// Variables de entorno mínimas para que los tests puedan cargar server/src/index.js (o
// data/supabase.js directamente) sin tocar Supabase de verdad y sin necesitar un server/.env
// completo (así corren igual en CI que en local). Cada test file la requiere, POR SU EFECTO
// SECUNDARIO, antes de requerir cualquier módulo que arrastre data/supabase.js -- dotenv no
// sobreescribe una variable que ya esté presente en process.env, así que fijarla aquí primero
// evita que dotenv cargue las credenciales reales de server/.env en los tests.
//
// data/supabase.js falla al cargarse si faltan estas dos variables (ver esa fail-fast); ningún
// test debería depender de un supabaseUrl/Key concretos, porque todos sustituyen `supabase.from`
// por un doble en memoria o un fetch falso antes de hacer ninguna petición real.
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'clave-de-prueba';
// Secreto del HMAC de los refresh tokens (utils/refreshTokens.js). Un test que quiera probar qué
// pasa sin él lo borra y lo restaura dentro del propio test.
process.env.REFRESH_TOKEN_HASH_SECRET =
  process.env.REFRESH_TOKEN_HASH_SECRET || 'secreto-de-prueba-para-refresh-tokens';

module.exports = {};
