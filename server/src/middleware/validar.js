const { ErrorValidacion } = require('../utils/errores');

// Middleware de validación con Zod. Valida `req[fuente]` contra `schema`; si es válida, SUSTITUYE
// req[fuente] por el resultado ya normalizado (recortado de espacios, con los "true"/"false" de
// un formulario convertidos a boolean, etc.) y sigue. Si no lo es, pasa un ErrorValidacion con el
// mensaje del primer problema encontrado al manejador de errores central (server/src/index.js),
// que responde 400 con ese mensaje.
//
// Solo se usa para la FORMA del payload (campos obligatorios, tipos, formatos, enumerados). Las
// reglas que dependen de la base de datos (un email ya registrado, una pieza ya vendida...) siguen
// viviendo en el controlador, después de este middleware.
const validar =
  (schema, fuente = 'body') =>
  (req, res, next) => {
    const resultado = schema.safeParse(req[fuente]);
    if (!resultado.success) {
      const primerProblema = resultado.error.issues[0];
      return next(new ErrorValidacion(primerProblema.message, resultado.error.issues));
    }
    req[fuente] = resultado.data;
    next();
  };

module.exports = { validar };
