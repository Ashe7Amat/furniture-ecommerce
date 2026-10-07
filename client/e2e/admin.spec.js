// El panel de administración: el administrador inicia sesión (API simulada), entra al panel desde
// el menú de su cuenta y recorre las pestañas.
import { test, expect } from '@playwright/test';
import { simularApi, vigilarConsola, cerrarCookies, ADMIN, CLIENTE, CONTRASENA, MUEBLES } from './apiSimulada';

const iniciarSesion = async (page, usuario) => {
  await page.goto('/login');
  await cerrarCookies(page);
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(usuario.email);
  await page.getByPlaceholder('Contraseña', { exact: true }).fill(CONTRASENA);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page).toHaveURL('/');
};

test('el administrador entra al panel y recorre todas las pestañas', async ({ page }) => {
  const errores = vigilarConsola(page);
  const { sinSimular } = await simularApi(page);
  await iniciarSesion(page, ADMIN);

  // Sin recargar: el access token vive en memoria.
  await page.getByRole('button', { name: 'Cuenta' }).click();
  await page.getByRole('link', { name: /Panel/ }).first().click();
  await expect(page).toHaveURL('/admin');

  const barra = page.getByRole('navigation').filter({ has: page.getByRole('button', { name: 'Resumen' }) });
  const pestanas = [
    ['Añadir Mueble', 'Añadir Nuevo Producto'],
    ['Gestionar Inventario', 'Gestionar Inventario'],
    [/^Pedidos/, 'Pedidos'],
    [/^Mensajes/, 'Mensajes'],
    ['Gestionar Categorías', 'Gestionar Categorías'],
    ['Resumen', 'Dashboard']
  ];
  for (const [boton, titulo] of pestanas) {
    await barra.getByRole('button', { name: boton }).click();
    await expect(page.getByRole('heading', { level: 2, name: titulo })).toBeVisible();
  }

  // El inventario lista lo que devuelve la API del panel, con su referencia.
  await barra.getByRole('button', { name: 'Gestionar Inventario' }).click();
  await expect(page.locator('.inventory-list-item')).toHaveCount(MUEBLES.length);
  await expect(page.getByText('NAV-SIL-001')).toBeVisible();

  // La insignia de "Mensajes" cuenta el mensaje sin leer de la API simulada.
  await expect(barra.getByRole('button', { name: /^Mensajes/ })).toHaveText(/Mensajes\s*1/);

  expect(sinSimular).toEqual([]);
  expect(errores).toEqual([]);
});

test('un cliente que no es administrador no entra al panel', async ({ page }) => {
  await simularApi(page);
  await iniciarSesion(page, CLIENTE);

  await page.getByRole('button', { name: 'Cuenta' }).click();
  await expect(page.getByRole('link', { name: /Panel/ })).toHaveCount(0);
});

// H57: la galería de fotos del editor de muebles, en el navegador de verdad: arrastrar con el ratón y con el
// teclado, "Usar como principal", guardar y recargar la página. La API simulada guarda aquí el orden que recibe
// (como el servidor, que guarda imagenes_existentes tal cual llegan) y renueva la sesión al recargar.
const FOTOS_INICIALES = ['/img/galeria-rincon.webp', '/img/galeria-butacas.webp', '/img/hero-almacen-800.webp'];

const prepararEditorDeFotos = async (page) => {
  const estado = { fotos: [...FOTOS_INICIALES], guardadas: [] };
  await simularApi(page);
  const API = 'http://localhost:5000/api';
  const responder = (route, cuerpo) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cuerpo) });
  await page.route(`${API}/admin/muebles`, (route) =>
    responder(route, MUEBLES.map((m) => (m.id === 'm1' ? { ...m, imagenes: estado.fotos } : m)))
  );
  await page.route(`${API}/muebles/m1`, (route) => {
    if (route.request().method() !== 'PUT') return route.fallback();
    const campo = route.request().postData().match(/name="imagenes_existentes"\r\n\r\n([^\r]*)\r\n/);
    estado.fotos = JSON.parse(campo[1]);
    estado.guardadas.push(estado.fotos);
    return responder(route, { success: true });
  });
  await page.route(`${API}/auth/refresh`, (route) =>
    responder(route, { accessToken: `access-${ADMIN.id}`, refreshToken: `refresh-${ADMIN.id}` })
  );
  await iniciarSesion(page, ADMIN);
  return estado;
};

const abrirEditorDeLaSilla = async (page) => {
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Gestionar Inventario' }).click();
  await page.locator('.inventory-list-item', { hasText: 'Silla Tolix Verde' }).getByRole('button', { name: 'Editar' }).click();
  const galeria = page.getByRole('list', { name: 'Fotos del mueble, en orden' });
  await expect(galeria).toBeVisible();
  return galeria;
};
const ordenVisto = (galeria) => galeria.locator('.image-thumb img').evaluateAll((imgs) => imgs.map((i) => new URL(i.src).pathname));

// Se coge la foto por su asa y se lleva hasta que el centro de su tarjeta caiga en el centro de la tarjeta de
// destino (dnd-kit compara los centros de las tarjetas, no la posición del puntero).
const arrastrar = async (page, asa, tarjetaOrigen, tarjetaDestino) => {
  // El ratón solo actúa dentro de la ventana: la galería está al final del modal y hay que bajar hasta ella.
  await tarjetaDestino.scrollIntoViewIfNeeded();
  await tarjetaOrigen.scrollIntoViewIfNeeded();
  const a = await asa.boundingBox();
  const o = await tarjetaOrigen.boundingBox();
  const d = await tarjetaDestino.boundingBox();
  const inicio = { x: a.x + a.width / 2, y: a.y + a.height / 2 };
  const fin = { x: inicio.x + (d.x + d.width / 2) - (o.x + o.width / 2), y: inicio.y + (d.y + d.height / 2) - (o.y + o.height / 2) };
  await page.mouse.move(inicio.x, inicio.y);
  await page.mouse.down();
  await page.mouse.move(fin.x, fin.y, { steps: 15 });
  await page.waitForTimeout(150);
  await page.mouse.up();
};

test('H57: arrastrar, "Usar como principal", guardar y recargar: el orden de las fotos se mantiene', async ({ page }) => {
  const errores = vigilarConsola(page);
  const estado = await prepararEditorDeFotos(page);
  let galeria = await abrirEditorDeLaSilla(page);

  expect(await ordenVisto(galeria)).toEqual(FOTOS_INICIALES);
  // Fotos grandes: 150 x 150 como mínimo.
  const caja = await galeria.locator('.image-thumb').first().boundingBox();
  expect(caja.width).toBeGreaterThanOrEqual(150);
  expect(caja.height).toBeGreaterThanOrEqual(150);

  // Con el ratón: la tercera, al primer sitio.
  const tarjetas = galeria.getByRole('listitem');
  await arrastrar(page, galeria.getByRole('button', { name: 'Mover la foto 3' }), tarjetas.nth(2), tarjetas.first());
  await expect.poll(() => ordenVisto(galeria)).toEqual([FOTOS_INICIALES[2], FOTOS_INICIALES[0], FOTOS_INICIALES[1]]);

  // "Usar como principal" en la que ahora es la tercera (butacas). Antes, que termine el arrastre: dnd-kit anula
  // el clic que llega justo al soltar, para que soltar encima de un botón no lo pulse.
  await expect(galeria.locator('.arrastrando')).toHaveCount(0);
  await page.waitForTimeout(200);
  await galeria.getByRole('listitem').nth(2).getByRole('button', { name: 'Usar como principal' }).click();
  const esperado = [FOTOS_INICIALES[1], FOTOS_INICIALES[2], FOTOS_INICIALES[0]];
  await expect.poll(() => ordenVisto(galeria)).toEqual(esperado);
  await expect(galeria.getByRole('listitem').first()).toContainText('1 · Principal');

  await page.getByRole('button', { name: 'Guardar Cambios' }).click();
  await expect(galeria).toBeHidden();
  expect(estado.guardadas).toEqual([esperado]);

  // Recargar la página: la sesión se renueva y el editor abre con el orden guardado.
  await page.reload();
  galeria = await abrirEditorDeLaSilla(page);
  expect(await ordenVisto(galeria)).toEqual(esperado);
  expect(errores).toEqual([]);
});

test('H57: con el teclado, espacio coge la foto, la flecha la mueve y espacio la suelta', async ({ page }) => {
  await prepararEditorDeFotos(page);
  const galeria = await abrirEditorDeLaSilla(page);

  // Con pausas, como una persona: dnd-kit empieza a escuchar las flechas un instante después de coger la foto, y
  // tres teclas en el mismo milisegundo se pierden.
  await galeria.getByRole('button', { name: 'Mover la foto 1' }).focus();
  for (const tecla of ['Space', 'ArrowRight', 'Space']) {
    await page.keyboard.press(tecla);
    await page.waitForTimeout(150);
  }

  await expect.poll(() => ordenVisto(galeria)).toEqual([FOTOS_INICIALES[1], FOTOS_INICIALES[0], FOTOS_INICIALES[2]]);
});

// Exportar clientes (CSV), en el Resumen: la descarga de verdad en el navegador, con el BOM delante y sin la
// contraseña. El nombre puede venir del servidor o, si el navegador no deja leer esa cabecera, armarse en el
// cliente con el mismo formato.
test('el Resumen descarga el CSV de clientes', async ({ page }) => {
  const errores = vigilarConsola(page);
  await simularApi(page);
  const CSV = '\uFEFFid;email;nombre;rol;creado_en\r\nu-ana;ana@correo.test;Ana;cliente;2026-09-01T10:00:00Z\r\n';
  const pedidas = [];
  await page.route('http://localhost:5000/api/admin/clientes/export', (route) => {
    pedidas.push(route.request().headers().authorization);
    return route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="clientes-nave5-2026-10-07.csv"'
      },
      body: CSV
    });
  });
  await iniciarSesion(page, ADMIN);
  await page.getByRole('button', { name: 'Cuenta' }).click();
  await page.getByRole('link', { name: /Panel/ }).first().click();

  const seccion = page.getByRole('region', { name: 'Clientes' });
  await seccion.scrollIntoViewIfNeeded();
  const [descarga] = await Promise.all([
    page.waitForEvent('download'),
    seccion.getByRole('button', { name: 'Exportar clientes (CSV)' }).click()
  ]);

  expect(pedidas).toEqual([`Bearer access-${ADMIN.id}`]);
  expect(descarga.suggestedFilename()).toMatch(/^clientes-nave5-\d{4}-\d{2}-\d{2}\.csv$/);
  const { readFile } = await import('node:fs/promises');
  const contenido = await readFile(await descarga.path(), 'utf8');
  expect(contenido).toBe(CSV);
  await expect(page.getByText('Clientes exportados')).toBeVisible();
  expect(errores).toEqual([]);
});
