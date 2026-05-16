require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mueblesRoutes = require('./routes/mueblesRoutes');
const authRoutes = require('./routes/authRoutes');
const categoriasRoutes = require('./routes/categoriasRoutes'); // Importamos las nuevas rutas de categorías

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares globales
app.use(cors());
app.use(express.json());

// Enrutamiento de la API
app.use('/api/muebles', mueblesRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/categorias', categoriasRoutes); // Montamos la ruta de categorías de forma limpia

// Ruta base de comprobación
app.get('/', (req, res) => {
  res.send('API del Catálogo de Muebles funcionando');
});

// Arrancar el servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});