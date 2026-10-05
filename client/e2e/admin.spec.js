// El panel de administración: el administrador inicia sesión (API simulada), entra al panel desde
// el menú de su cuenta y recorre las pestañas.
import { test, expect } from '@playwright/test';
import { simularApi, vigilarConsola, cerrarCookies, ADMIN, CLIENTE, CONTRASENA, MUEBLES } from './apiSimulada';

const iniciarSesion = async (page, usuario) => {
  await page.goto('/login');
  await cerrarCookies(page);
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(usuario.email);
  await page.getByPlaceholder('Contraseña', { exact: true }).fill(CONTRASENA);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page).toHaveURL('/');
};

test('el administrador entra al panel y recorre todas las pestañas', async ({ page }) => {
  const errores = vigilarConsola(page);
  const { sinSimular } = await simularApi(page);
  await iniciarSesion(page, ADMIN);

  // Sin recargar: el access token vive en memoria.
  await page.getByRole('button', { name: 'Cuenta' }).click();
  await page.getByRole('link', { name: /Panel/ }).first().click();
  await expect(page).toHaveURL('/admin');

  const barra = page.getByRole('navigation').filter({ has: page.getByRole('button', { name: 'Resumen' }) });
  const pestanas = [
    ['Añadir Mueble', 'Añadir Nuevo Producto'],
    ['Gestionar Inventario', 'Gestionar Inventario'],
    [/^Pedidos/, 'Pedidos'],
    [/^Mensajes/, 'Mensajes'],
    ['Gestionar Categorías', 'Gestionar Categorías'],
    ['Resumen', 'Dashboard']
  ];
  for (const [boton, titulo] of pestanas) {
    await barra.getByRole('button', { name: boton }).click();
    await expect(page.getByRole('heading', { level: 2, name: titulo })).toBeVisible();
  }

  // El inventario lista lo que devuelve la API del panel, con su referencia.
  await barra.getByRole('button', { name: 'Gestionar Inventario' }).click();
  await expect(page.locator('.inventory-list-item')).toHaveCount(MUEBLES.length);
  await expect(page.getByText('NAV-SIL-001')).toBeVisible();

  // La insignia de "Mensajes" cuenta el mensaje sin leer de la API simulada.
  await expect(barra.getByRole('button', { name: /^Mensajes/ })).toHaveText(/Mensajes\s*1/);

  expect(sinSimular).toEqual([]);
  expect(errores).toEqual([]);
});

test('un cliente que no es administrador no entra al panel', async ({ page }) => {
  await simularApi(page);
  await iniciarSesion(page, CLIENTE);

  await page.getByRole('button', { name: 'Cuenta' }).click();
  await expect(page.getByRole('link', { name: /Panel/ })).toHaveCount(0);
});
