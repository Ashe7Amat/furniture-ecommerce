// Se importa el módulo entero (no desestructurado) para que los tests puedan sustituir
// email.enviarMensajeContacto con mock.method: una función ya desestructurada aquí arriba
// quedaría fijada a la versión original y el mock no tendría ningún efecto (mismo patrón que
// utils/pagos.js).
const email = require('../utils/email');
const supabase = require('../data/supabase');

// Guarda el mensaje en mensajes_contacto (panel "Mensajes"). Devuelve true si se guardó. Si falla
// (por ejemplo, mientras la tabla no exista en la base de datos), solo se apunta en el log, sin
// datos de quien escribió (H27), y el formulario sigue con el correo como siempre.
const guardarMensaje = async ({ nombre, email: emailComprador, mensaje }) => {
  try {
    const { error } = await supabase
      .from('mensajes_contacto')
      .insert([{ nombre, email: emailComprador, mensaje }]);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('No se pudo guardar el mensaje de contacto:', error.message);
    return false;
  }
};

// Recibe el formulario de "Contacto". El honeypot y la forma del payload (nombre/email/mensaje
// obligatorios, con formato y longitud válidos) ya se comprobaron antes de llegar aquí (ver
// contactoRoutes.js): validar() ya ha recortado los espacios de nombre/email/mensaje.
// Primero se guarda el mensaje y después se manda el correo. Si se guardó, el mensaje no se pierde
// aunque falle el correo (se ve en el panel), así que se responde 200. Solo si fallan las dos cosas
// se pide al visitante que lo intente de nuevo.
const enviarContacto = async (req, res) => {
  const { nombre, email: emailComprador, mensaje } = req.body;

  const guardado = await guardarMensaje({ nombre, email: emailComprador, mensaje });
  const enviado = await email.enviarMensajeContacto({ nombre, email: emailComprador, mensaje });

  if (!enviado && !guardado) {
    return res
      .status(502)
      .json({ error: 'No se pudo enviar el mensaje. Inténtalo de nuevo en unos minutos.' });
  }

  res.status(200).json({ success: true });
};

module.exports = { enviarContacto };
