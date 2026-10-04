// La portada: carga, enseña las piezas destacadas (las 4 más recientes) y no deja errores en la
// consola.
import { test, expect } from '@playwright/test';
import { simularApi, vigilarConsola, cerrarCookies, MUEBLES } from './apiSimulada';

test('la portada carga con sus piezas destacadas y sin errores de consola', async ({ page }) => {
  const errores = vigilarConsola(page);
  const { llamadas, sinSimular } = await simularApi(page);

  await page.goto('/');
  await cerrarCookies(page);

  await expect(page.getByRole('heading', { level: 1, name: 'Nave 5 Barcelona' })).toBeVisible();
  const destacadas = page.locator('section', { has: page.getByRole('heading', { name: 'Piezas destacadas' }) });
  await expect(destacadas.getByRole('heading', { level: 2, name: 'Piezas destacadas' })).toBeVisible();
  for (const mueble of MUEBLES.slice(0, 4)) {
    await expect(destacadas.getByRole('heading', { level: 3, name: mueble.nombre })).toBeVisible();
  }
  await expect(destacadas.getByRole('heading', { level: 3, name: MUEBLES[4].nombre })).toHaveCount(0);

  // Solo pide las 4 más recientes, no el catálogo entero.
  expect(llamadas).toContain('GET /muebles?limit=4');
  expect(sinSimular).toEqual([]);
  expect(errores).toEqual([]);
});
