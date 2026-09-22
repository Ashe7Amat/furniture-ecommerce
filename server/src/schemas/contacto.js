const { z } = require('zod');
const { requerido, email } = require('./comunes');

// POST /api/contacto -- el honeypot ("web") se comprueba ANTES de llegar aquí (ver
// contactoRoutes.js): si un bot lo rellena, responde 200 sin pasar por esta validación, para no
// darle ninguna pista de que se le ha detectado.
//
// Antes de Zod, un nombre/email/mensaje demasiado largo se recortaba en silencio (200/200/5000
// caracteres) sin avisar a quien escribió el formulario. Ahora se RECHAZA con un mensaje claro en
// vez de guardar el mensaje cortado a medias -- es un cambio de comportamiento deliberado.
const schemaContacto = z.object({
  nombre: requerido('Indica tu nombre.')
    .min(2, 'Indica tu nombre.')
    .max(200, 'El nombre es demasiado largo (máximo 200 caracteres).'),
  email: email('Indica un correo electrónico válido.').max(
    200,
    'El email es demasiado largo (máximo 200 caracteres).'
  ),
  mensaje: requerido('El mensaje debe tener al menos 10 caracteres.')
    .min(10, 'El mensaje debe tener al menos 10 caracteres.')
    .max(5000, 'El mensaje es demasiado largo (máximo 5000 caracteres).')
});

module.exports = { schemaContacto };
