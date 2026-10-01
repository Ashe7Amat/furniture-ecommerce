// Tests de middleware/auth.js: verificarToken (cualquier sesión) y verificarAdmin (solo el rol
// admin). Se llaman directamente, con un req y un res mínimos, sin montar Express.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'secreto-de-prueba-para-este-archivo';
const { verificarToken, verificarAdmin } = require('../middleware/auth');

const firmar = (payload, opciones = {}) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h', ...opciones });

// Ejecuta el middleware y devuelve qué hizo: si llamó a next(), o qué respondió.
const pasarPor = (middleware, authorization) => {
  const req = { headers: authorization === undefined ? {} : { authorization } };
  const resultado = { siguio: false, status: null, cuerpo: null, req };
  const res = {
    status(codigo) {
      resultado.status = codigo;
      return this;
    },
    json(cuerpo) {
      resultado.cuerpo = cuerpo;
      return this;
    }
  };
  middleware(req, res, () => {
    resultado.siguio = true;
  });
  return resultado;
};

describe('verificarToken', () => {
  test('con un token válido deja pasar y guarda sus datos en req.usuario', () => {
    const r = pasarPor(
      verificarToken,
      `Bearer ${firmar({ email: 'ana@correo.es', rol: 'cliente', nombre: 'Ana' })}`
    );
    assert.equal(r.siguio, true);
    assert.equal(r.req.usuario.email, 'ana@correo.es');
    assert.equal(r.req.usuario.rol, 'cliente');
  });

  test('sin cabecera Authorization: 401 "No has iniciado sesión."', () => {
    const r = pasarPor(verificarToken, undefined);
    assert.equal(r.siguio, false);
    assert.equal(r.status, 401);
    assert.deepEqual(r.cuerpo, { error: 'No has iniciado sesión.' });
  });

  test('una cabecera que no es "Bearer <token>" cuenta como sin sesión', () => {
    const r = pasarPor(verificarToken, `Basic ${firmar({ email: 'a@b.es' })}`);
    assert.equal(r.status, 401);
    assert.deepEqual(r.cuerpo, { error: 'No has iniciado sesión.' });
  });

  test('un token caducado: 401 "Tu sesión ha caducado" (es el que hace renovar la sesión al cliente)', () => {
    const r = pasarPor(verificarToken, `Bearer ${firmar({ email: 'a@b.es' }, { expiresIn: -10 })}`);
    assert.equal(r.siguio, false);
    assert.equal(r.status, 401);
    assert.deepEqual(r.cuerpo, { error: 'Tu sesión ha caducado. Vuelve a iniciar sesión.' });
  });

  test('un token firmado con otro secreto (falsificado) no pasa', () => {
    const falso = jwt.sign({ email: 'a@b.es', rol: 'admin' }, 'otro-secreto');
    const r = pasarPor(verificarToken, `Bearer ${falso}`);
    assert.equal(r.siguio, false);
    assert.equal(r.status, 401);
  });

  test('un token que no es un JWT no pasa', () => {
    const r = pasarPor(verificarToken, 'Bearer esto-no-es-un-jwt');
    assert.equal(r.status, 401);
  });
});

describe('verificarAdmin', () => {
  test('con sesión de administrador deja pasar', () => {
    const r = pasarPor(
      verificarAdmin,
      `Bearer ${firmar({ email: 'admin@nave5.es', rol: 'admin' })}`
    );
    assert.equal(r.siguio, true);
  });

  test('con sesión de cliente: 403, no 401 (la sesión vale, pero no tiene permiso)', () => {
    const r = pasarPor(
      verificarAdmin,
      `Bearer ${firmar({ email: 'ana@correo.es', rol: 'cliente' })}`
    );
    assert.equal(r.siguio, false);
    assert.equal(r.status, 403);
    assert.deepEqual(r.cuerpo, { error: 'No tienes permisos de administrador para hacer esto.' });
  });

  test('sin sesión o con un token caducado: 401 antes de mirar el rol', () => {
    assert.equal(pasarPor(verificarAdmin, undefined).status, 401);
    const caducado = firmar({ email: 'admin@nave5.es', rol: 'admin' }, { expiresIn: -10 });
    const r = pasarPor(verificarAdmin, `Bearer ${caducado}`);
    assert.equal(r.status, 401);
    assert.equal(r.siguio, false);
  });
});
