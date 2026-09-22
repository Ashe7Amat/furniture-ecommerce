require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const mueblesRoutes = require('./routes/mueblesRoutes');
const authRoutes = require('./routes/authRoutes');
const categoriasRoutes = require('./routes/categoriasRoutes');
const pedidosRoutes = require('./routes/pedidosRoutes');
const contactoRoutes = require('./routes/contactoRoutes');
const stripeRoutes = require('./routes/stripeRoutes');

const app = express();

// Detrás del proxy de Vercel la IP real del visitante llega en X-Forwarded-For. Sin este
// ajuste Express ve siempre la IP del proxy, y los limitadores de peticiones (login,
// contacto, confirmación de pago) meterían a todos los visitantes en el mismo contador.
// VERCEL es una variable que define la propia plataforma; en local no se activa, para que
// nadie pueda falsear su IP con una cabecera.
if (process.env.VERCEL) {
  app.set('trust proxy', 1);
}

// Fuerza HTTPS en producción. Vercel ya sirve todo por HTTPS y redirige el tráfico HTTP
// automáticamente, pero si este servidor llega a correr detrás de otro proxy (Render,
// Railway, un VPS propio...) que sí deje pasar HTTP en texto plano, esta cabecera
// "x-forwarded-proto" es la forma estándar de saber si la petición original era HTTP.
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] === 'http') {
    return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
  }
  next();
});

// Cabeceras de seguridad estándar (X-Content-Type-Options, Referrer-Policy, HSTS, etc., todas
// activadas por defecto por helmet). Desactivamos COEP porque está pensada para páginas que
// aíslan recursos cross-origin (SharedArrayBuffer y similares), no para una API JSON.
//
// CSP mínima a propósito: este servidor solo devuelve JSON, nunca HTML ni ejecuta nada en un
// navegador, así que no necesita permitir scripts/estilos/imágenes de ningún sitio -- "default-src
// 'none'" es lo más restrictivo posible. La CSP que de verdad importa (la que controla qué puede
// cargar la página web) vive en client/vercel.json, no aquí.
app.use(helmet({
  contentSecurityPolicy: { useDefaults: false, directives: { defaultSrc: ["'none'"] } },
  crossOriginEmbedderPolicy: false,
}));

// Comprime las respuestas (gzip/brotli) -- reduce el peso de las respuestas de la API,
// sobre todo la lista de muebles con imágenes y descripciones.
app.use(compression());

// CORS: solo se acepta el frontend real de Nave 5, nunca cualquier origen. Se admite también
// localhost para desarrollo. CLIENT_URL ya se usaba para las URLs de Stripe.
//
// ALLOWED_ORIGENS es una lista adicional, separada por comas, de orígenes exactos permitidos
// (por ejemplo, la URL de un despliegue de vista previa de Vercel de una rama concreta). Antes
// se admitía CUALQUIER *.vercel.app -- un comodín demasiado abierto, porque cualquiera puede
// desplegar un proyecto en Vercel y su dominio también terminaría en ".vercel.app". Ahora, sin
// una entrada exacta en ALLOWED_ORIGINS, un despliegue de vista previa no queda autorizado: hay
// que añadir su URL a mano. Es una fricción aceptada a cambio de no dejar la puerta abierta a
// cualquier origen de ese dominio.
const origenesPermitidos = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  ...(process.env.ALLOWED_ORIGINS || '').split(',').map(origen => origen.trim()),
].filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Sin cabecera "origin" (curl, apps móviles, health checks) -- se permite.
    if (!origin || origenesPermitidos.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('No autorizado por CORS'));
  },
}));

// Webhook de Stripe: va ANTES de express.json() porque necesita el cuerpo sin parsear para
// poder verificar la firma (ver routes/stripeRoutes.js).
app.use('/api/stripe', stripeRoutes);

app.use(express.json());

// Enrutamiento de la API
app.use('/api/muebles', mueblesRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/categorias', categoriasRoutes);
app.use('/api/pedidos', pedidosRoutes);
app.use('/api/contacto', contactoRoutes);

// Ruta base de comprobación
app.get('/', (req, res) => {
  res.send('API del Catálogo de Muebles funcionando');
});

// 404 para cualquier ruta de API no reconocida
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada.' });
});

// Manejador de errores centralizado: red de seguridad para cualquier error que no se
// haya capturado ya dentro de un controlador (p. ej. un error lanzado desde un
// middleware, o el error de CORS de arriba). Nunca debe filtrar detalles internos.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.message === 'No autorizado por CORS') {
    return res.status(403).json({ error: 'Origen no autorizado.' });
  }
  // Errores de quien llama al leer el cuerpo (no fallos nuestros): no se vuelcan al log, ya
  // que cualquiera podría inundarlo con peticiones mal formadas o demasiado grandes.
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'El cuerpo de la petición es demasiado grande.' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo de la petición no es un JSON válido.' });
  }
  console.error('Error no controlado:', err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

// Solo arrancamos el servidor con "node src/index.js" (local / Render / Railway...).
// En Vercel, api/index.js reutiliza este mismo "app" como función serverless.
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
  });
}

module.exports = app;
