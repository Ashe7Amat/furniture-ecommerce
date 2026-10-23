// Los avisos de los esquemas cuando un dato llega con un tipo que no toca (un número donde va un
// texto, un texto donde va un objeto...). Un cliente normal no los provoca, pero sí una petición
// hecha a mano, y el aviso tiene que seguir siendo un mensaje claro en castellano.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { schemaListaReservas, schemaAlquilerFueraDeLaWeb } = require('../schemas/adminReservas');
const { schemaSolicitarCancelacion } = require('../schemas/reservas');

const mensajes = (resultado) => resultado.error.issues.map((i) => i.message);

const ALQUILER_VALIDO = {
  mueble_id: '00000000-0000-4000-8000-000000000001',
  fecha_inicio: '2026-11-10',
  hora_entrega: '10:00',
  fecha_fin: '2026-11-12',
  hora_recogida: '18:00',
  modo_entrega: 'tienda',
  modo_devolucion: 'tienda',
  contacto: { nombre: 'Ana' },
  origen: 'manual'
};

describe('avisos de tipo incorrecto en los esquemas', () => {
  test('el alquiler válido de partida se acepta', () => {
    assert.equal(schemaAlquilerFueraDeLaWeb.safeParse(ALQUILER_VALIDO).success, true);
  });

  test('una hora que no es texto avisa con el mensaje de esa hora', () => {
    const resultado = schemaAlquilerFueraDeLaWeb.safeParse({
      ...ALQUILER_VALIDO,
      hora_entrega: 10
    });
    assert.equal(resultado.success, false);
    assert.ok(mensajes(resultado).includes('Elige la hora de entrega (HH:MM).'));
  });

  test('un dato de contacto que no es texto avisa de que se revisen los datos del cliente', () => {
    const resultado = schemaAlquilerFueraDeLaWeb.safeParse({
      ...ALQUILER_VALIDO,
      contacto: { nombre: 'Ana', telefono: 123456789 }
    });
    assert.equal(resultado.success, false);
    assert.ok(mensajes(resultado).includes('Revisa los datos del cliente.'));
  });

  test('un filtro de fecha que no es texto avisa con el mensaje de esa fecha', () => {
    const resultado = schemaListaReservas.safeParse({ desde: 20261110 });
    assert.equal(resultado.success, false);
    assert.ok(
      mensajes(resultado).includes(
        'Elige una fecha de inicio válida para la búsqueda (AAAA-MM-DD).'
      )
    );
  });

  test('una pieza de filtro que no es texto avisa de que no es válida', () => {
    const resultado = schemaListaReservas.safeParse({ mueble_id: 123 });
    assert.equal(resultado.success, false);
    assert.ok(mensajes(resultado).includes('La pieza del filtro no es válida.'));
  });

  test('pedir la cancelación con algo que no es un objeto avisa de que se revise la solicitud', () => {
    const resultado = schemaSolicitarCancelacion.safeParse('quiero cancelar');
    assert.equal(resultado.success, false);
    assert.ok(mensajes(resultado).includes('Revisa tu solicitud.'));
  });
});
