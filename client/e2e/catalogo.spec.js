// El catálogo: se llega desde la portada, se filtra por categoría y por disponibilidad, y una
// pieza abre su ficha.
import { test, expect } from '@playwright/test';
import { simularApi, vigilarConsola, cerrarCookies, MUEBLES } from './apiSimulada';

const tarjetas = (page) => page.locator('.products-grid .product-card');

test.beforeEach(async ({ page }) => {
  await simularApi(page);
});

// CAMBIADO A PROPÓSITO (5 oct 2026, H43): el nombre de cada pieza del catálogo es un h2 (antes h3,
// que saltaba un nivel después del h1).
test('se llega al catálogo desde el menú y enseña todas las piezas', async ({ page }) => {
  const errores = vigilarConsola(page);
  await page.goto('/catalogo');
  await cerrarCookies(page);

  await expect(tarjetas(page)).toHaveCount(MUEBLES.length);
  for (const mueble of MUEBLES) {
    await expect(page.getByRole('heading', { level: 2, name: mueble.nombre })).toBeVisible();
  }
  // Sin precios publicados (MOSTRAR_PRECIOS): no hay orden por precio.
  await expect(page.getByLabel('Ordenar por precio')).toHaveCount(0);
  expect(errores).toEqual([]);
});

test('el filtro de categoría deja solo las piezas de esa categoría', async ({ page }) => {
  await page.goto('/catalogo');
  await cerrarCookies(page);

  await page.getByLabel('Categoría').selectOption('Sillas y asientos');

  await expect(tarjetas(page)).toHaveCount(2);
  await expect(page.getByRole('heading', { level: 2, name: 'Silla Tolix Verde' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Mesa de Roble Restaurada' })).toHaveCount(0);
  await expect(page).toHaveURL(/categoria=Sillas/);
});

test('"Disponible" quita las piezas vendidas', async ({ page }) => {
  await page.goto('/catalogo');
  await cerrarCookies(page);

  await page.getByText('Disponible', { exact: true }).click();

  await expect(tarjetas(page)).toHaveCount(MUEBLES.length - 1);
  await expect(page.getByRole('heading', { level: 2, name: 'Silla Thonet Curvada' })).toHaveCount(0);
});

test('pulsar una pieza abre su ficha, con su referencia y sin precio', async ({ page }) => {
  await page.goto('/catalogo');
  await cerrarCookies(page);

  await tarjetas(page).filter({ hasText: 'Mesa de Roble Restaurada' }).click();

  await expect(page).toHaveURL(/\/mueble\/m3$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Mesa de Roble Restaurada' })).toBeVisible();
  await expect(page.getByText('NAV-MES-001')).toBeVisible();
  await expect(page.getByText('Consultar precio').first()).toBeVisible();
});
