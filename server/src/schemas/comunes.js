// Piezas de Zod reutilizadas por los demás esquemas (schemas/auth.js, muebles.js, etc.).
//
// Nota sobre Zod v4: el `required_error`/`invalid_type_error` de Zod v3 ya NO funciona -- se
// ignora en silencio y Zod ve el mensaje en inglés por defecto ("Invalid input: expected
// string..."). Comprobado con la versión instalada (4.6.5). Por eso `requerido()` usa la opción
// `error` (función) para cubrir el campo ausente y de tipo incorrecto, y además encadena
// `.min(1, mensaje)` para cubrir la cadena vacía o solo espacios (que si pasara el `error`
// anterior, seguiría siendo un valor "válido" de tipo string para Zod).
const { z } = require('zod');

// Cadena de texto obligatoria: mismo mensaje en castellano tanto si el campo falta, como si
// llega con otro tipo, como si llega vacía o solo con espacios (se recorta con .trim()).
const requerido = (mensaje) => z.string({ error: () => mensaje }).trim().min(1, mensaje);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Mismo patrón y mismo mensaje que se usaba antes de Zod (EMAIL_REGEX en authController y
// contactoController), para no cambiar qué se acepta como email válido.
const email = (mensaje = 'Introduce un email válido.') =>
  requerido(mensaje).regex(EMAIL_REGEX, mensaje);

module.exports = { requerido, email, EMAIL_REGEX };
