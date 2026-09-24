// Tests de CARACTERIZACIÓN del panel (tarea 4, ver docs/tarea4-diseno.md): describen lo que hace
// hoy la pestaña Resumen, aunque algo no guste. Desde el primer commit del refactor no se tocan;
// si uno falla, es que el refactor ha cambiado el comportamiento.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getMuebles, getCategorias, getPedidos } from '../services/api';
import { renderAdmin, barraLateral } from './adminTestUtils';

vi.mock('../services/api');

// Cinco piezas que cubren todos los casos del resumen: con y sin estado, precios como número,
// como texto y a null, sin fotos (lista vacía y null) y sin categoría.
const SILLA = { id: 'm1', nombre: 'Silla Tolix', categoria: 'Sillas', categoria_id: 11, estado: 'disponible', precio_venta: 10000, precio_alquiler_dia: null, imagenes: ['https://img.test/silla.jpg'] };
const MESA = { id: 'm2', nombre: 'Mesa de roble', categoria: 'Mesas', categoria_id: 21, estado: null, precio_venta: '2500', precio_alquiler_dia: null, imagenes: [] };
const LAMPARA = { id: 'm3', nombre: 'Lámpara de pie', categoria: null, categoria_id: 31, estado: 'disponible', precio_venta: null, precio_alquiler_dia: 15, imagenes: null };
const SOFA = { id: 'm4', nombre: 'Sofá chester', categoria: 'Sofás', categoria_id: 12, estado: 'vendido', precio_venta: 900, precio_alquiler_dia: null, imagenes: ['https://img.test/sofa.jpg'] };
const APARADOR = { id: 'm5', nombre: 'Aparador nórdico', categoria: 'Aparadores', categoria_id: 41, estado: 'alquilado', precio_venta: null, precio_alquiler_dia: 40, imagenes: [] };
const CATALOGO = [SILLA, MESA, LAMPARA, SOFA, APARADOR];

const pedido = (id, estado) => ({ id, estado, email: `${id}@cliente.test`, total: 100, created_at: '2026-09-20T10:00:00Z' });

// Cada tarjeta del resumen es un <h3> con la cifra seguido de un <p> con su etiqueta.
const valorDeTarjeta = (etiqueta) =>
  within(screen.getByText(etiqueta, { selector: 'p' }).parentElement).getByRole('heading', { level: 3 });

const seccionUltimasVentas = () => screen.getByRole('heading', { level: 3, name: /Últimas Ventas/ }).parentElement;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Panel — acceso y carga inicial', () => {
  it('sin usuario, enseña "Acceso denegado" y no carga nada', async () => {
    await renderAdmin({ user: null });

    expect(screen.getByText('Acceso denegado. Inicia sesión primero.')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(getMuebles).not.toHaveBeenCalled();
    expect(getCategorias).not.toHaveBeenCalled();
    expect(getPedidos).not.toHaveBeenCalled();
  });

  it('con usuario, carga muebles, categorías y pedidos una sola vez al montar', async () => {
    await renderAdmin({ muebles: CATALOGO });

    expect(getMuebles).toHaveBeenCalledTimes(1);
    expect(getCategorias).toHaveBeenCalledTimes(1);
    expect(getPedidos).toHaveBeenCalledTimes(1);
  });

  it('arranca en el Resumen, con su botón marcado como activo en la barra lateral', async () => {
    await renderAdmin();

    expect(screen.getByRole('heading', { level: 2, name: 'Dashboard' })).toBeInTheDocument();
    expect(barraLateral().getByRole('button', { name: 'Resumen' })).toHaveClass('active');
    expect(barraLateral().getByRole('button', { name: 'Gestionar Inventario' })).not.toHaveClass('active');
  });
});

describe('Resumen — tarjetas', () => {
  it('cuenta el total, y las piezas disponibles, vendidas y alquiladas (una pieza sin estado cuenta como disponible)', async () => {
    await renderAdmin({ muebles: CATALOGO });

    expect(valorDeTarjeta('Total Catálogo')).toHaveTextContent('5');
    expect(valorDeTarjeta('Disponibles')).toHaveTextContent('3');
    expect(valorDeTarjeta('Vendidos')).toHaveTextContent('1');
    expect(valorDeTarjeta('Alquilados')).toHaveTextContent('1');
  });

  it('el valor en stock suma el precio de venta de las disponibles (texto incluido, null como 0) y no el de vendidas o alquiladas', async () => {
    await renderAdmin({ muebles: CATALOGO });

    // 10000 (silla) + "2500" (mesa, sin estado) + null (lámpara) = 12500. El sofá vendido no suma.
    expect(valorDeTarjeta('Valor en stock')).toHaveTextContent('12.500 €');
  });

  it('"Pedidos por procesar" cuenta solo los pedidos en "procesando", y la barra lateral lo repite como insignia', async () => {
    await renderAdmin({
      pedidos: [pedido('p1', 'procesando'), pedido('p2', 'enviado'), pedido('p3', 'procesando'), pedido('p4', 'cancelado')]
    });

    expect(valorDeTarjeta('Pedidos por procesar')).toHaveTextContent('2');
    expect(barraLateral().getByRole('button', { name: /^Pedidos/ })).toHaveTextContent('2');
  });

  it('sin pedidos por procesar, la tarjeta dice 0 y el botón de Pedidos no lleva insignia', async () => {
    await renderAdmin({ pedidos: [pedido('p1', 'entregado')] });

    expect(valorDeTarjeta('Pedidos por procesar')).toHaveTextContent('0');
    expect(barraLateral().getByRole('button', { name: /^Pedidos/ })).toHaveTextContent(/^\s*Pedidos\s*$/);
  });

  it('con el catálogo vacío, todo a cero, sin alertas y con la nota de "sin transacciones"', async () => {
    await renderAdmin({ muebles: [] });

    expect(valorDeTarjeta('Total Catálogo')).toHaveTextContent('0');
    expect(valorDeTarjeta('Disponibles')).toHaveTextContent('0');
    expect(valorDeTarjeta('Valor en stock')).toHaveTextContent('0 €');
    expect(screen.queryByRole('button', { name: 'Ver inventario' })).not.toBeInTheDocument();
    expect(screen.getByText('No se han registrado transacciones aún.')).toBeInTheDocument();
  });
});

describe('Resumen — alertas', () => {
  it('avisa de las piezas sin fotos (lista vacía o null) y sin categoría, en plural y en singular', async () => {
    await renderAdmin({ muebles: CATALOGO });

    // Sin fotos: la mesa ([]), la lámpara (null) y el aparador ([]).
    expect(screen.getByText(/3 productos sin ninguna foto cargada/)).toBeInTheDocument();
    // CARACTERIZACIÓN: la alerta mira el nombre de la categoría (columna `categoria`), no
    // `categoria_id`: la lámpara tiene id pero no nombre y cuenta como "sin categoría". Cambiará a
    // propósito con la migración A5 de la tarea 3 (quitar `categoria`), no con este refactor.
    expect(screen.getByText(/1 producto sin categoría asignada/)).toBeInTheDocument();
  });

  it('usa el singular para una sola pieza sin fotos y el plural para varias sin categoría', async () => {
    await renderAdmin({
      muebles: [
        { ...SILLA, imagenes: [] },
        { ...SOFA, categoria: null },
        { ...MESA, imagenes: ['https://img.test/mesa.jpg'], categoria: '' }
      ]
    });

    expect(screen.getByText(/1 producto sin ninguna foto cargada/)).toBeInTheDocument();
    expect(screen.getByText(/2 productos sin categoría asignada/)).toBeInTheDocument();
  });

  it('si todas las piezas tienen fotos y categoría, no hay alertas', async () => {
    await renderAdmin({ muebles: [SILLA, SOFA] });

    expect(screen.queryByText(/sin ninguna foto cargada/)).not.toBeInTheDocument();
    expect(screen.queryByText(/sin categoría asignada/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver inventario' })).not.toBeInTheDocument();
  });

  it.each([
    ['fotos', 0],
    ['categoría', 1]
  ])('el botón "Ver inventario" de la alerta de %s lleva a Gestionar Inventario', async (_alerta, indice) => {
    const user = userEvent.setup();
    await renderAdmin({ muebles: CATALOGO });

    await user.click(screen.getAllByRole('button', { name: 'Ver inventario' })[indice]);

    expect(screen.getByRole('heading', { level: 2, name: 'Gestionar Inventario' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Dashboard' })).not.toBeInTheDocument();
    expect(barraLateral().getByRole('button', { name: 'Gestionar Inventario' })).toHaveClass('active');
  });
});

describe('Resumen — "Avisos / Últimas Ventas"', () => {
  it('lista solo las piezas vendidas o alquiladas, en el orden en que llegan de la API', async () => {
    await renderAdmin({ muebles: CATALOGO });

    const nombres = within(seccionUltimasVentas()).getAllByRole('heading', { level: 4 }).map(h => h.textContent);
    expect(nombres).toEqual(['Sofá chester', 'Aparador nórdico']);
  });

  it('cada fila enseña categoría, estado y precio: de venta si lo tiene, si no el de alquiler por día', async () => {
    await renderAdmin({ muebles: CATALOGO });
    const seccion = within(seccionUltimasVentas());

    // Depende de la clase .sale-row (HTML congelado por el diseño de la tarea 4, sección 8).
    const filaSofa = within(seccion.getByRole('heading', { level: 4, name: 'Sofá chester' }).closest('.sale-row'));
    expect(filaSofa.getByText('Sofás')).toBeInTheDocument();
    expect(filaSofa.getByText('vendido')).toBeInTheDocument();
    expect(filaSofa.getByText('900 €')).toBeInTheDocument();

    const filaAparador = within(seccion.getByRole('heading', { level: 4, name: 'Aparador nórdico' }).closest('.sale-row'));
    expect(filaAparador.getByText('Aparadores')).toBeInTheDocument();
    expect(filaAparador.getByText('alquilado')).toBeInTheDocument();
    expect(filaAparador.getByText('40 €/día')).toBeInTheDocument();
  });

  it('usa la primera foto de la pieza, o la imagen genérica si no tiene', async () => {
    await renderAdmin({ muebles: CATALOGO });
    const seccion = within(seccionUltimasVentas());

    expect(seccion.getByRole('img', { name: 'Sofá chester' })).toHaveAttribute('src', 'https://img.test/sofa.jpg');
    expect(seccion.getByRole('img', { name: 'Aparador nórdico' })).toHaveAttribute('src', '/img/sin-imagen.svg');
  });

  it('no lee los pedidos: con pedidos pero sin piezas vendidas ni alquiladas, dice que no hay transacciones', async () => {
    // CARACTERIZACIÓN: el título dice "Últimas Ventas", pero el bloque sale del `estado` de los
    // muebles, no de la tabla de pedidos. Nombre engañoso, anotado en el diseño; no se toca aquí.
    await renderAdmin({
      muebles: [SILLA, MESA],
      pedidos: [pedido('p1', 'entregado'), pedido('p2', 'procesando')]
    });

    expect(within(seccionUltimasVentas()).getByText('No se han registrado transacciones aún.')).toBeInTheDocument();
  });
});
