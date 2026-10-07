// H61: en el móvil, las tarjetas del catálogo bajan la miniatura de 400 px de cada foto (si la tiene), no la
// foto grande; la ficha sigue con la grande. Las fotos se sirven desde aquí, sin red:
// - la grande, public/img/hero-almacen.webp (1600 x 1200, 359 KB, como una foto real del catálogo);
// - su miniatura, e2e/fixtures/hero-almacen-thumb.webp, la que genera server/src/utils/upload.js
//   (uploadToSupabase con conMiniatura) a partir de esa misma foto: 400 x 300, 26 KB.
import { test, expect, devices } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { simularApi, vigilarConsola, cerrarCookies, API, MUEBLES } from './apiSimulada';

// El Pixel 5 sin su navegador por defecto (lo pone el proyecto de la configuración).
// eslint-disable-next-line no-unused-vars
const { defaultBrowserType, ...movil } = devices['Pixel 5'];
test.use(movil);

const FOTOS = 'https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/muebles';
const BASE = `${FOTOS}/k3x9w2m1qa-1791300000000`;
const GRANDE = readFileSync(new URL('../public/img/hero-almacen.webp', import.meta.url));
const MINIATURA = readFileSync(new URL('./fixtures/hero-almacen-thumb.webp', import.meta.url));
const KB = 1024;

test('en el móvil, la tarjeta baja la miniatura (menos de 60 KB) y la ficha, la foto grande', async ({ page }) => {
  const errores = vigilarConsola(page);
  await simularApi(page);
  // La primera pieza, con una foto subida con miniatura; las demás, como siempre.
  const conFoto = { ...MUEBLES[0], imagenes: [`${BASE}-full.webp`] };
  const piezas = [conFoto, ...MUEBLES.slice(1)];
  await page.route(`${API}/muebles`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(piezas) })
  );
  await page.route(`${API}/muebles/${conFoto.id}`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(conFoto) })
  );
  const pedidas = [];
  await page.route(`${FOTOS}/**`, (route) => {
    const url = route.request().url();
    const cuerpo = url.endsWith('-thumb.webp') ? MINIATURA : url.endsWith('-full.webp') ? GRANDE : null;
    if (!cuerpo) return route.fulfill({ status: 404, body: '' });
    pedidas.push({ archivo: url.slice(FOTOS.length + 1), bytes: cuerpo.length });
    return route.fulfill({ status: 200, contentType: 'image/webp', body: cuerpo });
  });

  await page.goto('/catalogo');
  await cerrarCookies(page);
  expect(page.viewportSize().width).toBeLessThan(500);

  const foto = page.locator(`.products-grid .product-card img[alt="${conFoto.nombre}"]`);
  await foto.scrollIntoViewIfNeeded();
  await expect.poll(() => foto.evaluate((img) => img.complete && img.naturalWidth)).toBe(400);

  expect(pedidas).toEqual([{ archivo: 'k3x9w2m1qa-1791300000000-thumb.webp', bytes: MINIATURA.length }]);
  expect(pedidas[0].bytes).toBeLessThan(60 * KB);

  // La ficha: la foto grande.
  await foto.click();
  await expect(page).toHaveURL(`/mueble/${conFoto.id}`);
  const principal = page.locator('.pd-main-image');
  await expect(principal).toHaveAttribute('src', `${BASE}-full.webp`);
  await expect.poll(() => principal.evaluate((img) => img.complete && img.naturalWidth)).toBe(1600);
  expect(pedidas.map((p) => p.archivo)).toContain('k3x9w2m1qa-1791300000000-full.webp');
  expect(pedidas.find((p) => p.archivo.endsWith('-full.webp')).bytes).toBeGreaterThan(300 * KB);

  expect(errores).toEqual([]);
});
