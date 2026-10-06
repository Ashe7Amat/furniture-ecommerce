// Accesibilidad automática con axe-core (tarea 4 de la sesión del 5 oct 2026, ver
// docs/auditoria-accesibilidad.md). Pasa axe por las páginas principales, con la API simulada, y
// falla si encuentra algún problema grave o crítico (los que impiden usar la página con teclado o
// con un lector de pantalla). Los moderados y leves quedan apuntados en la auditoría.
//
// axe no lo ve todo: el orden del foco, si un aviso se entiende o si el contraste de un texto sobre
// una foto es suficiente se comprueban a mano (ver la auditoría).
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { simularApi, cerrarCookies, MUEBLES, CLIENTE, CONTRASENA } from './apiSimulada';

// Gravedades de axe que bloquean el uso: estas hacen fallar el test.
const GRAVES = ['serious', 'critical'];

const analizar = async (page) => {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return violations
    .filter((v) => GRAVES.includes(v.impact))
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
};

const PAGINAS = [
  ['portada', '/'],
  ['catálogo', '/catalogo'],
  ['ficha de una pieza', `/mueble/${MUEBLES[0].id}`],
  ['inicio de sesión', '/login'],
  ['contacto', '/contacto'],
  ['404', '/no-existe']
];

for (const [nombre, ruta] of PAGINAS) {
  test(`${nombre}: sin problemas de accesibilidad graves`, async ({ page }) => {
    await simularApi(page);
    await page.goto(ruta);
    await cerrarCookies(page);
    await page.waitForLoadState('networkidle');

    expect(await analizar(page)).toEqual([]);
  });
}

// H43: el orden de los títulos y el h1 son avisos moderados de axe (no entran en GRAVES), pero ya
// están arreglados en todas estas páginas: se exigen aparte para que no vuelvan.
const TITULOS = ['heading-order', 'page-has-heading-one'];
const analizarTitulos = async (page) => {
  const { violations } = await new AxeBuilder({ page }).withRules(TITULOS).analyze();
  return violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
};

for (const [nombre, ruta] of PAGINAS) {
  test(`${nombre}: un solo h1 y los títulos en orden (H43)`, async ({ page }) => {
    await simularApi(page);
    await page.goto(ruta);
    await cerrarCookies(page);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1')).toHaveCount(1);
    expect(await analizarTitulos(page)).toEqual([]);
  });
}

test('el buscador y el menú lateral abiertos: sin problemas graves', async ({ page }) => {
  await simularApi(page);
  await page.goto('/');
  await cerrarCookies(page);

  await page.getByRole('button', { name: '¿Qué estás buscando?' }).click();
  await page.getByRole('textbox', { name: 'Buscar en el catálogo' }).fill('mesa');
  expect(await analizar(page)).toEqual([]);
  expect(await analizarTitulos(page)).toEqual([]);
  await page.keyboard.press('Escape');

  await page.setViewportSize({ width: 375, height: 740 });
  await page.getByRole('button', { name: 'Abrir el menú' }).click();
  expect(await analizar(page)).toEqual([]);
  expect(await analizarTitulos(page)).toEqual([]);
});

// H47: Mi cuenta hace falta con sesión, así que no estaba en PAGINAS y nadie la pasaba por axe. Se entra
// de verdad por el formulario de login (con la API simulada: no hace falta ninguna credencial real, y
// funciona igual en local que en el CI), y no sembrando la sesión en localStorage: sin el access token en
// memoria, "Mis pedidos" recibía un 401 y la web echaba al usuario a /login, con lo que el test miraba la
// página de login sin saberlo. Aquí cuenta todo lo que axe encuentre sobre etiquetas, contraste y
// regiones, aunque sea moderado, en las tres pestañas, en claro y en oscuro.
// El aviso de cookies se evita sembrando la elección (no se pulsa: cerrarCookies solo actúa si el aviso ya
// se ha pintado, y era una carrera): su contraste se prueba aparte (H48).
const REGLAS_CUENTA = ['label', 'color-contrast', 'landmark-no-duplicate-main', 'landmark-main-is-top-level', 'landmark-unique'];

const entrarEnMiCuenta = async (page, pestana = 'datos') => {
  await simularApi(page);
  await page.addInitScript(
    ({ cliente, claveCookies }) => {
      localStorage.setItem(`kaveFavorites_${cliente.email}`, JSON.stringify(['m1']));
      localStorage.setItem(claveCookies, JSON.stringify({ analytics: false, date: new Date().toISOString() }));
    },
    { cliente: CLIENTE, claveCookies: 'nave5-cookie-consent' }
  );
  // Sin sesión, ProtectedRoute manda al login con la ruta pedida, y al entrar se vuelve a ella (H45).
  await page.goto(`/cuenta?tab=${pestana}`);
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(CLIENTE.email);
  await page.getByPlaceholder('Contraseña', { exact: true }).fill(CONTRASENA);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page).toHaveURL(`/cuenta?tab=${pestana}`);
  await page.waitForLoadState('networkidle');
  // La URL final y el título, otra vez después de que se asiente: así no se mira otra página sin saberlo.
  await expect(page).toHaveURL(`/cuenta?tab=${pestana}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Mi Cuenta' })).toBeVisible();
};

for (const tema of ['light', 'dark']) {
  for (const pestana of ['datos', 'favoritos', 'pedidos']) {
    test(`Mi cuenta (${pestana}, ${tema}): campos con etiqueta, contraste y un solo <main> (H47)`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: tema });
      await entrarEnMiCuenta(page, pestana);

      await expect(page.locator('.cookie-banner')).toHaveCount(0);
      await expect(page.locator('main')).toHaveCount(1);
      const { violations } = await new AxeBuilder({ page }).withRules(REGLAS_CUENTA).analyze();
      expect(violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
      expect(await analizarTitulos(page)).toEqual([]);
    });
  }
}

test('Mi cuenta: cada campo del formulario se localiza por su etiqueta (H47)', async ({ page }) => {
  await entrarEnMiCuenta(page);

  await expect(page.getByLabel('Nombre completo')).toHaveValue(CLIENTE.nombre);
  await expect(page.getByLabel('Correo electrónico')).toHaveValue(CLIENTE.email);
  await expect(page.getByLabel(/^Contraseña actual/)).toBeVisible();
  await expect(page.getByLabel(/^Nueva contraseña/)).toBeVisible();
  await expect(page.getByLabel('Confirmar nueva contraseña')).toBeVisible();
});
