// Reservas por fechas (docs/reservas-diseno.md). Bloque R-a: los dos endpoints públicos de solo
// lectura (7.1 y 7.2). Bloque R-b: la reserva provisional y su sesión de pago (6.3), detrás del
// interruptor RESERVAS_ACTIVAS. La tabla `reservas` (migración R2) está aplicada en producción desde el
// 19 oct 2026 (docs/reservas-sql/README.md).
const supabase = require('../data/supabase');
const stripeUtil = require('../utils/stripe');
const email = require('../utils/email');
const {
  ErrorValidacion,
  ErrorConflicto,
  ErrorReintentable,
  ErrorNoEncontrado
} = require('../utils/errores');
const { preciosVisibles } = require('../utils/precios');
const { buscarCuentaVerificada } = require('../utils/cuentaVerificada');
const { iniciarPagoDeReserva } = require('../utils/reservas');
const { hoyEnMadrid, fechaLegible } = require('../utils/fechasMadrid');
const {
  referenciaDeReserva,
  horaCorta,
  actualizarReserva
} = require('../utils/calendarioReservas');
const { enviarTodos } = require('../utils/enviarTodos');
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

// ─── Mis reservas (bloque R-c, commit 13) ────────────────────────────────────────────────────────

const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Lo que lee "Mis reservas". Nunca datos de Stripe, el historial entero ni nada interno: se arma la
// respuesta campo a campo (H36).
const COLUMNAS_MIS_RESERVAS =
  'id, pedido_id, mueble_id, estado, fecha_inicio, hora_entrega, fecha_fin, hora_recogida, ' +
  'modo_entrega, modo_devolucion, direccion_entrega, importe_total, precio_desglose, ' +
  'stripe_payment_intent_id, expira_en, conflicto_en, historial';

const cancelacionSolicitada = (fila) =>
  (fila.historial || []).some((linea) => linea.tipo === 'cancelacion_solicitada');

// El estado que ve el cliente. null = no se enseña: una reserva que nunca llegó a pagarse (caducó, o
// el cliente empezó otra) no es una reserva para él. Una pagada que no se pudo confirmar sí se
// enseña, porque se le va a devolver el dinero.
const estadoParaElCliente = (fila, ahora) => {
  if (fila.conflicto_en) return 'no_confirmada';
  if (fila.estado === 'pendiente') {
    return new Date(fila.expira_en) > ahora ? 'esperando_pago' : null;
  }
  if (fila.estado === 'cancelada') return fila.stripe_payment_intent_id ? 'cancelada' : null;
  if (['confirmada', 'en_curso', 'devuelta'].includes(fila.estado)) return fila.estado;
  return null;
};

// GET /api/reservas/mias -- las reservas de alquiler de la cuenta (por cliente_id, como "Mis pedidos"
// desde H18), con el email verificado. Las más lejanas en el calendario primero.
const obtenerMisReservas = async (req, res) => {
  try {
    const { cuenta, rechazo } = await buscarCuentaVerificada(req.usuario, {
      mensajeSinVerificar: 'Confirma tu email para ver tus reservas.'
    });
    if (rechazo) return res.status(rechazo.status).json(rechazo.cuerpo);

    const { data: filas, error } = await supabase
      .from('reservas')
      .select(COLUMNAS_MIS_RESERVAS)
      .eq('cliente_id', cuenta.id)
      .eq('tipo', 'alquiler')
      .order('fecha_inicio', { ascending: false });
    if (error) throw error;

    const ahora = new Date();
    const visibles = filas
      .map((fila) => ({ fila, estado: estadoParaElCliente(fila, ahora) }))
      .filter(({ estado }) => estado !== null);

    const ids = [...new Set(visibles.map(({ fila }) => fila.mueble_id))];
    let piezas = [];
    if (ids.length > 0) {
      const { data, error: errorPiezas } = await supabase
        .from('muebles')
        .select('id, nombre, imagenes')
        .in('id', ids);
      if (errorPiezas) throw errorPiezas;
      piezas = data;
    }

    res.set('Cache-Control', SIN_CACHE);
    res.status(200).json(
      visibles.map(({ fila, estado }) => {
        const pieza = piezas.find((p) => p.id === fila.mueble_id);
        const solicitada = cancelacionSolicitada(fila);
        return {
          id: fila.id,
          referencia: referenciaDeReserva(fila),
          estado,
          pieza: {
            id: fila.mueble_id,
            nombre: pieza ? pieza.nombre : 'Pieza retirada del catálogo',
            imagen: pieza?.imagenes?.[0] || null
          },
          fecha_inicio: fila.fecha_inicio,
          hora_entrega: horaCorta(fila.hora_entrega),
          fecha_fin: fila.fecha_fin,
          hora_recogida: horaCorta(fila.hora_recogida),
          modo_entrega: fila.modo_entrega,
          modo_devolucion: fila.modo_devolucion,
          direccion_entrega: fila.direccion_entrega,
          dias: fila.precio_desglose?.dias ?? null,
          importe_total_centimos:
            fila.importe_total === null ? null : Math.round(Number(fila.importe_total) * 100),
          cancelacion_solicitada: solicitada,
          puede_solicitar_cancelacion: estado === 'confirmada' && !solicitada
        };
      })
    );
  } catch (error) {
    console.error('Error al obtener mis reservas:', error.message || error);
    res.status(500).json({ error: 'Error interno al obtener tus reservas.' });
  }
};

const MENSAJE_RESERVA_NO_ENCONTRADA = 'No encontramos esa reserva.';

// POST /api/reservas/:id/solicitar-cancelacion -- en la primera versión cancela siempre el
// administrador (8.4, T13): el cliente solo lo pide. La solicitud queda en el historial de la reserva
// (el panel la enseña aunque el email se pierda) y se avisa al administrador por email.
const solicitarCancelacionReserva = async (req, res) => {
  try {
    if (!FORMATO_UUID.test(req.params.id)) {
      return res.status(404).json({ error: MENSAJE_RESERVA_NO_ENCONTRADA });
    }
    const { cuenta, rechazo } = await buscarCuentaVerificada(req.usuario, {
      columnas: 'id, email',
      mensajeSinVerificar: 'Confirma tu email para gestionar tus reservas.'
    });
    if (rechazo) return res.status(rechazo.status).json(rechazo.cuerpo);

    const motivo = req.body.motivo || '';
    let resultado;
    try {
      resultado = await actualizarReserva(req.params.id, {
        columnas:
          'cliente_id, tipo, estado, conflicto_en, pedido_id, fecha_inicio, hora_entrega, ' +
          'fecha_fin, hora_recogida, datos_contacto, importe_total',
        decidir: (fila) => {
          // La de otro cliente, igual que si no existiera.
          if (fila.cliente_id !== cuenta.id || fila.tipo !== 'alquiler') {
            throw new ErrorNoEncontrado(MENSAJE_RESERVA_NO_ENCONTRADA);
          }
          if (cancelacionSolicitada(fila)) {
            throw new ErrorConflicto(
              'Ya nos has pedido cancelar esta reserva. Te escribiremos pronto.'
            );
          }
          if (fila.estado !== 'confirmada' || fila.conflicto_en) {
            throw new ErrorConflicto(
              'Esta reserva ya no se puede cancelar desde aquí. Escríbenos y lo vemos.'
            );
          }
          return {
            cambios: {},
            entrada: {
              tipo: 'cancelacion_solicitada',
              detalle: motivo || 'Sin motivo.',
              por: 'cliente'
            }
          };
        }
      });
    } catch (error) {
      if (error instanceof ErrorNoEncontrado) {
        return res.status(404).json({ error: MENSAJE_RESERVA_NO_ENCONTRADA });
      }
      throw error;
    }
    const { reserva } = resultado;

    const { data: mueble, error: errorMueble } = await supabase
      .from('muebles')
      .select('nombre')
      .eq('id', reserva.mueble_id)
      .maybeSingle();
    if (errorMueble) console.error('No se pudo leer la pieza de la reserva:', errorMueble.message);
    const contacto = reserva.datos_contacto || {};
    await enviarTodos([
      () =>
        email.enviarAlertaAdmin({
          asunto: 'Solicitud de cancelación de una reserva',
          detalles: [
            `Reserva #${referenciaDeReserva(reserva)} de ${mueble?.nombre || 'una pieza'} (${reserva.mueble_id})`,
            `Entrega: ${fechaLegible(reserva.fecha_inicio)} a las ${horaCorta(reserva.hora_entrega)}`,
            `Recogida: ${fechaLegible(reserva.fecha_fin)} a las ${horaCorta(reserva.hora_recogida)}`,
            `Cliente: ${contacto.nombre || 'sin nombre'} <${contacto.email || cuenta.email}> · ${contacto.telefono || 'sin teléfono'}`,
            `Motivo: ${motivo || 'no lo ha indicado'}`,
            `Importe pagado: ${reserva.importe_total === null ? 'desconocido' : `${Number(reserva.importe_total).toFixed(2)} €`}`,
            'La política de cancelación es manual: decide el reembolso y cancela la reserva desde el panel (Reservas).'
          ]
        })
    ]);

    res.status(200).json({
      mensaje:
        'Hemos recibido tu solicitud. Te escribiremos para confirmar la cancelación y el reembolso.'
    });
  } catch (error) {
    if (error instanceof ErrorConflicto) return res.status(409).json({ error: error.message });
    console.error('Error al solicitar la cancelación de una reserva:', error.message || error);
    res.status(500).json({ error: 'No hemos podido enviar tu solicitud. Inténtalo de nuevo.' });
  }
};

module.exports = {
  obtenerDisponibilidad,
  obtenerPresupuesto,
  crearSesionPagoReserva,
  obtenerMisReservas,
  solicitarCancelacionReserva,
  MENSAJE_ALQUILER_CERRADO
};
