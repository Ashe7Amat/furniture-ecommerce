// Datos y utilidades comunes de los tests de la verificación del email (H18):
// verificacionEmail.test.js y verificacionEmailCambio.test.js. Van en dos archivos porque cada
// archivo corre en su propio proceso: así el límite de intentos por IP (15 fallidos, compartido por
// login, registro, Google y verificar-email; routes/authRoutes.js) empieza de cero en cada uno.
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const PASSWORD = 'contraseña-de-prueba';
const HASH = bcrypt.hashSync(PASSWORD, 4);
const ENLACE_NO_VALIDO = { error: 'El enlace no es válido o ha caducado.' };

const cuenta = (id, correo, extra = {}) => ({
  id,
  email: correo,
  nombre: correo.split('@')[0],
  rol: 'cliente',
  password: HASH,
  email_verificado: false,
  email_pendiente: null,
  ...extra
});
const pedido = (id, correo, extra = {}) => ({
  id,
  cliente_id: null,
  cliente_info: { email: correo },
  estado: 'procesando',
  created_at: '2026-10-01',
  ...extra
});
// Un access token como los de firmarToken. `iat` permite firmarlo "en el pasado".
const tokenDe = ({ id, email: correo }, { sinSub = false, iat } = {}) =>
  jwt.sign(
    {
      ...(!sinSub && { sub: id }),
      email: correo,
      nombre: 'x',
      rol: 'cliente',
      ...(iat && { iat })
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
const hmac = (token) =>
  crypto.createHmac('sha256', process.env.EMAIL_TOKEN_HASH_SECRET).update(token).digest('hex');
const tokenDeUrl = (url) => new URL(url).searchParams.get('token');

// Un correo que tarda en salir (25 ms, más que todo lo demás de la petición contra el doble de
// Supabase): sirve para comprobar que la respuesta espera a que salga. Con setImmediate no basta,
// porque el doble cede una vuelta del bucle de eventos en cada consulta y el correo acabaría antes
// aunque nadie lo esperara.
const correoLento = (estado) => async () => {
  await new Promise((resolver) => setTimeout(resolver, 25));
  estado.enviados = (estado.enviados || 0) + 1;
};

module.exports = {
  PASSWORD,
  HASH,
  ENLACE_NO_VALIDO,
  cuenta,
  pedido,
  tokenDe,
  hmac,
  tokenDeUrl,
  correoLento
};
