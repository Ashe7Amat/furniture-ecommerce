// Contrato entre servidor y cliente: el tope de piezas del carrito (H35) vive en dos constantes que
// tienen que coincidir. MAX_PIEZAS_CARRITO, en schemas/muebles.js, rechaza los pedidos de más piezas.
// MAX_PIEZAS_CESTA, en client/src/context/CartContext.jsx, no deja añadir la pieza siguiente. Si
// solo se cambia una, el cliente dejaría llenar una cesta que el servidor rechaza al pagar (o al
// revés). La CI hace un checkout completo del repositorio, así que el archivo del cliente está.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { MAX_PIEZAS_CARRITO } = require('../schemas/muebles');

const RUTA_CLIENTE = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'client',
  'src',
  'context',
  'CartContext.jsx'
);

test('el tope de piezas del carrito es el mismo en el servidor y en el cliente', () => {
  const codigo = fs.readFileSync(RUTA_CLIENTE, 'utf8');
  const encontrado = codigo.match(/export const MAX_PIEZAS_CESTA = (\d+);/);
  assert.ok(
    encontrado,
    'No se encuentra "export const MAX_PIEZAS_CESTA = <número>;" en CartContext.jsx: si ha cambiado de ' +
      'forma (p. ej. a una variable de entorno), hay que actualizar este test.'
  );

  assert.equal(
    Number(encontrado[1]),
    MAX_PIEZAS_CARRITO,
    `El cliente deja ${encontrado[1]} piezas y el servidor ${MAX_PIEZAS_CARRITO}: cambia los dos a la vez.`
  );
});
