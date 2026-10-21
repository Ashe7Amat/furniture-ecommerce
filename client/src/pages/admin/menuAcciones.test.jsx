// El menú «⋮» de las filas de "Gestionar Inventario" (21 oct 2026): «Editar» se queda en la fila, y
// «Duplicar», «Imprimir etiqueta» y «Eliminar» pasan al menú. No son tests de caracterización (los
// Admin.*.test.jsx, congelados): describen lo nuevo. scripts/mutantes/menu-acciones.js los usa para
// la comprobación por mutación. Lo que hace cada acción está en duplicarPieza.test.jsx,
// etiquetasQr.test.jsx y Admin.inventario.test.jsx.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { deleteMueble } from '../../services/api';
import { renderAdmin, irAPestana, CATEGORIAS } from '../adminTestUtils';

vi.mock('../../services/api');

const mueble = (id, nombre, referencia) => ({
  id, nombre, referencia, categoria: 'Sillas', estado: 'disponible', imagenes: [], descripcion: ''
});
const CATALOGO = [mueble('m1', 'Silla Thonet', 'NAV-SIL-001'), mueble('m2', 'Mesa de roble', 'NAV-MES-004')];

const abrirInventario = async () => {
  const user = userEvent.setup();
  const utils = await renderAdmin({ muebles: CATALOGO, categorias: CATEGORIAS });
  await irAPestana(user, 'Gestionar Inventario');
  return { user, ...utils };
};
const fila = (nombre) => within(screen.getByRole('checkbox', { name: `Seleccionar ${nombre}` }).closest('.inventory-list-item'));
const botonMenu = (nombre = 'Silla Thonet') => fila(nombre).getByRole('button', { name: `Más acciones de ${nombre}` });
const menu = () => screen.queryByRole('menu');
const opciones = () => screen.getAllByRole('menuitem');
const abrirMenu = async (user, nombre) => {
  await user.click(botonMenu(nombre));
  return within(menu());
};

beforeEach(() => {
  vi.resetAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('Inventario — menú de acciones de la fila', () => {
  it('cada fila tiene solo «Editar» y el botón del menú, y la cabecera «Acciones» va a la derecha', async () => {
    await abrirInventario();

    const acciones = fila('Silla Thonet').getByRole('button', { name: 'Editar' }).closest('.inv-actions');
    expect(within(acciones).getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual([
      'Editar',
      'Más acciones de Silla Thonet'
    ]);
    expect(screen.getByText('Acciones')).toHaveClass('inv-actions-head');
    expect(botonMenu()).toHaveAttribute('aria-haspopup', 'menu');
    expect(botonMenu()).toHaveAttribute('aria-expanded', 'false');
    expect(menu()).not.toBeInTheDocument();
  });

  it('al abrirlo: Duplicar, Imprimir etiqueta, una línea y Eliminar en rojo; el foco va a la primera', async () => {
    const { user } = await abrirInventario();

    const abierto = await abrirMenu(user);

    expect(menu()).toHaveAccessibleName('Más acciones de Silla Thonet');
    expect(botonMenu()).toHaveAttribute('aria-expanded', 'true');
    expect(botonMenu()).toHaveAttribute('aria-controls', menu().id);
    expect(opciones().map((o) => o.textContent)).toEqual(['Duplicar', 'Imprimir etiqueta', 'Eliminar']);
    expect(abierto.getByRole('separator')).toBe(opciones()[1].nextElementSibling);
    expect(opciones()[2]).toHaveClass('peligro');
    expect(opciones()[0]).not.toHaveClass('peligro');
    expect(opciones()[0]).toHaveFocus();
    // Cuelga de <body>: dentro de la tabla, que se desplaza en horizontal, se cortaría.
    expect(menu().parentElement).toBe(document.body);
  });

  it('las flechas se mueven entre opciones y dan la vuelta; Inicio y Fin van a los extremos', async () => {
    const { user } = await abrirInventario();
    await abrirMenu(user);

    await user.keyboard('{ArrowDown}');
    expect(opciones()[1]).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(opciones()[2]).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(opciones()[0]).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(opciones()[2]).toHaveFocus();
    await user.keyboard('{Home}');
    expect(opciones()[0]).toHaveFocus();
    await user.keyboard('{End}');
    expect(opciones()[2]).toHaveFocus();
  });

  it('Intro elige la opción: «Eliminar» pide confirmación de esa pieza', async () => {
    deleteMueble.mockResolvedValue({ success: true });
    const { user } = await abrirInventario();
    await abrirMenu(user, 'Mesa de roble');

    await user.keyboard('{End}{Enter}');

    expect(menu()).not.toBeInTheDocument();
    const confirmacion = within(screen.getByRole('heading', { level: 3, name: 'Eliminar Mueble' }).closest('.confirm-box'));
    await user.click(confirmacion.getByRole('button', { name: 'Eliminar' }));
    expect(deleteMueble).toHaveBeenCalledWith('m2');
  });

  it('«Imprimir etiqueta» abre la etiqueta de esa pieza', async () => {
    const { user } = await abrirInventario();
    await abrirMenu(user, 'Mesa de roble');

    await user.click(screen.getByRole('menuitem', { name: 'Imprimir etiqueta' }));

    expect(screen.getByRole('article')).toHaveAccessibleName('Etiqueta de Mesa de roble');
  });

  it('Escape cierra el menú, devuelve el foco al botón y no cierra nada más', async () => {
    const { user } = await abrirInventario();
    await abrirMenu(user);

    await user.keyboard('{Escape}');

    expect(menu()).not.toBeInTheDocument();
    expect(botonMenu()).toHaveFocus();
    expect(botonMenu()).toHaveAttribute('aria-expanded', 'false');
  });

  it('Tab cierra el menú y deja el foco en el botón', async () => {
    const { user } = await abrirInventario();
    await abrirMenu(user);

    await user.keyboard('{Tab}');

    expect(menu()).not.toBeInTheDocument();
    expect(botonMenu()).toHaveFocus();
  });

  it('un clic fuera lo cierra sin hacer nada; un clic dentro no', async () => {
    const { user } = await abrirInventario();
    await abrirMenu(user);

    await user.click(menu());
    expect(menu()).toBeInTheDocument();

    await user.click(screen.getByRole('heading', { level: 2, name: 'Gestionar Inventario' }));
    expect(menu()).not.toBeInTheDocument();
    expect(deleteMueble).not.toHaveBeenCalled();
  });

  it('volver a pulsar el botón lo cierra, y el de otra fila abre el suyo', async () => {
    const { user } = await abrirInventario();
    await abrirMenu(user);

    await user.click(botonMenu());
    expect(menu()).not.toBeInTheDocument();

    await abrirMenu(user);
    await user.click(botonMenu('Mesa de roble'));
    expect(screen.getAllByRole('menu')).toHaveLength(1);
    expect(menu()).toHaveAccessibleName('Más acciones de Mesa de roble');
  });

});

describe('Inventario — dónde se abre el menú', () => {
  // jsdom no calcula posiciones: se dan a mano la caja del botón y el alto del menú.
  // Devuelve la caja: cambiar sus campos es mover el botón (como al desplazar la tabla).
  const colocar = (inicial, alto = 150) => {
    const caja = { ...inicial };
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      const { top, bottom, right } = caja;
      return this.classList?.contains('inv-menu-btn') ? { top, bottom, right, left: right - 34, width: 34, height: bottom - top } : { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 };
    });
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function () {
      return this.getAttribute?.('role') === 'menu' ? alto : 0;
    });
    return caja;
  };
  const desplazar = (objetivo = window) => act(() => {
    fireEvent.scroll(objetivo);
  });

  it('con sitio debajo, se abre debajo del botón, pegado a su borde derecho', async () => {
    const { user } = await abrirInventario();
    colocar({ top: 200, bottom: 234, right: 900 });

    await abrirMenu(user);

    expect(menu()).not.toHaveClass('hacia-arriba');
    expect(menu().style.top).toBe('238px');
    expect(menu().style.right).toBe(`${window.innerWidth - 900}px`);
    expect(menu().style.visibility).toBe('');
  });

  it('sin sitio debajo (última fila al pie de la pantalla), se abre hacia arriba', async () => {
    const { user } = await abrirInventario();
    const alto = window.innerHeight;
    colocar({ top: alto - 40, bottom: alto - 6, right: 900 });

    await abrirMenu(user);

    expect(menu()).toHaveClass('hacia-arriba');
    expect(menu().style.top).toBe(`${alto - 40 - 4 - 150}px`);
  });

  it('si tampoco cabe arriba, se queda debajo', async () => {
    const { user } = await abrirInventario();
    colocar({ top: 100, bottom: 134, right: 900 }, window.innerHeight);

    await abrirMenu(user);

    expect(menu()).not.toHaveClass('hacia-arriba');
    expect(menu().style.top).toBe('138px');
  });

  it('justo cabiendo debajo, no se da la vuelta', async () => {
    const { user } = await abrirInventario();
    const alto = window.innerHeight;
    colocar({ top: alto - 188, bottom: alto - 154, right: 900 });

    await abrirMenu(user);

    expect(menu()).not.toHaveClass('hacia-arriba');
  });

  it('justo cabiendo arriba, sí se da la vuelta', async () => {
    const { user } = await abrirInventario();
    const alto = window.innerHeight;
    colocar({ top: 154, bottom: alto - 100, right: 900 });

    await abrirMenu(user);

    expect(menu()).toHaveClass('hacia-arriba');
    expect(menu().style.top).toBe('0px');
  });

  it('al desplazar la tabla o la página, el menú sigue al botón y no se cierra', async () => {
    const { user } = await abrirInventario();
    const caja = colocar({ top: 200, bottom: 234, right: 900 });
    await abrirMenu(user);

    // En el móvil, la tabla se desplaza en horizontal al pulsar un botón medio tapado.
    Object.assign(caja, { right: 700 });
    desplazar(document.querySelector('.inventory-table'));
    expect(menu().style.right).toBe(`${window.innerWidth - 700}px`);

    Object.assign(caja, { top: 100, bottom: 134 });
    desplazar();
    expect(menu().style.top).toBe('138px');
    expect(opciones()).toHaveLength(3);
  });

  it('al cambiar el tamaño de la ventana, se vuelve a colocar', async () => {
    const { user } = await abrirInventario();
    const caja = colocar({ top: 200, bottom: 234, right: 900 });
    await abrirMenu(user);

    Object.assign(caja, { right: 500 });
    act(() => {
      fireEvent(window, new Event('resize'));
    });

    expect(menu().style.right).toBe(`${window.innerWidth - 500}px`);
  });

  it('si el botón sale de la pantalla por arriba, se cierra; justo en el borde, no', async () => {
    const { user } = await abrirInventario();
    const caja = colocar({ top: 200, bottom: 234, right: 900 });
    await abrirMenu(user);

    Object.assign(caja, { top: -34, bottom: 0 });
    desplazar();
    expect(menu()).toBeInTheDocument();

    Object.assign(caja, { top: -35, bottom: -1 });
    desplazar();
    expect(menu()).not.toBeInTheDocument();
  });

  it('si el botón sale de la pantalla por abajo, se cierra; justo en el borde, no', async () => {
    const { user } = await abrirInventario();
    const alto = window.innerHeight;
    const caja = colocar({ top: 200, bottom: 234, right: 900 });
    await abrirMenu(user);

    Object.assign(caja, { top: alto, bottom: alto + 34 });
    desplazar();
    expect(menu()).toBeInTheDocument();

    Object.assign(caja, { top: alto + 1, bottom: alto + 35 });
    desplazar();
    expect(menu()).not.toBeInTheDocument();
  });
});
