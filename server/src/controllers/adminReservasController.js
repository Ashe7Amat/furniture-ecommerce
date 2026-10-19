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
  presentar,
  presentarFilas,
  listarReservas,
  ejecutarAccion,
  crearBloqueo,
  crearAlquiler,
  crearVenta
} = require('../utils/adminReservas');
const { hoyEnMadrid } = require('../utils/fechasMadrid');

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

// GET /api/admin/reservas?vista=...&mueble_id=... (la consulta ya validada) → { hoy, reservas }
const listarReservasAdmin = async (req, res) => {
  try {
    const resultado = await listarReservas({
      vista: req.query.vista,
      muebleId: req.query.mueble_id,
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

// Antes de POST /api/admin/reservas/:id/:accion: un id que no es un uuid no puede ser una reserva, y
// una acción que no existe es una ruta que no existe (las dos, 404 sin tocar la base de datos).
// Después, el cuerpo de esa acción.
const prepararAccion = (req, res, next) => {
  if (!FORMATO_UUID.test(req.params.id)) {
    return res.status(404).json({ error: MENSAJE_RESERVA_NO_ENCONTRADA });
  }
  const schema = SCHEMAS_ACCION[req.params.accion];
  if (!schema) return res.status(404).json({ error: 'Esa acción no existe.' });
  req.body = req.body ?? {};
  return validar(schema)(req, res, next);
};

// POST /api/admin/reservas/:id/:accion → { reserva }. Si la reserva se canceló pero el reembolso no
// se pudo hacer, 502 con el aviso y la reserva tal como ha quedado (a medias, 8.6).
const accionSobreReserva = async (req, res) => {
  try {
    const ahora = new Date();
    const { reserva, avisoReembolso } = await ejecutarAccion(
      req.params.id,
      req.params.accion,
      req.body,
      ahora
    );
    const [item] = await presentarFilas([reserva], ahora);
    if (avisoReembolso) return res.status(502).json({ error: avisoReembolso, reserva: item });
    res.status(200).json({ reserva: item });
  } catch (error) {
    responderError(
      res,
      error,
      `Error en la acción "${req.params.accion}" de la reserva ${req.params.id}`,
      MENSAJE_ERROR_GUARDAR
    );
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
  listarReservasAdmin,
  prepararAccion,
  accionSobreReserva,
  crearBloqueoAdmin,
  crearAlquilerAdmin,
  crearVentaAdmin
};
