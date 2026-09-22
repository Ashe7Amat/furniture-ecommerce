// Tests unitarios de utils/metadataStripe.js: cómo se escribe y se lee la metadata de las
// sesiones de Stripe Checkout, que limita cada valor a 500 caracteres y a 50 claves.
// Antes, un carrito de 7 o más piezas, o una nota de entrega larga, hacía fallar la creación de
// la sesión y el comprador no podía pagar.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  MAX_CLAVES, MAX_VALOR, MAX_NOMBRE_CLAVE,
  ErrorMetadata, construirMetadataPago, juntarItems, leerItemsDeMetadata
} = require('../utils/metadataStripe');

// UUID reales tienen 36 caracteres: es el peor caso de tamaño por pieza.
const uuid = (n) => `${String(n).padStart(8, '0')}-aaaa-4bbb-8ccc-${String(n).padStart(12, '0')}`;
const carrito = (piezas, modalidad = 'compra') =>
  Array.from({ length: piezas }, (_, i) => ({ productId: uuid(i), modalidad, precio: 999 }));

const comprador = (cambios = {}) => ({
  nombre: 'Ana Martínez', email: 'ana@ejemplo.com', telefono: '600123456',
  direccion: 'Calle Mayor 15, 2º B, 08001 Barcelona (Barcelona)', notas: 'Llamar al timbre.', ...cambios
});

const respetaLosLimitesDeStripe = (metadata) => {
  assert.ok(Object.keys(metadata).length <= MAX_CLAVES, `más de ${MAX_CLAVES} claves`);
  for (const [clave, valor] of Object.entries(metadata)) {
    assert.ok(clave.length <= MAX_NOMBRE_CLAVE, `clave demasiado larga: ${clave}`);
    assert.ok(valor.length <= MAX_VALOR, `valor de "${clave}" con ${valor.length} caracteres`);
  }
};

describe('construirMetadataPago — el carrito', () => {
  test('un carrito pequeño cabe en una sola clave y se lee igual que se escribió', () => {
    const items = carrito(2);
    const metadata = construirMetadataPago({ items, clienteInfo: comprador() });

    assert.ok(metadata.items_0 !== undefined);
    assert.equal(metadata.items_1, undefined);
    assert.deepEqual(leerItemsDeMetadata(metadata),
      items.map(({ productId, modalidad }) => ({ productId, modalidad })));
  });

  test('7 piezas (el caso que antes impedía pagar) se reparten en varias claves y no superan 500', () => {
    const items = carrito(7, 'alquiler');
    assert.ok(JSON.stringify(items.map(({ productId, modalidad }) => ({ productId, modalidad }))).length > MAX_VALOR,
      'el caso de prueba debe superar el límite de un solo valor');

    const metadata = construirMetadataPago({ items, clienteInfo: comprador() });

    respetaLosLimitesDeStripe(metadata);
    assert.ok(metadata.items_1 !== undefined, 'debe haberse repartido en más de una clave');
    assert.equal(leerItemsDeMetadata(metadata).length, 7);
  });

  test('un carrito grande junto con notas de 500 caracteres cabe y se lee completo', () => {
    const items = carrito(100);
    const metadata = construirMetadataPago({ items, clienteInfo: comprador({ notas: 'n'.repeat(500) }) });

    respetaLosLimitesDeStripe(metadata);
    assert.equal(metadata.clienteNotas.length, 500);
    assert.deepEqual(leerItemsDeMetadata(metadata).map(i => i.productId), items.map(i => i.productId));
  });

  test('en cualquier tamaño de carrito, escribir y leer devuelve exactamente lo mismo', () => {
    for (let piezas = 1; piezas <= 120; piezas++) {
      const items = carrito(piezas, piezas % 2 ? 'compra' : 'alquiler');
      const metadata = construirMetadataPago({ items, clienteInfo: comprador() });
      respetaLosLimitesDeStripe(metadata);
      assert.deepEqual(
        leerItemsDeMetadata(metadata),
        items.map(({ productId, modalidad }) => ({ productId, modalidad })),
        `falla con ${piezas} piezas`
      );
    }
  });

  test('un carrito imposible de repartir en 50 claves se rechaza con un mensaje claro para el comprador', () => {
    assert.throws(
      () => construirMetadataPago({ items: carrito(400), clienteInfo: comprador() }),
      (error) => error instanceof ErrorMetadata && /demasiado grande/.test(error.message) && /Divide el pedido/.test(error.message)
    );
  });

  test('la metadata solo lleva productId y modalidad de cada pieza, no el precio que mande el navegador', () => {
    const metadata = construirMetadataPago({ items: carrito(1), clienteInfo: comprador() });

    assert.ok(!juntarItems(metadata).includes('precio'));
    assert.ok(!juntarItems(metadata).includes('999'));
  });
});

describe('construirMetadataPago — los datos del comprador', () => {
  test('guarda cada dato en su clave', () => {
    const metadata = construirMetadataPago({ items: carrito(1), clienteInfo: comprador() });

    assert.equal(metadata.clienteNombre, 'Ana Martínez');
    assert.equal(metadata.clienteEmail, 'ana@ejemplo.com');
    assert.equal(metadata.clienteTelefono, '600123456');
    assert.equal(metadata.clienteDireccion, 'Calle Mayor 15, 2º B, 08001 Barcelona (Barcelona)');
    assert.equal(metadata.clienteNotas, 'Llamar al timbre.');
  });

  test('sin datos del comprador guarda cadenas vacías, como antes', () => {
    const metadata = construirMetadataPago({ items: carrito(1), clienteInfo: undefined });

    assert.equal(metadata.clienteNombre, '');
    assert.equal(metadata.clienteNotas, '');
  });

  test('unas notas de exactamente 500 caracteres se aceptan; con 501 se rechazan en castellano', () => {
    assert.doesNotThrow(() => construirMetadataPago({ items: carrito(1), clienteInfo: comprador({ notas: 'n'.repeat(500) }) }));

    assert.throws(
      () => construirMetadataPago({ items: carrito(1), clienteInfo: comprador({ notas: 'n'.repeat(501) }) }),
      (error) => error instanceof ErrorMetadata
        && error.message === 'Las notas de entrega son demasiado largas (máximo 500 caracteres).'
    );
  });

  test('cada dato tiene su límite y su mensaje', () => {
    const casos = [
      [{ nombre: 'x'.repeat(101) }, /^El nombre es demasiado largo \(máximo 100 caracteres\)\.$/],
      [{ email: 'x'.repeat(255) }, /^El correo electrónico es demasiado largo \(máximo 254 caracteres\)\.$/],
      [{ telefono: '6'.repeat(31) }, /^El teléfono es demasiado largo \(máximo 30 caracteres\)\.$/],
      [{ direccion: 'x'.repeat(501) }, /^La dirección es demasiado larga \(máximo 500 caracteres\)\.$/]
    ];
    for (const [cambios, mensaje] of casos) {
      assert.throws(
        () => construirMetadataPago({ items: carrito(1), clienteInfo: comprador(cambios) }),
        (error) => error instanceof ErrorMetadata && mensaje.test(error.message)
      );
    }
  });

  test('un dato que no es un texto se convierte en texto en vez de romper', () => {
    const metadata = construirMetadataPago({ items: carrito(1), clienteInfo: comprador({ telefono: 600123456 }) });
    assert.equal(metadata.clienteTelefono, '600123456');
  });
});

describe('leerItemsDeMetadata — formatos y datos corruptos', () => {
  const unaPieza = [{ productId: 'mueble-1', modalidad: 'compra' }];

  test('sigue leyendo el formato antiguo (un solo valor "items") de las sesiones ya abiertas', () => {
    assert.deepEqual(leerItemsDeMetadata({ items: JSON.stringify(unaPieza) }), unaPieza);
  });

  test('sin metadata, o sin piezas, devuelve null', () => {
    assert.equal(leerItemsDeMetadata(undefined), null);
    assert.equal(leerItemsDeMetadata({}), null);
    assert.equal(leerItemsDeMetadata({ clienteNombre: 'Ana' }), null);
  });

  test('un trozo que falta deja el JSON incompleto y se descarta en vez de procesar medio carrito', () => {
    const metadata = construirMetadataPago({ items: carrito(20), clienteInfo: comprador() });
    delete metadata.items_1;

    assert.equal(leerItemsDeMetadata(metadata), null);
  });

  test('lee los trozos en orden numérico, no en el orden en que Stripe devuelva las claves', () => {
    const items = carrito(20);
    const metadata = construirMetadataPago({ items, clienteInfo: comprador() });
    const desordenada = Object.fromEntries(Object.entries(metadata).reverse());

    assert.deepEqual(leerItemsDeMetadata(desordenada).map(i => i.productId), items.map(i => i.productId));
  });

  test('descarta una metadata con elementos que no son piezas', () => {
    for (const items of ['[null]', '[{}]', '[{"productId":5}]', '["x"]', '{"productId":"x"}', '[]', '{no es json']) {
      assert.equal(leerItemsDeMetadata({ items }), null, `debe descartar ${items}`);
    }
  });
});
