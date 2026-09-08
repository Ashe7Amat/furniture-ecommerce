const { enviarMensajeContacto } = require('../utils/email');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Recibe el formulario de "Contacto". El campo "web" es un honeypot: un campo oculto
// para humanos (vía CSS) pero visible para bots simples que rellenan todos los inputs
// de un formulario. Si llega con contenido, respondemos 200 sin enviar nada, para no
// darle a un bot ninguna pista de que fue detectado.
const enviarContacto = async (req, res) => {
  const { nombre, email, mensaje, web } = req.body;

  if (web) {
    return res.status(200).json({ success: true });
  }

  if (!nombre || nombre.trim().length < 2) {
    return res.status(400).json({ error: 'Indica tu nombre.' });
  }
  if (!email || !EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'Indica un correo electrónico válido.' });
  }
  if (!mensaje || mensaje.trim().length < 10) {
    return res.status(400).json({ error: 'El mensaje debe tener al menos 10 caracteres.' });
  }

  const enviado = await enviarMensajeContacto({
    nombre: nombre.trim().slice(0, 200),
    email: email.trim().slice(0, 200),
    mensaje: mensaje.trim().slice(0, 5000),
  });

  if (!enviado) {
    return res.status(502).json({ error: 'No se pudo enviar el mensaje. Inténtalo de nuevo en unos minutos.' });
  }

  res.status(200).json({ success: true });
};

module.exports = { enviarContacto };
