// Arreglo de H14 (28 sep 2026): cada formulario del panel tiene su propio estado de envío
// (hooks/useEstadoEnvio.js). NO son tests de caracterización: describen el comportamiento nuevo.
// - Mientras un formulario envía, su botón se desactiva y un segundo envío (doble clic, Intro) no
//   sale: el manejador también lo comprueba, porque aquí se envía con fireEvent.submit, que no
//   respeta el botón desactivado (ver Admin.crear.test.jsx, guardar()).
// - El mensaje (progreso o error) sale junto a su formulario y no en otro.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within, act, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMueble, updateMueble, updateCategoria } from '../services/api';
import { renderAdmin, irAPestana, CATEGORIAS } from './adminTestUtils';

vi.mock('../services/api');

const PIEZA = {
  id: 'p1',
  nombre: 'Pieza 01',
  categoria: 'Sillas',
  categoria_id: 11,
  descripcion: 'Una pieza',
  estado: 'disponible',
  precio_venta: 100,
  precio_alquiler_dia: null,
  imagenes: []
};

// Una promesa que el test resuelve cuando quiere: así se ve el formulario "a mitad de envío".
const pendiente = () => {
  let resolver;
  const promesa = new Promise((r) => (resolver = r));
  return { promesa, resolver: (valor) => act(async () => resolver(valor)) };
};
const enviar = (elemento) =>
  act(async () => {
    fireEvent.submit(elemento.closest('form'));
  });
const modal = () => within(document.querySelector('.admin-modal-content'));

const abrirEditorMueble = async () => {
  const user = userEvent.setup();
  await renderAdmin({ muebles: [PIEZA], categorias: CATEGORIAS });
  await irAPestana(user, 'Gestionar Inventario');
  const fila = screen.getByRole('checkbox', { name: 'Seleccionar Pieza 01' }).closest('.inventory-list-item');
  await user.click(within(fila).getByRole('button', { name: 'Editar' }));
  return user;
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('H14 — estado de envío por formulario', () => {
  it('"Añadir mueble": mientras guarda, un segundo envío no crea otro mueble; si falla, el error sale junto a su formulario', async () => {
    const envio = pendiente();
    createMueble.mockReturnValue(envio.promesa);
    const user = userEvent.setup();
    await renderAdmin({ categorias: CATEGORIAS });
    await irAPestana(user, 'Añadir Mueble');
    const boton = screen.getByRole('button', { name: 'Guardar Producto' });

    await enviar(boton);
    expect(boton).toBeDisabled();
    await enviar(boton);
    expect(createMueble).toHaveBeenCalledTimes(1);

    await envio.resolver(null);
    expect(boton).toBeEnabled();
    expect(screen.getByText('Error al guardar en base de datos.')).toBeInTheDocument();
  });

  it('modal de mueble: mientras guarda, "Guardar Cambios" se desactiva y el progreso sale en el modal; si falla, también el error', async () => {
    const envio = pendiente();
    updateMueble.mockReturnValue(envio.promesa);
    const user = await abrirEditorMueble();
    const boton = modal().getByRole('button', { name: 'Guardar Cambios' });

    await user.click(boton);
    expect(boton).toBeDisabled();
    expect(modal().getByText('Actualizando producto...')).toBeInTheDocument();
    await enviar(boton);
    expect(updateMueble).toHaveBeenCalledTimes(1);

    await envio.resolver(null);
    expect(boton).toBeEnabled();
    expect(modal().getByText('Error al actualizar.')).toBeInTheDocument();
  });

  it('modal de categoría: lo mismo, con su propio mensaje', async () => {
    const envio = pendiente();
    updateCategoria.mockReturnValue(envio.promesa);
    const user = userEvent.setup();
    await renderAdmin({ categorias: CATEGORIAS });
    await irAPestana(user, 'Gestionar Categorías');
    const tarjeta = screen.getByRole('heading', { level: 3, name: 'Mesas' }).closest('.cat-card');
    await user.click(within(tarjeta).getByRole('button', { name: 'Editar' }));
    const boton = modal().getByRole('button', { name: 'Guardar Cambios' });

    await user.click(boton);
    expect(boton).toBeDisabled();
    expect(modal().getByText('Actualizando categoría...')).toBeInTheDocument();
    await enviar(boton);
    expect(updateCategoria).toHaveBeenCalledTimes(1);

    await envio.resolver(null);
    expect(boton).toBeEnabled();
    expect(modal().getByText('Error al actualizar.')).toBeInTheDocument();
  });

  it('el error de "Añadir mueble" no aparece en el modal de edición', async () => {
    createMueble.mockResolvedValue(null);
    const user = userEvent.setup();
    await renderAdmin({ muebles: [PIEZA], categorias: CATEGORIAS });
    await irAPestana(user, 'Añadir Mueble');
    await enviar(screen.getByRole('button', { name: 'Guardar Producto' }));
    expect(screen.getByText('Error al guardar en base de datos.')).toBeInTheDocument();

    await irAPestana(user, 'Gestionar Inventario');
    const fila = screen.getByRole('checkbox', { name: 'Seleccionar Pieza 01' }).closest('.inventory-list-item');
    await user.click(within(fila).getByRole('button', { name: 'Editar' }));

    await waitFor(() => expect(document.querySelector('.admin-modal-content')).not.toBeNull());
    expect(screen.queryByText('Error al guardar en base de datos.')).not.toBeInTheDocument();
    expect(document.querySelector('.admin-modal-content .admin-status')).toBeNull();
  });
});
