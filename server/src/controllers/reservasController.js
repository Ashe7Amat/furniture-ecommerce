// Reservas por fechas (docs/reservas-diseno.md). Bloque R-a: los dos endpoints públicos de solo
// lectura (7.1 y 7.2). Bloque R-b: la reserva provisional y su sesión de pago (6.3), detrás del
// interruptor RESERVAS_ACTIVAS. Hasta que se aplique la migración R2 la tabla `reservas` no existe:
// no se puede llevar a `main` antes que ella.
const supabase = require('../data/supabase');
const stripeUtil = require('../utils/stripe');
const { ErrorValidacion, ErrorConflicto, ErrorReintentable } = require('../utils/errores');
const { preciosVisibles } = require('../utils/precios');
const { buscarCuentaVerificada } = require('../utils/cuentaVerificada');
const { iniciarPagoDeReserva } = require('../utils/reservas');
const { hoyEnMadrid } = require('../utils/fechasMadrid');
const { calcularPrecioReserva } = require('../utils/precioReserva');
const {
  ESTADOS_QUE_OCUPAN,
  ventanaDeConsulta,
  calcularDisponibilidad
} = require('../utils/disponibilidad');

const MENSAJE_ALQUILER_CERRADO =
  'El alquiler online no está disponible en este momento. Pregúntanos por la pieza en la página de contacto.';

// Sin caché (T11, 7.3): la disponibilidad cambia con cada reserva, y un calendario desfasado solo
// trae dudas y conflictos evitables. Lo que garantiza que no se solapen es la base de datos.
const SIN_CACHE = 'no-store';

// La pieza, o null si no existe (un id que no es un uuid también da error: es "no encontrada").
const leerMueble = async (id) => {
  const { data, error } = await supabase
    .from('muebles')
    .select('id, estado, precio_alquiler_dia')
    .eq('id', id)
    .maybeSingle();
  return error ? null : data;
};

// GET /api/muebles/:id/disponibilidad?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
const obtenerDisponibilidad = async (req, res) => {
  try {
    const ahora = new Date();
    const hoy = hoyEnMadrid(ahora);
    const { desde, hasta } = ventanaDeConsulta({
      desde: req.query.desde,
      hasta: req.query.hasta,
      hoy
    });

    const mueble = await leerMueble(req.params.id);
    if (!mueble) return res.status(404).json({ error: 'Mueble no encontrado.' });

    // Todo lo que ocupa la pieza de hoy en adelante: hace falta entero para saber si se puede
    // comprar (6.7), aunque el calendario solo enseñe la ventana pedida. Son pocas filas por pieza.
    const { data: filas, error } = await supabase
      .from('reservas')
      .select('tipo, estado, rango_ocupado, expira_en')
      .eq('mueble_id', mueble.id)
      .in('estado', ESTADOS_QUE_OCUPAN)
      .overlaps('rango_ocupado', `[${hoy},)`);
    if (error) throw error;

    res.set('Cache-Control', SIN_CACHE);
    res.status(200).json(
      calcularDisponibilidad({
        mueble,
        filas,
        hoy,
        ahora,
        desde,
        hasta,
        mostrarPrecio: preciosVisibles()
      })
    );
  } catch (error) {
    if (error instanceof ErrorValidacion) return res.status(400).json({ error: error.message });
    console.error('Error al obtener la disponibilidad:', error.message);
    res.status(500).json({ error: 'Error interno al consultar la disponibilidad.' });
  }
};

// GET /api/muebles/:id/presupuesto?fecha_inicio=&hora_entrega=&fecha_fin=&hora_recogida=&entrega=&recogida=
// Solo el precio (5.1): si las fechas están libres lo dice la disponibilidad, y lo garantizará la
// base de datos al reservar.
const obtenerPresupuesto = async (req, res) => {
  try {
    // Con los precios ocultos (MOSTRAR_PRECIOS, fase C), un presupuesto los revelaría.
    if (!preciosVisibles()) return res.status(403).json({ error: MENSAJE_ALQUILER_CERRADO });

    const mueble = await leerMueble(req.params.id);
    if (!mueble) return res.status(404).json({ error: 'Mueble no encontrado.' });
    if (mueble.estado === 'vendido') {
      throw new ErrorValidacion('Esta pieza no se puede alquilar.');
    }

    const { fecha_inicio, hora_entrega, fecha_fin, hora_recogida, entrega, recogida } = req.query;
    const presupuesto = calcularPrecioReserva({
      precioDia: mueble.precio_alquiler_dia,
      fechaInicio: fecha_inicio,
      horaEntrega: hora_entrega,
      fechaFin: fecha_fin,
      horaRecogida: hora_recogida,
      entrega,
      recogida,
      hoy: hoyEnMadrid()
    });

    res.set('Cache-Control', SIN_CACHE);
    res.status(200).json({ mueble_id: mueble.id, ...presupuesto });
  } catch (error) {
    if (error instanceof ErrorValidacion) return res.status(400).json({ error: error.message });
    console.error('Error al calcular el presupuesto:', error.message);
    res.status(500).json({ error: 'Error interno al calcular el presupuesto.' });
  }
};

// POST /api/reservas/sesion-pago -- exige sesión y el email de la cuenta verificado (T8). Crea la
// reserva provisional y devuelve la URL de pago de Stripe, { url }, como crear-sesion-pago.
const crearSesionPagoReserva = async (req, res) => {
  try {
    if (!preciosVisibles()) return res.status(403).json({ error: MENSAJE_ALQUILER_CERRADO });

    const stripe = stripeUtil.getStripe();
    if (!stripe) {
      return res
        .status(503)
        .json({ error: 'Los pagos con tarjeta todavía no están configurados en el servidor.' });
    }

    const { cuenta, rechazo } = await buscarCuentaVerificada(req.usuario, {
      columnas: 'id, email',
      mensajeSinVerificar: 'Confirma tu email para poder reservar.'
    });
    if (rechazo) return res.status(rechazo.status).json(rechazo.cuerpo);

    const { data: mueble, error } = await supabase
      .from('muebles')
      .select('id, nombre, estado, precio_alquiler_dia')
      .eq('id', req.body.mueble_id)
      .maybeSingle();
    if (error) throw error;
    if (!mueble) return res.status(404).json({ error: 'Mueble no encontrado.' });

    const { url } = await iniciarPagoDeReserva({ stripe, cuenta, mueble, datos: req.body });
    res.status(200).json({ url });
  } catch (error) {
    // ErrorConflicto es un ErrorValidacion: va primero.
    if (error instanceof ErrorConflicto) return res.status(409).json({ error: error.message });
    if (error instanceof ErrorValidacion) return res.status(400).json({ error: error.message });
    if (error instanceof ErrorReintentable) return res.status(503).json({ error: error.message });
    console.error('Error al crear la sesión de pago de una reserva:', error.message || error);
    res.status(500).json({ error: 'No se pudo iniciar el proceso de pago.' });
  }
};

module.exports = {
  obtenerDisponibilidad,
  obtenerPresupuesto,
  crearSesionPagoReserva,
  MENSAJE_ALQUILER_CERRADO
};
