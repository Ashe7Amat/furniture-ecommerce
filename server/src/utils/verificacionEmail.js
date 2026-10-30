// Enlaces para confirmar el email de una cuenta (H18, docs/verificacion-email-diseno.md). La tabla
// es public.verificaciones_email (parte 5 del diseño).
//
// - El token es aleatorio (256 bits) y solo viaja en el enlace del correo. En la base de datos se
//   guarda su HMAC-SHA256 con EMAIL_TOKEN_HASH_SECRET, como los refresh tokens: quien solo pudiera
//   leer o escribir en la tabla no podría usar ni fabricar un enlace válido. El secreto es propio
//   (no REFRESH_TOKEN_HASH_SECRET) para que rotar uno no invalide el otro.
// - Cada enlace sirve una vez y caduca a las 24 horas.
// - Gastarlo es un UPDATE condicional (`... WHERE id = $id AND usado_en IS NULL`), la única puerta
//   frente a dos confirmaciones a la vez: solo una ve la fila afectada; la otra recibe la misma
//   respuesta que un enlace inventado.
// - Pedir un enlace nuevo borra los anteriores sin usar de esa cuenta y del mismo motivo: solo vale
//   el último de cada motivo.
const crypto = require('crypto');
const supabase = require('../data/supabase');
const { BRAND } = require('../config/brand.config');
const { escaparIlike } = require('./ilike');

const DURACION_MS = 24 * 60 * 60 * 1000;
const MOTIVOS = ['registro', 'cambio_email'];
const COLUMNAS = 'id, cliente_id, email, motivo, expira_en, usado_en';

// Sin EMAIL_TOKEN_HASH_SECRET no se puede emitir ni comprobar ningún enlace. No se arranca con un
// valor por defecto: sería un secreto conocido.
class SecretoNoConfigurado extends Error {
  constructor() {
    super('Falta la variable de entorno EMAIL_TOKEN_HASH_SECRET.');
    this.name = 'SecretoNoConfigurado';
  }
}

const secreto = () => {
  const valor = process.env.EMAIL_TOKEN_HASH_SECRET;
  if (!valor) throw new SecretoNoConfigurado();
  return valor;
};

const secretoFallback = () =>
  process.env.EMAIL_TOKEN_HASH_SECRET_PREVIOUS || process.env.EMAIL_TOKEN_HASH_FALLBACK;

const hashear = (token, secretoAlternativo) =>
  crypto
    .createHmac('sha256', secretoAlternativo || secreto())
    .update(String(token))
    .digest('hex');

const tabla = () => supabase.from('verificaciones_email');

// Crea un enlace nuevo para `email` (el de la cuenta, o el pendiente si es un cambio) y devuelve el
// token en claro, para el correo. Antes borra los que la cuenta tuviera sin usar del mismo motivo:
// así pedir otro enlace de registro no anula el de un cambio de email a medias, ni al revés.
const crear = async ({ clienteId, email, motivo }) => {
  if (!MOTIVOS.includes(motivo)) throw new Error(`Motivo de verificación desconocido: ${motivo}`);
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashear(token);

  const { error: errorBorrado } = await tabla()
    .delete()
    .eq('cliente_id', clienteId)
    .eq('motivo', motivo)
    .is('usado_en', null);
  if (errorBorrado) throw errorBorrado;

  const { error } = await tabla().insert({
    cliente_id: clienteId,
    email,
    motivo,
    token_hash: tokenHash,
    expira_en: new Date(Date.now() + DURACION_MS).toISOString()
  });
  if (error) throw error;
  return token;
};

// Gasta el enlace. Devuelve la fila ({ cliente_id, email, motivo, ... }) o null si no vale: no
// existe, ya se usó, ha caducado o lo ha gastado otra petición a la vez. Los cuatro casos dan lo
// mismo a propósito: quien llama responde igual a todos.
const consumir = async (token) => {
  let { data: fila, error } = await tabla()
    .select(COLUMNAS)
    .eq('token_hash', hashear(token))
    .is('usado_en', null)
    .maybeSingle();
  if (error) throw error;

  const fallback = secretoFallback();
  if (!fila && fallback) {
    const { data: filaFallback, error: errorFallback } = await tabla()
      .select(COLUMNAS)
      .eq('token_hash', hashear(token, fallback))
      .is('usado_en', null)
      .maybeSingle();
    if (errorFallback) throw errorFallback;
    fila = filaFallback;
  }

  if (!fila) return null;
  if (new Date(fila.expira_en).getTime() <= Date.now()) return null;

  const { data: gastadas, error: errorGasto } = await tabla()
    .update({ usado_en: new Date().toISOString() })
    .eq('id', fila.id)
    .is('usado_en', null)
    .select('id');
  if (errorGasto) throw errorGasto;
  return gastadas && gastadas.length === 1 ? fila : null;
};

// Asocia a la cuenta los pedidos de invitado hechos con ese email (parte 6, punto 2). Solo se llama
// cuando el email acaba de demostrarse (enlace confirmado o Google), así que no hace falta la
// condición de unicidad de B3: ya se sabe qué cuenta es. Mismo criterio que "Mis pedidos" antes de
// H18: email sin distinguir mayúsculas y ESCAPADO (H17). Un fallo aquí no deshace la verificación:
// se registra y los pedidos se pueden asociar a mano. Devuelve cuántos se asociaron (o null).
const asociarPedidosDeInvitado = async (clienteId, email) => {
  const { data, error } = await supabase
    .from('pedidos')
    .update({ cliente_id: clienteId })
    .is('cliente_id', null)
    .ilike('cliente_info->>email', escaparIlike(email))
    .select('id');
  if (error) {
    console.error(
      `No se pudieron asociar los pedidos de invitado a la cuenta ${clienteId}:`,
      error.message
    );
    return null;
  }
  return data ? data.length : 0;
};

// URL del enlace del correo: una página del cliente que hace el POST al pulsar un botón. Si fuera un
// GET directo a la API, los filtros de correo que abren los enlaces para analizarlos gastarían el
// token antes que la persona (parte 6, punto 9). Sin CLIENT_URL válida, la web pública.
const WEB_PUBLICA = `https://${BRAND.dominio}`;
const urlVerificacion = (token) => {
  const urlWeb = (process.env.CLIENT_URL || '').replace(/\/+$/, '');
  const base = /^https?:\/\//.test(urlWeb) ? urlWeb : WEB_PUBLICA;
  return `${base}/verificar-email?token=${encodeURIComponent(token)}`;
};

module.exports = {
  SecretoNoConfigurado,
  DURACION_MS,
  hashear,
  crear,
  consumir,
  asociarPedidosDeInvitado,
  urlVerificacion
};
