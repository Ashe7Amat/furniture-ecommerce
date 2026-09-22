// Validación con Zod de /api/contacto (task 2, punto 6), y el orden honeypot -> Zod (el
// honeypot debe comprobarse ANTES de la validación, para no darle a un bot ninguna pista
// distinguible de que se le ha detectado).
//
// El limitador de contacto (5 mensajes por IP cada 15 min) es un contador en memoria
// compartido por todo este archivo: como mucho 5 peticiones en total (por eso el resto de
// casos -- longitud del mensaje, recorte de espacios -- están en
// validacionContactoLimites.test.js, en su propio proceso).
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
require('./helpers/testEnv');

const app = require('../index');

const mensajeValido = {
  nombre: 'Ana',
  email: 'ana@example.com',
  mensaje: 'Hola, quería preguntar algo.'
};

describe('POST /api/contacto — honeypot antes que la validación', () => {
  test('con el honeypot relleno, responde 200 SIN validar nada más (payload por lo demás vacío)', async () => {
    const res = await request(app).post('/api/contacto').send({ web: 'http://spam.example.com' });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { success: true });
  });
});

describe('POST /api/contacto — validación con Zod', () => {
  test('rechaza con 400 si falta el nombre', async () => {
    const res = await request(app)
      .post('/api/contacto')
      .send({ ...mensajeValido, nombre: undefined });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Indica tu nombre.');
  });

  test('rechaza con 400 un nombre de un solo carácter', async () => {
    const res = await request(app)
      .post('/api/contacto')
      .send({ ...mensajeValido, nombre: 'A' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Indica tu nombre.');
  });

  test('rechaza con 400 un email con formato inválido', async () => {
    const res = await request(app)
      .post('/api/contacto')
      .send({ ...mensajeValido, email: 'no-es-un-email' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Indica un correo electrónico válido.');
  });
});
