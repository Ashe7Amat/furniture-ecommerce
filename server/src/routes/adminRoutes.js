const express = require('express');
const multer = require('multer');
const router = express.Router();
const { obtenerCategoriasConEstadisticas } = require('../controllers/categoriasController');
const { obtenerMueblesAdmin } = require('../controllers/mueblesController');
const {
  exportarCatalogoCsv,
  importarCatalogoCsv
} = require('../controllers/catalogoCsvController');
const { exportarClientesCsv } = require('../controllers/clientesCsvController');
const { obtenerMensajes, marcarLeido } = require('../controllers/mensajesController');
const {
  exigirObjeto,
  listarReservasAdmin,
  prepararAccion,
  accionSobreReserva,
  crearBloqueoAdmin,
  crearAlquilerAdmin,
  crearVentaAdmin
} = require('../controllers/adminReservasController');
const { verificarAdmin } = require('../middleware/auth');
const { validar } = require('../middleware/validar');
const { reservasActivas } = require('../utils/reservas');
const {
  schemaListaReservas,
  schemaBloqueo,
  schemaAlquilerFueraDeLaWeb,
  schemaVentaFueraDeLaWeb
} = require('../schemas/adminReservas');

// Lecturas que solo necesita el panel de administración (H26): lo que no debe salir en las rutas
// públicas. Todas piden sesión de administrador.
router.get('/categorias/con-stats', verificarAdmin, obtenerCategoriasConEstadisticas);
// A5: el inventario del panel, con la referencia de cada mueble.
router.get('/muebles', verificarAdmin, obtenerMueblesAdmin);
// El catálogo entero en CSV, para abrirlo en Excel (precios reales, como el inventario).
router.get('/muebles/export', verificarAdmin, exportarCatalogoCsv);

// Importar el catálogo desde un CSV: un solo archivo, en memoria, de 2 MB como mucho (500 filas con
// varias fotos cada una caben de sobra). Los errores de la subida se responden aquí con un mensaje
// claro, en vez de llegar como 500 al manejador general.
const MAX_BYTES_CSV = 2 * 1024 * 1024;
const subirCsv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES_CSV, files: 1 }
}).single('archivo');
const recibirCsv = (req, res, next) =>
  subirCsv(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'El archivo es demasiado grande (máximo 2 MB).' });
    }
    return res
      .status(400)
      .json({ error: 'No se pudo leer el archivo: sube un único CSV en el campo "archivo".' });
  });
router.post('/muebles/import', verificarAdmin, recibirCsv, importarCatalogoCsv);

// Las cuentas de clientes en CSV (id, email, nombre, rol y fecha de alta; nunca la contraseña).
router.get('/clientes/export', verificarAdmin, exportarClientesCsv);

// Mensajes del formulario de contacto (pendiente de la migración mensajes_contacto).
router.get('/mensajes', verificarAdmin, obtenerMensajes);
router.patch('/mensajes/:id/leido', verificarAdmin, marcarLeido);

// Reservas por fechas (docs/reservas-diseno.md, 8.1 y 8.3; bloque R-d): la lista por vistas, las
// acciones sobre cada reserva y las altas sin pago web. Primero la sesión de administrador y después
// el interruptor RESERVAS_ACTIVAS (9.1): apagado, responden 403 sin tocar la base de datos.
const exigirReservasActivas = (req, res, next) =>
  reservasActivas()
    ? next()
    : res.status(403).json({ error: 'Las reservas por fechas todavía no están activadas.' });
const reservas = [verificarAdmin, exigirReservasActivas];

router.get('/reservas', ...reservas, validar(schemaListaReservas, 'query'), listarReservasAdmin);
router.post(
  '/reservas/bloqueos',
  ...reservas,
  exigirObjeto,
  validar(schemaBloqueo),
  crearBloqueoAdmin
);
router.post(
  '/reservas/alquileres',
  ...reservas,
  exigirObjeto,
  validar(schemaAlquilerFueraDeLaWeb),
  crearAlquilerAdmin
);
router.post(
  '/reservas/ventas',
  ...reservas,
  exigirObjeto,
  validar(schemaVentaFueraDeLaWeb),
  crearVentaAdmin
);
// entregar, recoger, ampliar, cancelar, reintentar-reembolso, dar-por-reembolsado o
// levantar-bloqueo
router.post('/reservas/:id/:accion', ...reservas, prepararAccion, accionSobreReserva);

module.exports = router;
