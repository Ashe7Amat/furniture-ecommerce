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

// H49: las cuatro fotos del hero estaban apiladas dentro de la pantalla y el navegador las descargaba todas
// al cargar (1 223 KB en escritorio, 400 KB en móvil), aunque solo se ve una. Aquí se cuentan las
// peticiones de verdad: al cargar, solo la primera; la siguiente, poco antes de que le toque. El reloj de la
// página es falso y está parado (page.clock, H59): el tiempo avanza solo cuando el test lo dice, así que no
// depende de lo que tarde en cargar la máquina.
for (const [nombre, ancho, alto, fotos] of [
  ['móvil (375 px)', 375, 740, ['hero-almacen-800.webp', 'hero-aerea-800.webp']],
  ['escritorio (1440 px)', 1440, 900, ['hero-almacen.webp', 'hero-aerea.webp']]
]) {
  test(`hero en ${nombre}: al cargar solo se pide la primera foto, y la siguiente 3 s después (H49)`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: alto });
    const pedidas = [];
    page.on('request', (r) => {
      const { pathname } = new URL(r.url());
      if (pathname.startsWith('/img/hero')) pedidas.push(pathname.replace('/img/', ''));
    });
    // H59: install() solo pone un reloj falso que sigue corriendo al ritmo real; con los tests en paralelo la carga
    // tardaba más y el carrusel ya había cambiado de foto antes de comprobarlo. pauseAt() lo congela antes de
    // navegar (1 s después del arranque, para no saltar hacia atrás), y desde ahí solo avanza con fastForward.
    // En la portada, los únicos temporizadores durante la carga son los del propio hero (Home.jsx), así que
    // congelarlo no atasca la carga, que es lo que avisa la documentación de pauseAt.
    const arranque = new Date('2026-10-07T10:00:00');
    await page.clock.install({ time: arranque });
    await page.clock.pauseAt(new Date(arranque.getTime() + 1000));
    await simularApi(page);
    await page.goto('/');
    // H59: primero, que la portada esté pintada. Con los tests en paralelo, 'networkidle' (500 ms sin peticiones)
    // podía llegar mientras el navegador aún procesaba los módulos de la app, antes de pedir ninguna foto. Y
    // cerrarCookies solo cierra el aviso si ya se ve, así que también tiene que ir después.
    await expect(page.locator('.hero-slide-img.is-active')).toHaveAttribute('src', /hero-almacen/);
    await cerrarCookies(page);
    await page.waitForLoadState('networkidle');

    await expect.poll(() => pedidas).toEqual([fotos[0]]);

    await page.clock.fastForward(3100); // la siguiente se pide a los 3 s de mostrar la actual...
    await expect.poll(() => pedidas).toEqual(fotos);
    await expect(page.locator('.hero-slide-img.is-active')).toHaveAttribute('src', /hero-almacen/); // ...y aún no se ve
    await page.clock.fastForward(2500); // 5,6 s: le toca
    await expect(page.locator('.hero-slide-img.is-active')).toHaveAttribute('src', /hero-aerea/);
  });
}
