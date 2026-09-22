const { z } = require('zod');
const { requerido, email } = require('./comunes');

// Sin cambios respecto al valor que ya usaba authController: no estaba en el alcance acordado
// de esta tarea (queda para cuando se toque JWT/bcrypt en la tarea 3).
const PASSWORD_MIN_LENGTH = 6;

const mensajePassword = `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
const password = () => z.string({ error: () => mensajePassword }).min(PASSWORD_MIN_LENGTH, mensajePassword);

// POST /api/auth/register -- igual que antes: nombre y contraseña solo comprueban que no estén
// vacíos; el email además debe tener formato de email.
const schemaRegistro = z.object({
  nombre: requerido('El nombre es obligatorio.'),
  email: email(),
  password: password(),
});

// POST /api/auth/login -- a propósito NO valida el formato del email (nunca lo hizo): solo que
// email y contraseña vengan rellenos, con el mismo mensaje combinado de antes. Si el email no
// existe o no tiene formato válido, la búsqueda en Supabase simplemente no encuentra nada y
// loginCliente responde igual que con una contraseña incorrecta (para no revelar qué emails
// están registrados).
const MENSAJE_LOGIN_INCOMPLETO = 'Email y contraseña requeridos.';
const schemaLogin = z.object({
  email: z.string({ error: () => MENSAJE_LOGIN_INCOMPLETO }).trim().min(1, MENSAJE_LOGIN_INCOMPLETO),
  password: z.string({ error: () => MENSAJE_LOGIN_INCOMPLETO }).min(1, MENSAJE_LOGIN_INCOMPLETO),
});

// POST /api/auth/google
const schemaGoogle = z.object({
  credential: requerido('Falta el token de Google.'),
});

// POST /api/auth/perfil-update -- todo opcional (es una actualización parcial: se manda solo lo
// que se quiere cambiar), pero lo que SÍ venga debe tener forma válida. Dos endurecimientos
// deliberados frente al código anterior, que no validaba ninguno de los dos:
//   - nuevoNombre ya no admite una cadena vacía (antes se podía dejar el nombre en "").
//   - nuevoEmail ahora exige formato de email (antes se aceptaba cualquier texto).
// Qué contraseña hay que pedir para autorizar el cambio, y si el nuevo email ya está en uso,
// sigue siendo cosa del controlador (depende de la base de datos, no de la forma del payload).
const schemaPerfilUpdate = z.object({
  nuevoNombre: requerido('El nombre no puede estar vacío.').optional(),
  nuevoEmail: email('Introduce un email válido.').optional(),
  passwordActual: z.string().optional(),
  nuevaPassword: password().optional(),
});

module.exports = { schemaRegistro, schemaLogin, schemaGoogle, schemaPerfilUpdate, PASSWORD_MIN_LENGTH };
