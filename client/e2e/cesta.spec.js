// La cesta y sus modales (H53, sesión de diagnóstico del 6 oct 2026). Al abrir la cesta, validateCart pide
// cada pieza a la API y copia su precio actual. La API simulada da los precios a null, como producción con
// MOSTRAR_PRECIOS apagado, así que el botón "Confirmar Pedido" se desactiva (C4) y no se llega a ningún
// modal: era la causa de que el E2E "no abriera" AuthModal ni CheckoutModal. Para llegar a ellos, aquí se
// simula una pieza con precio, como si los precios estuvieran publicados.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { simularApi, CLIENTE, MUEBLES, API } from './apiSimulada';

const LINEA = { productId: 'm1', modalidad: 'compra', nombre: MUEBLES[0].nombre, precio: 120, cantidad: 1 };

const abrirCesta = async (page, { precio, conSesion }) => {
  await simularApi(page);
  // Registrada después de simularApi: Playwright usa primero la última ruta que coincide.
  await page.route(`${API}/muebles/m1`, (r) => r.fulfill({ json: { ...MUEBLES[0], precio_venta: precio } }));
  await page.addInitScript(
    ({ cliente, linea, sesion }) => {
      if (sesion) localStorage.setItem('kaveUser', JSON.stringify(cliente));
      localStorage.setItem(`kaveCart_${sesion ? cliente.email : 'guest'}`, JSON.stringify([linea]));
      localStorage.setItem('nave5-cookie-consent', JSON.stringify({ analytics: false, date: new Date().toISOString() }));
    },
    { cliente: CLIENTE, linea: LINEA, sesion: conSesion }
  );
  await page.goto('/catalogo');
  await page.getByRole('button', { name: 'Cesta', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Tu cesta' })).toBeVisible();
};

test('con los precios ocultos (como en producción), la cesta no deja pagar: "Confirmar Pedido" desactivado (C4)', async ({ page }) => {
  await abrirCesta(page, { precio: null, conSesion: false });

  await expect(page.getByText('Hay piezas sin precio en tu cesta')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmar Pedido' })).toBeDisabled();
});

// Lo que axe encuentra hoy en cada modal, con todas las reglas WCAG A y AA y cualquier gravedad. Una
// violación conocida, pendiente (H54): el lema "Almacén de ideas" de AuthModal usa --accent-color, a 2,97:1
// en claro. Está aquí, a la vista, en vez de excluida: cuando se arregle, este test fallará y habrá que
// quitarla de la lista.
const CONOCIDAS = {
  'AuthModal light': ['color-contrast (serious): .auth-tagline'],
  'AuthModal dark': [],
  'CheckoutModal light': [],
  'CheckoutModal dark': []
};

for (const tema of ['light', 'dark']) {
  for (const [modal, conSesion, raiz] of [
    ['AuthModal', false, '.auth-overlay'],
    ['CheckoutModal', true, '.checkout-overlay']
  ]) {
    test(`${modal} (${tema}): se abre desde la cesta con una pieza con precio, y axe (H53, H54)`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: tema, reducedMotion: 'reduce' });
      await abrirCesta(page, { precio: 120, conSesion });

      const confirmar = page.getByRole('button', { name: 'Confirmar Pedido' });
      await expect(confirmar).toBeEnabled();
      await confirmar.click();
      await expect(page.locator(raiz)).toBeVisible();

      const { violations } = await new AxeBuilder({ page })
        .include(raiz)
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual(
        CONOCIDAS[`${modal} ${tema}`]
      );
    });
  }
}
