const supabase = require('../data/supabase');
const {
  CONFIG_RESERVAS,
  hoyEnMadrid,
  diasEntreFechas,
  sumarDias,
  sumarMeses,
  validarRangoReserva,
  calcularPrecioReserva
} = require('../utils/reservas');

/**
 * Consulta pública de disponibilidad de una pieza (docs/reservas-diseno.md, sección 7.1).
 * Devuelve el calendario de ocupación, límites y si la pieza es comprable/alquilable hoy.
 */
async function obtenerDisponibilidad(req, res) {
  try {
    const { id } = req.params;

    const { data: mueble, error: errMueble } = await supabase
      .from('muebles')
      .select('id, nombre, estado, precio_alquiler_dia')
      .eq('id', id)
      .maybeSingle();

    if (errMueble) {
      console.error('Error al consultar mueble para disponibilidad:', errMueble);
      return res.status(500).json({ error: 'Error al consultar disponibilidad.' });
    }

    if (!mueble) {
      return res.status(404).json({ error: 'Mueble no encontrado.' });
    }

    const hoy = hoyEnMadrid();
    const desde = req.query.desde || hoy;
    const hastaPorDefecto = sumarDias(
      sumarMeses(hoy, CONFIG_RESERVAS.antelacionMaxMeses),
      CONFIG_RESERVAS.duracionMaxDias
    );
    const hasta = req.query.hasta || hastaPorDefecto;

    if (hasta < desde) {
      return res
        .status(400)
        .json({ error: 'La fecha "hasta" no puede ser anterior a la fecha "desde".' });
    }

    if (diasEntreFechas(desde, hasta) > 366) {
      return res
        .status(400)
        .json({ error: 'El rango de consulta no puede superar los 12 meses.' });
    }

    // Consultar ocupaciones activas en el rango pedido
    const { data: filasReservas, error: errReservas } = await supabase
      .from('reservas')
      .select(
        'id, tipo, estado, fecha_inicio, fecha_fin, fin_ocupacion, dias_margen, rango_ocupado, expira_en'
      )
      .eq('mueble_id', id)
      .in('estado', ['pendiente', 'confirmada', 'en_curso', 'devuelta'])
      .overlaps('rango_ocupado', `[${desde},${hasta})`);

    if (errReservas) {
      console.error('Error al consultar reservas de la pieza:', errReservas);
      return res.status(500).json({ error: 'Error al consultar disponibilidad.' });
    }

    const ahora = new Date();
    const reservasValidas = (filasReservas || []).filter((r) => {
      // Ignorar reservas provisionales ya caducadas
      if (r.estado === 'pendiente' && r.expira_en && new Date(r.expira_en) < ahora) {
        return false;
      }
      return true;
    });

    const ocupado = reservasValidas.map((r) => {
      let finConMargen = null;
      if (r.fin_ocupacion) {
        finConMargen = sumarDias(r.fin_ocupacion, Number(r.dias_margen || 0));
      }

      let tipoVisual = 'reservado';
      if (r.tipo === 'venta') tipoVisual = 'vendido';
      else if (r.tipo === 'bloqueo') tipoVisual = 'bloqueado';

      return {
        desde: r.fecha_inicio,
        hasta: finConMargen,
        tipo: tipoVisual
      };
    });

    if (mueble.estado === 'vendido') {
      const yaConstaVendido = ocupado.some((o) => o.tipo === 'vendido');
      if (!yaConstaVendido) {
        ocupado.push({ desde: hoy, hasta: null, tipo: 'vendido' });
      }
    }

    // Definición compartida de "ocupada desde hoy" (sección 858):
    // Una pieza no es comprable si ya está vendida o si existe una fila activa cuyo rango llega a hoy o más allá.
    let comprable = true;
    let motivoNoComprable = null;
    let comprableDesde = null;

    if (mueble.estado === 'vendido') {
      comprable = false;
      motivoNoComprable = 'vendido';
      comprableDesde = null;
    } else {
      const ocupacionesDesdeHoy = ocupado.filter((o) => o.hasta === null || o.hasta > hoy);
      if (ocupacionesDesdeHoy.length > 0) {
        comprable = false;
        motivoNoComprable = 'reservas_activas';
        const tieneFinAbierto = ocupacionesDesdeHoy.some((o) => o.hasta === null);
        if (tieneFinAbierto) {
          comprableDesde = null;
        } else {
          // Tomar el límite superior máximo como primer día comprable
          const limites = ocupacionesDesdeHoy.map((o) => o.hasta).sort();
          comprableDesde = limites[limites.length - 1];
        }
      }
    }

    const tienePrecioAlquiler =
      mueble.precio_alquiler_dia != null && Number(mueble.precio_alquiler_dia) > 0;
    const alquilable = mueble.estado !== 'vendido' && tienePrecioAlquiler;

    res.set('Cache-Control', 'no-store');
    return res.json({
      mueble_id: mueble.id,
      zona_horaria: 'Europe/Madrid',
      hoy,
      alquilable,
      comprable,
      motivo_no_comprable: motivoNoComprable,
      comprable_desde: comprableDesde,
      precio_dia: tienePrecioAlquiler ? Number(mueble.precio_alquiler_dia) : null,
      reglas: {
        duracion_min_dias: CONFIG_RESERVAS.duracionMinDias,
        duracion_max_dias: CONFIG_RESERVAS.duracionMaxDias,
        antelacion_min_dias: CONFIG_RESERVAS.antelacionMinDias,
        antelacion_max_meses: CONFIG_RESERVAS.antelacionMaxMeses,
        dias_margen: CONFIG_RESERVAS.diasMargen,
        tramos_descuento: CONFIG_RESERVAS.tramosDescuento.map((t) => ({
          desde_dias: t.desdeDias,
          porcentaje: t.porcentaje
        }))
      },
      primer_inicio_posible: sumarDias(hoy, CONFIG_RESERVAS.antelacionMinDias),
      ultimo_inicio_posible: sumarMeses(hoy, CONFIG_RESERVAS.antelacionMaxMeses),
      ocupado
    });
  } catch (error) {
    console.error('Error inesperado en obtenerDisponibilidad:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

/**
 * Consulta pública de presupuesto de alquiler (docs/reservas-diseno.md, sección 7.2).
 * Calcula el desglose en vivo a partir de las fechas y opciones de entrega.
 */
async function obtenerPresupuesto(req, res) {
  try {
    const { id } = req.params;
    const { fecha_inicio, fecha_fin, entrega = 'tienda', recogida = 'tienda' } = req.query;

    const { data: mueble, error: errMueble } = await supabase
      .from('muebles')
      .select('id, nombre, estado, precio_alquiler_dia')
      .eq('id', id)
      .maybeSingle();

    if (errMueble) {
      console.error('Error al consultar mueble para presupuesto:', errMueble);
      return res.status(500).json({ error: 'Error al calcular presupuesto.' });
    }

    if (!mueble) {
      return res.status(404).json({ error: 'Mueble no encontrado.' });
    }

    if (!mueble.precio_alquiler_dia || Number(mueble.precio_alquiler_dia) <= 0) {
      return res
        .status(400)
        .json({ error: 'Esta pieza no está disponible para alquiler.' });
    }

    const validacion = validarRangoReserva({
      fechaInicio: fecha_inicio,
      fechaFin: fecha_fin
    });

    if (!validacion.valido) {
      return res.status(400).json({ error: validacion.error });
    }

    const presupuesto = calcularPrecioReserva({
      precioAlquilerDia: mueble.precio_alquiler_dia,
      fechaInicio: fecha_inicio,
      fechaFin: fecha_fin,
      modoEntrega: entrega,
      modoDevolucion: recogida
    });

    res.set('Cache-Control', 'no-store');
    return res.json({
      mueble_id: mueble.id,
      ...presupuesto
    });
  } catch (error) {
    console.error('Error inesperado en obtenerPresupuesto:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

module.exports = {
  obtenerDisponibilidad,
  obtenerPresupuesto
};
