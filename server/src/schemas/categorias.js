const { z } = require('zod');

// A5: el código de 3 letras de una categoría (SIL, MES...), con el que se forman las referencias
// de sus muebles (NAV-SIL-001, ver utils/referencia.js). Llega por multipart/form-data, así que
// siempre como texto. Se recorta y se pasa a mayúsculas antes de comprobarlo.
// - ausente: no se toca (al editar, el código se queda como estaba);
// - vacío: sin código (null). Sus muebles nuevos se crean sin referencia, como hasta ahora;
// - cualquier otra cosa: tiene que ser exactamente 3 letras de la A a la Z.
// Que no lo use otra categoría lo comprueba la base de datos (índice único de categorias.codigo).
const CODIGO_REGEX = /^[A-Z]{3}$/;
const codigoCategoria = z
  .union([z.string(), z.null()])
  .transform((valor) => {
    const limpio = (valor ?? '').trim().toUpperCase();
    return limpio === '' ? null : limpio;
  })
  .refine((valor) => valor == null || CODIGO_REGEX.test(valor), {
    message: 'El código de la categoría tiene que ser de 3 letras (A-Z), por ejemplo SIL.'
  });

// .optional(): sin el campo, Zod no llama a la transformación y `codigo` sigue ausente.
// .passthrough(): el resto de campos (nombre, categoria_padre_id, imagen_url) los sigue tratando el
// controlador como antes de A5; aquí solo se valida el código.
const schemaCategoria = z.object({ codigo: codigoCategoria.optional() }).passthrough();

module.exports = { schemaCategoria, CODIGO_REGEX };
