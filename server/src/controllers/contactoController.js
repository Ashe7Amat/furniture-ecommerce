// Se importa el módulo entero (no desestructurado) para que los tests puedan sustituir
// email.enviarMensajeContacto con mock.method: una función ya desestructurada aquí arriba
// quedaría fijada a la versión original y el mock no tendría ningún efecto (mismo patrón que
// utils/pagos.js).
const email = require('../utils/email');

// Recibe el formulario de "Contacto". El honeypot y la forma del payload (nombre/email/mensaje
// obligatorios, con formato y longitud válidos) ya se comprobaron antes de llegar aquí (ver
// contactoRoutes.js): validar() ya ha recortado los espacios de nombre/email/mensaje.
const enviarContacto = async (req, res) => {
  const { nombre, email: emailComprador, mensaje } = req.body;

  const enviado = await email.enviarMensajeContacto({ nombre, email: emailComprador, mensaje });

  if (!enviado) {
    return res.status(502).json({ error: 'No se pudo enviar el mensaje. Inténtalo de nuevo en unos minutos.' });
  }

  res.status(200).json({ success: true });
};

module.exports = { enviarContacto };
