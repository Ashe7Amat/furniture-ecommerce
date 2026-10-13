// Reservas por fechas, bloque R-a: los dos endpoints públicos de solo lectura
// (docs/reservas-diseno.md, 7.1 y 7.2). Ninguno escribe nada. Hasta que se aplique la migración R2
// la tabla `reservas` no existe: no se puede llevar a `main` antes que ella.
const supabase = require('../data/supabase');
const { ErrorValidacion } = require('../utils/errores');
const { preciosVisibles } = require('../utils/precios');
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

module.exports = { obtenerDisponibilidad, obtenerPresupuesto, MENSAJE_ALQUILER_CERRADO };
