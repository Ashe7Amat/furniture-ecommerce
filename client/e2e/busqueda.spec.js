// Buscar desde la cabecera (H39). En el móvil la barra de búsqueda no cabe y está oculta: se busca
// con la lupa. Esto depende de las media queries del CSS, que jsdom no aplica, así que va aquí.
import { test, expect } from '@playwright/test';
import { simularApi, vigilarConsola, cerrarCookies, MUEBLES } from './apiSimulada';

test.describe('en el móvil (375 px)', () => {
  test.use({ viewport: { width: 375, height: 740 } });

  test('la lupa abre el buscador, encuentra piezas y Escape lo cierra', async ({ page }) => {
    const errores = vigilarConsola(page);
    const { sinSimular } = await simularApi(page);
    await page.goto('/');
    await cerrarCookies(page);

    await expect(page.getByRole('button', { name: '¿Qué estás buscando?' })).toBeHidden();
    const lupa = page.getByRole('button', { name: 'Buscar', exact: true });
    await expect(lupa).toBeVisible();

    await lupa.click();
    const campo = page.getByRole('textbox', { name: 'Buscar en el catálogo' });
    await expect(campo).toBeFocused();
    await campo.fill('mesa');
    const resultados = page.locator('.search-live-results');
    await expect(resultados.getByText(MUEBLES[2].nombre)).toBeVisible();
    await expect(resultados.getByText(MUEBLES[0].nombre)).toHaveCount(0);

    await page.keyboard.press('Escape');
    await expect(campo).toBeHidden();
    await expect(lupa).toBeFocused();

    // Sin scroll horizontal con la lupa de más en la cabecera.
    const anchoPagina = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(anchoPagina).toBeLessThanOrEqual(375);
    expect(sinSimular).toEqual([]);
    expect(errores).toEqual([]);
  });
});

test.describe('en escritorio', () => {
  test('la barra se abre con el teclado y la lupa del móvil no se ve', async ({ page }) => {
    await simularApi(page);
    await page.goto('/');
    await cerrarCookies(page);

    await expect(page.getByRole('button', { name: 'Buscar', exact: true })).toBeHidden();
    const barra = page.getByRole('button', { name: '¿Qué estás buscando?' });
    await barra.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('textbox', { name: 'Buscar en el catálogo' })).toBeFocused();
  });
});
