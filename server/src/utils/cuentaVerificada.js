// La cuenta del cliente que ha iniciado sesión, para lo que exige un email verificado: "Mis pedidos"
// (H18, docs/verificacion-email-diseno.md, parte 6, punto 6) y reservar fechas (T8 de
// docs/reservas-diseno.md). Antes vivía dentro de pedidosController.js.
//
// La cuenta se busca por su id (`sub` del token) o, en los tokens de antes de H28, por su email.
const supabase = require('../data/supabase');

const NO_LOGUEADO = { error: 'No has iniciado sesión.' };
const SESION_CADUCADA = { error: 'Tu sesión ha caducado. Vuelve a iniciar sesión.' };

// Un access token firmado antes de que la cuenta quedara verificada no sirve aquí: puede ser de
// quien registró el email de otra persona, cuando esa persona entra con Google y protege la cuenta
// (se le revocan las sesiones, pero su access token vale hasta 1 hora y la cuenta acaba de recibir
// los pedidos de invitado). Con un 401, el cliente renueva la sesión y reintenta: quien tiene una
// sesión válida sigue sin notar nada, y la revocada se queda fuera. Se compara por segundos, como
// `iat`, para no rechazar un token firmado en el mismo segundo que la verificación.
const firmadoAntesDeVerificar = (usuarioToken, cuenta) => {
  if (!cuenta.email_verificado_en || typeof usuarioToken.iat !== 'number') return false;
  const verificadoEn = Math.floor(new Date(cuenta.email_verificado_en).getTime() / 1000);
  return usuarioToken.iat < verificadoEn;
};

// Devuelve { cuenta } con las `columnas` pedidas, o { rechazo: { status, cuerpo } } con la respuesta
// que hay que dar. `mensajeSinVerificar` dice qué es lo que no se puede hacer sin confirmar el email.
// Lanza si falla la base de datos.
const buscarCuentaVerificada = async (usuarioToken, { columnas = 'id', mensajeSinVerificar }) => {
  const { sub, email } = usuarioToken || {};
  if (!sub && !email) return { rechazo: { status: 401, cuerpo: NO_LOGUEADO } };

  const consulta = supabase
    .from('clientes')
    .select(`${columnas}, email_verificado, email_verificado_en`);
  const { data: cuenta, error } = sub
    ? await consulta.eq('id', sub).maybeSingle()
    : await consulta.eq('email', email).maybeSingle();
  if (error) throw error;
  if (!cuenta) return { rechazo: { status: 401, cuerpo: NO_LOGUEADO } };
  if (cuenta.email_verificado !== true) {
    return {
      rechazo: {
        status: 403,
        cuerpo: { error: mensajeSinVerificar, codigo: 'email_no_verificado' }
      }
    };
  }
  if (firmadoAntesDeVerificar(usuarioToken, cuenta)) {
    return { rechazo: { status: 401, cuerpo: SESION_CADUCADA } };
  }
  return { cuenta };
};

module.exports = { buscarCuentaVerificada };
