// Lógica compartida para dar por bueno un pago de Stripe Checkout. La usan dos caminos que
// pueden ejecutarse a la vez para la misma compra:
//   1. El webhook (POST /api/stripe/webhook): el camino principal, no depende del navegador.
//   2. confirmar-sesion: el respaldo, que se dispara al volver el comprador a /checkout/exito.
// Por eso procesarSesionPagada es idempotente: llamarla varias veces (o a la vez) con la
// misma sesión deja UN pedido, y solo quien lo registra envía los emails.
const crypto = require('crypto');
const supabase = require('../data/supabase');
const email = require('./email');
const { juntarItems, leerItemsDeMetadata } = require('./metadataStripe');
const { escaparIlike } = require('./ilike');
const { enviarTodos } = require('./enviarTodos');
const { registrarVenta, cancelarVentaDeSesion, tieneVentaDeSesion } = require('./calendarioReservas');

const CODIGO_VIOLACION_UNICIDAD = '23505';

// Espacio de nombres fijo para derivar el id de cada pedido a partir de su sesión de Stripe.
const ESPACIO_ID_PEDIDOS = '3d6f1c2e-8a4b-4c7d-9e0f-a1b2c3d4e5f6';

// UUID v5 (determinista) de la sesión de Stripe. Se usa como clave primaria del pedido: si
// el webhook y la página de éxito procesan la misma compra a la vez, sus dos INSERT llevan
// el mismo id y la base de datos solo admite uno (error 23505). Así la idempotencia es
// atómica sin depender de un índice adicional; el índice único sobre stripe_session_id que
// llegará con las migraciones es una segunda red de seguridad, no un requisito.
// Cuándo revertirlo: una vez ese índice único esté aplicado en producción se puede volver a
// un UUID aleatorio (quitando `id` del INSERT en registrarPedido); el manejo del 23505 sigue
// valiendo tal cual, porque el índice devuelve el mismo error.
const idPedidoDeSesion = (sessionId) => {
  const hash = crypto.createHash('sha1')
    .update(Buffer.from(ESPACIO_ID_PEDIDOS.replace(/-/g, ''), 'hex'))
    .update(String(sessionId))
    .digest();
  hash[6] = (hash[6] & 0x0f) | 0x50; // versión 5
  hash[8] = (hash[8] & 0x3f) | 0x80; // variante RFC 4122
  const h = hash.subarray(0, 16).toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
};

// Piezas del carrito que crearSesionPago guardó en la metadata de la sesión de Stripe.
// Devuelve null si no hay o no se pueden leer (p. ej. una sesión que no es de esta tienda).
const leerItemsDeSesion = (session) => leerItemsDeMetadata(session?.metadata);

const leerClienteDeSesion = (session) => ({
  nombre: session.metadata.clienteNombre,
  email: session.metadata.clienteEmail,
  telefono: session.metadata.clienteTelefono,
  direccion: session.metadata.clienteDireccion,
  notas: session.metadata.clienteNotas,
  metodoPago: 'Tarjeta (Stripe)'
});

const existePedidoDeSesion = async (sessionId) => {
  // limit(1) y no maybeSingle(): este último devuelve un error si hay más de una fila, y
  // una sesión con pedidos duplicados haría fallar todos los reintentos en lugar de
  // reconocerla como ya registrada.
  const { data, error } = await supabase
    .from('pedidos')
    .select('id')
    .eq('stripe_session_id', sessionId)
    .limit(1);

  if (error) throw error;
  return Boolean(data && data.length > 0);
};

// Líneas del pedido a partir de la metadata. A diferencia de construirLineasDesdeCarrito
// (que valida stock ANTES de cobrar), aquí el cobro ya se ha hecho: no se rechaza nada
// aunque la pieza ya no esté disponible o haya desaparecido del catálogo, porque el pedido
// hay que registrarlo igualmente. El total del pedido sale de Stripe, no de estas líneas.
const cargarLineasPagadas = async (items) => {
  const ids = items.map(item => item.productId);
  const { data: muebles, error } = await supabase
    .from('muebles')
    .select('id, nombre, precio_venta, precio_alquiler_dia, referencia')
    .in('id', ids);

  if (error) throw error;

  return items.map(item => {
    const modalidad = item.modalidad === 'alquiler' ? 'alquiler' : 'compra';
    const mueble = (muebles || []).find(m => m.id === item.productId);
    if (!mueble) {
      console.error(`Pago recibido de una pieza que ya no existe en el catálogo: ${item.productId}`);
    }
    return {
      productId: item.productId,
      nombre: mueble ? mueble.nombre : '(pieza eliminada del catálogo)',
      modalidad,
      cantidad: 1, // son piezas únicas: siempre 1
      precio: (mueble && (modalidad === 'alquiler' ? mueble.precio_alquiler_dia : mueble.precio_venta)) || 0,
      // Solo para el correo de confirmación al comprador: registrarPedido la quita antes de
      // guardar, así que los items de `pedidos` conservan su forma de siempre.
      referencia: (mueble && mueble.referencia) || null
    };
  });
};

// Marca cada pieza como vendida/alquilada con una actualización CONDICIONAL: solo pasa a
// vendida/alquilada la que sigue "disponible". Es una única operación atómica en la base de
// datos (sin "leer y luego escribir"), no pisa nunca el estado que otra persona haya puesto
// (otro comprador, o el admin desde el panel) y repetirla no cambia nada.
// Devuelve, por línea, el estado que se buscaba (`deseado`) y en el que ha quedado la pieza
// (`actual`, null si ya no existe). Si no eran el mismo, la pieza era de otro: es un conflicto.
// Solo se cambia `estado`: la base de datos recalcula `disponible` a partir de él (trigger
// trg_sync_disponible_desde_estado).
const marcarPiezas = async (lineas) => {
  const resultados = [];
  for (const linea of lineas) {
    const deseado = linea.modalidad === 'compra' ? 'vendido' : 'alquilado';

    const { data: actualizadas, error } = await supabase
      .from('muebles')
      .update({ estado: deseado })
      .eq('id', linea.productId)
      .eq('estado', 'disponible')
      .select('id');

    if (error) throw error;
    if (actualizadas && actualizadas.length > 0) {
      resultados.push({ productId: linea.productId, deseado, actual: deseado });
      continue;
    }

    // No se actualizó nada: la pieza no estaba disponible (o ya no existe). Se mira cómo
    // está, sin tocarla. Que ya esté en el estado buscado es lo normal en un reintento o
    // cuando el webhook y el respaldo coinciden; cualquier otro estado es de otra persona.
    const { data: pieza, error: errorLectura } = await supabase
      .from('muebles')
      .select('estado')
      .eq('id', linea.productId)
      .maybeSingle();

    if (errorLectura) throw errorLectura;
    resultados.push({ productId: linea.productId, deseado, actual: pieza ? pieza.estado : null });
  }
  return resultados;
};

// Reservas por fechas (docs/reservas-diseno.md, 6.7): cada pieza comprada deja su fila de venta en
// el calendario, de hoy sin fin. Devuelve, por pieza comprada, lo que dijo registrarVenta. Va antes
// de marcar las piezas y de registrar el pedido: si se hiciera después, un fallo entre medias dejaría
// la venta sin fila para siempre, porque el reintento ve el pedido y no repite nada. Con 'conflicto'
// (la pieza tenía un alquiler o un bloqueo) la pieza NO se marca como vendida: quedaría vendida sin
// fila de venta y con un alquiler vivo. Con 'vendida' (otra venta) sí, como antes: ya lo estaba. En
// los dos casos el pedido se registra igual y se avisa al admin.
// Los alquileres por días de la cesta (el flujo antiguo, H7) no tienen fechas: no dejan fila.
const registrarVentas = async (lineas, sessionId) => {
  const ventas = new Map();
  for (const linea of lineas) {
    if (linea.modalidad !== 'compra') continue;
    ventas.set(linea.productId, await registrarVenta({ muebleId: linea.productId, sessionId }));
  }
  return ventas;
};

// Después de marcar las piezas: si una pieza comprada ya era de otro según `muebles.estado` (alquilada
// con el alquiler por días de la cesta, o vendida a mano fuera de la web), es la doble venta de
// siempre y su fila de venta, recién insertada (o de un intento anterior), se cancela. Si se quedara,
// la pieza no se podría volver a vender cuando quedara libre. Se anota en `ventas` como 'anulada'.
const anularVentasDeOtroEstado = async (resultados, ventas, sessionId) => {
  for (const r of resultados) {
    const venta = ventas.get(r.productId);
    if (venta !== 'registrada' && venta !== 'ya_registrada') continue;
    if (!r.actual || r.actual === 'disponible' || r.actual === r.deseado) continue;
    await cancelarVentaDeSesion({ muebleId: r.productId, sessionId, estadoDeLaPieza: r.actual });
    ventas.set(r.productId, 'anulada');
  }
};

// El webhook y la página de éxito procesan la misma sesión a la vez, y el calendario puede cambiar
// entre una y otra (caduca una provisional, o pasa la medianoche): una puede dar 'conflicto' y la
// otra registrar la venta. Solo avisa quien registra el pedido, así que antes de avisar se mira si la
// venta de esta sesión ya está; si está, no era un conflicto (y la otra llamada ya marcó la pieza).
const revisarConflictos = async (ventas, sessionId) => {
  for (const [productId, venta] of ventas) {
    if (venta !== 'conflicto') continue;
    if (await tieneVentaDeSesion({ muebleId: productId, sessionId })) ventas.set(productId, 'ya_registrada');
  }
};

// Migración B (ver docs/tarea3-diseno.md): id de la cuenta cuyo email coincide con el que se
// usó al comprar, o null. Email sin distinguir mayúsculas y ESCAPADO, para que un "_" no haga de
// comodín (H17). H18: solo cuentas con el email VERIFICADO. Una cuenta sin verificar pudo crearla
// cualquiera con el email de otra persona, y se quedaría con sus compras. Los pedidos que quedan
// sin cuenta se asocian cuando alguien verifica ese email (utils/verificacionEmail.js). Ojo: el
// email lo escribe el comprador en el checkout de invitado, sin verificar, así que cliente_id dice
// "se compró con el email de esa cuenta", no "lo compró el titular de esa cuenta".
// Nunca impide registrar el pedido: sin una coincidencia única (ninguna, o varias cuentas que
// solo cambian en mayúsculas) o si la consulta falla, devuelve null y el pedido se guarda
// igual; el backfill B3 puede rellenarlo después.
const buscarClienteIdPorEmail = async (emailComprador) => {
  if (!emailComprador) return null;
  const { data, error } = await supabase
    .from('clientes')
    .select('id')
    .ilike('email', escaparIlike(emailComprador))
    .eq('email_verificado', true)
    .limit(2);

  if (error) {
    console.error('No se pudo buscar la cuenta del comprador; el pedido se guarda sin cliente_id:', error.message);
    return null;
  }
  return data && data.length === 1 ? data[0].id : null;
};

// Guarda el pedido para el panel de administración. `creado` es true solo para quien lo
// inserta de verdad. Si otra petición lo registra a la vez, su INSERT choca con el nuestro
// en la clave primaria (id derivado de la sesión, ver idPedidoDeSesion) o, cuando exista,
// en el índice único de stripe_session_id: en ambos casos llega un 23505 y `creado` es false.
// También lo usan las reservas por fechas (utils/reservas.js), con su propio `metodoEntrega`
// ('domicilio' o 'recogida' en tienda); la compra sigue siendo siempre a domicilio.
const registrarPedido = async ({
  lineas,
  cliente,
  clienteId,
  total,
  sessionId,
  metodoEntrega = 'domicilio'
}) => {
  const id = idPedidoDeSesion(sessionId);
  const { error } = await supabase.from('pedidos').insert({
    id,
    items: lineas.map(({ referencia: _referencia, ...linea }) => linea),
    cliente_info: cliente,
    cliente_id: clienteId,
    total,
    metodo_entrega: metodoEntrega,
    direccion_envio: cliente.direccion || null,
    estado: 'procesando',
    stripe_session_id: sessionId
  });

  if (error) {
    if (error.code === CODIGO_VIOLACION_UNICIDAD) return { creado: false, id };
    throw error;
  }
  return { creado: true, id };
};

// Doble venta: dos compradores han pagado la misma pieza única (p. ej. una sesión de pago
// que se dejó abierta mientras otra persona la compraba o la alquilaba). Hay conflicto si
// se da alguna de estas tres señales, ninguna de las cuales salta con un simple reintento
// ni con el gemelo webhook/respaldo (que dejan la pieza en el MISMO estado buscado):
//   - la pieza estaba en otro estado que el buscado (vendida/alquilada por otra persona)
//   - OTRO pedido no cancelado ya incluye esa pieza como compra
//   - el calendario de la pieza no admitió su fila de venta (registrarVentas, 6.7): ya tenía otra
//     venta, o un alquiler o un bloqueo
// Es un aviso: si la consulta falla se registra y se sigue, nunca se pierde un pedido.
//
// El filtro jsonb va como CADENA JSON: si se pasara un array de objetos, postgrest-js lo
// serializaría como literal de array de Postgres ("{[object Object]}") y la base de datos
// lo rechazaría siempre. Lo fija el test de contrato queryContract.test.js.
const detectarConflictos = async (lineas, idPedido, resultados, ventas) => {
  const conflictos = [];
  for (const linea of lineas) {
    const motivos = [];
    const resultado = resultados.find(r => r.productId === linea.productId);
    if (resultado && resultado.actual && resultado.actual !== 'disponible' && resultado.actual !== resultado.deseado) {
      motivos.push(`la pieza ya figuraba como "${resultado.actual}" cuando se cobró`);
    }
    if (ventas.get(linea.productId) === 'anulada') {
      motivos.push('su venta no se ha dejado en el calendario');
    }
    const enCalendario = ventas.get(linea.productId) === 'conflicto';
    if (enCalendario) {
      motivos.push('tenía reservas o un bloqueo en el calendario cuando se cobró: no se ha registrado la venta ni se ha marcado como vendida');
    }
    if (ventas.get(linea.productId) === 'vendida') {
      motivos.push('el calendario ya tenía registrada otra venta de esta pieza');
    }

    let pedidoAnteriorId = null;
    const { data, error } = await supabase
      .from('pedidos')
      .select('id')
      .contains('items', JSON.stringify([{ productId: linea.productId, modalidad: 'compra' }]))
      .neq('id', idPedido)
      .neq('estado', 'cancelado')
      .limit(1);

    if (error) {
      console.error(`No se pudo comprobar si la pieza ${linea.productId} ya estaba vendida:`, error.message || error);
    } else if (data && data.length > 0) {
      pedidoAnteriorId = data[0].id;
      motivos.push(`ya se había vendido en el pedido ${pedidoAnteriorId}`);
    }

    if (motivos.length > 0) {
      conflictos.push({ productId: linea.productId, nombre: linea.nombre, motivos, pedidoAnteriorId, enCalendario });
    }
  }
  return conflictos;
};

// Un solo aviso por compra, con todas sus piezas en conflicto. Si alguna tenía reservas, el
// administrador puede reembolsar o, si el comprador acepta, entregarla cuando quede libre (la
// entrega diferida del 6.7).
const avisarConflictos = async ({ conflictos, sessionId, cliente, total }) => {
  for (const c of conflictos) {
    console.error(
      `[ALERTA] Posible doble venta de "${c.nombre}" (${c.productId}): ${c.motivos.join('; ')}. ` +
      `Se ha cobrado la sesión ${sessionId}. Revisar y valorar un reembolso.`
    );
  }
  const conReservas = conflictos.some(c => c.enCalendario);
  await enviarTodos([() => email.enviarAlertaAdmin({
    asunto: conReservas ? 'Compra cobrada de una pieza con reservas' : 'Posible doble venta de una pieza única',
    detalles: [
      ...conflictos.map(c => `"${c.nombre}" (${c.productId}): ${c.motivos.join('; ')}.`),
      `Sesión de Stripe del cobro afectado: ${sessionId}`,
      `Comprador: ${cliente.nombre || 'sin nombre'} <${cliente.email || 'sin email'}>`,
      `Importe cobrado: ${total.toFixed(2)} €`,
      'Revisa ambos pedidos en el panel y, si procede, reembolsa el segundo desde el Dashboard de Stripe.',
      ...(conReservas
        ? ['Si la pieza tenía reservas, también puedes ofrecer al comprador entregársela cuando quede libre. La venta no consta en el calendario: habrá que registrarla a mano desde ese día.']
        : [])
    ]
  })]);
};

// Da por bueno el pago de una sesión de Stripe ya pagada. Devuelve:
//   { estado: 'procesada' | 'ya_procesada' | 'ignorada', total, conflictos }
// Lanza si falla la base de datos: el webhook responde entonces 500 para que Stripe
// reintente, y el respaldo de confirmar-sesion lo registra en el log y avisa al admin.
//
// El orden importa. Si la sesión ya tiene pedido no se toca NADA (ni las piezas, que el admin
// pudo cambiar después). Si no, la fila de venta de cada pieza (6.7) y marcar las piezas son
// idempotentes y van antes de registrar el pedido: un fallo en cualquier paso previo deja un
// reintento limpio, y solo quien consigue registrar el pedido envía los emails.
const procesarSesionPagada = async (session) => {
  const total = (session.amount_total || 0) / 100;

  const items = leerItemsDeSesion(session);
  if (!items) return { estado: 'ignorada', total, conflictos: [] };

  if (await existePedidoDeSesion(session.id)) {
    return { estado: 'ya_procesada', total, conflictos: [] };
  }

  const cliente = leerClienteDeSesion(session);
  const lineas = await cargarLineasPagadas(items);
  const ventas = await registrarVentas(lineas, session.id);
  const resultados = await marcarPiezas(lineas.filter(l => ventas.get(l.productId) !== 'conflicto'));
  await anularVentasDeOtroEstado(resultados, ventas, session.id);
  const clienteId = await buscarClienteIdPorEmail(cliente.email);

  const { creado, id } = await registrarPedido({ lineas, cliente, clienteId, total, sessionId: session.id });
  if (!creado) return { estado: 'ya_procesada', total, conflictos: [] };

  await revisarConflictos(ventas, session.id);
  const conflictos = await detectarConflictos(lineas, id, resultados, ventas);

  await enviarTodos([
    () => email.enviarNotificacionVenta({ items: lineas, clienteInfo: cliente, total, fecha: new Date() }),
    () => email.enviarConfirmacionCliente({
      id, items: lineas, clienteInfo: cliente, total, fecha: new Date(), conCuenta: Boolean(clienteId)
    })
  ]);
  if (conflictos.length > 0) {
    await avisarConflictos({ conflictos, sessionId: session.id, cliente, total });
  }

  return { estado: 'procesada', total, conflictos };
};

// Avisa al administrador de un pago cobrado que no se pudo registrar. Es la red de seguridad
// de confirmar-sesion cuando no hay webhook que reintente: sin este correo el cobro solo
// quedaría en el log de Vercel y en el Dashboard de Stripe.
const avisarPagoSinRegistrar = async (session, error) => {
  const meta = session.metadata || {};
  await enviarTodos([() => email.enviarAlertaAdmin({
    asunto: 'Pago cobrado que no se ha podido registrar',
    detalles: [
      `Sesión de Stripe: ${session.id}`,
      `Importe cobrado: ${((session.amount_total || 0) / 100).toFixed(2)} €`,
      `Comprador: ${meta.clienteNombre || 'sin nombre'} <${meta.clienteEmail || 'sin email'}> · ${meta.clienteTelefono || 'sin teléfono'}`,
      `Dirección de entrega: ${meta.clienteDireccion || 'sin dirección'}`,
      `Piezas (ID y modalidad): ${juntarItems(meta) || 'sin datos'}`,
      `Motivo del fallo: ${(error && error.message) || error}`,
      'El pago está cobrado pero el pedido no consta en el panel. Regístralo a mano o configura el webhook de Stripe para que se reintente solo.'
    ]
  })]);
};

module.exports = { procesarSesionPagada, avisarPagoSinRegistrar, idPedidoDeSesion, registrarPedido };
