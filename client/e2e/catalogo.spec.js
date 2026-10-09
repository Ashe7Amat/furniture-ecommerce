// El catálogo: se llega desde la portada, se filtra por categoría y por disponibilidad, se ordena
// por referencia, y una pieza abre su ficha.
import { test, expect } from '@playwright/test';
import { simularApi, vigilarConsola, cerrarCookies, MUEBLES } from './apiSimulada';

const tarjetas = (page) => page.locator('.products-grid .product-card');
const titulos = (page) => page.locator('.products-grid .product-title');
const selectorOrden = (page) => page.getByLabel('Ordenar por', { exact: true });

// Las piezas de la API simulada (MUEBLES), por referencia: NAV-ILU-001, NAV-MES-001, NAV-MES-002,
// NAV-SIL-001 y NAV-SIL-002.
const POR_REFERENCIA = [
  'Lámpara Industrial Plateada',
  'Mesa de Roble Restaurada',
  'Mesa Auxiliar de Hierro',
  'Silla Tolix Verde',
  'Silla Thonet Curvada'
];

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
  // CAMBIADO A PROPÓSITO (9 oct 2026, orden por referencia): el selector "Ordenar por" sale siempre
  // (antes "Ordenar por precio", que sin precios no salía). Sin precios publicados (MOSTRAR_PRECIOS)
  // no ofrece las opciones de precio.
  await expect(selectorOrden(page)).toBeVisible();
  await expect(selectorOrden(page)).toHaveValue('recomendados');
  await expect(selectorOrden(page).locator('option')).toHaveText(['Recomendados', 'Referencia (A-Z)', 'Referencia (Z-A)']);
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

test('"Ordenar por" referencia ordena las piezas, lo guarda en la URL y se mantiene al recargar', async ({ page }) => {
  await page.goto('/catalogo');
  await cerrarCookies(page);

  await selectorOrden(page).selectOption('referencia_asc');
  await expect(page).toHaveURL(/orden=referencia_asc/);
  await expect(titulos(page)).toHaveText(POR_REFERENCIA);

  await page.reload();
  await expect(selectorOrden(page)).toHaveValue('referencia_asc');
  await expect(titulos(page)).toHaveText(POR_REFERENCIA);

  await selectorOrden(page).selectOption('referencia_desc');
  await expect(page).toHaveURL(/orden=referencia_desc/);
  await expect(titulos(page)).toHaveText([...POR_REFERENCIA].reverse());

  // "Recomendados" es el orden por defecto: no se escribe en la URL.
  await selectorOrden(page).selectOption('recomendados');
  await expect(page).not.toHaveURL(/orden=/);
  await expect(titulos(page)).toHaveText(MUEBLES.map((m) => m.nombre));
});

test('un enlace con ?orden= y categoría abre el catálogo filtrado y ya ordenado', async ({ page }) => {
  await page.goto('/catalogo?categoria=Sillas%20y%20asientos&orden=referencia_desc');
  await cerrarCookies(page);

  await expect(selectorOrden(page)).toHaveValue('referencia_desc');
  await expect(titulos(page)).toHaveText(['Silla Thonet Curvada', 'Silla Tolix Verde']);
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
