require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const mueblesRoutes = require('./routes/mueblesRoutes');
const authRoutes = require('./routes/authRoutes');
const categoriasRoutes = require('./routes/categoriasRoutes');
const pedidosRoutes = require('./routes/pedidosRoutes');

const app = express();

// Cabeceras de seguridad estándar (X-Content-Type-Options, Referrer-Policy, etc.)
// Desactivamos CSP y COEP porque este servidor es una API JSON pura -- esas cabeceras
// están pensadas para páginas que sirven HTML propio, no para respuestas de API.
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

// Comprime las respuestas (gzip/brotli) -- reduce el peso de las respuestas de la API,
// sobre todo la lista de muebles con imágenes y descripciones.
app.use(compression());

// CORS: solo se acepta el frontend real de Nave 5, nunca cualquier origen. Se admite
// también localhost para desarrollo. CLIENT_URL ya se usaba para las URLs de Stripe.
const origenesPermitidos = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://localhost:5174',
].filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Sin cabecera "origin" (curl, apps móviles, health checks) -- se permite.
    // También se permite cualquier *.vercel.app para no romper los despliegues de
    // vista previa (cada rama/PR genera una URL de Vercel distinta a CLIENT_URL).
    const esVercelPreview = origin && /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);
    if (!origin || origenesPermitidos.includes(origin) || esVercelPreview) {
      return callback(null, true);
    }
    callback(new Error('No autorizado por CORS'));
  },
}));

app.use(express.json());

// Enrutamiento de la API
app.use('/api/muebles', mueblesRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/categorias', categoriasRoutes);
app.use('/api/pedidos', pedidosRoutes);

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
