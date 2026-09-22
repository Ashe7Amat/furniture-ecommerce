// data/supabase.js debe fallar al cargarse (con un mensaje claro) si falta SUPABASE_URL o
// SUPABASE_SERVICE_ROLE_KEY, en vez de arrancar en silencio con la clave "anon" como respaldo (lo
// que dejaba al servidor sujeto a las políticas de Row Level Security pensadas para el
// navegador). No usa el doble en memoria de otros tests: aquí interesa precisamente el propio
// módulo real, forzado a recargarse en cada caso con `delete require.cache`.
const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const recargar = () => {
  delete require.cache[require.resolve('../data/supabase')];
  return require('../data/supabase');
};

describe('data/supabase.js — falla rápido sin SERVICE_ROLE_KEY', () => {
  test('sin SUPABASE_SERVICE_ROLE_KEY, lanza mencionando esa variable', () => {
    process.env.SUPABASE_URL = 'https://dummy.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = ''; // dotenv no la sobreescribe: ya está "presente"
    assert.throws(recargar, /SUPABASE_SERVICE_ROLE_KEY/);
  });

  test('con SUPABASE_SERVICE_ROLE_KEY pero sin SUPABASE_URL, lanza mencionando esa otra variable', () => {
    process.env.SUPABASE_URL = '';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-de-prueba-valida';
    assert.throws(recargar, /SUPABASE_URL/);
  });

  test('con una SUPABASE_URL que no es una URL http/https, también lanza', () => {
    process.env.SUPABASE_URL = 'no-es-una-url';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-de-prueba-valida';
    assert.throws(recargar, /SUPABASE_URL/);
  });

  test('la clave "anon" ya NO sirve de respaldo si falta la service_role', () => {
    process.env.SUPABASE_URL = 'https://dummy.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = '';
    process.env.SUPABASE_ANON_KEY = 'una-clave-anon-cualquiera';
    assert.throws(recargar, /SUPABASE_SERVICE_ROLE_KEY/);
  });

  test('con ambas variables presentes y válidas, no lanza y exporta un cliente utilizable', () => {
    process.env.SUPABASE_URL = 'https://dummy.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-de-prueba-valida';
    let cliente;
    assert.doesNotThrow(() => {
      cliente = recargar();
    });
    assert.equal(typeof cliente.from, 'function');
  });
});

// H8: en producción, SUPABASE_URL con http:// (sin TLS) deja viajar la clave service_role sin
// cifrar. Grupo propio para poder restaurar NODE_ENV con un afterEach (no al final de un test
// concreto, que no correría si ese test fallara) y no afectar a otros archivos de test (aunque
// node --test ya aísla cada archivo en su propio proceso, restaurarlo es gratis y evita depender
// de ese detalle de aislamiento).
describe('data/supabase.js — exige https:// en producción (H8)', () => {
  const nodeEnvOriginal = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = nodeEnvOriginal;
  });

  test('en producción, con SUPABASE_URL http://, lanza mencionando https://', () => {
    process.env.NODE_ENV = 'production';
    process.env.SUPABASE_URL = 'http://dummy.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-de-prueba-valida';
    assert.throws(recargar, /https:\/\//);
  });

  test('en producción, con SUPABASE_URL https://, no lanza', () => {
    process.env.NODE_ENV = 'production';
    process.env.SUPABASE_URL = 'https://dummy.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-de-prueba-valida';
    assert.doesNotThrow(recargar);
  });

  test('fuera de producción, con SUPABASE_URL http:// (self-hosted en local), no lanza', () => {
    process.env.NODE_ENV = 'development';
    process.env.SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-de-prueba-valida';
    assert.doesNotThrow(recargar);
  });

  test('sin NODE_ENV definido, con SUPABASE_URL http://, no lanza (mismo criterio que el resto del código: solo "production" activa el modo estricto)', () => {
    delete process.env.NODE_ENV;
    process.env.SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-de-prueba-valida';
    assert.doesNotThrow(recargar);
  });
});
