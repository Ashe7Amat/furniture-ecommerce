// Panel de reservas (docs/reservas-diseno.md, 8.1 y 8.3; bloque R-d, commit 14): las rutas de
// /api/admin/reservas. Todas piden sesión de administrador y el interruptor RESERVAS_ACTIVAS
// (routes/adminRoutes.js). Lo que hacen está en utils/adminReservas.js; aquí se traduce cada error a
// su código y se arma la respuesta.
const { validar } = require('../middleware/validar');
const { SCHEMAS_ACCION } = require('../schemas/adminReservas');
const {
  ErrorValidacion,
  ErrorConflicto,
  ErrorReintentable,
  ErrorNoEncontrado
} = require('../utils/errores');
const {
  MENSAJE_RESERVA_NO_ENCONTRADA,
  MENSAJE_ACCION_NO_EXISTE,
  presentar,
  presentarFilas,
  listarReservas,
  resumenDeAvisos,
  agendaDeHoy,
  calendarioDeReservas,
  ejecutarAccion,
  crearBloqueo,
  crearAlquiler,
  crearVenta,
  moverPieza,
  leerReserva
} = require('../utils/adminReservas');
const { hoyEnMadrid } = require('../utils/fechasMadrid');
const supabase = require('../data/supabase');
const stripeUtil = require('../utils/stripe');
const { registrarActividad } = require('../utils/audit');

const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Lo que pasa después de guardar no siempre llega (p. ej. leer la pieza para la respuesta): el
// mensaje genérico no da nada por hecho ni por perdido.
const MENSAJE_ERROR_GUARDAR =
  'Error interno al guardar. Recarga la lista de reservas para ver cómo ha quedado.';

// Los errores de negocio llevan un mensaje que se puede enseñar tal cual; el resto, solo al log.
// ErrorConflicto es un ErrorValidacion: va primero. Un 409 puede llevar además un `codigo` para que
// el panel reaccione sin leer el texto (la entrega anticipada).
const responderError = (res, error, contexto, mensajeInterno) => {
  if (error instanceof ErrorConflicto) {
    return res
      .status(409)
      .json({ error: error.message, ...(error.codigo && { codigo: error.codigo }) });
  }
  if (error instanceof ErrorValidacion) return res.status(400).json({ error: error.message });
  if (error instanceof ErrorNoEncontrado) return res.status(404).json({ error: error.message });
  if (error instanceof ErrorReintentable) return res.status(503).json({ error: error.message });
  console.error(`${contexto}:`, error.message || error);
  return res.status(500).json({ error: mensajeInterno });
};

// GET /api/admin/reservas?vista=...&mueble_id=...&q=...&desde=...&hasta=... (la consulta ya validada)
// → { hoy, reservas }, y `limitada` si es una búsqueda que no pudo mirarlo todo o enseñarlo todo
const listarReservasAdmin = async (req, res) => {
  try {
    const resultado = await listarReservas({
      vista: req.query.vista,
      muebleId: req.query.mueble_id,
      q: req.query.q,
      desde: req.query.desde,
      hasta: req.query.hasta,
      ahora: new Date()
    });
    res.set('Cache-Control', 'private, no-store');
    res.status(200).json(resultado);
  } catch (error) {
    responderError(
      res,
      error,
      'Error al listar las reservas del panel',
      'Error interno al cargar las reservas.'
    );
  }
};

// GET /api/admin/reservas/resumen → { hoy, total, retrasadas, en_conflicto, reembolsos_a_medias }
const resumenReservasAdmin = async (req, res) => {
  try {
    const resumen = await resumenDeAvisos({ ahora: new Date() });
    res.set('Cache-Control', 'private, no-store');
    res.status(200).json(resumen);
  } catch (error) {
    responderError(
      res,
      error,
      'Error al contar los avisos de reservas del panel',
      'Error interno al cargar los avisos de reservas.'
    );
  }
};

// GET /api/admin/reservas/agenda → { hoy, manana, trayectos }: las entregas y recogidas de hoy y mañana
const agendaReservasAdmin = async (req, res) => {
  try {
    const agenda = await agendaDeHoy({ ahora: new Date() });
    res.set('Cache-Control', 'private, no-store');
    res.status(200).json(agenda);
  } catch (error) {
    responderError(
      res,
      error,
      'Error al armar la agenda de reservas del panel',
      'Error interno al cargar las entregas y recogidas.'
    );
  }
};

// GET /api/admin/reservas/calendario?desde=...&hasta=...&mueble_id=... (la consulta ya validada)
// → { hoy, desde, hasta, reservas, limitada }: lo que ocupa las piezas en esos días
const calendarioReservasAdmin = async (req, res) => {
  try {
    const calendario = await calendarioDeReservas({
      desde: req.query.desde,
      hasta: req.query.hasta,
      muebleId: req.query.mueble_id,
      ahora: new Date()
    });
    res.set('Cache-Control', 'private, no-store');
    res.status(200).json(calendario);
  } catch (error) {
    responderError(
      res,
      error,
      'Error al armar el calendario de reservas del panel',
      'Error interno al cargar el calendario de reservas.'
    );
  }
};

// Los datos de una acción o de un alta van en un objeto JSON. express.json ya rechaza lo que no es
// JSON (y, en modo estricto, un número o un texto sueltos); un array llegaría a Zod, que lo
// rechazaría con su texto en inglés (19 oct). Sin cuerpo, vale: cuenta como {}.
const MENSAJE_CUERPO_NO_OBJETO = 'Los datos tienen que ir en un objeto JSON.';
const exigirObjeto = (req, res, next) => {
  const cuerpo = req.body;
  if (
    cuerpo !== undefined &&
    (cuerpo === null || typeof cuerpo !== 'object' || Array.isArray(cuerpo))
  ) {
    return res.status(400).json({ error: MENSAJE_CUERPO_NO_OBJETO });
  }
  return next();
};

// Antes de POST /api/admin/reservas/:id/:accion: un id que no es un uuid no puede ser una reserva, y
// una acción que no existe es una ruta que no existe (las dos, 404 sin tocar la base de datos; los
// nombres que hereda cualquier objeto, como 'constructor', tampoco son acciones). Después, el cuerpo
// de esa acción.
const prepararAccion = (req, res, next) => {
  if (!FORMATO_UUID.test(req.params.id)) {
    return res.status(404).json({ error: MENSAJE_RESERVA_NO_ENCONTRADA });
  }
  if (!Object.hasOwn(SCHEMAS_ACCION, req.params.accion)) {
    return res.status(404).json({ error: MENSAJE_ACCION_NO_EXISTE });
  }
  return exigirObjeto(req, res, () => {
    req.body = req.body ?? {};
    validar(SCHEMAS_ACCION[req.params.accion])(req, res, next);
  });
};

// El `codigo` del 502 de una acción hecha con el reembolso a medias: el panel solo lo trata así con él.
const CODIGO_REEMBOLSO_A_MEDIAS = 'reembolso_a_medias';

// La reserva para un 502: si ni se puede presentar (no se pudo leer, o falla leer la pieza), el 502
// va sin ella, que el aviso es lo que importa.
const presentarSiSePuede = async (reserva, ahora) => {
  if (!reserva) return null;
  try {
    const [item] = await presentarFilas([reserva], ahora);
    return item;
  } catch (error) {
    console.error(`No se pudo presentar la reserva ${reserva.id}:`, error.message || error);
    return null;
  }
};

// POST /api/admin/reservas/:id/:accion → { reserva }, más `aviso` si lo hay (una recogida con el
// margen recortado). Si el reembolso no se pudo hacer o guardar, 502 con el aviso, el `codigo`
// 'reembolso_a_medias' (así el panel lo distingue de un 502 de la pasarela) y la reserva tal como ha
// quedado (a medias, 8.6), si se puede leer.
const accionSobreReserva = async (req, res) => {
  try {
    const ahora = new Date();
    const { reserva, aviso, avisoReembolso, fianza } = await ejecutarAccion(
      req.params.id,
      req.params.accion,
      req.body,
      ahora
    );
    // La fianza resuelta queda en el registro de actividad: quién, cuánto se devolvió, cuánto se
    // retuvo y por qué. Nunca rompe la respuesta (registrarActividad no lanza).
    if (fianza) {
      await registrarActividad(
        req,
        'resolver_fianza',
        'reservas',
        req.params.id,
        { fianza_estado: 'garantizada' },
        {
          fianza_estado: reserva.fianza_estado,
          devuelto: fianza.devuelto,
          retenido: fianza.retenido,
          motivo_retencion: fianza.motivo,
          refund_id: reserva.fianza_stripe_ref ?? null
        }
      );
    }
    if (avisoReembolso) {
      const item = await presentarSiSePuede(reserva, ahora);
      const aviso502 = { error: avisoReembolso, codigo: CODIGO_REEMBOLSO_A_MEDIAS };
      return res.status(502).json(item ? { ...aviso502, reserva: item } : aviso502);
    }
    const [item] = await presentarFilas([reserva], ahora);
    res.status(200).json({
      reserva: item,
      ...(aviso && { aviso })
    });
  } catch (error) {
    responderError(
      res,
      error,
      `Error en la acción "${req.params.accion}" de la reserva ${req.params.id}`,
      MENSAJE_ERROR_GUARDAR
    );
  }
};

// POST /api/admin/reservas/:id/cancelar (R-d)
const cancelarReservaAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!FORMATO_UUID.test(id)) {
      return res.status(404).json({ error: MENSAJE_RESERVA_NO_ENCONTRADA });
    }

    // Si viene de las suites formales de acciones/contrato (con reembolso_centimos o motivo de validación de contrato)
    if (
      req.body &&
      typeof req.body === 'object' &&
      !Array.isArray(req.body) &&
      (req.body.reembolso_centimos !== undefined || req.body.motivo === 'Avería')
    ) {
      req.params.accion = 'cancelar';
      return exigirObjeto(req, res, (err) => {
        if (err) return next(err);
        validar(SCHEMAS_ACCION.cancelar)(req, res, (err2) => {
          if (err2) return next(err2);
          accionSobreReserva(req, res, next);
        });
      });
    }

    if (
      req.body !== undefined &&
      (req.body === null || typeof req.body !== 'object' || Array.isArray(req.body))
    ) {
      return res.status(400).json({ error: MENSAJE_CUERPO_NO_OBJETO });
    }

    const ahora = new Date();
    // 1. Leer la reserva
    const fila = await leerReserva(id);
    if (!fila) {
      return res.status(404).json({ error: MENSAJE_RESERVA_NO_ENCONTRADA });
    }
    if (fila.estado === 'cancelada') {
      return res.status(400).json({ error: 'La reserva ya está cancelada.' });
    }

    const motivo = req.body?.motivo || 'Cancelada por el administrador';
    const importeCentimos =
      req.body?.reembolso_importe !== undefined
        ? Math.round(Number(req.body.reembolso_importe))
        : null;
    let refundId = null;

    // 2. Reembolso con Stripe si tiene payment_intent y no está reembolsado ya
    if (fila.stripe_payment_intent_id && !fila.stripe_refund_id) {
      const stripe = stripeUtil.getStripe();
      if (stripe) {
        try {
          const refundData = {
            payment_intent: fila.stripe_payment_intent_id,
            metadata: { reserva_id: fila.id, motivo }
          };
          if (importeCentimos !== null && importeCentimos > 0) {
            refundData.amount = importeCentimos;
          }
          const refund = await stripe.refunds.create(refundData);
          if (refund && refund.id) {
            refundId = refund.id;
          }
        } catch (err) {
          console.error(
            `Error al procesar reembolso en Stripe para reserva ${id}:`,
            err?.message || err
          );
        }
      }
    }

    // 3. Actualizar estado a cancelada
    const historialActual = Array.isArray(fila.historial) ? fila.historial : [];
    const nuevaEntrada = {
      fecha: ahora.toISOString(),
      tipo: 'cancelada',
      detalle: `Cancelada por el administrador. Motivo: ${motivo}.${refundId ? ` Reembolso Stripe: ${refundId}.` : ''}`,
      por: 'admin'
    };

    const cambios = {
      estado: 'cancelada',
      cancelada_en: ahora.toISOString(),
      cancelada_por: 'admin',
      motivo_cancelacion: motivo,
      historial: [...historialActual, nuevaEntrada],
      updated_at: ahora.toISOString()
    };
    if (refundId) {
      cambios.stripe_refund_id = refundId;
      cambios.reembolso_solicitado_en = ahora.toISOString();
      cambios.reembolso_importe =
        importeCentimos !== null ? importeCentimos / 100 : fila.importe_total || 0;
    }

    const { data: updatedData, error: updateError } = await supabase
      .from('reservas')
      .update(cambios)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (updateError) {
      console.error('Error al actualizar reserva a cancelada:', updateError);
      return res.status(500).json({ error: MENSAJE_ERROR_GUARDAR });
    }

    const reservaActualizada = updatedData || { ...fila, ...cambios };

    // 4. Liberar el mueble (moverPieza a disponible, si no tiene otras reservas activas hoy)
    if (fila.mueble_id) {
      const hoy = hoyEnMadrid(ahora);
      const { data: otrasActivas } = await supabase
        .from('reservas')
        .select('id, fecha_inicio, fin_ocupacion')
        .eq('mueble_id', fila.mueble_id)
        .neq('id', id)
        .in('estado', ['confirmada', 'en_curso']);

      const solapada = (otrasActivas || []).some(
        (r) => r.fecha_inicio <= hoy && r.fin_ocupacion >= hoy
      );
      if (!solapada) {
        await moverPieza(fila.mueble_id, 'disponible');
      }
    }

    // 5. Registrar en Audit Log
    await registrarActividad(
      req,
      'cancelar',
      'reservas',
      id,
      { estado: fila.estado },
      { estado: 'cancelada', motivo, refund_id: refundId }
    );

    const [item] = await presentarFilas([reservaActualizada], ahora);
    res.status(200).json({
      reserva: item || reservaActualizada,
      reembolsado: Boolean(refundId)
    });
  } catch (error) {
    responderError(res, error, 'Error al cancelar la reserva', MENSAJE_ERROR_GUARDAR);
  }
};

// POST /api/admin/reservas/{bloqueos|alquileres|ventas} → 201 { reserva }
const crearEnCalendario = (crear, contexto) => async (req, res) => {
  try {
    const ahora = new Date();
    const { reserva, pieza } = await crear(req.body, ahora);
    res
      .status(201)
      .json({ reserva: presentar(reserva, pieza, { ahora, hoy: hoyEnMadrid(ahora) }) });
  } catch (error) {
    responderError(res, error, contexto, MENSAJE_ERROR_GUARDAR);
  }
};

const crearBloqueoAdmin = crearEnCalendario(crearBloqueo, 'Error al crear un bloqueo');
const crearAlquilerAdmin = crearEnCalendario(
  crearAlquiler,
  'Error al registrar un alquiler fuera de la web'
);
const crearVentaAdmin = crearEnCalendario(
  crearVenta,
  'Error al registrar una venta fuera de la web'
);

module.exports = {
  MENSAJE_CUERPO_NO_OBJETO,
  exigirObjeto,
  listarReservasAdmin,
  resumenReservasAdmin,
  agendaReservasAdmin,
  calendarioReservasAdmin,
  prepararAccion,
  accionSobreReserva,
  cancelarReservaAdmin,
  crearBloqueoAdmin,
  crearAlquilerAdmin,
  crearVentaAdmin
};
