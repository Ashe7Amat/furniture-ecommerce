// La música de fondo (components/MusicaDeFondo.jsx) en un navegador de verdad: los tests unitarios
// simulan matchMedia y jsdom no aplica la hoja de estilo, así que no ven si el botón se pinta.
// El 13 oct 2026 el botón no le salía a Ashe en la web publicada, dos veces seguidas, con los tests en
// verde: primero por la comprobación de "es un ordenador" y después por el aviso de cookies.
import { test, expect, devices, chromium } from '@playwright/test';
import { simularApi } from './apiSimulada';

const boton = (page) => page.getByRole('button', { name: 'Escuchar música' });

test('con un bloqueador que oculta el aviso de cookies, el botón de la música se ve', async ({ page }) => {
  await simularApi(page);
  await page.goto('/');
  // Lo que hace el filtro de avisos de cookies de uBlock, Brave o AdGuard: el aviso sigue en la
  // página, pero oculto, y nadie lo cierra.
  await page.addStyleTag({ content: '.cookie-banner { display: none !important; }' });
  await expect(page.locator('.cookie-banner')).toHaveCount(1);

  await expect(boton(page)).toBeVisible();
  const caja = await boton(page).boundingBox();
  expect(caja.y + caja.height).toBeCloseTo(page.viewportSize().height - 24, 0);
});

test('con el aviso de cookies abierto, el botón se ve encima del aviso, y al cerrarlo baja', async ({ page }) => {
  await simularApi(page);
  await page.goto('/');
  const aviso = page.getByRole('dialog', { name: 'Consentimiento de cookies' });
  await expect(aviso).toBeVisible();

  await expect(boton(page)).toBeVisible();
  const cajaAviso = await aviso.boundingBox();
  await expect.poll(async () => {
    const caja = await boton(page).boundingBox();
    return caja.y + caja.height <= cajaAviso.y;
  }).toBe(true);

  await page.getByRole('button', { name: 'Solo esenciales' }).click();
  await expect.poll(async () => {
    const caja = await boton(page).boundingBox();
    return Math.round(caja.y + caja.height);
  }).toBe(page.viewportSize().height - 24);
});

test('en un portátil con pantalla táctil y touchpad, sale el botón de la música', async ({ baseURL }) => {
  // Chromium no tiene un dispositivo así en la lista: se arranca aparte diciéndole que el puntero
  // principal es el dedo (sin hover) y que además hay uno fino, como dicen muchos portátiles táctiles.
  const navegador = await chromium.launch({
    args: ['--blink-settings=primaryPointerType=2,availablePointerTypes=6,primaryHoverType=1,availableHoverTypes=3']
  });
  try {
    const page = await navegador.newPage({ baseURL });
    await simularApi(page);
    await page.goto('/');
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
    await page.getByRole('button', { name: 'Solo esenciales' }).click();
    await expect(boton(page)).toBeVisible();
  } finally {
    await navegador.close();
  }
});

test.describe('móvil', () => {
  // eslint-disable-next-line no-unused-vars
  const { defaultBrowserType, ...movil } = devices['Pixel 7'];
  test.use(movil);

  test('no hay música (decisión de Ashe)', async ({ page }) => {
    await simularApi(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Solo esenciales' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Nave 5 Barcelona' })).toBeVisible();
    await expect(page.locator('.musica-boton')).toHaveCount(0);
  });
});
