// El calendario de cada pieza, la tabla `reservas` (docs/reservas-diseno.md): lo que comparten la
// compra (crear-sesion-pago y utils/pagos.js) y las reservas por fechas (utils/reservas.js). Va
// aparte para que pagos.js no dependa de reservas.js, que ya depende de él (registrarPedido).
const supabase = require('../data/supabase');
const { ESTADOS_QUE_OCUPAN, ocupacionDesdeHoy, finDeLaOcupacion } = require('./disponibilidad');
const { hoyEnMadrid } = require('./fechasMadrid');

const CODIGO_EXCLUSION = '23P01';
const CODIGO_UNICIDAD = '23505';
const CODIGO_CLAVE_AJENA = '23503';
// Dos inserciones que se solapan casi a la vez pueden acabar en interbloqueo en vez de en 23P01:
// Postgres mete la entrada del índice de exclusión antes de mirar los conflictos, y cada una puede
// quedarse esperando a la otra (reproducido en PostgreSQL 16 con dos sesiones insertando la misma
// venta: unos 2 de cada 1.000 pares). Postgres aborta una con 40P01; se trata como un 23P01.
const CODIGO_INTERBLOQUEO = '40P01';
const chocaEnCalendario = (error) =>
  error?.code === CODIGO_EXCLUSION || error?.code === CODIGO_INTERBLOQUEO;

// 4.6: la restricción no puede mirar la hora, así que una provisional cuyo plazo ya pasó sigue
// ocupando el calendario hasta que alguien la marque expirada. Esto se hace antes de cada escritura
// en el calendario de la pieza, nunca con un proceso programado.
const liberarProvisionalesCaducadas = async (muebleId, ahora = new Date()) => {
  const { error } = await supabase
    .from('reservas')
    .update({ estado: 'expirada' })
    .eq('mueble_id', muebleId)
    .eq('estado', 'pendiente')
    .lt('expira_en', ahora.toISOString());
  if (error) throw error;
};

// Toda escritura que ocupe el calendario de una pieza pasa por aquí (4.6): primero se limpian las
// provisionales caducadas, y un 23P01 solo cuenta como conflicto si vuelve a salir después de limpiar
// otra vez (pudo caducar una entre la limpieza y la escritura). Un interbloqueo (40P01) también se
// reintenta: el segundo intento ya ve la otra escritura terminada y da 23P01 o entra. `escribir` lanza
// la consulta y devuelve lo mismo que supabase-js, { data, error }.
const escribirEnCalendario = async (muebleId, escribir) => {
  await liberarProvisionalesCaducadas(muebleId);
  const resultado = await escribir();
  if (!chocaEnCalendario(resultado.error)) return resultado;
  await liberarProvisionalesCaducadas(muebleId);
  return escribir();
};

// 6.7, antes de cobrar una compra: lo que ocupa cada pieza de hoy en adelante, con la misma
// definición que la ficha (ocupacionDesdeHoy). Devuelve un Map solo con las piezas ocupadas:
// { vendida, hasta }, con `hasta` el primer día libre (null si algo no tiene fin). Las provisionales
// caducadas no cuentan, igual que en la ficha, así que leer no necesita limpiar nada.
const leerOcupacionParaCompra = async (muebleIds, ahora = new Date()) => {
  const hoy = hoyEnMadrid(ahora);
  const { data, error } = await supabase
    .from('reservas')
    .select('mueble_id, tipo, estado, rango_ocupado, expira_en')
    .in('mueble_id', muebleIds)
    .in('estado', ESTADOS_QUE_OCUPAN)
    .overlaps('rango_ocupado', `[${hoy},)`);
  if (error) throw error;

  const ocupacion = new Map();
  for (const id of muebleIds) {
    const ocupadas = ocupacionDesdeHoy(
      data.filter((fila) => fila.mueble_id === id),
      hoy,
      ahora
    );
    if (ocupadas.length === 0) continue;
    ocupacion.set(id, {
      vendida: ocupadas.some((o) => o.tipo === 'venta'),
      hasta: finDeLaOcupacion(ocupadas)
    });
  }
  return ocupacion;
};

// 6.7, al confirmar el pago de una compra: la fila de venta de la pieza, de hoy (en Madrid) sin fin.
// Devuelve:
//   'registrada'     la ha insertado esta llamada;
//   'ya_registrada'  ya estaba (un reintento, o el webhook y la página de éxito a la vez);
//   'vendida'        la pieza ya tenía otra venta (la doble venta de siempre, H5);
//   'conflicto'      la pieza tenía un alquiler o un bloqueo en el calendario;
//   'sin_pieza'      la pieza ya no existe en el catálogo (el pedido se registra igual).
// Un INSERT normal, nunca upsert(..., { ignoreDuplicates: true }) (3.2): fallaría con 42P10 o se
// tragaría el 23P01.
//
// Ojo con el orden: Postgres comprueba las restricciones en el orden en que se crearon, y en R2 la
// exclusión va antes que la unicidad de (stripe_session_id, mueble_id). Repetir la venta de la misma
// sesión no da 23505 sino 23P01, porque se solapa con la suya (comprobado en PostgreSQL 16). Así que
// tras un 23P01 se mira la venta confirmada de la pieza, que solo puede haber una (todas van sin fin
// y se solaparían): si es de esta sesión, ya estaba; si es de otra, es una doble venta y no un choque
// con reservas, para que el aviso al administrador no proponga entregarla "cuando quede libre".
const registrarVenta = async ({ muebleId, sessionId, ahora = new Date() }) => {
  const fila = {
    mueble_id: muebleId,
    tipo: 'venta',
    estado: 'confirmada',
    fecha_inicio: hoyEnMadrid(ahora),
    stripe_session_id: sessionId,
    historial: [
      {
        fecha: ahora.toISOString(),
        tipo: 'creada',
        detalle: 'Compra pagada en la web.',
        por: 'sistema'
      }
    ],
    origen: 'web'
  };
  const { error } = await escribirEnCalendario(muebleId, () =>
    supabase.from('reservas').insert(fila)
  );
  if (!error) return 'registrada';
  if (error.code === CODIGO_UNICIDAD) return 'ya_registrada';
  if (error.code === CODIGO_CLAVE_AJENA) return 'sin_pieza';
  if (!chocaEnCalendario(error)) throw error;

  const { data, error: errorLectura } = await supabase
    .from('reservas')
    .select('stripe_session_id')
    .eq('mueble_id', muebleId)
    .eq('tipo', 'venta')
    .eq('estado', 'confirmada')
    .limit(1);
  if (errorLectura) throw errorLectura;
  if (data.length === 0) return 'conflicto';
  return data[0].stripe_session_id === sessionId ? 'ya_registrada' : 'vendida';
};

// Cancela las ventas confirmadas que cumplen `filtros` (columna: valor), con su motivo y una línea en
// el historial. Como mucho hay una por pieza (todas van sin fin); se lee para añadir la línea. El
// UPDATE solo vale si sigue confirmada: repetirlo no cambia nada.
const cancelarVentas = async (filtros, { motivo, por, ahora = new Date() }) => {
  let consulta = supabase
    .from('reservas')
    .select('id, historial')
    .eq('tipo', 'venta')
    .eq('estado', 'confirmada');
  for (const [columna, valor] of Object.entries(filtros)) consulta = consulta.eq(columna, valor);
  const { data, error } = await consulta;
  if (error) throw error;
  for (const venta of data) {
    const { error: errorCancelar } = await supabase
      .from('reservas')
      .update({
        estado: 'cancelada',
        cancelada_en: ahora.toISOString(),
        cancelada_por: por,
        motivo_cancelacion: motivo,
        historial: [
          ...(venta.historial || []),
          { fecha: ahora.toISOString(), tipo: 'cancelada', detalle: motivo, por }
        ]
      })
      .eq('id', venta.id)
      .eq('estado', 'confirmada');
    if (errorCancelar) throw errorCancelar;
  }
};

// La pieza vuelve a estar a la venta desde el panel (el administrador la pasa de `vendido` a
// `disponible`, p. ej. tras cancelar y reembolsar la compra): su venta del calendario se cancela. Si
// no, la compra la seguiría rechazando como vendida, y la venta de quien la pagara chocaría con la
// antigua (las "filas sin venta" del 9.2). Vale mientras `muebles.estado` se edite a mano; cuando lo
// derive el calendario (3.3), el selector de estado desaparece del panel.
const cancelarVentasDeLaPieza = (muebleId, ahora = new Date()) =>
  cancelarVentas(
    { mueble_id: muebleId },
    { motivo: 'La pieza se ha vuelto a poner a la venta desde el panel.', por: 'admin', ahora }
  );

// La venta de una compra cobrada cuya pieza ya era de otro según `muebles.estado` (alquilada con el
// alquiler por días de la cesta, o vendida a mano fuera de la web): es la doble venta de siempre, y
// la pieza sigue siendo de quien la tenía. Su fila no puede quedarse ocupando el calendario, o la
// pieza no se podría volver a vender cuando quede libre.
const cancelarVentaDeSesion = ({ muebleId, sessionId, estadoDeLaPieza, ahora = new Date() }) =>
  cancelarVentas(
    { mueble_id: muebleId, stripe_session_id: sessionId },
    {
      motivo: `La pieza ya figuraba como "${estadoDeLaPieza}" cuando se cobró (posible doble venta).`,
      por: 'sistema',
      ahora
    }
  );

// ¿Tiene esta sesión su venta confirmada en el calendario de la pieza?
const tieneVentaDeSesion = async ({ muebleId, sessionId }) => {
  const { data, error } = await supabase
    .from('reservas')
    .select('id')
    .eq('mueble_id', muebleId)
    .eq('stripe_session_id', sessionId)
    .eq('tipo', 'venta')
    .eq('estado', 'confirmada')
    .limit(1);
  if (error) throw error;
  return data.length > 0;
};

module.exports = {
  CODIGO_EXCLUSION,
  CODIGO_UNICIDAD,
  CODIGO_CLAVE_AJENA,
  CODIGO_INTERBLOQUEO,
  chocaEnCalendario,
  liberarProvisionalesCaducadas,
  escribirEnCalendario,
  leerOcupacionParaCompra,
  registrarVenta,
  cancelarVentasDeLaPieza,
  cancelarVentaDeSesion,
  tieneVentaDeSesion
};
