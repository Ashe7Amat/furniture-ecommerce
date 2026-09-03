require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mueblesRoutes = require('./routes/mueblesRoutes');
const authRoutes = require('./routes/authRoutes');
const categoriasRoutes = require('./routes/categoriasRoutes');

const app = express();

// Middlewares globales
app.use(cors());
app.use(express.json());

// Enrutamiento de la API
app.use('/api/muebles', mueblesRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/categorias', categoriasRoutes);

// Ruta base de comprobación
app.get('/', (req, res) => {
  res.send('API del Catálogo de Muebles funcionando');
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
