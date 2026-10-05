// Accesibilidad automática con axe-core (tarea 4 de la sesión del 5 oct 2026, ver
// docs/auditoria-accesibilidad.md). Pasa axe por las páginas principales, con la API simulada, y
// falla si encuentra algún problema grave o crítico (los que impiden usar la página con teclado o
// con un lector de pantalla). Los moderados y leves quedan apuntados en la auditoría.
//
// axe no lo ve todo: el orden del foco, si un aviso se entiende o si el contraste de un texto sobre
// una foto es suficiente se comprueban a mano (ver la auditoría).
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { simularApi, cerrarCookies, MUEBLES } from './apiSimulada';

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

test('el buscador y el menú lateral abiertos: sin problemas graves', async ({ page }) => {
  await simularApi(page);
  await page.goto('/');
  await cerrarCookies(page);

  await page.getByRole('button', { name: '¿Qué estás buscando?' }).click();
  await page.getByRole('textbox', { name: 'Buscar en el catálogo' }).fill('mesa');
  expect(await analizar(page)).toEqual([]);
  await page.keyboard.press('Escape');

  await page.setViewportSize({ width: 375, height: 740 });
  await page.getByRole('button', { name: 'Abrir el menú' }).click();
  expect(await analizar(page)).toEqual([]);
});
