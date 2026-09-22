// Lógica compartida para dar por bueno un pago de Stripe Checkout. La usan dos caminos que
// pueden ejecutarse a la vez para la misma compra:
//   1. El webhook (POST /api/stripe/webhook): el camino principal, no depende del navegador.
//   2. confirmar-sesion: el respaldo, que se dispara al volver el comprador a /checkout/exito.
// Por eso procesarSesionPagada es idempotente: llamarla varias veces (o a la vez) con la
// misma sesión deja UN pedido, y solo quien lo registra envía los emails.
const crypto = require('crypto');
const supabase = require('../data/supabase');
const email = require('./email');

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
const leerItemsDeSesion = (session) => {
  const bruto = session?.metadata?.items;
  if (!bruto) return null;
  try {
    const items = JSON.parse(bruto);
    // Cada elemento debe ser un objeto con productId: una metadata corrupta (p. ej. [null])
    // haría fallar el procesado siempre y Stripe reintentaría el webhook durante días.
    const validos = Array.isArray(items) && items.length > 0
      && items.every(item => item && typeof item.productId === 'string' && item.productId.length > 0);
    return validos ? items : null;
  } catch {
    return null;
  }
};

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
    .select('id, nombre, precio_venta, precio_alquiler_dia')
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
      precio: (mueble && (modalidad === 'alquiler' ? mueble.precio_alquiler_dia : mueble.precio_venta)) || 0
    };
  });
};

// Marca cada pieza como vendida/alquilada con una actualización CONDICIONAL: solo pasa a
// vendida/alquilada la que sigue "disponible". Es una única operación atómica en la base de
// datos (sin "leer y luego escribir"), no pisa nunca el estado que otra persona haya puesto
// (otro comprador, o el admin desde el panel) y repetirla no cambia nada.
// Devuelve, por línea, el estado que se buscaba (`deseado`) y en el que ha quedado la pieza
// (`actual`, null si ya no existe). Si no eran el mismo, la pieza era de otro: es un conflicto.
const marcarPiezas = async (lineas) => {
  const resultados = [];
  for (const linea of lineas) {
    const deseado = linea.modalidad === 'compra' ? 'vendido' : 'alquilado';

    const { data: actualizadas, error } = await supabase
      .from('muebles')
      .update({ estado: deseado, disponible: false })
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

// Guarda el pedido para el panel de administración. `creado` es true solo para quien lo
// inserta de verdad. Si otra petición lo registra a la vez, su INSERT choca con el nuestro
// en la clave primaria (id derivado de la sesión, ver idPedidoDeSesion) o, cuando exista,
// en el índice único de stripe_session_id: en ambos casos llega un 23505 y `creado` es false.
const registrarPedido = async ({ lineas, cliente, total, sessionId }) => {
  const id = idPedidoDeSesion(sessionId);
  const { error } = await supabase.from('pedidos').insert({
    id,
    items: lineas,
    cliente_info: cliente,
    total,
    metodo_entrega: 'domicilio',
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
// se da alguna de estas dos señales, ninguna de las cuales salta con un simple reintento
// ni con el gemelo webhook/respaldo (que dejan la pieza en el MISMO estado buscado):
//   - la pieza estaba en otro estado que el buscado (vendida/alquilada por otra persona)
//   - OTRO pedido no cancelado ya incluye esa pieza como compra
// Es un aviso: si la consulta falla se registra y se sigue, nunca se pierde un pedido.
//
// El filtro jsonb va como CADENA JSON: si se pasara un array de objetos, postgrest-js lo
// serializaría como literal de array de Postgres ("{[object Object]}") y la base de datos
// lo rechazaría siempre. Lo fija el test de contrato queryContract.test.js.
const detectarConflictos = async (lineas, idPedido, resultados) => {
  const conflictos = [];
  for (const linea of lineas) {
    const motivos = [];
    const resultado = resultados.find(r => r.productId === linea.productId);
    if (resultado && resultado.actual && resultado.actual !== 'disponible' && resultado.actual !== resultado.deseado) {
      motivos.push(`la pieza ya figuraba como "${resultado.actual}" cuando se cobró`);
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
      conflictos.push({ productId: linea.productId, nombre: linea.nombre, motivos, pedidoAnteriorId });
    }
  }
  return conflictos;
};

// Tiempo máximo que se espera a los emails antes de responder. Resend suele tardar menos de
// un segundo, pero sin este tope una caída lenta del proveedor dejaría colgados al webhook
// (Stripe acabaría dándolo por fallido y lo reintentaría) y la página de éxito del comprador.
const TIEMPO_MAXIMO_EMAILS_MS = 8000;

// Ninguna función de email lanza (capturan sus errores), pero se esperan aquí con allSettled
// por si una lo hiciera: un fallo de correo nunca debe tumbar el pago. Se espera a que
// terminen porque en Vercel la función se congela al responder y un envío pendiente podría
// no completarse; por eso solo se deja de esperar pasado TIEMPO_MAXIMO_EMAILS_MS.
const enviarTodos = async (envios) => {
  let temporizador;
  const limite = new Promise(resolver => {
    temporizador = setTimeout(() => resolver('limite'), TIEMPO_MAXIMO_EMAILS_MS);
  });
  const enviados = Promise.allSettled(envios.map(envio => (async () => envio())())).then(() => 'enviados');

  const resultado = await Promise.race([enviados, limite]);
  clearTimeout(temporizador);
  if (resultado === 'limite') {
    console.warn(`Los emails tardan más de ${TIEMPO_MAXIMO_EMAILS_MS / 1000} s: se responde sin esperar a que terminen.`);
  }
};

const avisarConflictos = async ({ conflictos, sessionId, cliente, total }) => {
  for (const c of conflictos) {
    console.error(
      `[ALERTA] Posible doble venta de "${c.nombre}" (${c.productId}): ${c.motivos.join('; ')}. ` +
      `Se ha cobrado la sesión ${sessionId}. Revisar y valorar un reembolso.`
    );
  }
  await enviarTodos([() => email.enviarAlertaAdmin({
    asunto: 'Posible doble venta de una pieza única',
    detalles: [
      ...conflictos.map(c => `"${c.nombre}" (${c.productId}): ${c.motivos.join('; ')}.`),
      `Sesión de Stripe del cobro afectado: ${sessionId}`,
      `Comprador: ${cliente.nombre || 'sin nombre'} <${cliente.email || 'sin email'}>`,
      `Importe cobrado: ${total.toFixed(2)} €`,
      'Revisa ambos pedidos en el panel y, si procede, reembolsa el segundo desde el Dashboard de Stripe.'
    ]
  })]);
};

// Da por bueno el pago de una sesión de Stripe ya pagada. Devuelve:
//   { estado: 'procesada' | 'ya_procesada' | 'ignorada', total, conflictos }
// Lanza si falla la base de datos: el webhook responde entonces 500 para que Stripe
// reintente, y el respaldo de confirmar-sesion lo registra en el log y avisa al admin.
//
// El orden importa. Si la sesión ya tiene pedido no se toca NADA (ni las piezas, que el admin
// pudo cambiar después). Si no, marcar las piezas es idempotente y va antes de registrar el
// pedido: un fallo en cualquier paso previo deja un reintento limpio, y solo quien consigue
// registrar el pedido envía los emails.
const procesarSesionPagada = async (session) => {
  const total = (session.amount_total || 0) / 100;

  const items = leerItemsDeSesion(session);
  if (!items) return { estado: 'ignorada', total, conflictos: [] };

  if (await existePedidoDeSesion(session.id)) {
    return { estado: 'ya_procesada', total, conflictos: [] };
  }

  const cliente = leerClienteDeSesion(session);
  const lineas = await cargarLineasPagadas(items);
  const resultados = await marcarPiezas(lineas);

  const { creado, id } = await registrarPedido({ lineas, cliente, total, sessionId: session.id });
  if (!creado) return { estado: 'ya_procesada', total, conflictos: [] };

  const conflictos = await detectarConflictos(lineas, id, resultados);

  await enviarTodos([
    () => email.enviarNotificacionVenta({ items: lineas, clienteInfo: cliente, total, fecha: new Date() }),
    () => email.enviarConfirmacionCliente({ items: lineas, clienteInfo: cliente, total, fecha: new Date() })
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
      `Piezas (ID y modalidad): ${meta.items || 'sin datos'}`,
      `Motivo del fallo: ${(error && error.message) || error}`,
      'El pago está cobrado pero el pedido no consta en el panel. Regístralo a mano o configura el webhook de Stripe para que se reintente solo.'
    ]
  })]);
};

module.exports = { procesarSesionPagada, avisarPagoSinRegistrar, idPedidoDeSesion };
