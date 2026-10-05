// Iniciar sesión, con la API simulada: con la contraseña buena entra y saluda; con una mala, se
// queda en el formulario con el error del servidor.
import { test, expect } from '@playwright/test';
import { simularApi, cerrarCookies, CLIENTE, CONTRASENA } from './apiSimulada';

test.beforeEach(async ({ page }) => {
  await simularApi(page);
  await page.goto('/login');
  await cerrarCookies(page);
});

test('con las credenciales buenas, entra, saluda y vuelve a la portada', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(CLIENTE.email);
  await page.getByPlaceholder('Contraseña', { exact: true }).fill(CONTRASENA);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();

  await expect(page).toHaveURL('/');
  await expect(page.getByText(`¡Hola de nuevo, ${CLIENTE.nombre}!`)).toBeVisible();
  // La sesión queda guardada para la siguiente visita (sin el access token, que vive en memoria).
  const guardado = await page.evaluate(() => JSON.parse(localStorage.getItem('kaveUser')));
  expect(guardado).toMatchObject({ email: CLIENTE.email, rol: 'cliente' });
});

test('con una contraseña mala, se queda en el login y enseña el error', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(CLIENTE.email);
  await page.getByPlaceholder('Contraseña', { exact: true }).fill('no-es-esta');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();

  await expect(page.getByText('Email o contraseña incorrectos.')).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test('sin sesión, /cuenta?tab=pedidos manda al login y, al entrar, vuelve ahí y no a la portada (H45)', async ({ page }) => {
  await page.goto('/cuenta?tab=pedidos');
  await expect(page).toHaveURL(/\/login$/);

  // Con replace, el login no deja una entrada en el historial: "atrás" no vuelve al formulario.
  const entradas = () => page.evaluate(() => window.history.length);
  const antes = await entradas();
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(CLIENTE.email);
  await page.getByPlaceholder('Contraseña', { exact: true }).fill(CONTRASENA);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();

  await expect(page).toHaveURL('/cuenta?tab=pedidos');
  await expect(page.getByRole('heading', { level: 2, name: 'Historial de Compras' })).toBeVisible();
  expect(await entradas()).toBe(antes);
});

test('sin sesión, /admin manda al login', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login$/);
});
