// Refresh tokens con rotación, detección de reuso y margen de gracia (docs/tarea3-diseno.md,
// sección 2). La tabla es public.refresh_tokens (migración C1).
//
// - El token es aleatorio (256 bits) y solo se entrega al cliente. En la base de datos se guarda
//   su HMAC-SHA256 con REFRESH_TOKEN_HASH_SECRET: quien solo pudiera escribir en la tabla no
//   podría fabricar una fila válida para un token inventado por él.
// - Cada uso lo rota: el token presentado queda revocado y apunta (replaced_by) a su sucesor, de
//   la misma familia (family_id = la cadena de rotaciones de una sesión).
// - Presentar un token ya revocado es un reuso y revoca la familia entera, salvo el margen de
//   gracia: si se revocó hace 60 s o menos por una rotación normal y su sucesor sigue activo, se
//   rota a partir del sucesor (un solo salto por petición). Cubre dos pestañas con el mismo token.
//
// ORDEN DE LA ROTACIÓN (distinto del literal del diseño, a propósito): el diseño reclamaba primero
// el token viejo y después insertaba el sucesor y rellenaba replaced_by. Con dos peticiones
// simultáneas, la segunda podía ver el token revocado con replaced_by todavía a NULL y tomarlo
// por un reuso, revocando la familia (incluido el token recién entregado a la primera). Aquí se
// inserta antes el sucesor, y revoked_at y replaced_by se ponen en el MISMO UPDATE condicional
// (`... WHERE id = $id AND revoked_at IS NULL`), que sigue siendo la única puerta: quien ve el
// token revocado ve también su sucesor. Si el UPDATE no afecta a ninguna fila, otra petición
// ganó la carrera y el sucesor huérfano se borra (no se ha entregado a nadie).
const crypto = require('crypto');
const net = require('net');
const supabase = require('../data/supabase');

const DURACION_MS = 7 * 24 * 60 * 60 * 1000;
const MARGEN_GRACIA_MS = 60 * 1000;
// Los caducados se guardan 30 días más por si hace falta investigar un reuso reciente.
const CONSERVAR_CADUCADOS_MS = 30 * 24 * 60 * 60 * 1000;
const COLUMNAS = 'id, user_id, family_id, expires_at, revoked_at, replaced_by';

// Sin REFRESH_TOKEN_HASH_SECRET no se puede emitir ni comprobar ningún refresh token. No se
// arranca con un valor por defecto: sería un secreto conocido.
class SecretoNoConfigurado extends Error {
  constructor() {
    super('Falta la variable de entorno REFRESH_TOKEN_HASH_SECRET.');
    this.name = 'SecretoNoConfigurado';
  }
}

const secreto = () => {
  const valor = process.env.REFRESH_TOKEN_HASH_SECRET;
  if (!valor) throw new SecretoNoConfigurado();
  return valor;
};

const generarToken = () => crypto.randomBytes(32).toString('base64url');

const hashear = (token) =>
  crypto.createHmac('sha256', secreto()).update(String(token)).digest('hex');

// user_agent e ip solo sirven para una futura pantalla de "sesiones activas": no se usan para
// ninguna decisión de seguridad. La ip solo se guarda si es una dirección válida (la columna es
// inet y un valor raro haría fallar el INSERT, y con él el inicio de sesión).
const metadatos = (req) => {
  const userAgent = (req.get?.('user-agent') || '').slice(0, 255);
  return {
    user_agent: userAgent || null,
    ip: req.ip && net.isIP(req.ip) ? req.ip : null
  };
};

const tabla = () => supabase.from('refresh_tokens');

const leer = async (columna, valor) => {
  const { data, error } = await tabla().select(COLUMNAS).eq(columna, valor).maybeSingle();
  if (error) throw error;
  return data;
};

const ahoraIso = () => new Date().toISOString();

// Emite un refresh token nuevo. Sin `familia`, empieza una sesión nueva (login).
const emitir = async (userId, { familia = crypto.randomUUID(), meta = {} } = {}) => {
  const token = generarToken();
  const { data, error } = await tabla()
    .insert({
      user_id: userId,
      family_id: familia,
      token_hash: hashear(token),
      expires_at: new Date(Date.now() + DURACION_MS).toISOString(),
      ...meta
    })
    .select('id')
    .single();
  if (error) throw error;
  return { token, id: data.id, familia };
};

const revocarFamilia = async (familia) => {
  const { error } = await tabla()
    .update({ revoked_at: ahoraIso() })
    .eq('family_id', familia)
    .is('revoked_at', null);
  if (error) throw error;
};

// Reclama `fila` (activa según la última lectura) y la rota. `unSalto`: se viene del margen de
// gracia; si se pierde la carrera no se intenta otro salto (el diseño lo limita a uno por petición).
const reclamarYRotar = async (fila, meta, { unSalto = false } = {}) => {
  if (new Date(fila.expires_at).getTime() <= Date.now()) {
    const { error } = await tabla()
      .update({ revoked_at: ahoraIso() })
      .eq('id', fila.id)
      .is('revoked_at', null);
    if (error) throw error;
    return { ok: false, motivo: 'caducado' };
  }

  const sucesor = await emitir(fila.user_id, { familia: fila.family_id, meta });
  const { data: reclamadas, error } = await tabla()
    .update({ revoked_at: ahoraIso(), replaced_by: sucesor.id })
    .eq('id', fila.id)
    .is('revoked_at', null)
    .select('id');
  if (error) throw error;
  if (reclamadas && reclamadas.length === 1) {
    return { ok: true, userId: fila.user_id, familia: fila.family_id, refreshToken: sucesor.token };
  }

  // Otra petición la reclamó antes: el sucesor recién insertado no se ha entregado a nadie.
  const { error: errorBorrado } = await tabla().delete().eq('id', sucesor.id);
  if (errorBorrado) throw errorBorrado;
  if (unSalto) return { ok: false, motivo: 'reuso', familia: fila.family_id };
  const actual = await leer('id', fila.id);
  return actual ? tratarRevocado(actual, meta) : { ok: false, motivo: 'inexistente' };
};

// El token presentado ya estaba revocado: margen de gracia o reuso.
const tratarRevocado = async (fila, meta) => {
  const reciente =
    fila.replaced_by && Date.now() - new Date(fila.revoked_at).getTime() <= MARGEN_GRACIA_MS;
  if (reciente) {
    const sucesora = await leer('id', fila.replaced_by);
    const activa =
      sucesora && !sucesora.revoked_at && new Date(sucesora.expires_at).getTime() > Date.now();
    if (activa) {
      const resultado = await reclamarYRotar(sucesora, meta, { unSalto: true });
      if (resultado.ok) return resultado;
    }
  }
  await revocarFamilia(fila.family_id);
  return { ok: false, motivo: 'reuso', familia: fila.family_id };
};

// Rota el refresh token presentado. Devuelve { ok: true, userId, familia, refreshToken } o
// { ok: false, motivo: 'inexistente' | 'reuso' | 'caducado' }. El motivo es solo para el log:
// al cliente se le responde igual en los tres casos.
const rotar = async (token, meta = {}) => {
  const fila = await leer('token_hash', hashear(token));
  if (!fila) return { ok: false, motivo: 'inexistente' };
  if (fila.revoked_at) return tratarRevocado(fila, meta);
  return reclamarYRotar(fila, meta);
};

// Cierre de sesión: revoca la familia del token presentado. Si no existe, no hace nada.
const revocarFamiliaDeToken = async (token) => {
  const fila = await leer('token_hash', hashear(token));
  if (fila) await revocarFamilia(fila.family_id);
};

// H21: al cambiar la contraseña o el email se revocan todas las sesiones del usuario.
const revocarTodasDelUsuario = async (userId) => {
  const { error } = await tabla()
    .update({ revoked_at: ahoraIso() })
    .eq('user_id', userId)
    .is('revoked_at', null);
  if (error) throw error;
};

// Mantenimiento (no lo llama nada automáticamente: no hay tareas programadas en el proyecto). Es
// la misma consulta que se documenta en mejoras-tecnicas.md para lanzarla a mano:
//   DELETE FROM refresh_tokens WHERE expires_at < now() - interval '30 days';
const limpiarExpirados = async () => {
  const limite = new Date(Date.now() - CONSERVAR_CADUCADOS_MS).toISOString();
  const { data, error } = await tabla().delete().lt('expires_at', limite).select('id');
  if (error) throw error;
  return data ? data.length : 0;
};

module.exports = {
  SecretoNoConfigurado,
  DURACION_MS,
  MARGEN_GRACIA_MS,
  generarToken,
  hashear,
  metadatos,
  emitir,
  rotar,
  revocarFamilia,
  revocarFamiliaDeToken,
  revocarTodasDelUsuario,
  limpiarExpirados
};
