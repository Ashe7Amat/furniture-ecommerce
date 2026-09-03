// server/src/middleware/auth.js
const jwt = require('jsonwebtoken');

// Comprueba que la petición trae un token válido (cualquier usuario logueado)
const verificarToken = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'No has iniciado sesión.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = payload; // { email, rol, nombre }
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Tu sesión ha caducado. Vuelve a iniciar sesión.' });
  }
};

// Igual que verificarToken, pero además exige rol admin
const verificarAdmin = (req, res, next) => {
  verificarToken(req, res, () => {
    if (req.usuario?.rol !== 'admin') {
      return res.status(403).json({ error: 'No tienes permisos de administrador para hacer esto.' });
    }
    next();
  });
};

module.exports = { verificarToken, verificarAdmin };
