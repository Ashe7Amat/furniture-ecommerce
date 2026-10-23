// Reservas por fechas, bloque R-b: lo que escribe en la tabla `reservas` (docs/reservas-diseno.md,
// secciones 4 y 6.3). La reserva provisional se crea antes de pagar, así que dos clientes no pueden
// pagar las mismas fechas: el segundo recibe un 409 antes de llegar a Stripe.
//
// Lo que impide los solapes no es este código sino la base de datos: la restricción de exclusión
// reservas_sin_solape (23P01) y el índice de una sola provisional por cliente (23505). Aquí solo se
// traducen esos errores y se ordenan los pasos para que ninguna carrera deje un cobro sin reserva.
const supabase = require('../data/supabase');
const email = require('./email');
const { registrarPedido } = require('./pagos');
const { enviarTodos } = require('./enviarTodos');
const {
  ErrorValidacion,
  ErrorConflicto,
  ErrorReintentable,
  ErrorNoEncontrado
} = require('./errores');
const { REGLAS_ALQUILER } = require('./reglasAlquiler');
const { calcularPrecioReserva } = require('./precioReserva');
const { hoyEnMadrid, fechaLegible } = require('./fechasMadrid');
const {
  CODIGO_EXCLUSION,
  CODIGO_UNICIDAD,
  liberarProvisionalesCaducadas,
  escribirEnCalendario
} = require('./calendarioReservas');

const MS_MINUTO = 60 * 1000;

// Stripe cuenta la duración mínima de la sesión (30 min) desde que recibe la petición, no desde que
// se calcula aquí: un minuto de más para que no la rechace por llegar unos milisegundos tarde.
const MARGEN_STRIPE_MIN = 1;

const MENSAJE_FECHAS_OCUPADAS = 'Esas fechas se acaban de reservar. Elige otras.';
const MENSAJE_OTRA_RESERVA =
  'Tienes otra reserva a medio pagar. Vuelve a intentarlo en un momento.';
// El código del 409 anterior: las fechas no se han ocupado, así que la web las conserva.
const CODIGO_OTRA_RESERVA = 'otra_reserva_en_curso';
const MENSAJE_RESERVA_NO_ENCONTRADA = 'No encontramos esa reserva.';
const MENSAJE_PLAZO_DE_PAGO_TERMINADO =
  'El plazo para pagar esta reserva ha terminado. Elige las fechas otra vez.';
const MENSAJE_PAGO_YA_RECIBIDO = 'Ya hemos recibido tu pago. Estamos confirmando tu reserva.';
const MENSAJE_REINTENTAR_PAGO =
  'No hemos podido preparar el pago. Inténtalo de nuevo en un momento.';

// Interruptor del servidor (9.1). Apagado, que es lo que pasa si no se pone, nadie puede crear una
// reserva aunque el código esté desplegado. Solo "true" lo enciende, como MOSTRAR_PRECIOS.
const reservasActivas = () => process.env.RESERVAS_ACTIVAS === 'true';

const cancelacion = (motivo, ahora) => ({
  estado: 'cancelada',
  cancelada_en: ahora.toISOString(),
  cancelada_por: 'sistema',
  motivo_cancelacion: motivo
});

// Caduca en Stripe la sesión de una reserva provisional anterior. Devuelve 'caducada' si la caduca
// ahora, 'ya_caducada' si ya lo estaba y 'pagada' si se completó (se está confirmando, no se toca).
// Stripe solo deja caducar sesiones abiertas y su error no dice por qué falla, así que se le pregunta
// cómo está la sesión (6.3, paso 4). Si tampoco se puede saber eso, no se toca nada y se pide
// reintentar.
const caducarSesion = async (stripe, sessionId) => {
  try {
    await stripe.checkout.sessions.expire(sessionId);
    return 'caducada';
  } catch (errorCaducar) {
    let sesion;
    try {
      sesion = await stripe.checkout.sessions.retrieve(sessionId);
    } catch (errorConsulta) {
      console.error(
        `No se pudo caducar ni consultar la sesión de pago ${sessionId}:`,
        errorConsulta.message
      );
      throw new ErrorReintentable(MENSAJE_REINTENTAR_PAGO);
    }
    if (sesion.status === 'expired') return 'ya_caducada';
    if (sesion.status === 'complete') return 'pagada';
    console.error(
      `No se pudo caducar la sesión de pago ${sessionId} (${sesion.status}):`,
      errorCaducar.message
    );
    throw new ErrorReintentable(MENSAJE_REINTENTAR_PAGO);
  }
};

// 6.3, paso 4: si el cliente ya tenía una reserva a medio pagar (cambió de fechas, o tiene dos
// pestañas), se libera antes de crear la nueva. Si aún no tenía sesión, es que otra petición suya
// está entre los pasos 6 y 8: se cancela, y esa petición lo verá al guardar su sesión (paso 8).
const liberarProvisionalesDelCliente = async (clienteId, stripe, ahora) => {
  const { data, error } = await supabase
    .from('reservas')
    .select('id, stripe_session_id')
    .eq('cliente_id', clienteId)
    .eq('estado', 'pendiente');
  if (error) throw error;

  for (const anterior of data) {
    const resultado = anterior.stripe_session_id
      ? await caducarSesion(stripe, anterior.stripe_session_id)
      : 'sin_sesion';
    if (resultado === 'pagada') continue;
    const cambios =
      resultado === 'ya_caducada'
        ? { estado: 'expirada' }
        : cancelacion('El cliente empezó otra reserva.', ahora);
    const { error: errorLiberar } = await supabase
      .from('reservas')
      .update(cambios)
      .eq('id', anterior.id)
      .eq('estado', 'pendiente');
    if (errorLiberar) throw errorLiberar;
  }
};

// Si el cliente tiene una provisional viva. Después del paso 4 solo puede ser de otra petición suya
// que va a la vez.
const tieneOtraProvisional = async (clienteId, ahora) => {
  const { data, error } = await supabase
    .from('reservas')
    .select('id')
    .eq('cliente_id', clienteId)
    .eq('estado', 'pendiente')
    .gte('expira_en', ahora.toISOString())
    .limit(1);
  if (error) throw error;
  return data.length > 0;
};

const euros = (centimos) => centimos / 100;
const eurosLegibles = (centimos) => `${(centimos / 100).toFixed(2).replace('.', ',')} €`;
const dias = (n) => (n === 1 ? '1 día' : `${n} días`);
const importeDe = (presupuesto, concepto) =>
  presupuesto.lineas.find((l) => l.concepto === concepto).importe_centimos;

// La fila de la reserva provisional. Lleva todo lo que se ha aceptado (precio, reglas, datos de
// contacto): es la fuente de verdad al confirmar el pago, y nada de eso viaja en la metadata de
// Stripe (T12b).
const filaProvisional = ({ mueble, cuenta, contacto, presupuesto, expiraEn, ahora, reglas }) => {
  const aDomicilio =
    presupuesto.entrega.modo === 'domicilio' || presupuesto.recogida.modo === 'domicilio';
  const direccion = contacto.direccion || null;
  return {
    mueble_id: mueble.id,
    tipo: 'alquiler',
    estado: 'pendiente',
    fecha_inicio: presupuesto.fecha_inicio,
    fecha_fin: presupuesto.fecha_fin,
    hora_entrega: presupuesto.hora_entrega,
    hora_recogida: presupuesto.hora_recogida,
    fin_ocupacion: presupuesto.fecha_fin,
    dias_margen: reglas.diasMargen,
    cliente_id: cuenta.id,
    expira_en: expiraEn.toISOString(),
    modo_entrega: presupuesto.entrega.modo,
    modo_devolucion: presupuesto.recogida.modo,
    direccion_entrega: aDomicilio ? direccion : null,
    datos_contacto: {
      nombre: contacto.nombre,
      email: cuenta.email,
      telefono: contacto.telefono,
      direccion,
      notas: contacto.notas || null
    },
    historial: [
      {
        fecha: ahora.toISOString(),
        tipo: 'creada',
        detalle: 'Reserva provisional desde la web, a falta del pago.',
        por: 'cliente'
      }
    ],
    importe_alquiler: euros(importeDe(presupuesto, 'alquiler')),
    importe_envio: euros(importeDe(presupuesto, 'entrega') + importeDe(presupuesto, 'recogida')),
    importe_total: euros(presupuesto.importe_total_centimos),
    precio_desglose: presupuesto,
    condiciones: {
      aceptadas_en: ahora.toISOString(),
      version_reglas: reglas.version,
      dias_margen: reglas.diasMargen,
      politica_cancelacion: reglas.politicaCancelacion
    },
    origen: 'web'
  };
};

// Las líneas de la página de pago (5.4). Stripe no admite importes negativos, así que el alquiler va
// ya con el descuento aplicado y la cuenta se explica en la descripción. Entrega y recogida solo
// salen si cuestan algo.
const lineasDeStripe = (mueble, p) => {
  const linea = (nombre, centimos, descripcion) => ({
    price_data: {
      currency: 'eur',
      product_data: { name: nombre, ...(descripcion && { description: descripcion }) },
      unit_amount: centimos
    },
    quantity: 1
  });
  const descuento =
    p.descuento_centimos > 0
      ? ` − ${p.tramo.porcentaje} % por ${dias(p.tramo.desde_dias)} o más`
      : '';
  const lineas = [
    linea(
      `Alquiler de ${mueble.nombre}`,
      importeDe(p, 'alquiler'),
      `Entrega el ${fechaLegible(p.fecha_inicio)} a las ${p.hora_entrega} y recogida el ` +
        `${fechaLegible(p.fecha_fin)} a las ${p.hora_recogida}: ` +
        `${dias(p.dias)} × ${eurosLegibles(p.precio_dia_centimos)}${descuento}`
    )
  ];
  const trayectos = [
    ['Entrega', p.entrega],
    ['Recogida', p.recogida]
  ];
  for (const [nombre, trayecto] of trayectos) {
    if (trayecto.importe_centimos > 0) {
      const donde = trayecto.modo === 'domicilio' ? 'a domicilio' : 'en la tienda';
      lineas.push(linea(`${nombre} ${donde}`, trayecto.importe_centimos));
    }
  }
  return lineas;
};

// POST /api/reservas/sesion-pago (6.3): crea la reserva provisional y su sesión de pago, y devuelve
// la URL de Stripe. `mueble` es la pieza ya leída; `datos`, el cuerpo ya validado
// (schemas/reservas.js). Lanza ErrorConflicto (409), ErrorValidacion (400) o ErrorReintentable (503)
// con un mensaje que se puede enseñar; cualquier otro error es interno.
const iniciarPagoDeReserva = async ({
  stripe,
  cuenta,
  mueble,
  datos,
  ahora = new Date(),
  reglas = REGLAS_ALQUILER
}) => {
  // Pasos 1 y 3: la pieza y el precio, siempre calculado aquí.
  if (mueble.estado === 'vendido') throw new ErrorValidacion('Esta pieza no se puede alquilar.');
  const presupuesto = calcularPrecioReserva({
    precioDia: mueble.precio_alquiler_dia,
    fechaInicio: datos.fecha_inicio,
    horaEntrega: datos.hora_entrega,
    fechaFin: datos.fecha_fin,
    horaRecogida: datos.hora_recogida,
    entrega: datos.entrega,
    recogida: datos.recogida,
    hoy: hoyEnMadrid(ahora),
    reglas
  });

  // Paso 4.
  await liberarProvisionalesDelCliente(cuenta.id, stripe, ahora);

  // Pasos 5 y 6: la reserva provisional dura lo que la sesión de pago, más la gracia del webhook.
  const finSesion = new Date(
    ahora.getTime() + (reglas.duracionSesionMin + MARGEN_STRIPE_MIN) * MS_MINUTO
  );
  const expiraEn = new Date(finSesion.getTime() + reglas.graciaWebhookMin * MS_MINUTO);
  const fila = filaProvisional({
    mueble,
    cuenta,
    contacto: datos.contacto,
    presupuesto,
    expiraEn,
    ahora,
    reglas
  });
  const { data: reserva, error } = await escribirEnCalendario(mueble.id, () =>
    supabase.from('reservas').insert(fila).select('id').single()
  );
  if (error) {
    // Con las mismas fechas, la provisional que crea otra petición suya a la vez (doble clic, otra
    // pestaña) da 23P01 antes que el índice de una por cliente: no es que se las haya quitado otra
    // persona, así que recibe el mismo "vuelve a intentarlo" (4.4).
    if (error.code === CODIGO_EXCLUSION) {
      const suya = await tieneOtraProvisional(cuenta.id, ahora);
      throw suya
        ? new ErrorConflicto(MENSAJE_OTRA_RESERVA, CODIGO_OTRA_RESERVA)
        : new ErrorConflicto(MENSAJE_FECHAS_OCUPADAS);
    }
    // El índice de una sola provisional por cliente: otra pestaña suya ha creado la suya a la vez.
    if (error.code === CODIGO_UNICIDAD)
      throw new ErrorConflicto(MENSAJE_OTRA_RESERVA, CODIGO_OTRA_RESERVA);
    throw error;
  }

  // Paso 7. Si Stripe falla, la reserva se cancela para no tener las fechas ocupadas (paso 9).
  let session;
  try {
    session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: lineasDeStripe(mueble, presupuesto),
        customer_email: cuenta.email,
        client_reference_id: reserva.id,
        metadata: { tipo: 'reserva', reserva_id: reserva.id },
        payment_intent_data: { metadata: { tipo: 'reserva', reserva_id: reserva.id } },
        submit_type: 'book',
        expires_at: Math.floor(finSesion.getTime() / 1000),
        success_url: `${process.env.CLIENT_URL}/checkout/exito?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.CLIENT_URL}/producto/${mueble.id}`
      },
      { idempotencyKey: `reserva-${reserva.id}` }
    );
  } catch (errorStripe) {
    const { error: errorCancelar } = await supabase
      .from('reservas')
      .update(cancelacion('No se pudo crear la sesión de pago.', ahora))
      .eq('id', reserva.id)
      .eq('estado', 'pendiente');
    if (errorCancelar) {
      console.error(
        `No se pudo cancelar la reserva provisional ${reserva.id}; caducará sola:`,
        errorCancelar.message
      );
    }
    throw errorStripe;
  }

  // Paso 8: si otra petición del mismo cliente la canceló mientras tanto, esta sesión sobra.
  const { data: guardadas, error: errorGuardar } = await supabase
    .from('reservas')
    .update({ stripe_session_id: session.id })
    .eq('id', reserva.id)
    .eq('estado', 'pendiente')
    .select('id');
  if (errorGuardar || guardadas.length === 0) {
    try {
      await stripe.checkout.sessions.expire(session.id);
    } catch (errorCaducar) {
      console.error(`No se pudo caducar la sesión de pago ${session.id}:`, errorCaducar.message);
    }
    if (errorGuardar) throw errorGuardar;
    throw new ErrorConflicto(MENSAJE_OTRA_RESERVA, CODIGO_OTRA_RESERVA);
  }

  return { url: session.url, reservaId: reserva.id };
};

// Hasta cuándo se puede pagar una reserva provisional: lo que dura su sesión de Stripe. `expira_en` es ese
// instante más la gracia del webhook (6.3, paso 5), que el cliente no puede usar para pagar.
const pagoHastaDe = (filaReserva, reglas = REGLAS_ALQUILER) =>
  new Date(
    new Date(filaReserva.expira_en).getTime() - reglas.graciaWebhookMin * MS_MINUTO
  ).toISOString();

// POST /api/reservas/:id/retomar-pago: la página de pago de una reserva provisional que sigue abierta, para
// el cliente que la cerró sin pagar (o volvió atrás). No crea nada: pide a Stripe la sesión que ya tiene.
// Lanza ErrorNoEncontrado (404: no es suya o no existe), ErrorConflicto (409: ya no se puede pagar) o
// ErrorReintentable (503); los mensajes se pueden enseñar.
const retomarPagoDeReserva = async ({ stripe, cuenta, id, ahora = new Date() }) => {
  const { data: fila, error } = await supabase
    .from('reservas')
    .select('id, cliente_id, tipo, estado, expira_en, stripe_session_id')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  // La de otro cliente, igual que si no existiera.
  if (!fila || fila.cliente_id !== cuenta.id || fila.tipo !== 'alquiler') {
    throw new ErrorNoEncontrado(MENSAJE_RESERVA_NO_ENCONTRADA);
  }
  if (fila.estado !== 'pendiente' || !fila.stripe_session_id || new Date(fila.expira_en) <= ahora) {
    throw new ErrorConflicto(MENSAJE_PLAZO_DE_PAGO_TERMINADO);
  }

  let sesion;
  try {
    sesion = await stripe.checkout.sessions.retrieve(fila.stripe_session_id);
  } catch (errorConsulta) {
    console.error(
      `No se pudo consultar la sesión de pago ${fila.stripe_session_id}:`,
      errorConsulta.message
    );
    throw new ErrorReintentable(MENSAJE_REINTENTAR_PAGO);
  }
  if (sesion.status === 'complete') throw new ErrorConflicto(MENSAJE_PAGO_YA_RECIBIDO);
  if (sesion.status !== 'open' || !sesion.url)
    throw new ErrorConflicto(MENSAJE_PLAZO_DE_PAGO_TERMINADO);
  return { url: sesion.url };
};

// ─── Confirmación del pago (6.4) ─────────────────────────────────────────────────────────────────

const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ESTADOS_YA_CONFIRMADA = ['confirmada', 'en_curso', 'devuelta'];
const COLUMNAS_RESERVA_PAGADA =
  'id, mueble_id, estado, cliente_id, stripe_session_id, fecha_inicio, hora_entrega, fecha_fin, ' +
  'hora_recogida, modo_entrega, modo_devolucion, direccion_entrega, datos_contacto, ' +
  'importe_alquiler, precio_desglose';

const leerReserva = async (id, columnas) => {
  const { data, error } = await supabase
    .from('reservas')
    .select(columnas)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
};

// El id del pago de una sesión (llega como texto, o como objeto si alguien expande la sesión).
const idPago = (session) =>
  typeof session.payment_intent === 'string'
    ? session.payment_intent
    : (session.payment_intent?.id ?? null);

// Pone la hora en `columna` solo si estaba vacía (y la reserva cumple `filtros`). Devuelve true para
// la única llamada que lo consigue, que es la que envía los emails: así ni el webhook y la página de
// éxito a la vez, ni las recargas de la página, los repiten.
const reclamarMarca = async (reservaId, columna, filtros, ahora) => {
  let consulta = supabase
    .from('reservas')
    .update({ [columna]: ahora.toISOString() })
    .eq('id', reservaId)
    .is(columna, null);
  for (const [campo, valor] of Object.entries(filtros)) consulta = consulta.eq(campo, valor);
  const { data, error } = await consulta.select('id');
  if (error) throw error;
  return data.length > 0;
};

const lineaTrayecto = (fecha, hora, modo) =>
  `${fechaLegible(fecha)} a las ${hora}, ${modo === 'tienda' ? 'en la tienda' : 'a domicilio'}`;

// Lo que el administrador necesita para preparar la entrega (o el reembolso).
const detallesParaAdmin = ({ reserva, pieza, contacto, total, pedidoId, sessionId }) => [
  `Pieza: ${pieza} (${reserva.mueble_id})`,
  `Entrega: ${lineaTrayecto(reserva.fecha_inicio, reserva.hora_entrega, reserva.modo_entrega)}`,
  `Recogida: ${lineaTrayecto(reserva.fecha_fin, reserva.hora_recogida, reserva.modo_devolucion)}`,
  `Cliente: ${contacto.nombre || 'sin nombre'} <${contacto.email || 'sin email'}> · ${contacto.telefono || 'sin teléfono'}`,
  `Dirección: ${reserva.direccion_entrega || 'ninguna (todo en la tienda)'}`,
  `Notas: ${contacto.notas || 'ninguna'}`,
  `Importe cobrado: ${total.toFixed(2)} €`,
  `Reserva ${reserva.id} · pedido ${pedidoId} · sesión de Stripe ${sessionId}`
];

// Da por bueno el pago de la sesión de una reserva. La usan el webhook y la página de éxito
// (confirmar-sesion), que pueden llegar a la vez: es idempotente. Devuelve
//   { estado: 'confirmada' | 'conflicto' | 'cancelada' | 'ignorada', total, reservaId, pedidoId }
// ('cancelada': ya se había confirmado con este pago y luego se canceló desde el panel).
// Lanza si falla la base de datos (el webhook responde 500 y Stripe reintenta).
//
// No sigue el orden de procesarSesionPagada (pagos.js), que corta en cuanto el pedido ya existe:
// aquí eso dejaría una reserva pagada y sin confirmar si el proceso muere entre registrar el pedido
// y confirmar la reserva. Cada paso se puede repetir, y un reintento completa lo que faltara.
const procesarReservaPagada = async (session, ahora = new Date()) => {
  const total = (session.amount_total || 0) / 100;
  const reservaId = session.metadata?.reserva_id;

  // 1. Por la metadata y no por stripe_session_id, que puede no haberse guardado (paso 8 del 6.3).
  const reserva = FORMATO_UUID.test(reservaId ?? '')
    ? await leerReserva(reservaId, COLUMNAS_RESERVA_PAGADA)
    : null;
  if (!reserva) {
    console.error(`Pago de la sesión ${session.id} para una reserva que no existe: ${reservaId}`);
    await enviarTodos([
      () =>
        email.enviarAlertaAdmin({
          asunto: 'Pago cobrado de una reserva que no existe',
          detalles: [
            `Sesión de Stripe: ${session.id}`,
            `Reserva indicada en el pago: ${reservaId || 'ninguna'}`,
            `Importe cobrado: ${total.toFixed(2)} €`,
            'Búscalo en el Dashboard de Stripe y, si procede, reembolsa el pago.'
          ]
        })
    ]);
    return { estado: 'ignorada', total, reservaId: null, pedidoId: null };
  }

  // 2 y 3. Confirmar, después de limpiar las caducadas de la pieza (4.6). Guarda también la sesión,
  // por si el paso 8 del 6.3 no llegó a hacerlo. Una reserva expirada todavía se puede confirmar si
  // sus fechas siguen libres; si no, la restricción lo impide (23P01).
  const { data: confirmadas, error } = await escribirEnCalendario(reserva.mueble_id, () =>
    supabase
      .from('reservas')
      .update({
        estado: 'confirmada',
        stripe_session_id: session.id,
        stripe_payment_intent_id: idPago(session),
        expira_en: null
      })
      .eq('id', reserva.id)
      .in('estado', ['pendiente', 'expirada'])
      // Una reserva que ya quedó en conflicto no se confirma aunque sus fechas se hayan liberado
      // (se reembolsó el pago, como decía el aviso): el cliente ya no la tiene (19 oct).
      .is('conflicto_en', null)
      .select('id')
  );
  let conflicto;
  let cancelada = false;
  if (error) {
    if (error.code !== CODIGO_EXCLUSION) throw error;
    conflicto = true;
  } else if (confirmadas.length > 0) {
    conflicto = false;
  } else {
    // Ya no estaba pendiente ni expirada. O ya se confirmó con este mismo pago (otra llamada, que
    // pudo morir antes de acabar los pasos 4 a 6, y se siguen; o hace tiempo, y después se entregó o
    // se canceló desde el panel), o se canceló sin pagar porque el cliente empezó otra reserva y
    // este pago llegó a pesar de todo: solo eso es un conflicto (19 oct). La sesión cuenta para
    // las que se confirmaron antes de guardar también el pago.
    const actual = await leerReserva(
      reserva.id,
      'estado, stripe_session_id, stripe_payment_intent_id'
    );
    const pago = idPago(session);
    const conEstePago =
      (pago !== null && actual.stripe_payment_intent_id === pago) ||
      (ESTADOS_YA_CONFIRMADA.includes(actual.estado) && actual.stripe_session_id === session.id);
    conflicto = !conEstePago;
    cancelada = conEstePago && actual.estado === 'cancelada';
  }

  // 4. El pedido, pase lo que pase: el dinero está cobrado. El id sale de la sesión, así que
  // repetirlo no crea otro.
  const { data: mueble, error: errorMueble } = await supabase
    .from('muebles')
    .select('nombre')
    .eq('id', reserva.mueble_id)
    .maybeSingle();
  if (errorMueble) throw errorMueble;
  const pieza = mueble ? mueble.nombre : '(pieza eliminada del catálogo)';
  const contacto = reserva.datos_contacto || {};
  const { id: pedidoId } = await registrarPedido({
    lineas: [
      {
        productId: reserva.mueble_id,
        nombre: pieza,
        modalidad: 'alquiler',
        cantidad: 1,
        precio: Number(reserva.importe_alquiler),
        fecha_inicio: reserva.fecha_inicio,
        hora_entrega: reserva.hora_entrega,
        fecha_fin: reserva.fecha_fin,
        hora_recogida: reserva.hora_recogida,
        dias: reserva.precio_desglose?.dias ?? null,
        reserva_id: reserva.id
      }
    ],
    cliente: {
      nombre: contacto.nombre,
      email: contacto.email,
      telefono: contacto.telefono,
      direccion: contacto.direccion,
      notas: contacto.notas,
      metodoPago: 'Tarjeta (Stripe)'
    },
    clienteId: reserva.cliente_id,
    total,
    sessionId: session.id,
    metodoEntrega: reserva.modo_entrega === 'tienda' ? 'recogida' : 'domicilio'
  });

  // 5. Enlazar la reserva con su pedido.
  const { error: errorEnlace } = await supabase
    .from('reservas')
    .update({ pedido_id: pedidoId })
    .eq('id', reserva.id)
    .is('pedido_id', null);
  if (errorEnlace) throw errorEnlace;

  // 6. Los emails, cada juego con su marca.
  const detalles = detallesParaAdmin({
    reserva,
    pieza,
    contacto,
    total,
    pedidoId,
    sessionId: session.id
  });
  const paraElCliente = {
    email: contacto.email,
    nombre: contacto.nombre,
    reserva: {
      pedidoId,
      pieza,
      fechaInicio: reserva.fecha_inicio,
      horaEntrega: reserva.hora_entrega,
      fechaFin: reserva.fecha_fin,
      horaRecogida: reserva.hora_recogida,
      dias: reserva.precio_desglose?.dias,
      modoEntrega: reserva.modo_entrega,
      modoRecogida: reserva.modo_devolucion,
      direccion: reserva.direccion_entrega,
      total
    }
  };
  if (cancelada) {
    // Ya pagada, confirmada y cancelada después desde el panel: nada que avisar ni que reembolsar
    // aquí (el reembolso, si lo hay, lo decidió el administrador al cancelar).
  } else if (!conflicto) {
    if (
      await reclamarMarca(reserva.id, 'confirmacion_enviada_en', { estado: 'confirmada' }, ahora)
    ) {
      await enviarTodos([
        () => email.enviarConfirmacionReserva(paraElCliente),
        () => email.enviarAlertaAdmin({ asunto: 'Nueva reserva de alquiler', detalles })
      ]);
    }
  } else if (await reclamarMarca(reserva.id, 'conflicto_en', {}, ahora)) {
    console.error(
      `[ALERTA] Reserva ${reserva.id} pagada (sesión ${session.id}) sin poder confirmarse: ` +
        'las fechas ya no estaban libres. Hay que reembolsar el pago.'
    );
    await enviarTodos([
      () =>
        email.enviarAlertaAdmin({
          asunto: 'Reserva pagada que no se ha podido confirmar',
          detalles: [
            ...detalles,
            'Las fechas ya no estaban libres cuando llegó el pago. Reembolsa el pago desde el ' +
              'Dashboard de Stripe: al cliente ya se le ha dicho que se le devolverá.'
          ]
        }),
      () => email.enviarConflictoReserva(paraElCliente)
    ]);
  }

  const estado = cancelada ? 'cancelada' : conflicto ? 'conflicto' : 'confirmada';
  return { estado, total, reservaId: reserva.id, pedidoId };
};

// Webhook checkout.session.expired (6.4): libera las fechas en cuanto Stripe da la sesión por
// caducada, sin esperar a la limpieza común. Una sesión caducada ya no se puede pagar. Si el aviso
// no llega, no pasa nada: la limpieza de antes de cada escritura (4.6) hace lo mismo más tarde.
const liberarReservaDeSesionCaducada = async (session) => {
  const reservaId = session.metadata?.reserva_id;
  if (!FORMATO_UUID.test(reservaId ?? '')) return { estado: 'ignorada' };
  const { data, error } = await supabase
    .from('reservas')
    .update({ estado: 'expirada' })
    .eq('id', reservaId)
    .eq('estado', 'pendiente')
    .select('id');
  if (error) throw error;
  return { estado: data.length > 0 ? 'expirada' : 'sin_cambios' };
};

module.exports = {
  reservasActivas,
  procesarReservaPagada,
  liberarReservaDeSesionCaducada,
  liberarProvisionalesCaducadas,
  escribirEnCalendario,
  iniciarPagoDeReserva,
  retomarPagoDeReserva,
  pagoHastaDe,
  CODIGO_EXCLUSION,
  CODIGO_OTRA_RESERVA,
  MENSAJE_FECHAS_OCUPADAS,
  MENSAJE_OTRA_RESERVA,
  MENSAJE_REINTENTAR_PAGO,
  MENSAJE_RESERVA_NO_ENCONTRADA,
  MENSAJE_PLAZO_DE_PAGO_TERMINADO,
  MENSAJE_PAGO_YA_RECIBIDO
};
