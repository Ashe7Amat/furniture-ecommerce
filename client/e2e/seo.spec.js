// Tarea 4 (7 oct 2026): cada ficha pone su <title>, su descripción y su primera foto como og:image, y al
// salir vuelven las de la web. Solo con JavaScript: el HTML que se sirve (lo que leen las vistas previas
// de WhatsApp o las redes, que no ejecutan JavaScript) es el mismo index.html para todas las rutas, con
// las etiquetas de la portada (H34).
import { test, expect } from '@playwright/test';
import { simularApi, vigilarConsola, cerrarCookies, MUEBLES } from './apiSimulada';

const meta = (page, selector) => page.locator(`head ${selector}`).getAttribute('content');
const TITULO_WEB = 'Nave 5 Barcelona | Almacén de ideas';

test('la ficha pone su título, descripción y og:image; otra ficha, los suyos; al salir, los de la web', async ({ page }) => {
  const errores = vigilarConsola(page);
  await simularApi(page);
  const [silla, , mesa] = MUEBLES;

  await page.goto('/catalogo');
  await cerrarCookies(page);
  await expect(page).toHaveTitle(/Catálogo/);

  await page.locator('.products-grid .product-card', { hasText: silla.nombre }).click();
  await expect(page).toHaveTitle(`${silla.nombre} | Nave 5 Barcelona`);
  // Las descripciones de prueba son cortas: van con el nombre delante y la tienda detrás.
  expect(await meta(page, 'meta[name="description"]')).toContain(silla.descripcion);
  const producto = JSON.parse(
    await page.locator('head script[type="application/ld+json"][data-jsonld="producto"]').textContent()
  );
  expect(producto).toMatchObject({ '@type': 'Product', name: silla.nombre });
  expect(await page.locator('head link[rel="canonical"]').getAttribute('href')).toBe(
    `https://www.nave5barcelona.com/mueble/${silla.id}`
  );
  expect(await meta(page, 'meta[property="og:title"]')).toBe(`${silla.nombre} | Nave 5 Barcelona`);
  expect(await meta(page, 'meta[property="og:image"]')).toBe(silla.imagenes[0]);

  await page.goBack();
  await page.locator('.products-grid .product-card', { hasText: mesa.nombre }).click();
  await expect(page).toHaveTitle(`${mesa.nombre} | Nave 5 Barcelona`);
  expect(await meta(page, 'meta[name="description"]')).toContain(mesa.descripcion);
  expect(await meta(page, 'meta[property="og:description"]')).toContain(mesa.descripcion);
  await expect(page.locator('head script[data-jsonld="producto"]')).toHaveCount(1);

  await page.goto('/');
  await expect(page).toHaveTitle(TITULO_WEB);
  expect(await meta(page, 'meta[property="og:image"]')).toMatch(/og-image\.png$/);
  await expect(page.locator('head script[data-jsonld]')).toHaveCount(0);
  // La portada pone el suyo (y uno solo: el de la ficha se ha ido).
  await expect(page.locator('head link[rel="canonical"]')).toHaveCount(1);
  expect(await page.locator('head link[rel="canonical"]').getAttribute('href')).toBe('https://www.nave5barcelona.com/');
  expect(errores).toEqual([]);
});

test('el HTML que se sirve para una ficha (sin JavaScript) sigue con las etiquetas de la portada (H34)', async ({ page }) => {
  const respuesta = await page.request.get(`/mueble/${MUEBLES[0].id}`);
  const html = await respuesta.text();

  expect(html).toContain(`<title>${TITULO_WEB}</title>`);
  expect(html).toContain('<meta property="og:image" content="https://www.nave5barcelona.com/og-image.png" />');
  expect(html).not.toContain(MUEBLES[0].nombre);
});
