// Panel de reservas (docs/reservas-diseno.md, 8.1, 8.3, 8.4, 8.6 y 8.7; bloque R-d, commit 14): la
// lista por vistas, lo que el administrador hace con cada reserva (entregar, recoger, ampliar,
// cancelar con reembolso, levantar un bloqueo) y lo que da de alta sin pago web (bloqueos, alquileres
// pactados fuera de la web y ventas).
//
// Como en el resto de las reservas, lo que impide los solapes es la base de datos (23P01). Aquí se
// limpian las provisionales caducadas antes de escribir (escribirEnCalendario, 4.6), cada reserva se
// cambia solo si sigue como se leyó (actualizarReserva) y, si algo choca, se busca con qué para
// decírselo al administrador.
//
// Ajustes del 19 oct: recoger con otra fecha y con el margen recortado, entregar antes de tiempo
// ocupa desde hoy, el tope de Stripe al cancelar, los reembolsos que Stripe rechaza o que se
// hicieron fuera del panel y «Dar por reembolsado».
const supabase = require('../data/supabase');
const stripeUtil = require('./stripe');
const email = require('./email');
const { ErrorValidacion, ErrorConflicto, ErrorNoEncontrado } = require('./errores');
const { ESTADOS_QUE_OCUPAN, ocupaElCalendario } = require('./disponibilidad');
const { REGLAS_ALQUILER } = require('./reglasAlquiler');
const { idPedidoDeSesion } = require('./pagos');
const {
  hoyEnMadrid,
  sumarDias,
  diasEntre,
  fechaLegible,
  instanteEnMadrid
} = require('./fechasMadrid');
const {
  CODIGO_CLAVE_AJENA,
  chocaEnCalendario,
  escribirEnCalendario,
  actualizarReserva,
  referenciaDeReserva,
  horaCorta
} = require('./calendarioReservas');

// Lo que lee el panel de cada reserva, sin las cuatro columnas que actualizarReserva añade siempre
// (id, mueble_id, historial y updated_at). Las listas las piden aparte.
const COLUMNAS_PANEL =
  'pedido_id, tipo, estado, origen, fecha_inicio, hora_entrega, fecha_fin, hora_recogida, ' +
  'fin_ocupacion, dias_margen, expira_en, modo_entrega, modo_devolucion, direccion_entrega, ' +
  'datos_contacto, conflicto_en, importe_total, stripe_session_id, stripe_payment_intent_id, ' +
  'reembolso_solicitado_en, reembolso_importe, stripe_refund_id, motivo, motivo_cancelacion, ' +
  'entregada_en, devuelta_en, created_at';
const COLUMNAS_LISTA = `id, mueble_id, ${COLUMNAS_PANEL}, historial`;

// "Todas": las 200 más recientes. El resto de vistas son listas de trabajo, cortas por naturaleza.
const MAX_TODAS = 200;
// Una búsqueda mira las 1000 reservas más recientes (también es el tope de filas de PostgREST en
// Supabase) y enseña como mucho MAX_TODAS de las que coinciden.
const MAX_BUSQUEDA = 1000;

// Una venta ya hecha se puede registrar con fecha de hasta 30 días atrás: basta para apuntar una
// venta de tienda que se olvidó, y frena un año mal escrito (2006 por 2026), que dejaría una venta
// sin fin escondida en el pasado. Las ventas más antiguas entran con la migración de datos (9.2).
const DIAS_ATRAS_VENTA = 30;

// La marca del reembolso de una cancelación en Stripe (8.6): en la metadata, para encontrarlo al
// reintentar, y en la clave de idempotencia. Sin datos personales.
const TIPO_REEMBOLSO = 'reembolso_cancelacion';
const claveDeReembolso = (id) => `reserva_${id}_${TIPO_REEMBOLSO}`;
// Un reembolso que Stripe da por fallido o anulado no ha devuelto nada: no cuenta como hecho.
const ESTADOS_SIN_EFECTO = ['failed', 'canceled'];
const cuentaComoHecho = (refund) => !ESTADOS_SIN_EFECTO.includes(refund.status);
// La línea del historial de «Dar por reembolsado» (8.6, 19 oct): cierra el "a medias" sin el id.
const TIPO_DADO_POR_HECHO = 'reembolso_dado_por_hecho';
// Cada vez que Stripe rechaza crear el reembolso (sin que quede un reembolso fallido que contar): con la
// misma clave de idempotencia devolvería el mismo error durante 24 horas, así que el siguiente intento
// cuenta estos para usar otra.
const TIPO_REEMBOLSO_RECHAZADO = 'reembolso_rechazado';
const LINEA_DADO_POR_HECHO =
  'Reembolso dado por hecho desde el panel: se hizo fuera, en el Dashboard de Stripe.';
const LINEA_DADO_POR_HECHO_SIN_STRIPE =
  'Reembolso dado por hecho desde el panel sin que conste en Stripe: se hizo por otro medio.';
// Si la recogida se apunta otro día, a mediodía de ese día en Madrid (3.6).
const HORA_RECOGIDA_OTRO_DIA = '12:00';

const MENSAJE_RESERVA_NO_ENCONTRADA = 'Reserva no encontrada.';
const MENSAJE_PIEZA_NO_ENCONTRADA = 'Mueble no encontrado.';
const MENSAJE_REEMBOLSO_EN_CURSO = 'Ya hay un reembolso en curso o hecho para esta reserva.';
const MENSAJE_REEMBOLSO_A_MEDIAS =
  'La reserva está cancelada, pero el reembolso no se ha podido hacer. Usa «Reintentar reembolso».';
const MENSAJE_REINTENTO_FALLIDO =
  'El reembolso todavía no se ha podido hacer. Vuelve a intentarlo en un momento.';
const MENSAJE_REEMBOLSO_RECHAZADO =
  'Stripe no ha aceptado el reembolso. Revísalo en el Dashboard de Stripe; si lo devuelves allí, ' +
  'usa «Dar por reembolsado».';
const MENSAJE_REEMBOLSO_SIN_GUARDAR =
  'El reembolso ya está hecho en Stripe, pero no se ha podido guardar. Pulsa «Reintentar ' +
  'reembolso» para guardarlo; no lo repitas desde el Dashboard.';
const MENSAJE_SIN_REEMBOLSO_A_MEDIAS = 'Esta reserva no tiene ningún reembolso a medias.';
const MENSAJE_ACCION_NO_EXISTE = 'Esa acción no existe.';
// Un 23P01 cuya causa ya no está cuando se busca (se canceló o se movió entre medias).
const MENSAJE_CHOQUE_DESAPARECIDO =
  'Esas fechas chocaban con otra reserva de la pieza que acaba de cambiar. Vuelve a intentarlo.';

const dias = (n) => (n === 1 ? '1 día' : `${n} días`);
const euros = (centimos) => centimos / 100;
const centimosDe = (importe) => Math.round(Number(importe) * 100);
const eurosLegibles = (centimos) => `${(centimos / 100).toFixed(2).replace('.', ',')} €`;
const porInicio = (a, b) => {
  if (a.fecha_inicio === b.fecha_inicio) return 0;
  return a.fecha_inicio < b.fecha_inicio ? -1 : 1;
};
const contextoDe = (ahora) => ({ ahora, hoy: hoyEnMadrid(ahora) });

// ─── Cómo se enseña cada reserva (8.7) ───────────────────────────────────────────────────────────

// "A medias" (8.6): se reclamó el reembolso (la marca está puesta) pero no consta hecho en Stripe, ni
// se ha dado por hecho desde el panel (19 oct).
const reembolsoDadoPorHecho = (fila) =>
  (fila.historial || []).some((linea) => linea.tipo === TIPO_DADO_POR_HECHO);
const reembolsoAMedias = (fila) =>
  Boolean(fila.reembolso_solicitado_en) && !fila.stripe_refund_id && !reembolsoDadoPorHecho(fila);

// La referencia que conoce el administrador: la del pedido si lo hay. La venta de una compra web no
// guarda pedido_id, pero su pedido sale de la sesión de Stripe (idPedidoDeSesion): se nombra como en
// sus emails (19 oct). La sesión no sale nunca del servidor.
const referenciaDelPanel = (fila) =>
  fila.tipo === 'venta' && !fila.pedido_id && fila.stripe_session_id
    ? referenciaDeReserva({ id: idPedidoDeSesion(fila.stripe_session_id) })
    : referenciaDeReserva(fila);

// Retrasada = entregada y con la recogida prevista ya pasada (3.4). Se calcula al leer (T5).
const estaRetrasada = (fila, hoy) =>
  fila.tipo === 'alquiler' && fila.estado === 'en_curso' && fila.fecha_fin < hoy;

// La solicitud de cancelación que el cliente envía desde "Mis reservas" queda en el historial.
const cancelacionSolicitada = (fila) =>
  (fila.historial || []).some((linea) => linea.tipo === 'cancelacion_solicitada');

// La etiqueta legible de cada combinación y las acciones que tienen sentido en ella (8.7). La fianza
// (fianza_estado) no cuenta todavía: llega con R-e. Las acciones que se ofrecen aquí son las únicas
// que el servidor acepta (comprobarAccion), así la lista y las acciones nunca se contradicen.
const situacion = (fila, { hoy, ahora }) => {
  // Pagada sin poder confirmarse (6.4): el reembolso se hace desde el Dashboard de Stripe, como dice
  // el email de aviso al administrador. Un conflicto_en puesto de más (antes del 19 oct, un webhook
  // repetido de una reserva cancelada) no esconde un reembolso a medias.
  if (fila.conflicto_en && !reembolsoAMedias(fila)) {
    return { etiqueta: 'No se pudo confirmar', acciones: [] };
  }
  switch (`${fila.tipo}:${fila.estado}`) {
    case 'alquiler:pendiente':
      return {
        etiqueta: new Date(fila.expira_en) < ahora ? 'No pagada' : 'Esperando pago',
        acciones: []
      };
    case 'alquiler:expirada':
      return { etiqueta: 'No pagada', acciones: [] };
    case 'alquiler:confirmada':
      return { etiqueta: 'Confirmada', acciones: ['entregar', 'cancelar'] };
    case 'alquiler:en_curso':
      return {
        etiqueta: estaRetrasada(fila, hoy) ? 'Retrasada' : 'Entregada',
        acciones: ['recoger', 'ampliar']
      };
    case 'alquiler:devuelta':
      return { etiqueta: 'Devuelta', acciones: [] };
    case 'alquiler:cancelada':
      return reembolsoAMedias(fila)
        ? {
            etiqueta: 'Cancelada · reembolso a medias',
            acciones: ['reintentar-reembolso', 'dar-por-reembolsado']
          }
        : { etiqueta: 'Cancelada', acciones: [] };
    case 'bloqueo:confirmada':
      return { etiqueta: 'Bloqueo', acciones: ['levantar-bloqueo'] };
    case 'bloqueo:cancelada':
      return { etiqueta: 'Bloqueo levantado', acciones: [] };
    case 'venta:confirmada':
      return { etiqueta: 'Venta', acciones: ['cancelar'] };
    case 'venta:cancelada':
      return { etiqueta: 'Venta cancelada', acciones: [] };
    default:
      // Combinaciones que las CHECK de R2 no permiten.
      return { etiqueta: fila.estado, acciones: [] };
  }
};

// Una reserva tal como la recibe el panel. `pieza` es { id, nombre, referencia }, o undefined si ya
// no está en el catálogo.
const presentar = (fila, pieza, contexto) => {
  const { etiqueta, acciones } = situacion(fila, contexto);
  const contacto = fila.datos_contacto;
  return {
    id: fila.id,
    referencia: referenciaDelPanel(fila),
    tipo: fila.tipo,
    estado: fila.estado,
    origen: fila.origen,
    etiqueta,
    retrasada: estaRetrasada(fila, contexto.hoy),
    en_conflicto: Boolean(fila.conflicto_en),
    cancelacion_solicitada: cancelacionSolicitada(fila),
    pieza: {
      id: fila.mueble_id,
      nombre: pieza ? pieza.nombre : '(pieza eliminada)',
      referencia: pieza?.referencia ?? null
    },
    fecha_inicio: fila.fecha_inicio,
    hora_entrega: horaCorta(fila.hora_entrega),
    fecha_fin: fila.fecha_fin ?? null,
    hora_recogida: horaCorta(fila.hora_recogida),
    fin_ocupacion: fila.fin_ocupacion ?? null,
    dias_margen: fila.dias_margen ?? 0,
    modo_entrega: fila.modo_entrega ?? null,
    modo_devolucion: fila.modo_devolucion ?? null,
    direccion_entrega: fila.direccion_entrega ?? null,
    contacto: contacto
      ? {
          nombre: contacto.nombre ?? null,
          email: contacto.email ?? null,
          telefono: contacto.telefono ?? null,
          direccion: contacto.direccion ?? null,
          notas: contacto.notas ?? null
        }
      : null,
    importe_total: fila.importe_total == null ? null : Number(fila.importe_total),
    pagado: Boolean(fila.stripe_payment_intent_id),
    reembolso: fila.reembolso_solicitado_en
      ? {
          solicitado_en: fila.reembolso_solicitado_en,
          importe: Number(fila.reembolso_importe),
          stripe_refund_id: fila.stripe_refund_id ?? null
        }
      : null,
    reembolso_a_medias: reembolsoAMedias(fila),
    motivo: fila.motivo ?? null,
    motivo_cancelacion: fila.motivo_cancelacion ?? null,
    entregada_en: fila.entregada_en ?? null,
    devuelta_en: fila.devuelta_en ?? null,
    created_at: fila.created_at ?? null,
    acciones
  };
};

// Las piezas de las reservas, con una segunda consulta (no con un embed de PostgREST).
const leerPiezas = async (ids) => {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return new Map();
  const { data, error } = await supabase
    .from('muebles')
    .select('id, nombre, referencia')
    .in('id', unicos);
  if (error) throw error;
  return new Map(data.map((pieza) => [pieza.id, pieza]));
};

const presentarFilas = async (filas, ahora = new Date()) => {
  const contexto = contextoDe(ahora);
  const piezas = await leerPiezas(filas.map((fila) => fila.mueble_id));
  return filas.map((fila) => presentar(fila, piezas.get(fila.mueble_id), contexto));
};

// ─── La lista (8.1) ──────────────────────────────────────────────────────────────────────────────

const leer = async (consulta) => {
  const { data, error } = await consulta;
  if (error) throw error;
  return data;
};

// Todas las reservas con las columnas de la lista, o las de una pieza.
const consultaBase = (muebleId) => {
  const consulta = supabase.from('reservas').select(COLUMNAS_LISTA);
  return muebleId ? consulta.eq('mueble_id', muebleId) : consulta;
};

// Las filas de cada vista. `hoy` es el de Madrid (3.6).
const leerVista = async (vista, { muebleId, hoy, ahora }) => {
  const base = () => consultaBase(muebleId);
  const manana = sumarDias(hoy, 1);
  switch (vista) {
    case 'proximas': {
      // Lo que ocupa el calendario de hoy en adelante, menos las ventas que empezaron antes de hoy:
      // cada compra de la web deja una venta sin fin, y llenarían la lista para siempre. Más los
      // alquileres entregados aunque su ocupación ya haya pasado: un retraso que nadie ha ampliado
      // todavía (8.5) sigue teniendo la pieza fuera.
      const [enCalendario, entregadas] = await Promise.all([
        leer(
          base()
            .in('estado', ESTADOS_QUE_OCUPAN)
            .overlaps('rango_ocupado', `[${hoy},)`)
            .or(`tipo.neq.venta,fecha_inicio.gte.${hoy}`)
            .order('fecha_inicio', { ascending: true })
        ),
        leer(base().eq('estado', 'en_curso').order('fecha_inicio', { ascending: true }))
      ]);
      // Una provisional caducada no ocupa nada, como en la ficha (ocupaElCalendario).
      const filas = enCalendario.filter((fila) => ocupaElCalendario(fila, ahora));
      const vistas = new Set(filas.map((fila) => fila.id));
      return [...filas, ...entregadas.filter((fila) => !vistas.has(fila.id))].sort(porInicio);
    }
    case 'entregas':
      // Hoy y mañana, y las que tenían que haberse entregado ya y siguen sin entregar.
      return leer(
        base()
          .eq('tipo', 'alquiler')
          .eq('estado', 'confirmada')
          .lte('fecha_inicio', manana)
          .order('fecha_inicio', { ascending: true })
      );
    case 'recogidas':
      // Por la recogida prevista (fin_ocupacion), que es la pactada salvo que se haya ampliado (8.5,
      // 19 oct): un retraso ampliado hasta mañana se recoge mañana.
      return leer(
        base()
          .eq('tipo', 'alquiler')
          .eq('estado', 'en_curso')
          .gte('fin_ocupacion', hoy)
          .lte('fin_ocupacion', manana)
          .order('fin_ocupacion', { ascending: true })
      );
    case 'retrasadas':
      return leer(
        base()
          .eq('tipo', 'alquiler')
          .eq('estado', 'en_curso')
          .lt('fecha_fin', hoy)
          .order('fecha_fin', { ascending: true })
      );
    case 'conflicto':
      return leer(
        base().not('conflicto_en', 'is', null).order('conflicto_en', { ascending: false })
      );
    case 'reembolsos': {
      // Sin las que se dieron por reembolsadas desde el panel (su línea del historial, 19 oct).
      const filas = await leer(
        base()
          .not('reembolso_solicitado_en', 'is', null)
          .is('stripe_refund_id', null)
          .order('reembolso_solicitado_en', { ascending: true })
      );
      return filas.filter(reembolsoAMedias);
    }
    case 'legacy':
      return leer(
        base()
          .eq('origen', 'legacy')
          .neq('estado', 'cancelada')
          .order('fecha_inicio', { ascending: true })
      );
    case 'todas':
      return leer(base().order('created_at', { ascending: false }).limit(MAX_TODAS));
    case 'busqueda':
      // No es una vista de la lista (el esquema no la deja pedir): es lo que lee listarReservas
      // cuando hay una búsqueda, para filtrarlo en memoria.
      return leer(base().order('created_at', { ascending: false }).limit(MAX_BUSQUEDA));
    default:
      throw new ErrorValidacion('Esa vista de la lista de reservas no existe.');
  }
};

// ─── La búsqueda (8.1: «tabla filtrable por estado y fechas») ────────────────────────────────────

// Sin mayúsculas ni acentos: «perez» encuentra a «Pérez».
const sinAcentos = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
// Un teléfono sin espacios, puntos, guiones ni paréntesis, y sin el «+» de delante.
const soloDigitos = (texto) => String(texto ?? '').replace(/[\s.\-()+]/g, '');
const palabrasDe = (q) => sinAcentos(q).split(/\s+/).filter(Boolean);

// Lo que se busca de cada reserva: su referencia, la pieza (nombre y referencia), el cliente (nombre,
// email, teléfono y dirección), la dirección de entrega y el motivo de un bloqueo o una venta. Las
// notas del cliente no.
const textoBuscable = (r) =>
  sinAcentos(
    [
      r.referencia,
      r.pieza.nombre,
      r.pieza.referencia,
      r.contacto?.nombre,
      r.contacto?.email,
      r.contacto?.telefono,
      r.contacto?.direccion,
      r.direccion_entrega,
      r.motivo
    ]
      .filter(Boolean)
      .join(' ')
  );

// Todas las palabras tienen que estar, en cualquier orden. Un número también vale si el teléfono se
// guardó con otros espacios: «600111222» encuentra «600 111 222».
const coincideConTexto = (r, palabras) => {
  const texto = textoBuscable(r);
  const telefono = soloDigitos(r.contacto?.telefono);
  return palabras.every((palabra) => {
    if (texto.includes(palabra)) return true;
    const digitos = soloDigitos(palabra);
    return digitos.length >= 3 && telefono.includes(digitos);
  });
};

// Entre `desde` y `hasta` (los dos incluidos, cualquiera puede faltar) la reserva tenía algo: un
// alquiler o un bloqueo, de su entrega a su recogida (la real si ya se devolvió, y la ampliada si
// se amplió); una venta, solo el día de la venta (no tiene fecha de fin).
const diaMayor = (a, b) => (b && b > a ? b : a);
const ultimoDia = (r) => {
  if (r.estado === 'devuelta' && r.fin_ocupacion) return r.fin_ocupacion;
  return diaMayor(r.fecha_fin ?? r.fecha_inicio, r.fin_ocupacion);
};
const coincideConFechas = (r, desde, hasta) =>
  (!desde || ultimoDia(r) >= desde) && (!hasta || r.fecha_inicio <= hasta);

// Una búsqueda mira las más recientes de todas las reservas (sea cual sea la vista) y enseña las que
// coinciden, también las canceladas y las devueltas, con su etiqueta. `limitada` avisa de que no se
// pudo mirar o enseñar todo: hay que afinar.
const buscarReservas = async ({ muebleId, q, desde, hasta, hoy, ahora }) => {
  const filas = await leerVista('busqueda', { muebleId, hoy, ahora });
  const palabras = palabrasDe(q);
  const coinciden = (await presentarFilas(filas, ahora)).filter(
    (r) => coincideConTexto(r, palabras) && coincideConFechas(r, desde, hasta)
  );
  return {
    hoy,
    reservas: coinciden.slice(0, MAX_TODAS),
    limitada: filas.length >= MAX_BUSQUEDA || coinciden.length > MAX_TODAS
  };
};

// GET /api/admin/reservas: { hoy, reservas }. Con `q`, `desde` o `hasta` es una búsqueda en todas las
// reservas, y la vista no cuenta.
const listarReservas = async ({
  vista = 'proximas',
  muebleId,
  q,
  desde,
  hasta,
  ahora = new Date()
}) => {
  const contexto = contextoDe(ahora);
  if (q || desde || hasta) return buscarReservas({ muebleId, q, desde, hasta, ...contexto });
  const filas = await leerVista(vista, { muebleId, ...contexto });
  return { hoy: contexto.hoy, reservas: await presentarFilas(filas, ahora) };
};

// GET /api/admin/reservas/resumen: lo que no puede esperar a que alguien abra la pestaña, para la
// insignia del menú del panel. Son las tres vistas de aviso, contadas con la misma consulta que las
// lista (así el número y la lista nunca se contradicen): las retrasadas, las pagadas que no se
// pudieron confirmar y los reembolsos a medias. `total` cuenta cada reserva una vez: una pagada sin
// confirmar y con el reembolso a medias está en dos vistas. Las entregas y recogidas de hoy y mañana
// son trabajo de cada día, no un aviso: no suman.
const VISTAS_DE_AVISO = ['retrasadas', 'conflicto', 'reembolsos'];
const resumenDeAvisos = async ({ ahora = new Date() } = {}) => {
  const contexto = contextoDe(ahora);
  const [retrasadas, conflicto, reembolsos] = await Promise.all(
    VISTAS_DE_AVISO.map((vista) => leerVista(vista, contexto))
  );
  const reservas = new Set([...retrasadas, ...conflicto, ...reembolsos].map((fila) => fila.id));
  return {
    hoy: contexto.hoy,
    total: reservas.size,
    retrasadas: retrasadas.length,
    en_conflicto: conflicto.length,
    reembolsos_a_medias: reembolsos.length
  };
};

// ─── El calendario (8.2: por pieza y vista general) ──────────────────────────────────────────────

// Las reservas que ocupan alguna pieza entre `desde` y `hasta` (los dos incluidos), con el margen. Las
// dos vistas del calendario se dibujan en el panel a partir de esto. Las provisionales caducadas no
// ocupan nada (como en la ficha). Con `hasta` a partir de hoy se suman las retrasadas, que tienen la
// pieza fuera aunque su ocupación ya haya acabado: son el riesgo para la reserva siguiente (8.2).
const MAX_CALENDARIO = 1000;

// Lo mínimo que el calendario necesita de cada reserva: sin teléfono, email, dirección ni notas del
// cliente. `ocupada_hasta` es el primer día libre después del margen (null = sin fin, una venta).
const paraCalendario = (r) => ({
  id: r.id,
  referencia: r.referencia,
  tipo: r.tipo,
  estado: r.estado,
  etiqueta: r.etiqueta,
  retrasada: r.retrasada,
  en_conflicto: r.en_conflicto,
  pieza: r.pieza,
  cliente: r.contacto?.nombre ?? null,
  motivo: r.motivo,
  fecha_inicio: r.fecha_inicio,
  hora_entrega: r.hora_entrega,
  fecha_fin: r.fecha_fin,
  hora_recogida: r.hora_recogida,
  fin_ocupacion: r.fin_ocupacion,
  dias_margen: r.dias_margen,
  ocupada_hasta: r.fin_ocupacion == null ? null : sumarDias(r.fin_ocupacion, r.dias_margen)
});

const calendarioDeReservas = async ({ desde, hasta, muebleId, ahora = new Date() }) => {
  const contexto = contextoDe(ahora);
  const [enElRango, retrasadas] = await Promise.all([
    leer(
      consultaBase(muebleId)
        .in('estado', ESTADOS_QUE_OCUPAN)
        .overlaps('rango_ocupado', `[${desde},${sumarDias(hasta, 1)})`)
        // Las más recientes primero: si hay más de las que caben, que falten las más viejas (las ventas no
        // tienen fin y entran en toda ventana posterior a su día), no las que están por llegar.
        .order('fecha_inicio', { ascending: false })
        .limit(MAX_CALENDARIO)
    ),
    hasta < contexto.hoy
      ? []
      : leer(
          consultaBase(muebleId)
            .eq('tipo', 'alquiler')
            .eq('estado', 'en_curso')
            .lt('fecha_fin', contexto.hoy)
            .order('fecha_inicio', { ascending: true })
        )
  ]);
  const filas = enElRango.filter((fila) => ocupaElCalendario(fila, ahora));
  const vistas = new Set(filas.map((fila) => fila.id));
  const todas = [...filas, ...retrasadas.filter((fila) => !vistas.has(fila.id))].sort(porInicio);
  return {
    hoy: contexto.hoy,
    desde,
    hasta,
    reservas: (await presentarFilas(todas, ahora)).map(paraCalendario),
    limitada: enElRango.length >= MAX_CALENDARIO
  };
};

// ─── La agenda de hoy y mañana (8.2, «lista de trayectos del día») ───────────────────────────────

// Un trayecto es una entrega o una recogida: lo mínimo para organizar la ruta y llamar sin abrir la
// reserva (hora, pieza, cliente, teléfono y dónde). En una tienda no hay dirección que llevar.
const trayecto = (reserva, tipo, hoy) => {
  const entrega = tipo === 'entrega';
  const modo = (entrega ? reserva.modo_entrega : reserva.modo_devolucion) ?? null;
  // Una entrega que tenía que haberse hecho antes de hoy y sigue sin hacerse va en hoy, marcada.
  const atrasada = entrega && reserva.fecha_inicio < hoy;
  const contacto = reserva.contacto;
  return {
    clave: `${reserva.id}:${tipo}`,
    tipo,
    dia: atrasada ? hoy : entrega ? reserva.fecha_inicio : reserva.fin_ocupacion,
    hora: (entrega ? reserva.hora_entrega : reserva.hora_recogida) ?? null,
    modo,
    atrasada,
    prevista: atrasada ? reserva.fecha_inicio : null,
    reserva: {
      id: reserva.id,
      referencia: reserva.referencia,
      pieza: { nombre: reserva.pieza.nombre, referencia: reserva.pieza.referencia },
      cliente: contacto ? { nombre: contacto.nombre, telefono: contacto.telefono } : null,
      direccion:
        modo === 'tienda' ? null : (reserva.direccion_entrega ?? contacto?.direccion ?? null)
    }
  };
};

// Por día; en un día, primero lo atrasado, luego por hora (sin hora al final), y a igual hora, la
// entrega antes que la recogida; y para que el orden no cambie entre cargas, por referencia y por clave.
const porMomento = (a, b) => {
  if (a.dia !== b.dia) return a.dia < b.dia ? -1 : 1;
  if (a.atrasada !== b.atrasada) return a.atrasada ? -1 : 1;
  const horaA = a.hora ?? '99:99';
  const horaB = b.hora ?? '99:99';
  if (horaA !== horaB) return horaA < horaB ? -1 : 1;
  if (a.tipo !== b.tipo) return a.tipo === 'entrega' ? -1 : 1;
  if (a.reserva.referencia !== b.reserva.referencia) {
    return a.reserva.referencia < b.reserva.referencia ? -1 : 1;
  }
  return a.clave < b.clave ? -1 : 1;
};

// GET /api/admin/reservas/agenda: las entregas y las recogidas de hoy y de mañana, en una sola lista.
// Salen de las mismas consultas que las vistas «Entregas hoy y mañana» y «Recogidas hoy y mañana»,
// así la agenda y esas listas nunca se contradicen. Las recogidas retrasadas no están: son un aviso
// con su propia vista.
const agendaDeHoy = async ({ ahora = new Date() } = {}) => {
  const contexto = contextoDe(ahora);
  const [entregas, recogidas] = await Promise.all([
    leerVista('entregas', contexto),
    leerVista('recogidas', contexto)
  ]);
  const presentadas = await presentarFilas([...entregas, ...recogidas], ahora);
  const trayectos = [
    ...presentadas.slice(0, entregas.length).map((r) => trayecto(r, 'entrega', contexto.hoy)),
    ...presentadas.slice(entregas.length).map((r) => trayecto(r, 'recogida', contexto.hoy))
  ].sort(porMomento);
  return { hoy: contexto.hoy, manana: sumarDias(contexto.hoy, 1), trayectos };
};

// ─── Choques en el calendario (4.3) ──────────────────────────────────────────────────────────────

// Lo que ocupa el calendario de la pieza en el rango propuesto [desde, hasta) (hasta null = sin fin),
// sin la propia reserva y sin las provisionales caducadas, que no cuentan (como ocupacionDesdeHoy).
// Por fecha de inicio.
const buscarChoques = async ({ muebleId, desde, hasta, excluir = null, ahora }) => {
  const filas = await leer(
    supabase
      .from('reservas')
      .select(
        'id, pedido_id, tipo, estado, fecha_inicio, fecha_fin, fin_ocupacion, dias_margen, ' +
          'expira_en, stripe_session_id'
      )
      .eq('mueble_id', muebleId)
      .in('estado', ESTADOS_QUE_OCUPAN)
      .overlaps('rango_ocupado', `[${desde},${hasta ?? ''})`)
  );
  return filas
    .filter((fila) => fila.id !== excluir && ocupaElCalendario(fila, ahora))
    .sort(porInicio);
};

// Con qué choca, para el administrador: el tipo, la referencia que conoce (la del pedido si lo hay) y
// las fechas. Nunca los datos del otro cliente ni el detalle de Postgres (4.3).
const ARTICULO = { alquiler: 'el alquiler', bloqueo: 'el bloqueo', venta: 'la venta' };
const nombrarReserva = (fila) => `${ARTICULO[fila.tipo]} #${referenciaDelPanel(fila)}`;
const describirReserva = (fila) => {
  if (fila.tipo === 'venta') {
    return `${nombrarReserva(fila)} (desde el ${fechaLegible(fila.fecha_inicio)})`;
  }
  const fechas = `del ${fechaLegible(fila.fecha_inicio)} al ${fechaLegible(fila.fin_ocupacion ?? fila.fecha_fin)}`;
  if (fila.tipo === 'bloqueo') return `${nombrarReserva(fila)} (${fechas})`;
  const margen = fila.dias_margen > 0 ? `, más ${dias(fila.dias_margen)} de margen` : '';
  return `${nombrarReserva(fila)} (${fechas}${margen})`;
};

// El 409 de una escritura que la base de datos rechazó por solaparse: `mensaje(choques)` lo redacta
// con las filas encontradas.
const errorDeChoque = async (rango, mensaje) => {
  const choques = await buscarChoques(rango);
  return new ErrorConflicto(choques.length > 0 ? mensaje(choques) : MENSAJE_CHOQUE_DESAPARECIDO);
};

const chocanLasFechas = (choques) => `Esas fechas chocan con ${describirReserva(choques[0])}.`;

// El primer día libre después de una fila (su final exclusivo, margen incluido), o null sin fin.
const finalDe = (fila) =>
  fila.fin_ocupacion == null ? null : sumarDias(fila.fin_ocupacion, fila.dias_margen ?? 0);

// Una venta no tiene fin: choca con todo lo que ocupe la pieza desde su fecha. Se nombra lo último, y
// el día desde el que podría empezar (la entrega diferida del 6.7).
const chocaLaVenta = (choques) => {
  const sinFin = choques.find((fila) => finalDe(fila) === null);
  if (sinFin) return `La venta choca con ${describirReserva(sinFin)}.`;
  const ultima = choques.reduce((a, b) => (finalDe(b) > finalDe(a) ? b : a));
  return (
    `La venta choca con ${describirReserva(ultima)}. ` +
    `Puede empezar, como pronto, el ${fechaLegible(finalDe(ultima))}.`
  );
};

const ANTES_DE_AMPLIAR = {
  alquiler: 'avisa a ese cliente antes de ampliar',
  bloqueo: 'levanta ese bloqueo antes de ampliar',
  venta: 'avisa a ese comprador antes de ampliar'
};

// ─── muebles.estado mientras no lo derive el calendario (3.3) ────────────────────────────────────

// Hasta que el disparador de R5 derive muebles.estado de esta tabla (en el lanzamiento, R-f), las
// acciones del panel lo mantienen al día ellas mismas. Cada una cambia la pieza solo si está en el
// estado que la acción deja atrás (entregar: de disponible a alquilado; recoger: de alquilado a
// disponible; cancelar una venta: de vendido a disponible), así que nunca pisan un estado puesto a
// mano: una pieza marcada vendida no pasa a alquilada por entregar un alquiler. Registrar una venta
// ya empezada la marca vendida sin mirar, porque vendida es lo que manda en la derivación del 3.3.
// Si este paso falla, la acción ya está hecha y guardada: se deja en el log y no se rompe la
// respuesta (el estado se corrige a mano en el panel; desde R5 lo hará la base de datos).
const moverPieza = async (muebleId, nuevo, desde = null) => {
  let consulta = supabase.from('muebles').update({ estado: nuevo }).eq('id', muebleId);
  if (desde) consulta = consulta.eq('estado', desde);
  const { error } = await consulta;
  if (error) {
    console.error(`No se pudo poner la pieza ${muebleId} en "${nuevo}":`, error.message || error);
  }
};

// ─── Correos al cliente (R-e, paso 20) ──────────────────────────────────────────────────────────

// Lo que necesitan los correos de una reserva (el formato de la confirmación, utils/email.js).
const datosDelCorreo = (fila, pieza) => ({
  email: fila.datos_contacto?.email,
  nombre: fila.datos_contacto?.nombre,
  reserva: {
    pedidoId: fila.pedido_id,
    pieza: pieza || 'tu pieza',
    fechaInicio: fila.fecha_inicio,
    horaEntrega: horaCorta(fila.hora_entrega),
    fechaFin: fila.fecha_fin,
    horaRecogida: horaCorta(fila.hora_recogida),
    modoEntrega: fila.modo_entrega,
    modoRecogida: fila.modo_devolucion,
    direccion: fila.direccion_entrega
  }
});

// La cancelación y el reembolso de un alquiler se cuentan al cliente, si dejó email. No a los de un
// contrato antiguo (origen 'legacy'), que el administrador lleva a mano, ni a bloqueos ni ventas. Un
// fallo aquí no rompe la acción, que ya está hecha (como los demás correos, solo queda en el log).
const avisarAlCliente = async (fila, enviar, extra = {}) => {
  if (fila?.tipo !== 'alquiler' || fila.origen === 'legacy' || !fila.datos_contacto?.email) return;
  try {
    const piezas = await leerPiezas([fila.mueble_id]);
    await enviar({ ...datosDelCorreo(fila, piezas.get(fila.mueble_id)?.nombre), ...extra });
  } catch (error) {
    console.error(`No se pudo avisar al cliente de la reserva ${fila.id}:`, error.message || error);
  }
};

const avisarDelReembolso = (fila) =>
  avisarAlCliente(fila, email.enviarReembolsoReserva, {
    reembolso: Number(fila.reembolso_importe)
  });

// ─── Acciones sobre una reserva (8.3) ────────────────────────────────────────────────────────────

const NO_SE_PUEDE = {
  entregar: 'Solo se puede marcar como entregado un alquiler confirmado.',
  recoger: 'Solo se puede marcar como recogido un alquiler entregado.',
  ampliar: 'Solo se puede ampliar un alquiler entregado que todavía no se ha recogido.',
  cancelar: 'Solo se puede cancelar un alquiler confirmado (antes de entregarlo) o una venta.',
  'reintentar-reembolso': MENSAJE_SIN_REEMBOLSO_A_MEDIAS,
  'dar-por-reembolsado': MENSAJE_SIN_REEMBOLSO_A_MEDIAS,
  'levantar-bloqueo': 'Solo se puede levantar un bloqueo activo.'
};
// Las acciones de una reserva ya cancelada: las del reembolso a medias.
const ACCIONES_DE_REEMBOLSO = ['reintentar-reembolso', 'dar-por-reembolsado'];

// 409 si la acción no es una de las que el panel ofrece para esta reserva (situacion), con el motivo
// más concreto que se pueda dar.
const comprobarAccion = (fila, accion, contexto) => {
  if (situacion(fila, contexto).acciones.includes(accion)) return;
  if (fila.conflicto_en) {
    throw new ErrorConflicto(
      'Esta reserva no se pudo confirmar: el reembolso se hace desde el Dashboard de Stripe.'
    );
  }
  if (fila.estado === 'cancelada' && !ACCIONES_DE_REEMBOLSO.includes(accion)) {
    throw new ErrorConflicto(
      fila.tipo === 'bloqueo'
        ? 'Este bloqueo ya está levantado.'
        : 'Esta reserva ya está cancelada.'
    );
  }
  if (accion === 'entregar' && fila.estado === 'en_curso') {
    throw new ErrorConflicto('Este alquiler ya está marcado como entregado.');
  }
  if (accion === 'recoger' && fila.estado === 'devuelta') {
    throw new ErrorConflicto('Este alquiler ya está marcado como recogido.');
  }
  throw new ErrorConflicto(NO_SE_PUEDE[accion]);
};

// Marcar entregada (8.3): solo desde la fecha prevista, o antes con confirmación explícita. Antes de
// tiempo, la pieza ya no está desde hoy: fecha_inicio pasa a hoy en el mismo UPDATE guardado, que
// ocupa más calendario y pasa por escribirEnCalendario (4.6); la fecha prevista queda en el historial
// (19 oct). Si esos días ya son de otra reserva, 409 que la nombra.
const entregar = async (id, { antes_de_tiempo: antesDeTiempo = false }, ahora) => {
  const contexto = contextoDe(ahora);
  const resultado = await actualizarReserva(id, {
    columnas: COLUMNAS_PANEL,
    ahora,
    decidir: (fila) => {
      comprobarAccion(fila, 'entregar', contexto);
      const anticipada = fila.fecha_inicio > contexto.hoy;
      if (anticipada && !antesDeTiempo) {
        const error = new ErrorConflicto(
          `La entrega está prevista para el ${fechaLegible(fila.fecha_inicio)}. ¿Seguro que la entregas antes?`
        );
        error.codigo = 'entrega_anticipada';
        throw error;
      }
      if (!anticipada) {
        return {
          cambios: { estado: 'en_curso', entregada_en: ahora.toISOString() },
          entrada: { tipo: 'entregada', detalle: 'Entregada.', por: 'admin' }
        };
      }
      return {
        cambios: {
          estado: 'en_curso',
          entregada_en: ahora.toISOString(),
          fecha_inicio: contexto.hoy
        },
        entrada: {
          tipo: 'entregada',
          detalle:
            `Entregada antes de la fecha prevista (${fechaLegible(fila.fecha_inicio)}): ocupa el ` +
            'calendario desde hoy.',
          por: 'admin'
        },
        ocupa: true
      };
    }
  });
  if (resultado.choque) {
    const fila = resultado.choque;
    throw await errorDeChoque(
      {
        muebleId: fila.mueble_id,
        desde: contexto.hoy,
        hasta: finalDe(fila),
        excluir: fila.id,
        ahora
      },
      ([anterior]) => `Entregarla hoy choca con ${describirReserva(anterior)}.`
    );
  }
  await moverPieza(resultado.reserva.mueble_id, 'alquilado', 'disponible');
  return { reserva: resultado.reserva };
};

// El día en que volvió la pieza (19 oct): hoy si no se dice otro. Ni después de hoy ni antes de
// entregarla (ni de su fecha de inicio, que es donde empieza lo que ocupa en el calendario).
const comprobarFechaRecogida = (fila, fecha, hoy) => {
  if (fecha > hoy) throw new ErrorValidacion('La fecha de recogida no puede ser posterior a hoy.');
  const entrega = fila.entregada_en ? hoyEnMadrid(new Date(fila.entregada_en)) : fila.fecha_inicio;
  const desde = entrega > fila.fecha_inicio ? entrega : fila.fecha_inicio;
  if (fecha < desde) {
    throw new ErrorValidacion(
      `La fecha de recogida no puede ser anterior a la entrega (${fechaLegible(desde)}).`
    );
  }
};

const lineaDeRecogida = (fila, fecha, otroDia) => {
  const retraso = diasEntre(fila.fecha_fin, fecha);
  if (!otroDia) return retraso > 0 ? `Recogida con ${dias(retraso)} de retraso.` : 'Recogida.';
  const cuando = `Recogida el ${fechaLegible(fecha)}`;
  return retraso > 0 ? `${cuando}, con ${dias(retraso)} de retraso.` : `${cuando}.`;
};

const avisoDeRecorte = ({ margen, por }) => {
  let queda = `solo quedan ${margen} días de margen`;
  if (margen === 0) queda = 'no queda margen';
  if (margen === 1) queda = 'solo queda 1 día de margen';
  return (
    `La pieza ha vuelto tarde: hasta ${nombrarReserva(por)} del ` +
    `${fechaLegible(por.fecha_inicio)} ${queda}.`
  );
};

// La devolución (con `margen` días detrás) chocó: con qué, y el margen que de verdad queda hasta la
// primera reserva que alcanza (días enteros desde la devolución). Si esa reserva ya había empezado
// cuando volvió la pieza, ni sin margen cabe: 409 que la nombra.
const recortarMargen = async (fila, fecha, margen, ahora) => {
  const [siguiente] = await buscarChoques({
    muebleId: fila.mueble_id,
    desde: fila.fecha_inicio,
    hasta: sumarDias(fecha, margen),
    excluir: fila.id,
    ahora
  });
  if (!siguiente) throw new ErrorConflicto(MENSAJE_CHOQUE_DESAPARECIDO);
  if (siguiente.fecha_inicio < fecha) {
    throw new ErrorConflicto(
      `La pieza volvió el ${fechaLegible(fecha)}, cuando ya había empezado ` +
        `${describirReserva(siguiente)}: no se puede apuntar esa recogida.`
    );
  }
  const queda = diasEntre(fecha, siguiente.fecha_inicio);
  // No debería pasar (lo que choca empieza antes de acabar el margen), pero así el bucle siempre
  // acaba: cada vuelta recorta el margen o termina.
  if (queda >= margen) throw new ErrorConflicto(MENSAJE_CHOQUE_DESAPARECIDO);
  return { margen: queda, por: siguiente };
};

// Marcar recogida (8.3), hoy o el día que se diga (`fecha_recogida`, 19 oct; ese día a las 12:00 de
// Madrid). El disparador de R2 pone fin_ocupacion = día real de la devolución (3.4), así que una
// devolución tardía ocupa más calendario y, con su margen, puede alcanzar a la reserva siguiente. La
// pieza ya ha vuelto: se apunta igual, con el margen recortado a los días enteros que quedan (el
// original queda en el historial), y la respuesta lleva un `aviso`. Si se cierra otra ventana entre
// medias, se vuelve a mirar y se recorta otra vez. Solo si ni sin margen cabe, 409.
const recoger = async (id, { fecha_recogida: fechaRecogida }, ahora) => {
  const contexto = contextoDe(ahora);
  const fecha = fechaRecogida ?? contexto.hoy;
  const otroDia = fecha !== contexto.hoy;
  const devueltaEn = otroDia
    ? instanteEnMadrid(fecha, HORA_RECOGIDA_OTRO_DIA).toISOString()
    : ahora.toISOString();
  let recorte = null;
  const margenDe = (fila) =>
    recorte ? Math.min(recorte.margen, fila.dias_margen ?? 0) : (fila.dias_margen ?? 0);
  for (;;) {
    const resultado = await actualizarReserva(id, {
      columnas: COLUMNAS_PANEL,
      ahora,
      ocupa: true,
      decidir: (fila) => {
        comprobarAccion(fila, 'recoger', contexto);
        comprobarFechaRecogida(fila, fecha, contexto.hoy);
        const cambios = { estado: 'devuelta', devuelta_en: devueltaEn };
        let detalle = lineaDeRecogida(fila, fecha, otroDia);
        const margen = margenDe(fila);
        if (margen < (fila.dias_margen ?? 0)) {
          cambios.dias_margen = margen;
          detalle +=
            ` Margen recortado de ${dias(fila.dias_margen)} a ${dias(margen)} por ` +
            `${nombrarReserva(recorte.por)} del ${fechaLegible(recorte.por.fecha_inicio)}.`;
        }
        return { cambios, entrada: { tipo: 'recogida', detalle, por: 'admin' } };
      }
    });
    if (resultado.reserva) {
      await moverPieza(resultado.reserva.mueble_id, 'disponible', 'alquilado');
      return recorte
        ? { reserva: resultado.reserva, aviso: avisoDeRecorte(recorte) }
        : { reserva: resultado.reserva };
    }
    const fila = resultado.choque;
    recorte = await recortarMargen(fila, fecha, margenDe(fila), ahora);
  }
};

// Ampliar un retraso (8.3, 8.5): la nueva fecha prevista de recogida, que ocupa el calendario.
const ampliar = async (id, { fin_ocupacion: nuevaFecha }, ahora) => {
  const contexto = contextoDe(ahora);
  const resultado = await actualizarReserva(id, {
    columnas: COLUMNAS_PANEL,
    ahora,
    ocupa: true,
    decidir: (fila) => {
      comprobarAccion(fila, 'ampliar', contexto);
      if (nuevaFecha < fila.fecha_fin) {
        throw new ErrorValidacion(
          `La nueva fecha no puede ser anterior a la recogida pactada (${fechaLegible(fila.fecha_fin)}).`
        );
      }
      if (nuevaFecha < contexto.hoy) {
        throw new ErrorValidacion('La nueva fecha no puede ser anterior a hoy.');
      }
      return {
        cambios: { fin_ocupacion: nuevaFecha },
        entrada: {
          tipo: 'ampliada',
          detalle: `Recogida prevista para el ${fechaLegible(nuevaFecha)} (antes, el ${fechaLegible(fila.fin_ocupacion)}).`,
          por: 'admin'
        }
      };
    }
  });
  if (resultado.choque) {
    const fila = resultado.choque;
    throw await errorDeChoque(
      {
        muebleId: fila.mueble_id,
        desde: fila.fecha_inicio,
        hasta: sumarDias(nuevaFecha, fila.dias_margen ?? 0),
        excluir: fila.id,
        ahora
      },
      ([siguiente]) =>
        `La nueva fecha choca con ${describirReserva(siguiente)}: ${ANTES_DE_AMPLIAR[siguiente.tipo]}.`
    );
  }
  return { reserva: resultado.reserva };
};

// El reembolso que se pide al cancelar (8.4, política 'manual': decide el administrador), en céntimos.
const comprobarReembolso = (fila, centimos) => {
  if (centimos === 0) return;
  if (fila.tipo === 'venta') {
    throw new ErrorValidacion(
      'Las compras se reembolsan desde el Dashboard de Stripe, como hasta ahora.'
    );
  }
  if (!fila.stripe_payment_intent_id) {
    throw new ErrorValidacion(
      'Este alquiler no se pagó en la web: el reembolso, si lo hay, se hace a mano.'
    );
  }
  const pagado = fila.importe_total == null ? 0 : centimosDe(fila.importe_total);
  if (centimos > pagado) {
    throw new ErrorValidacion(
      `El reembolso no puede pasar de lo pagado (${eurosLegibles(pagado)}).`
    );
  }
};

// Lo que Stripe todavía deja devolver de un pago (8.4, 19 oct), en céntimos: lo cobrado menos lo ya
// devuelto (también lo devuelto desde el Dashboard). null si ahora no se puede saber (Stripe sin
// configurar o sin responder): entonces el tope lo pone Stripe al reembolsar.
const loQueStripeDejaDevolver = async (paymentIntentId) => {
  const stripe = stripeUtil.getStripe();
  if (!stripe) return null;
  try {
    const pago = await stripe.paymentIntents.retrieve(paymentIntentId);
    const { data } = await stripe.refunds.list({ payment_intent: paymentIntentId, limit: 100 });
    const devuelto = data
      .filter(cuentaComoHecho)
      .reduce((suma, refund) => suma + (refund.amount ?? 0), 0);
    return Math.max(0, (pago.amount_received ?? 0) - devuelto);
  } catch (error) {
    console.warn(
      `No se pudo leer en Stripe lo que queda por devolver del pago ${paymentIntentId}:`,
      error.message || error
    );
    return null;
  }
};

// Otra petición (un «Reintentar» a la vez) ya guardó el reembolso: no se añade otra línea.
class ReembolsoYaGuardado extends Error {
  constructor(fila) {
    super('El reembolso ya estaba guardado.');
    this.fila = fila;
  }
}

// Stripe no ha aceptado el reembolso, y repetirlo igual no va a cambiar nada: lo rechazó
// (StripeInvalidRequestError) o lo devolvió fallido o anulado (19 oct).
class ReembolsoRechazado extends Error {
  constructor(refund, causa) {
    super(causa?.message || `Reembolso ${refund.id} en estado ${refund.status}.`);
    this.refundId = refund?.id ?? null;
  }
}

// La línea del historial de un reembolso que Stripe no ha aceptado (sin reembolso fallido que contar).
// Si no se puede escribir, el siguiente reintento usará la misma clave: no es grave.
const anotarRechazo = async (id, motivo, ahora) => {
  try {
    await actualizarReserva(id, {
      columnas: COLUMNAS_PANEL,
      ahora,
      decidir: () => ({
        cambios: {},
        entrada: {
          tipo: TIPO_REEMBOLSO_RECHAZADO,
          detalle: `Stripe no ha aceptado el reembolso: ${motivo}`,
          por: 'sistema'
        }
      })
    });
  } catch (error) {
    console.error(
      `No se pudo anotar el rechazo del reembolso de la reserva ${id}:`,
      error.message || error
    );
  }
};

// El reembolso está hecho en Stripe, pero su id no se pudo guardar (19 oct).
class ReembolsoSinGuardar extends Error {
  constructor(refundId, causa) {
    super(causa?.message || String(causa));
    this.refundId = refundId;
  }
}

// 8.6, capa 3: el id del reembolso, con su línea en el historial, solo si no estaba ya.
const guardarReembolso = async (id, refundId, ahora) => {
  try {
    const { reserva } = await actualizarReserva(id, {
      columnas: COLUMNAS_PANEL,
      ahora,
      decidir: (fila) => {
        if (fila.stripe_refund_id) throw new ReembolsoYaGuardado(fila);
        if (reembolsoDadoPorHecho(fila)) {
          console.error(
            `[ALERTA] Reserva ${id}: se dio por reembolsada y a la vez se hizo el reembolso ${refundId}. ` +
              'Revisa en el Dashboard de Stripe que no se haya devuelto dos veces.'
          );
        }
        return {
          cambios: { stripe_refund_id: refundId },
          entrada: {
            tipo: 'reembolso',
            detalle: `Reembolso de ${eurosLegibles(centimosDe(fila.reembolso_importe))} hecho en Stripe (${refundId}).`,
            por: 'admin'
          }
        };
      }
    });
    return reserva;
  } catch (error) {
    if (error instanceof ReembolsoYaGuardado) return error.fila;
    throw error;
  }
};

// Hecho por este servidor: cada reembolso que crea lleva en la metadata su reserva y su tipo.
const hechoPorElPanel = (refund) => Boolean(refund.metadata?.reserva_id && refund.metadata?.tipo);
const esDeEstaCancelacion = (refund, fila) =>
  refund.metadata?.reserva_id === fila.id && refund.metadata?.tipo === TIPO_REEMBOLSO;

// 8.6, capas 2 y 3, con la marca ya reclamada: el reembolso en Stripe, con su clave de idempotencia
// fija, y su id en la reserva. Al reintentar (`buscarAntes`), primero se busca en Stripe por si se
// hizo y no llegó a guardarse: la clave solo dura 24 horas, y pasado ese plazo crearía otro. Desde el
// 19 oct, al reintentar:
//   - uno de esta cancelación fallido o anulado no cuenta, y el siguiente va con otra clave (_2, _3...:
//     con la misma, Stripe devolvería el fallido);
//   - si el pago tiene un reembolso que no hizo el panel, posterior a la cancelación y que no ha
//     fallado, no se crea nada: 409 (se hizo desde el Dashboard; si basta, «Dar por reembolsado»).
const hacerReembolso = async (fila, { buscarAntes, ahora }) => {
  const stripe = stripeUtil.getStripe();
  if (!stripe) throw new Error('Stripe no está configurado (falta STRIPE_SECRET_KEY).');
  let refund = null;
  let intento = 1;
  if (buscarAntes) {
    const { data } = await stripe.refunds.list({
      payment_intent: fila.stripe_payment_intent_id,
      limit: 100
    });
    const deEsta = data.filter((r) => esDeEstaCancelacion(r, fila));
    refund = deEsta.find(cuentaComoHecho) ?? null;
    if (!refund) {
      const desde = Math.floor(Date.parse(fila.reembolso_solicitado_en) / 1000);
      const deFuera = data.filter(
        (r) => !hechoPorElPanel(r) && cuentaComoHecho(r) && r.created >= desde
      );
      if (deFuera.length > 0) {
        const suma = deFuera.reduce((total, r) => total + (r.amount ?? 0), 0);
        throw new ErrorConflicto(
          `Este pago ya tiene un reembolso de ${eurosLegibles(suma)} hecho fuera del panel. Si ` +
            'con él ya está todo devuelto, usa «Dar por reembolsado».'
        );
      }
      const rechazos = (fila.historial || []).filter((l) => l.tipo === TIPO_REEMBOLSO_RECHAZADO);
      intento = deEsta.length + rechazos.length + 1;
    }
  }
  if (!refund) {
    const clave = claveDeReembolso(fila.id);
    try {
      refund = await stripe.refunds.create(
        {
          payment_intent: fila.stripe_payment_intent_id,
          amount: centimosDe(fila.reembolso_importe),
          metadata: { reserva_id: fila.id, tipo: TIPO_REEMBOLSO }
        },
        { idempotencyKey: intento === 1 ? clave : `${clave}_${intento}` }
      );
    } catch (error) {
      if (error?.type === 'StripeInvalidRequestError') throw new ReembolsoRechazado(null, error);
      throw error;
    }
    if (!cuentaComoHecho(refund)) throw new ReembolsoRechazado(refund);
  }
  try {
    return await guardarReembolso(fila.id, refund.id, ahora);
  } catch (error) {
    throw new ReembolsoSinGuardar(refund.id, error);
  }
};

const leerReserva = async (id) => {
  const fila = await leer(
    supabase.from('reservas').select(COLUMNAS_LISTA).eq('id', id).maybeSingle()
  );
  if (!fila) throw new ErrorNoEncontrado(MENSAJE_RESERVA_NO_ENCONTRADA);
  return fila;
};

// La reserva tal como ha quedado, para el 502; null si tampoco se puede leer.
const releerReserva = async (id) => {
  try {
    return await leerReserva(id);
  } catch (error) {
    console.error(`No se pudo volver a leer la reserva ${id}:`, error.message || error);
    return null;
  }
};

// El reembolso de una reserva con la marca reclamada. Devuelve { reserva } si queda hecho y guardado;
// si no, { reserva, avisoReembolso } (502) con la reserva tal como queda (sin ella, si no se puede
// leer). `siFalla` es el aviso de un fallo pasajero. Nunca se mueve dinero dos veces: lo rechazado no
// se repite solo, y lo hecho y no guardado se encuentra al reintentar (por su metadata).
const reembolsar = async (fila, { buscarAntes, ahora, siFalla }) => {
  try {
    return { reserva: await hacerReembolso(fila, { buscarAntes, ahora }) };
  } catch (error) {
    if (error instanceof ErrorConflicto) throw error;
    if (error instanceof ReembolsoSinGuardar) {
      console.error(
        `[ALERTA] Reembolso ${error.refundId} de la reserva ${fila.id} hecho en Stripe y sin guardar:`,
        error.message
      );
      const actual = await releerReserva(fila.id);
      if (actual?.stripe_refund_id) return { reserva: actual };
      return { reserva: actual, avisoReembolso: MENSAJE_REEMBOLSO_SIN_GUARDAR };
    }
    if (error instanceof ReembolsoRechazado) {
      console.error(
        `[ALERTA] Stripe no ha aceptado el reembolso de la reserva ${fila.id}` +
          `${error.refundId ? ` (${error.refundId})` : ''}:`,
        error.message
      );
      if (!error.refundId) await anotarRechazo(fila.id, error.message, ahora);
      return { reserva: fila, avisoReembolso: MENSAJE_REEMBOLSO_RECHAZADO };
    }
    console.error(`[ALERTA] Reserva ${fila.id} con el reembolso a medias:`, error.message || error);
    return { reserva: fila, avisoReembolso: siFalla };
  }
};

// Cancelar (8.4) un alquiler confirmado o una venta, con el reembolso que decide el administrador.
// Con reembolso, antes de nada se lee lo que Stripe todavía deja devolver del pago (19 oct): pedir más
// es un 400 y no cambia nada. El dinero se mueve en las tres capas del 8.6. La primera es este UPDATE:
// cancela y reclama la marca del reembolso a la vez, y solo vale si la fila sigue como se leyó
// (actualizarReserva), así que una segunda petición simultánea vuelve a leer y se encuentra la marca
// puesta, o la reserva cancelada. Si Stripe falla después, la reserva queda cancelada con el
// reembolso "a medias", y se dice (502).
const cancelar = async (id, { motivo, reembolso_centimos: reembolso }, ahora) => {
  const contexto = contextoDe(ahora);
  const comprobar = (fila) => {
    if (fila.reembolso_solicitado_en) throw new ErrorConflicto(MENSAJE_REEMBOLSO_EN_CURSO);
    comprobarAccion(fila, 'cancelar', contexto);
    comprobarReembolso(fila, reembolso);
  };
  if (reembolso > 0) {
    const fila = await leerReserva(id);
    comprobar(fila);
    const tope = await loQueStripeDejaDevolver(fila.stripe_payment_intent_id);
    if (tope !== null && reembolso > tope) {
      throw new ErrorValidacion(
        `Stripe solo permite devolver ${eurosLegibles(tope)} de este pago.`
      );
    }
  }
  const { reserva } = await actualizarReserva(id, {
    columnas: COLUMNAS_PANEL,
    ahora,
    decidir: (fila) => {
      comprobar(fila);
      const cambios = {
        estado: 'cancelada',
        cancelada_en: ahora.toISOString(),
        cancelada_por: 'admin',
        motivo_cancelacion: motivo
      };
      if (reembolso > 0) {
        cambios.reembolso_solicitado_en = ahora.toISOString();
        cambios.reembolso_importe = euros(reembolso);
      }
      return {
        cambios,
        entrada: {
          tipo: 'cancelada',
          detalle: `Motivo: ${motivo}. ${reembolso > 0 ? `Reembolso pedido: ${eurosLegibles(reembolso)}.` : 'Sin reembolso.'}`,
          por: 'admin'
        }
      };
    }
  });
  if (reserva.tipo === 'venta') await moverPieza(reserva.mueble_id, 'disponible', 'vendido');
  await avisarAlCliente(reserva, email.enviarCancelacionReserva, {
    reembolso: reembolso > 0 ? euros(reembolso) : 0
  });
  if (!reembolsoAMedias(reserva)) return { reserva };
  const resultado = await reembolsar(reserva, {
    buscarAntes: false,
    ahora,
    siFalla: MENSAJE_REEMBOLSO_A_MEDIAS
  });
  if (resultado.reserva?.stripe_refund_id) await avisarDelReembolso(resultado.reserva);
  return resultado;
};

// «Reintentar reembolso» (8.6, capa 3): solo para las que se quedaron a medias.
const reintentarReembolso = async (id, _datos, ahora) => {
  const fila = await leerReserva(id);
  comprobarAccion(fila, 'reintentar-reembolso', contextoDe(ahora));
  const resultado = await reembolsar(fila, {
    buscarAntes: true,
    ahora,
    siFalla: MENSAJE_REINTENTO_FALLIDO
  });
  if (resultado.reserva?.stripe_refund_id) await avisarDelReembolso(resultado.reserva);
  return resultado;
};

// Lo que Stripe dice haber devuelto de este pago desde que se pidió el reembolso, en céntimos (cuenta lo
// hecho por el panel y lo hecho desde el Dashboard); null si ahora no se puede saber.
const devueltoDesdeLaCancelacion = async (fila) => {
  const stripe = stripeUtil.getStripe();
  if (!stripe) return null;
  try {
    const { data } = await stripe.refunds.list({
      payment_intent: fila.stripe_payment_intent_id,
      limit: 100
    });
    const desde = Math.floor(Date.parse(fila.reembolso_solicitado_en) / 1000);
    return data
      .filter((r) => cuentaComoHecho(r) && r.created >= desde)
      .reduce((suma, r) => suma + (r.amount ?? 0), 0);
  } catch (error) {
    console.warn(
      `No se pudo leer en Stripe lo devuelto del pago ${fila.stripe_payment_intent_id}:`,
      error.message || error
    );
    return null;
  }
};

// «Dar por reembolsado» (8.6, 19 oct): el reembolso a medias se hizo fuera. Cierra el "a medias" con una
// línea en el historial, sin mover dinero, con el UPDATE guardado: si ya no está a medias (otro clic,
// un «Reintentar»), 409. Antes se mira en Stripe que conste lo devuelto: si no consta (o no se puede
// mirar) es un 409 con el código `reembolso_no_consta`, y solo con `aunque_no_conste` (un reembolso por
// otro medio, como una transferencia) se cierra igualmente, con otra línea.
const darPorReembolsado = async (id, { aunque_no_conste: aunqueNoConste = false }, ahora) => {
  const contexto = contextoDe(ahora);
  if (!aunqueNoConste) {
    const fila = await leerReserva(id);
    comprobarAccion(fila, 'dar-por-reembolsado', contexto);
    const devuelto = await devueltoDesdeLaCancelacion(fila);
    const pedido = centimosDe(fila.reembolso_importe);
    if (devuelto === null || devuelto < pedido) {
      let mensaje = 'No se ha podido comprobar en Stripe si el reembolso está hecho.';
      if (devuelto === 0) {
        mensaje =
          'En Stripe no consta ningún reembolso de este pago desde que se canceló la reserva.';
      } else if (devuelto !== null) {
        mensaje = `En Stripe constan ${eurosLegibles(devuelto)} devueltos, y había que devolver ${eurosLegibles(pedido)}.`;
      }
      const error = new ErrorConflicto(mensaje);
      error.codigo = 'reembolso_no_consta';
      throw error;
    }
  }
  const { reserva } = await actualizarReserva(id, {
    columnas: COLUMNAS_PANEL,
    ahora,
    decidir: (fila) => {
      comprobarAccion(fila, 'dar-por-reembolsado', contexto);
      return {
        cambios: {},
        entrada: {
          tipo: TIPO_DADO_POR_HECHO,
          detalle: aunqueNoConste ? LINEA_DADO_POR_HECHO_SIN_STRIPE : LINEA_DADO_POR_HECHO,
          por: 'admin'
        }
      };
    }
  });
  // Solo si Stripe confirma lo devuelto: el correo dice «en la misma tarjeta», y con
  // `aunque_no_conste` se devolvió por otro medio (una transferencia), que el administrador cuenta él.
  if (!aunqueNoConste) await avisarDelReembolso(reserva);
  return { reserva };
};

const levantarBloqueo = async (id, _datos, ahora) => {
  const contexto = contextoDe(ahora);
  const { reserva } = await actualizarReserva(id, {
    columnas: COLUMNAS_PANEL,
    ahora,
    decidir: (fila) => {
      comprobarAccion(fila, 'levantar-bloqueo', contexto);
      return {
        cambios: { estado: 'cancelada', cancelada_en: ahora.toISOString(), cancelada_por: 'admin' },
        entrada: { tipo: 'levantado', detalle: 'Bloqueo levantado.', por: 'admin' }
      };
    }
  });
  return { reserva };
};

// Un Map y no un objeto: 'constructor' o '__proto__' no son acciones (19 oct).
const ACCIONES = new Map([
  ['entregar', entregar],
  ['recoger', recoger],
  ['ampliar', ampliar],
  ['cancelar', cancelar],
  ['reintentar-reembolso', reintentarReembolso],
  ['dar-por-reembolsado', darPorReembolsado],
  ['levantar-bloqueo', levantarBloqueo]
]);

// POST /api/admin/reservas/:id/:accion, con el cuerpo ya validado (schemas/adminReservas.js).
// Devuelve { reserva } con la fila tal como queda, más `aviso` si se hizo con algo que conviene saber
// (una recogida con el margen recortado), o { reserva, avisoReembolso } si el reembolso no se pudo
// hacer o guardar (502; `reserva` es null si ni se pudo volver a leer). Lanza ErrorConflicto (409),
// ErrorValidacion (400) o ErrorNoEncontrado (404) con un mensaje que se puede enseñar; cualquier otro
// error es interno.
const ejecutarAccion = (id, accion, datos, ahora = new Date()) => {
  const hacer = ACCIONES.get(accion);
  if (!hacer) throw new ErrorNoEncontrado(MENSAJE_ACCION_NO_EXISTE);
  return hacer(id, datos ?? {}, ahora);
};

// ─── Altas sin pago web (8.3) ────────────────────────────────────────────────────────────────────

const leerPieza = async (muebleId) => {
  const pieza = await leer(
    supabase
      .from('muebles')
      .select('id, nombre, referencia, estado')
      .eq('id', muebleId)
      .maybeSingle()
  );
  if (!pieza) throw new ErrorNoEncontrado(MENSAJE_PIEZA_NO_ENCONTRADA);
  return pieza;
};

const lineaCreada = (detalle, ahora) => [
  { fecha: ahora.toISOString(), tipo: 'creada', detalle, por: 'admin' }
];

// Inserta una fila en el calendario por el mismo camino que todo lo demás (4.6): limpieza, inserción
// y, si choca, el 409 que dice con qué.
const insertarEnCalendario = async (fila, { ahora, mensaje }) => {
  const { data, error } = await escribirEnCalendario(fila.mueble_id, () =>
    supabase.from('reservas').insert(fila).select(COLUMNAS_LISTA).single()
  );
  if (!error) return data;
  // La pieza se borró entre la lectura y la inserción.
  if (error.code === CODIGO_CLAVE_AJENA) throw new ErrorNoEncontrado(MENSAJE_PIEZA_NO_ENCONTRADA);
  if (!chocaEnCalendario(error)) throw error;
  throw await errorDeChoque(
    {
      muebleId: fila.mueble_id,
      desde: fila.fecha_inicio,
      hasta: finalDe(fila),
      ahora
    },
    mensaje
  );
};

// Bloquear fechas (8.3): mantenimiento, una exposición... Devuelven { reserva, pieza }.
const crearBloqueo = async (datos, ahora = new Date()) => {
  if (datos.fecha_inicio < hoyEnMadrid(ahora)) {
    throw new ErrorValidacion('Un bloqueo no puede empezar antes de hoy.');
  }
  const pieza = await leerPieza(datos.mueble_id);
  const reserva = await insertarEnCalendario(
    {
      mueble_id: pieza.id,
      tipo: 'bloqueo',
      estado: 'confirmada',
      fecha_inicio: datos.fecha_inicio,
      fecha_fin: datos.fecha_fin,
      fin_ocupacion: datos.fecha_fin,
      dias_margen: 0,
      origen: 'manual',
      motivo: datos.motivo,
      historial: lineaCreada(`Bloqueo: ${datos.motivo}`, ahora)
    },
    { ahora, mensaje: chocanLasFechas }
  );
  return { reserva, pieza };
};

// Registrar un alquiler fuera de la web (8.3): pactado por teléfono o en la tienda ('manual'), o un
// contrato antiguo ('legacy', 9.2), sin pago de Stripe y con el mismo margen que los de la web. Un
// contrato antiguo, o uno que ya está en casa del cliente, puede haber empezado antes de hoy; uno que
// todavía hay que entregar, no. La duración no tiene los límites de la web: se pactó fuera.
const crearAlquiler = async (datos, ahora = new Date(), reglas = REGLAS_ALQUILER) => {
  const hoy = hoyEnMadrid(ahora);
  if (datos.origen === 'manual' && !datos.ya_entregado && datos.fecha_inicio < hoy) {
    throw new ErrorValidacion(
      'Un alquiler que todavía no se ha entregado no puede empezar antes de hoy.'
    );
  }
  // Ya en casa del cliente, y empezando mañana: no se podría recoger hasta entonces (19 oct).
  if (datos.ya_entregado && datos.fecha_inicio > hoy) {
    throw new ErrorValidacion('Un alquiler ya entregado no puede empezar después de hoy.');
  }
  const pieza = await leerPieza(datos.mueble_id);
  if (pieza.estado === 'vendido') {
    throw new ErrorValidacion('Esta pieza está vendida: no se puede alquilar.');
  }

  const { contacto } = datos;
  const aDomicilio = datos.modo_entrega === 'domicilio' || datos.modo_devolucion === 'domicilio';
  const comoEs =
    datos.origen === 'legacy'
      ? 'Contrato antiguo dado de alta desde el panel.'
      : 'Alquiler pactado fuera de la web.';
  const reserva = await insertarEnCalendario(
    {
      mueble_id: pieza.id,
      tipo: 'alquiler',
      estado: datos.ya_entregado ? 'en_curso' : 'confirmada',
      fecha_inicio: datos.fecha_inicio,
      hora_entrega: datos.hora_entrega,
      fecha_fin: datos.fecha_fin,
      hora_recogida: datos.hora_recogida,
      // Ya entregado y con la recogida pactada pasada: la pieza sigue fuera, así que ocupa al menos
      // hasta hoy, como un retraso sin ampliar (19 oct).
      fin_ocupacion: datos.ya_entregado && datos.fecha_fin < hoy ? hoy : datos.fecha_fin,
      dias_margen: reglas.diasMargen,
      modo_entrega: datos.modo_entrega,
      modo_devolucion: datos.modo_devolucion,
      direccion_entrega: aDomicilio ? contacto.direccion : null,
      datos_contacto: {
        nombre: contacto.nombre,
        email: contacto.email ?? null,
        telefono: contacto.telefono ?? null,
        direccion: contacto.direccion ?? null,
        notas: contacto.notas ?? null
      },
      importe_total:
        datos.importe_total_centimos == null ? null : euros(datos.importe_total_centimos),
      ...(datos.ya_entregado && { entregada_en: ahora.toISOString() }),
      origen: datos.origen,
      historial: lineaCreada(datos.ya_entregado ? `${comoEs} Ya estaba entregado.` : comoEs, ahora)
    },
    { ahora, mensaje: chocanLasFechas }
  );
  if (datos.ya_entregado) await moverPieza(pieza.id, 'alquilado', 'disponible');
  return { reserva, pieza };
};

// Registrar una venta fuera de la web (8.3): ya hecha (desde hoy o desde hace unos días) o con entrega
// diferida, que empieza cuando la pieza queda libre (6.7). Sin fin, como todas las ventas.
const crearVenta = async (datos, ahora = new Date()) => {
  const hoy = hoyEnMadrid(ahora);
  const limite = sumarDias(hoy, -DIAS_ATRAS_VENTA);
  if (datos.fecha_inicio < limite) {
    throw new ErrorValidacion(
      `Una venta ya hecha se puede registrar con fecha de hasta ${DIAS_ATRAS_VENTA} días atrás ` +
        `(desde el ${fechaLegible(limite)}).`
    );
  }
  const pieza = await leerPieza(datos.mueble_id);
  const reserva = await insertarEnCalendario(
    {
      mueble_id: pieza.id,
      tipo: 'venta',
      estado: 'confirmada',
      fecha_inicio: datos.fecha_inicio,
      dias_margen: 0,
      origen: 'manual',
      motivo: datos.motivo,
      historial: lineaCreada(`Venta fuera de la web: ${datos.motivo}`, ahora)
    },
    { ahora, mensaje: chocaLaVenta }
  );
  if (datos.fecha_inicio <= hoy) await moverPieza(pieza.id, 'vendido');
  return { reserva, pieza };
};

module.exports = {
  COLUMNAS_LISTA,
  MAX_TODAS,
  MAX_BUSQUEDA,
  MAX_CALENDARIO,
  DIAS_ATRAS_VENTA,
  MENSAJE_RESERVA_NO_ENCONTRADA,
  MENSAJE_REEMBOLSO_EN_CURSO,
  MENSAJE_REEMBOLSO_A_MEDIAS,
  MENSAJE_REINTENTO_FALLIDO,
  MENSAJE_REEMBOLSO_RECHAZADO,
  MENSAJE_REEMBOLSO_SIN_GUARDAR,
  MENSAJE_SIN_REEMBOLSO_A_MEDIAS,
  MENSAJE_ACCION_NO_EXISTE,
  MENSAJE_CHOQUE_DESAPARECIDO,
  LINEA_DADO_POR_HECHO,
  claveDeReembolso,
  situacion,
  presentar,
  presentarFilas,
  listarReservas,
  calendarioDeReservas,
  resumenDeAvisos,
  agendaDeHoy,
  ejecutarAccion,
  crearBloqueo,
  crearAlquiler,
  crearVenta,
  moverPieza,
  leerReserva,
  buscarChoques,
  describirReserva,
  datosDelCorreo
};
