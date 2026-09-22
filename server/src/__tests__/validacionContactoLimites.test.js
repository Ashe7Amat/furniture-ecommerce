// Límites de longitud de /api/contacto (task 2, punto 6): en su propio archivo/proceso para no
// compartir el contador del limitador (5 mensajes por IP cada 15 min) con
// validacionContacto.test.js. Aquí caben 3 peticiones.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
require('./helpers/testEnv');

process.env.RESEND_API_KEY = ''; // por si algún test no llegara a mockear enviarMensajeContacto

const email = require('../utils/email');
const app = require('../index');

const mensajeValido = { nombre: 'Ana', email: 'ana@example.com', mensaje: 'Hola, quería preguntar algo.' };

afterEach(() => mock.restoreAll());

describe('POST /api/contacto — límites de longitud', () => {
  test('rechaza con 400 un mensaje demasiado corto', async () => {
    const res = await request(app).post('/api/contacto').send({ ...mensajeValido, mensaje: 'corto' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'El mensaje debe tener al menos 10 caracteres.');
  });

  test('cambio de comportamiento deliberado: un mensaje de más de 5000 caracteres se RECHAZA (antes se recortaba en silencio, sin avisar)', async () => {
    const res = await request(app).post('/api/contacto').send({ ...mensajeValido, mensaje: 'x'.repeat(5001) });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'El mensaje es demasiado largo (máximo 5000 caracteres).');
  });

  test('un mensaje válido con espacios de sobra llega recortado al envío de email', async () => {
    const enviar = mock.method(email, 'enviarMensajeContacto', async () => true);
    const res = await request(app).post('/api/contacto').send({ nombre: '  Ana  ', email: ' ana@example.com ', mensaje: '  Hola, quería preguntar algo.  ' });

    assert.equal(res.status, 200);
    const enviado = enviar.mock.calls[0].arguments[0];
    assert.equal(enviado.nombre, 'Ana');
    assert.equal(enviado.email, 'ana@example.com');
    assert.equal(enviado.mensaje, 'Hola, quería preguntar algo.');
  });
});
