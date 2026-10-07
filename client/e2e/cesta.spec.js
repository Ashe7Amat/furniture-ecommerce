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

// axe sobre cada modal, con todas las reglas WCAG A y AA y cualquier gravedad: ninguna violación.
// CAMBIADO A PROPÓSITO (6 oct 2026, H54): hasta H54 se esperaba una, el contraste del lema "Almacén de ideas"
// de AuthModal (2,97:1 en claro). Ya está arreglado, y se exige cero en los dos modales y los dos temas.

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
      expect(violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    });
  }
}

// H55: los dos modales son diálogos modales de verdad. Se anuncian con su título, el foco entra al abrirlos,
// Tab y Mayús+Tab no lo dejan salir, y al cerrarlos (Escape o ✕) el foco vuelve a "Confirmar Pedido" con la cesta
// aún abierta debajo. Pendiente, fuera de este entorno: comprobarlo en un iPhone real con VoiceOver (aquí solo hay
// Chrome/Chromium, y emular un iPhone no reproduce Safari).
const MODALES = [
  { modal: 'AuthModal', conSesion: false, titulo: 'Iniciar Sesión' },
  { modal: 'CheckoutModal', conSesion: true, titulo: 'Finalizar Pago' }
];
const focoDentro = (dialogo) => dialogo.evaluate((d) => d.contains(document.activeElement));

for (const { modal, conSesion, titulo } of MODALES) {
  test.describe(`${modal}: diálogo modal y foco (H55)`, () => {
    const abrirModal = async (page) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await abrirCesta(page, { precio: 120, conSesion });
      const confirmar = page.getByRole('button', { name: 'Confirmar Pedido' });
      await confirmar.click();
      const dialogo = page.getByRole('dialog', { name: titulo });
      await expect(dialogo).toBeVisible();
      return { confirmar, dialogo };
    };

    test('se anuncia como diálogo modal con su título, y al abrir el foco está dentro', async ({ page }) => {
      const { dialogo } = await abrirModal(page);
      await expect(dialogo).toHaveAttribute('aria-modal', 'true');
      await expect.poll(() => focoDentro(dialogo)).toBe(true);
    });

    test('Tab y Mayús+Tab dan la vuelta sin salir del diálogo', async ({ page }) => {
      const { dialogo } = await abrirModal(page);
      const enfocables = await dialogo.evaluate(
        (d) => d.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])').length
      );
      expect(enfocables).toBeGreaterThan(1);
      for (let i = 0; i < enfocables + 3; i++) {
        await page.keyboard.press('Tab');
        expect(await focoDentro(dialogo), `Tab n.º ${i + 1}`).toBe(true);
      }
      for (let i = 0; i < enfocables + 3; i++) {
        await page.keyboard.press('Shift+Tab');
        expect(await focoDentro(dialogo), `Mayús+Tab n.º ${i + 1}`).toBe(true);
      }
    });

    test('Escape lo cierra, la cesta sigue abierta y el foco vuelve a "Confirmar Pedido"', async ({ page }) => {
      const { confirmar, dialogo } = await abrirModal(page);
      await page.keyboard.press('Escape');
      await expect(dialogo).toBeHidden();
      await expect(page.getByRole('dialog', { name: 'Tu cesta' })).toBeVisible();
      await expect(confirmar).toBeFocused();
    });

    test('la ✕ lo cierra y el foco vuelve a "Confirmar Pedido"', async ({ page }) => {
      const { confirmar, dialogo } = await abrirModal(page);
      await dialogo.getByRole('button', { name: 'Cerrar' }).click();
      await expect(dialogo).toBeHidden();
      await expect(confirmar).toBeFocused();
    });
  });
}

// H56: axe no pasa el ratón ni pone el foco, así que se mide aquí con los colores que calcula el navegador, en los
// dos temas. Texto del botón "¿Aún no eres miembro?…" al pasar el ratón: 4,5:1 sobre el fondo del modal. Borde del
// campo con el foco (su única señal de foco, sin outline): 3:1 contra el fondo y contra el borde sin foco.
const luminancia = (rgb) => {
  const [r, g, b] = rgb.match(/\d+(\.\d+)?/g).slice(0, 3).map((v) => {
    const c = Number(v) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a, b) => {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
};
const estilo = (locator, propiedad) => locator.evaluate((el, p) => getComputedStyle(el)[p], propiedad);

for (const tema of ['light', 'dark']) {
  test(`AuthModal (${tema}): contraste al pasar el ratón y con el foco (H56)`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema, reducedMotion: 'reduce' });
    await abrirCesta(page, { precio: 120, conSesion: false });
    await page.getByRole('button', { name: 'Confirmar Pedido' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Iniciar Sesión' });
    await expect(dialogo).toBeVisible();
    const fondo = await estilo(dialogo, 'backgroundColor');

    const alternar = dialogo.getByRole('button', { name: '¿Aún no eres miembro? Regístrate aquí' });
    await alternar.hover();
    await expect.poll(async () => contraste(await estilo(alternar, 'color'), fondo)).toBeGreaterThanOrEqual(4.5);

    const email = dialogo.getByPlaceholder('tu@correo.com');
    const bordeSinFoco = await estilo(email, 'borderTopColor');
    await email.focus();
    await expect.poll(async () => contraste(await estilo(email, 'borderTopColor'), fondo)).toBeGreaterThanOrEqual(3);
    expect(contraste(await estilo(email, 'borderTopColor'), bordeSinFoco)).toBeGreaterThanOrEqual(3);
  });
}
