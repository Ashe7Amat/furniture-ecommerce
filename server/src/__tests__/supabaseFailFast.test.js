// data/supabase.js debe fallar al cargarse (con un mensaje claro) si falta SUPABASE_URL o
// SUPABASE_SERVICE_ROLE_KEY, en vez de arrancar en silencio con la clave "anon" como respaldo (lo
// que dejaba al servidor sujeto a las políticas de Row Level Security pensadas para el
// navegador). No usa el doble en memoria de otros tests: aquí interesa precisamente el propio
// módulo real, forzado a recargarse en cada caso con `delete require.cache`.
const { test, describe } = require('node:test');
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
    assert.doesNotThrow(() => { cliente = recargar(); });
    assert.equal(typeof cliente.from, 'function');
  });
});
