// Tests de CARACTERIZACIÓN del panel (tarea 4, ver docs/tarea4-diseno.md): describen lo que hace
// hoy la pestaña "Pedidos", aunque algo no guste. Desde el primer commit del refactor no se tocan;
// si uno falla, es que el refactor ha cambiado el comportamiento.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getPedidos, actualizarEstadoPedido } from '../services/api';
import { renderAdmin, irAPestana, barraLateral } from './adminTestUtils';

vi.mock('../services/api');

// Datos inventados. Los ids son UUID, como en la tabla real (la referencia sale de sus 8 primeros caracteres).
const PEDIDO_COMPLETO = {
  id: 'a1b2c3d4-0000-4000-8000-000000000001',
  estado: 'procesando',
  created_at: '2026-09-04T10:30:00Z',
  total: 1290,
  direccion_envio: 'Calle Mayor 1, Barcelona',
  cliente_info: {
    nombre: 'Laura Gómez',
    email: 'laura@cliente.test',
    telefono: '600111222',
    direccion: 'Otra dirección (no se usa si hay direccion_envio)',
    notas: 'Llamar antes de subir'
  },
  items: [
    { productId: 'm1', nombre: 'Sofá Lumina', modalidad: 'compra', cantidad: 1, precio: 1250 },
    { productId: 'm2', nombre: 'Butaca de cine', modalidad: 'alquiler', cantidad: 1, precio: 40 }
  ]
};
const PEDIDO_MINIMO = {
  id: 'ffee0011-0000-4000-8000-000000000002',
  estado: 'enviado',
  created_at: null,
  total: 300,
  direccion_envio: null,
  cliente_info: { notas: 'Ninguna', direccion: 'Plaza Real 3' },
  items: [{ productId: 'm3', nombre: 'Mesa de roble', modalidad: 'compra', precio: 300 }]
};
const PEDIDO_SIN_NADA = {
  id: '99887766-0000-4000-8000-000000000003',
  estado: 'entregado',
  created_at: '2026-09-05T08:00:00Z',
  total: 0,
  direccion_envio: null,
  cliente_info: null,
  items: 'no es una lista'
};
const PEDIDOS = [PEDIDO_COMPLETO, PEDIDO_MINIMO, PEDIDO_SIN_NADA];

const abrirPedidos = async (pedidos = PEDIDOS) => {
  const user = userEvent.setup();
  const utils = await renderAdmin({ pedidos });
  await irAPestana(user, /^Pedidos/);
  return { user, ...utils };
};

// Cada pedido es una tarjeta .pedido-card, localizada por su referencia. El filtro es el único
// <select> de la barra de herramientas. Depende del HTML congelado (diseño de la tarea 4, sección 8).
const tarjeta = (ref) => within(screen.getByText(`Ref. ${ref}`).closest('.pedido-card'));
const filtroEstado = () => document.querySelector('.admin-toolbar select');
const referencias = () =>
  [...document.querySelectorAll('.pedido-card .pedido-id')].map((el) => el.textContent);

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Pedidos — listado', () => {
  it('cabecera con el recuento y una tarjeta por pedido, en el orden de la API, con su referencia', async () => {
    await abrirPedidos();

    expect(screen.getByRole('heading', { level: 2, name: 'Pedidos' })).toBeInTheDocument();
    expect(screen.getByText('3 de 3 pedidos')).toBeInTheDocument();
    // La referencia son los 8 primeros caracteres del id, en mayúsculas.
    expect(referencias()).toEqual(['Ref. A1B2C3D4', 'Ref. FFEE0011', 'Ref. 99887766']);
  });

  it('los datos del cliente: nombre, email y teléfono como enlaces, dirección de envío y notas', async () => {
    await abrirPedidos();
    const pedido = tarjeta('A1B2C3D4');

    expect(pedido.getByText('Laura Gómez')).toBeInTheDocument();
    expect(pedido.getByRole('link', { name: 'laura@cliente.test' })).toHaveAttribute('href', 'mailto:laura@cliente.test');
    expect(pedido.getByRole('link', { name: '600111222' })).toHaveAttribute('href', 'tel:600111222');
    // La dirección del pedido tiene prioridad sobre la de cliente_info.
    expect(pedido.getByText('Calle Mayor 1, Barcelona')).toBeInTheDocument();
    expect(pedido.queryByText(/Otra dirección/)).not.toBeInTheDocument();
    expect(pedido.getByText('Llamar antes de subir')).toBeInTheDocument();
  });

  it('con datos que faltan: "Sin nombre", sin enlaces, la dirección de cliente_info, y las notas "Ninguna" no se enseñan', async () => {
    await abrirPedidos();
    const pedido = tarjeta('FFEE0011');

    expect(pedido.getByText('Sin nombre')).toBeInTheDocument();
    expect(pedido.queryByRole('link')).not.toBeInTheDocument();
    expect(pedido.getByText('Plaza Real 3')).toBeInTheDocument();
    expect(pedido.queryByText(/Notas:/)).not.toBeInTheDocument();
  });

  it('sin cliente_info, sin dirección y sin fecha no se rompe: "Sin nombre", "Sin dirección de envío" y "—"', async () => {
    await abrirPedidos();

    expect(tarjeta('99887766').getByText('Sin nombre')).toBeInTheDocument();
    expect(tarjeta('99887766').getByText('Sin dirección de envío')).toBeInTheDocument();
    expect(tarjeta('FFEE0011').getByText('—')).toBeInTheDocument(); // created_at a null
    expect(tarjeta('A1B2C3D4').queryByText('—')).not.toBeInTheDocument();
  });

  it('los productos con su precio (y "alquiler/día" en los alquileres), la cantidad por defecto 1 y el total', async () => {
    await abrirPedidos();
    const completo = tarjeta('A1B2C3D4');

    expect(completo.getByText('Sofá Lumina')).toBeInTheDocument();
    expect(completo.getByText('1 x 1250 €')).toBeInTheDocument();
    expect(completo.getByText('Butaca de cine (alquiler/día)')).toBeInTheDocument();
    expect(completo.getByText('1 x 40 €')).toBeInTheDocument();
    expect(completo.getByText('1290 €')).toBeInTheDocument();

    expect(tarjeta('FFEE0011').getByText('1 x 300 €')).toBeInTheDocument(); // sin "cantidad"
    // items que no es una lista: ninguna línea, pero la tarjeta sale con su total.
    expect(tarjeta('99887766').queryAllByRole('listitem')).toHaveLength(0);
    expect(tarjeta('99887766').getByText('0 €')).toBeInTheDocument();
  });

  it('sin ningún pedido, avisa de que todavía no hay pedidos', async () => {
    await abrirPedidos([]);

    expect(screen.getByText('0 de 0 pedidos')).toBeInTheDocument();
    expect(screen.getByText('Todavía no se ha registrado ningún pedido.')).toBeInTheDocument();
  });

  it('si getPedidos no devuelve una lista, se trata como "sin pedidos"', async () => {
    // CARACTERIZACIÓN: con el contrato C de api.js (H12), un fallo de carga no se distingue de
    // "no hay pedidos"; y si llegara otra cosa que una lista, el panel tampoco lo diferencia.
    await abrirPedidos(null);

    expect(screen.getByText('Todavía no se ha registrado ningún pedido.')).toBeInTheDocument();
  });
});

describe('Pedidos — filtro y recarga', () => {
  it('el filtro ofrece los cuatro estados y enseña solo los pedidos de ese estado', async () => {
    const { user } = await abrirPedidos();
    const opciones = [...filtroEstado().options].map((o) => [o.value, o.textContent]);
    expect(opciones).toEqual([
      ['', 'Todos los estados'],
      ['procesando', 'Procesando'],
      ['enviado', 'Enviado'],
      ['entregado', 'Entregado'],
      ['cancelado', 'Cancelado']
    ]);

    await user.selectOptions(filtroEstado(), 'enviado');

    expect(referencias()).toEqual(['Ref. FFEE0011']);
    expect(screen.getByText('1 de 3 pedidos')).toBeInTheDocument();
  });

  it('si el filtro no deja ninguno, lo dice (distinto de "todavía no hay pedidos")', async () => {
    const { user } = await abrirPedidos();

    await user.selectOptions(filtroEstado(), 'cancelado');

    expect(screen.getByText('No hay pedidos que coincidan con este filtro.')).toBeInTheDocument();
    expect(screen.getByText('0 de 3 pedidos')).toBeInTheDocument();
  });

  it('"Actualizar" vuelve a pedir los pedidos a la API', async () => {
    const { user } = await abrirPedidos();
    expect(getPedidos).toHaveBeenCalledTimes(1);

    getPedidos.mockResolvedValue([PEDIDO_MINIMO]);
    await user.click(screen.getByRole('button', { name: 'Actualizar' }));

    await waitFor(() => expect(referencias()).toEqual(['Ref. FFEE0011']));
    expect(getPedidos).toHaveBeenCalledTimes(2);
  });
});

describe('Pedidos — cambio de estado', () => {
  it('cada tarjeta tiene su estado en un selector con los cuatro estados', async () => {
    await abrirPedidos();

    expect(tarjeta('A1B2C3D4').getByRole('combobox')).toHaveValue('procesando');
    expect(tarjeta('FFEE0011').getByRole('combobox')).toHaveValue('enviado');
    expect([...tarjeta('A1B2C3D4').getByRole('combobox').options].map((o) => o.value)).toEqual([
      'procesando',
      'enviado',
      'entregado',
      'cancelado'
    ]);
  });

  it('si va bien, avisa, lo cambia en pantalla sin recargar y actualiza la insignia de pendientes', async () => {
    actualizarEstadoPedido.mockResolvedValue({ ...PEDIDO_COMPLETO, estado: 'enviado' });
    const { user, showToast } = await abrirPedidos();
    expect(barraLateral().getByRole('button', { name: /^Pedidos/ })).toHaveTextContent('1');

    await user.selectOptions(tarjeta('A1B2C3D4').getByRole('combobox'), 'enviado');

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Estado del pedido actualizado', 'success'));
    expect(actualizarEstadoPedido).toHaveBeenCalledWith(PEDIDO_COMPLETO.id, 'enviado');
    expect(tarjeta('A1B2C3D4').getByRole('combobox')).toHaveValue('enviado');
    expect(getPedidos).toHaveBeenCalledTimes(1);
    // Ya no queda ninguno "procesando": la insignia desaparece.
    expect(barraLateral().getByRole('button', { name: /^Pedidos/ })).toHaveTextContent(/^\s*Pedidos\s*$/);
  });

  it('si falla, avisa del error y el selector se queda en el estado que tenía', async () => {
    actualizarEstadoPedido.mockResolvedValue(null);
    const { user, showToast } = await abrirPedidos();

    await user.selectOptions(tarjeta('A1B2C3D4').getByRole('combobox'), 'cancelado');

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith('Error al actualizar el estado del pedido', 'error')
    );
    expect(tarjeta('A1B2C3D4').getByRole('combobox')).toHaveValue('procesando');
  });

  it('con un filtro puesto, un pedido que cambia a otro estado desaparece de la lista', async () => {
    actualizarEstadoPedido.mockResolvedValue({ ...PEDIDO_COMPLETO, estado: 'enviado' });
    const { user } = await abrirPedidos();
    await user.selectOptions(filtroEstado(), 'procesando');
    expect(referencias()).toEqual(['Ref. A1B2C3D4']);

    await user.selectOptions(tarjeta('A1B2C3D4').getByRole('combobox'), 'enviado');

    await waitFor(() => expect(screen.getByText('No hay pedidos que coincidan con este filtro.')).toBeInTheDocument());
  });
});
