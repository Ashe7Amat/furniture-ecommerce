// Edición rápida de precios y "Asignar precio de alquiler" en "Gestionar Inventario" (21 oct 2026).
// No son tests de caracterización (los Admin.*.test.jsx, congelados desde la tarea 4): describen lo
// nuevo. scripts/mutantes/precios.js los usa para la comprobación por mutación.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getMuebles, updateMueble } from '../../services/api';
import { renderAdmin, irAPestana, CATEGORIAS } from '../adminTestUtils';

vi.mock('../../services/api');

const mueble = (id, nombre, extra = {}) => ({
  id,
  nombre,
  categoria: 'Sillas',
  categoria_id: 11,
  estado: 'disponible',
  precio_venta: 100,
  precio_alquiler_dia: null,
  imagenes: [],
  ...extra
});

const CATALOGO = [
  mueble('m1', 'Silla Tolix', { precio_venta: 1250 }),
  mueble('m2', 'Mesa de roble', { precio_venta: 333, precio_alquiler_dia: 12.5 }),
  mueble('m3', 'Lámpara de pie', { precio_venta: null, precio_alquiler_dia: 40 }),
  mueble('m4', 'Aparador', { precio_venta: null }),
  mueble('m5', 'Banco de iglesia', { precio_venta: 1255 })
];

const abrirInventario = async (muebles = CATALOGO) => {
  const user = userEvent.setup();
  const utils = await renderAdmin({ muebles, categorias: CATEGORIAS });
  await irAPestana(user, 'Gestionar Inventario');
  return { user, ...utils };
};

const casilla = (nombre) => screen.getByRole('checkbox', { name: `Seleccionar ${nombre}` });
const fila = (nombre) => within(casilla(nombre).closest('.inventory-list-item'));
// Los dos precios de una fila: [venta, alquiler].
const celdasPrecio = (nombre) => casilla(nombre).closest('.inventory-list-item').querySelectorAll('.inv-precio');
const modal = () => within(screen.getByRole('dialog', { name: 'Asignar precio de alquiler' }));
const confirmacion = () => within(screen.getByRole('alertdialog', { name: 'Confirmar precio de alquiler' }));
const filaDeLaPrevia = (nombre) => within(modal().getByRole('cell', { name: nombre }).closest('tr'));

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Inventario — los dos precios', () => {
  it('venta y alquiler/día en la columna de precio, con los céntimos si los hay y una raya si falta', async () => {
    await abrirInventario();

    const cabecera = [...document.querySelector('.inventory-head-row').querySelectorAll('span')].map((s) => s.textContent);
    expect(cabecera).toContain('Venta');
    expect(cabecera).toContain('Alquiler/día');
    expect(cabecera.indexOf('Alquiler/día')).toBe(cabecera.indexOf('Venta') + 1);

    const [venta, alquiler] = celdasPrecio('Mesa de roble');
    expect(venta).toHaveTextContent('333€');
    expect(alquiler).toHaveTextContent('12,50€/día');
    const [ventaLampara, alquilerLampara] = celdasPrecio('Lámpara de pie');
    expect(ventaLampara).toHaveTextContent('—');
    expect(alquilerLampara).toHaveTextContent('40€/día');
    expect(celdasPrecio('Silla Tolix')[1]).toHaveTextContent('—');
  });
});

describe('Inventario — edición rápida de precios', () => {
  it('el lápiz abre el campo con el precio; Intro guarda, avisa "Precio guardado" y recarga', async () => {
    updateMueble.mockResolvedValue({ success: true });
    const { user, showToast } = await abrirInventario();

    await user.click(fila('Silla Tolix').getByRole('button', { name: 'Editar precio de venta de Silla Tolix' }));
    const campo = fila('Silla Tolix').getByRole('spinbutton', { name: 'Precio de venta de Silla Tolix' });
    expect(campo).toHaveValue(1250);
    expect(campo).toHaveFocus();

    getMuebles.mockResolvedValue(CATALOGO.map((m) => (m.id === 'm1' ? { ...m, precio_venta: 1300 } : m)));
    await user.clear(campo);
    await user.type(campo, '1300{Enter}');

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Precio guardado', 'success'));
    expect(updateMueble).toHaveBeenCalledTimes(1);
    expect(updateMueble).toHaveBeenCalledWith('m1', { precio_venta: '1300' });
    expect(getMuebles).toHaveBeenCalledTimes(2);
    expect(getMuebles).toHaveBeenLastCalledWith({ fresco: true });
    await waitFor(() => expect(fila('Silla Tolix').queryByRole('spinbutton')).not.toBeInTheDocument());
    expect(fila('Silla Tolix').getByText('1300€')).toBeInTheDocument();
  });

  it('doble clic en el precio de alquiler abre el campo, y salir del campo lo guarda (con céntimos)', async () => {
    updateMueble.mockResolvedValue({ success: true });
    const { user, showToast } = await abrirInventario();

    await user.dblClick(fila('Lámpara de pie').getByText('40€/día'));
    const campo = fila('Lámpara de pie').getByRole('spinbutton', { name: 'Precio de alquiler por día de Lámpara de pie' });
    await user.clear(campo);
    await user.type(campo, '45.5');
    await user.tab();

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Precio guardado', 'success'));
    expect(updateMueble).toHaveBeenCalledWith('m3', { precio_alquiler: '45.5' });
    // Antes de que llegue la recarga (aquí devuelve lo de antes), la celda ya enseña el precio nuevo.
    expect(fila('Lámpara de pie').getByText('45,50€/día')).toBeInTheDocument();
  });

  it('cuando llega la recarga, la celda enseña lo que hay en el servidor', async () => {
    updateMueble.mockResolvedValue({ success: true });
    const { user } = await abrirInventario();

    // Lo guardado es 1300, pero la recarga trae 1350 (p. ej. otra persona lo ha cambiado a la vez).
    getMuebles.mockResolvedValue(CATALOGO.map((m) => (m.id === 'm1' ? { ...m, precio_venta: 1350 } : m)));
    await user.click(fila('Silla Tolix').getByRole('button', { name: 'Editar precio de venta de Silla Tolix' }));
    const campo = fila('Silla Tolix').getByRole('spinbutton');
    await user.clear(campo);
    await user.type(campo, '1300{Enter}');

    await waitFor(() => expect(fila('Silla Tolix').getByText('1350€')).toBeInTheDocument());
  });

  it('Escape cancela: no guarda nada y la celda vuelve a enseñar el precio de antes', async () => {
    const { user, showToast } = await abrirInventario();

    await user.click(fila('Mesa de roble').getByRole('button', { name: 'Editar precio de alquiler por día de Mesa de roble' }));
    const campo = fila('Mesa de roble').getByRole('spinbutton');
    expect(campo).toHaveValue(12.5);
    await user.clear(campo);
    await user.type(campo, '99{Escape}');

    expect(fila('Mesa de roble').queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(fila('Mesa de roble').getByText('12,50€/día')).toBeInTheDocument();
    expect(updateMueble).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
    expect(getMuebles).toHaveBeenCalledTimes(1);
  });

  it('si falla, avisa "Error al guardar", no recarga y deja el precio de antes', async () => {
    updateMueble.mockResolvedValue(null);
    const { user, showToast } = await abrirInventario();

    await user.click(fila('Silla Tolix').getByRole('button', { name: 'Editar precio de venta de Silla Tolix' }));
    const campo = fila('Silla Tolix').getByRole('spinbutton');
    await user.clear(campo);
    await user.type(campo, '900{Enter}');

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Error al guardar', 'error'));
    expect(showToast).not.toHaveBeenCalledWith(expect.anything(), 'success');
    expect(getMuebles).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(fila('Silla Tolix').queryByRole('spinbutton')).not.toBeInTheDocument());
    expect(fila('Silla Tolix').getByText('1250€')).toBeInTheDocument();
  });

  it('mientras guarda, el campo se queda desactivado', async () => {
    let responder;
    updateMueble.mockImplementation(() => new Promise((r) => { responder = r; }));
    const { user } = await abrirInventario();

    await user.click(fila('Silla Tolix').getByRole('button', { name: 'Editar precio de venta de Silla Tolix' }));
    const campo = fila('Silla Tolix').getByRole('spinbutton');
    await user.clear(campo);
    await user.type(campo, '900{Enter}');

    expect(campo).toBeDisabled();
    responder({ success: true });
    await waitFor(() => expect(fila('Silla Tolix').queryByRole('spinbutton')).not.toBeInTheDocument());
  });

  it('vaciar el campo quita el precio (manda null)', async () => {
    updateMueble.mockResolvedValue({ success: true });
    const { user, showToast } = await abrirInventario();

    await user.click(fila('Mesa de roble').getByRole('button', { name: 'Editar precio de alquiler por día de Mesa de roble' }));
    await user.clear(fila('Mesa de roble').getByRole('spinbutton'));
    await user.keyboard('{Enter}');

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Precio guardado', 'success'));
    expect(updateMueble).toHaveBeenCalledWith('m2', { precio_alquiler: null });
    expect(celdasPrecio('Mesa de roble')[1]).toHaveTextContent('—');
  });

  it('sin cambios no manda nada; en una pieza sin precio, el campo sale vacío', async () => {
    const { user } = await abrirInventario();

    await user.click(fila('Silla Tolix').getByRole('button', { name: 'Editar precio de venta de Silla Tolix' }));
    await user.keyboard('{Enter}');
    expect(fila('Silla Tolix').queryByRole('spinbutton')).not.toBeInTheDocument();

    await user.click(fila('Aparador').getByRole('button', { name: 'Editar precio de alquiler por día de Aparador' }));
    expect(fila('Aparador').getByRole('spinbutton')).toHaveValue(null);
    await user.tab();

    expect(fila('Aparador').queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(updateMueble).not.toHaveBeenCalled();
  });

  it('un precio negativo no se guarda: avisa "Precio no válido"', async () => {
    const { user, showToast } = await abrirInventario();

    await user.click(fila('Silla Tolix').getByRole('button', { name: 'Editar precio de venta de Silla Tolix' }));
    const campo = fila('Silla Tolix').getByRole('spinbutton');
    await user.clear(campo);
    await user.type(campo, '-5{Enter}');

    expect(showToast).toHaveBeenCalledWith('Precio no válido', 'error');
    expect(updateMueble).not.toHaveBeenCalled();
    expect(fila('Silla Tolix').getByText('1250€')).toBeInTheDocument();
  });

  it('Intro y después salir del campo guardan una sola vez', async () => {
    updateMueble.mockResolvedValue({ success: true });
    const { user } = await abrirInventario();

    await user.click(fila('Silla Tolix').getByRole('button', { name: 'Editar precio de venta de Silla Tolix' }));
    const campo = fila('Silla Tolix').getByRole('spinbutton');
    await user.clear(campo);
    await user.type(campo, '1400');
    fireEvent.keyDown(campo, { key: 'Enter' });
    fireEvent.blur(campo);

    await waitFor(() => expect(fila('Silla Tolix').queryByRole('spinbutton')).not.toBeInTheDocument());
    expect(updateMueble).toHaveBeenCalledTimes(1);
  });

  it('otras teclas solo escriben en el campo', async () => {
    const { user } = await abrirInventario();

    await user.click(fila('Silla Tolix').getByRole('button', { name: 'Editar precio de venta de Silla Tolix' }));
    const campo = fila('Silla Tolix').getByRole('spinbutton');
    fireEvent.keyDown(campo, { key: 'a' });

    expect(campo).toBeInTheDocument();
    expect(updateMueble).not.toHaveBeenCalled();
  });
});

describe('Inventario — "Asignar precio de alquiler" en lote', () => {
  const abrirModal = async (nombres, muebles = CATALOGO) => {
    const utils = await abrirInventario(muebles);
    for (const nombre of nombres) await utils.user.click(casilla(nombre));
    await utils.user.click(screen.getByRole('button', { name: 'Asignar precio de alquiler' }));
    return utils;
  };

  it('el botón está en la barra de acciones en lote y abre el modal con el número de piezas', async () => {
    const { user } = await abrirInventario();
    expect(screen.queryByRole('button', { name: 'Asignar precio de alquiler' })).not.toBeInTheDocument();

    await user.click(casilla('Silla Tolix'));
    await user.click(screen.getByRole('button', { name: 'Asignar precio de alquiler' }));

    expect(modal().getByText('Precio por día para 1 pieza seleccionada.')).toBeInTheDocument();
    expect(modal().getByRole('radio', { name: 'Precio fijo por día' })).toBeChecked();
  });

  it('con varias, el texto va en plural', async () => {
    await abrirModal(['Silla Tolix', 'Aparador']);

    expect(modal().getByText('Precio por día para 2 piezas seleccionadas.')).toBeInTheDocument();
  });

  it('precio fijo: confirma antes, aplica a cada seleccionada y dice "X de Y piezas actualizadas"', async () => {
    updateMueble.mockResolvedValue({ success: true });
    const { user, showToast } = await abrirModal(['Silla Tolix', 'Aparador']);
    const revisar = modal().getByRole('button', { name: 'Revisar y aplicar' });
    const campo = modal().getByRole('spinbutton', { name: 'Precio por día (€)' });
    expect(revisar).toBeDisabled();
    await user.type(campo, '0');
    expect(revisar).toBeDisabled();

    await user.clear(campo);
    await user.type(campo, '30');
    expect(filaDeLaPrevia('Silla Tolix').getByText('30 €/día')).toBeInTheDocument();
    expect(filaDeLaPrevia('Silla Tolix').getByText('1250 €')).toBeInTheDocument();
    expect(filaDeLaPrevia('Aparador').getByText('30 €/día')).toBeInTheDocument();
    await user.click(revisar);

    expect(confirmacion().getByText('Se va a cambiar el precio de alquiler de 2 piezas. ¿Seguir?')).toBeInTheDocument();
    expect(updateMueble).not.toHaveBeenCalled();
    await user.click(confirmacion().getByRole('button', { name: 'Sí, asignar' }));

    await waitFor(() => expect(modal().getByText('2 de 2 piezas actualizadas')).toBeInTheDocument());
    expect(updateMueble).toHaveBeenCalledTimes(2);
    expect(updateMueble).toHaveBeenCalledWith('m1', { precio_alquiler: '30' });
    expect(updateMueble).toHaveBeenCalledWith('m4', { precio_alquiler: '30' });
    expect(showToast).toHaveBeenCalledWith('2 de 2 piezas actualizadas', 'success');
    expect(getMuebles).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/seleccionad/)).not.toBeInTheDocument();

    await user.click(modal().getByRole('button', { name: 'Volver al inventario' }));
    expect(screen.queryByRole('dialog', { name: 'Asignar precio de alquiler' })).not.toBeInTheDocument();
  });

  it('porcentaje del precio de venta: 10 % por defecto, redondeado a euros enteros', async () => {
    updateMueble.mockResolvedValue({ success: true });
    const { user } = await abrirModal(['Silla Tolix', 'Banco de iglesia']);

    await user.click(modal().getByRole('radio', { name: 'Porcentaje del precio de venta' }));
    expect(modal().getByRole('radio', { name: '10 %' })).toBeChecked();
    expect(modal().getByRole('radio', { name: 'Redondear a euros enteros' })).toBeChecked();
    expect(filaDeLaPrevia('Silla Tolix').getByText('125 €/día')).toBeInTheDocument();
    expect(filaDeLaPrevia('Banco de iglesia').getByText('126 €/día')).toBeInTheDocument(); // 125,50 -> 126

    await user.click(modal().getByRole('button', { name: 'Revisar y aplicar' }));
    await user.click(confirmacion().getByRole('button', { name: 'Sí, asignar' }));

    await waitFor(() => expect(modal().getByText('2 de 2 piezas actualizadas')).toBeInTheDocument());
    expect(updateMueble).toHaveBeenCalledWith('m1', { precio_alquiler: '125' });
    expect(updateMueble).toHaveBeenCalledWith('m5', { precio_alquiler: '126' });
  });

  it('5 % y redondeo a 0,50 €', async () => {
    updateMueble.mockResolvedValue({ success: true });
    const { user } = await abrirModal(['Mesa de roble', 'Banco de iglesia']);

    await user.click(modal().getByRole('radio', { name: 'Porcentaje del precio de venta' }));
    await user.click(modal().getByRole('radio', { name: '5 %' }));
    // 333 × 5 % = 16,65; 1255 × 5 % = 62,75
    expect(filaDeLaPrevia('Mesa de roble').getByText('17 €/día')).toBeInTheDocument();
    expect(filaDeLaPrevia('Banco de iglesia').getByText('63 €/día')).toBeInTheDocument();
    expect(filaDeLaPrevia('Mesa de roble').getByText('12,50 €/día')).toBeInTheDocument(); // el de ahora

    await user.click(modal().getByRole('radio', { name: 'Redondear a 0,50 €' }));
    expect(filaDeLaPrevia('Mesa de roble').getByText('16,50 €/día')).toBeInTheDocument();
    expect(filaDeLaPrevia('Banco de iglesia').getByText('63 €/día')).toBeInTheDocument();

    await user.click(modal().getByRole('button', { name: 'Revisar y aplicar' }));
    await user.click(confirmacion().getByRole('button', { name: 'Sí, asignar' }));

    await waitFor(() => expect(updateMueble).toHaveBeenCalledTimes(2));
    expect(updateMueble).toHaveBeenCalledWith('m2', { precio_alquiler: '16.5' });
    expect(updateMueble).toHaveBeenCalledWith('m5', { precio_alquiler: '63' });
  });

  it('porcentaje personalizado; vacío, 0 o más del 100 % no dejan seguir', async () => {
    updateMueble.mockResolvedValue({ success: true });
    const { user } = await abrirModal(['Silla Tolix']);

    await user.click(modal().getByRole('radio', { name: 'Porcentaje del precio de venta' }));
    await user.click(modal().getByRole('radio', { name: 'Personalizado' }));
    const revisar = modal().getByRole('button', { name: 'Revisar y aplicar' });
    const campo = modal().getByRole('spinbutton', { name: 'Porcentaje personalizado (%)' });
    expect(revisar).toBeDisabled();

    await user.type(campo, '0');
    expect(revisar).toBeDisabled();
    await user.clear(campo);
    await user.type(campo, '101');
    expect(revisar).toBeDisabled();
    await user.clear(campo);
    await user.type(campo, '7.5');
    expect(filaDeLaPrevia('Silla Tolix').getByText('94 €/día')).toBeInTheDocument(); // 93,75 -> 94

    await user.click(revisar);
    await user.click(confirmacion().getByRole('button', { name: 'Sí, asignar' }));
    await waitFor(() => expect(updateMueble).toHaveBeenCalledWith('m1', { precio_alquiler: '94' }));
    expect(modal().getByText('1 de 1 pieza actualizada')).toBeInTheDocument();
  });

  it('una pieza sin precio de venta: la opción de porcentaje sale desactivada', async () => {
    await abrirModal(['Aparador']);

    expect(modal().getByRole('radio', { name: 'Porcentaje del precio de venta' })).toBeDisabled();
    expect(modal().getByText('Esta pieza no tiene precio de venta.')).toBeInTheDocument();
  });

  it('varias, ninguna con precio de venta: también desactivada, en plural', async () => {
    await abrirModal(['Aparador', 'Lámpara de pie']);

    expect(modal().getByRole('radio', { name: 'Porcentaje del precio de venta' })).toBeDisabled();
    expect(modal().getByText('Ninguna de las piezas seleccionadas tiene precio de venta.')).toBeInTheDocument();
  });

  it('si a algunas les falta el precio de venta, se avisa antes y se quedan como están', async () => {
    updateMueble.mockResolvedValue({ success: true });
    const { user, showToast } = await abrirModal(['Silla Tolix', 'Aparador']);

    await user.click(modal().getByRole('radio', { name: 'Porcentaje del precio de venta' }));
    expect(modal().getByText('1 de las 2 piezas no tiene precio de venta: se quedará como está.')).toBeInTheDocument();
    expect(filaDeLaPrevia('Aparador').getByText('Sin cambios')).toBeInTheDocument();

    await user.click(modal().getByRole('button', { name: 'Revisar y aplicar' }));
    expect(
      confirmacion().getByText('Se va a cambiar el precio de alquiler de 1 pieza (la otra se queda como está). ¿Seguir?')
    ).toBeInTheDocument();
    await user.click(confirmacion().getByRole('button', { name: 'Sí, asignar' }));

    await waitFor(() => expect(modal().getByText('1 de 2 piezas actualizadas')).toBeInTheDocument());
    expect(updateMueble).toHaveBeenCalledTimes(1);
    expect(updateMueble).toHaveBeenCalledWith('m1', { precio_alquiler: '125' });
    expect(showToast).toHaveBeenCalledWith('1 de 2 piezas actualizadas', 'success');
  });

  it('con varias sin precio de venta, el aviso va en plural', async () => {
    const { user } = await abrirModal(['Silla Tolix', 'Aparador', 'Lámpara de pie']);

    await user.click(modal().getByRole('radio', { name: 'Porcentaje del precio de venta' }));
    expect(modal().getByText('2 de las 3 piezas no tienen precio de venta: se quedarán como están.')).toBeInTheDocument();
    await user.click(modal().getByRole('button', { name: 'Revisar y aplicar' }));
    expect(
      confirmacion().getByText('Se va a cambiar el precio de alquiler de 1 pieza (las otras 2 se quedan como están). ¿Seguir?')
    ).toBeInTheDocument();
  });

  it('si fallan algunas, lo dice, avisa con error y deja seleccionadas solo las que fallaron', async () => {
    updateMueble.mockImplementation(async (id) => (id === 'm4' ? null : { success: true }));
    const { user, showToast } = await abrirModal(['Silla Tolix', 'Aparador']);

    await user.type(modal().getByRole('spinbutton', { name: 'Precio por día (€)' }), '25');
    await user.click(modal().getByRole('button', { name: 'Revisar y aplicar' }));
    await user.click(confirmacion().getByRole('button', { name: 'Sí, asignar' }));

    await waitFor(() => expect(modal().getByText('1 de 2 piezas actualizadas')).toBeInTheDocument());
    expect(modal().getByText('No se pudo guardar: Aparador. Siguen seleccionadas para reintentarlo.')).toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith('1 de 2 piezas actualizadas', 'error');
    expect(getMuebles).toHaveBeenCalledTimes(2);
    expect(screen.getByText('1 seleccionado')).toBeInTheDocument();
    expect(casilla('Aparador')).toBeChecked();
  });

  it('si fallan todas, no recarga', async () => {
    updateMueble.mockResolvedValue(null);
    const { user, showToast } = await abrirModal(['Silla Tolix']);

    await user.type(modal().getByRole('spinbutton', { name: 'Precio por día (€)' }), '25');
    await user.click(modal().getByRole('button', { name: 'Revisar y aplicar' }));
    await user.click(confirmacion().getByRole('button', { name: 'Sí, asignar' }));

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('0 de 1 pieza actualizada', 'error'));
    expect(getMuebles).toHaveBeenCalledTimes(1);
  });

  it('mientras guarda, "Sí, asignar" dice "Guardando…" y no se puede pulsar otra vez', async () => {
    let responder;
    updateMueble.mockImplementation(() => new Promise((r) => { responder = r; }));
    const { user } = await abrirModal(['Silla Tolix']);

    await user.type(modal().getByRole('spinbutton', { name: 'Precio por día (€)' }), '25');
    await user.click(modal().getByRole('button', { name: 'Revisar y aplicar' }));
    await user.click(confirmacion().getByRole('button', { name: 'Sí, asignar' }));

    expect(confirmacion().getByRole('button', { name: 'Guardando…' })).toBeDisabled();
    expect(confirmacion().getByRole('button', { name: 'Volver' })).toBeDisabled();
    responder({ success: true });
    await waitFor(() => expect(modal().getByText('1 de 1 pieza actualizada')).toBeInTheDocument());
  });

  it('cambiar una opción o "Volver" cierra la confirmación sin aplicar nada', async () => {
    const { user } = await abrirModal(['Silla Tolix']);
    const campo = modal().getByRole('spinbutton', { name: 'Precio por día (€)' });

    await user.type(campo, '25');
    await user.click(modal().getByRole('button', { name: 'Revisar y aplicar' }));
    expect(modal().getByRole('button', { name: 'Revisar y aplicar' })).toBeDisabled();
    await user.type(campo, '0');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(filaDeLaPrevia('Silla Tolix').getByText('250 €/día')).toBeInTheDocument();

    await user.click(modal().getByRole('button', { name: 'Revisar y aplicar' }));
    await user.click(modal().getByRole('radio', { name: 'Porcentaje del precio de venta' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await user.click(modal().getByRole('button', { name: 'Revisar y aplicar' }));
    await user.click(modal().getByRole('radio', { name: 'Precio fijo por día' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(modal().getByRole('spinbutton', { name: 'Precio por día (€)' })).toHaveValue(250);
    await user.click(modal().getByRole('radio', { name: 'Porcentaje del precio de venta' }));

    for (const [opcion, nombre] of [
      ['radio', '5 %'],
      ['radio', 'Redondear a 0,50 €'],
      ['radio', 'Redondear a euros enteros'],
      ['radio', '10 %']
    ]) {
      await user.click(modal().getByRole('button', { name: 'Revisar y aplicar' }));
      await user.click(modal().getByRole(opcion, { name: nombre }));
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    }

    await user.click(modal().getByRole('radio', { name: 'Personalizado' }));
    await user.type(modal().getByRole('spinbutton', { name: 'Porcentaje personalizado (%)' }), '20');
    await user.click(modal().getByRole('button', { name: 'Revisar y aplicar' }));
    await user.type(modal().getByRole('spinbutton', { name: 'Porcentaje personalizado (%)' }), '0');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    await user.clear(modal().getByRole('spinbutton', { name: 'Porcentaje personalizado (%)' }));
    await user.type(modal().getByRole('spinbutton', { name: 'Porcentaje personalizado (%)' }), '20');
    await user.click(modal().getByRole('button', { name: 'Revisar y aplicar' }));
    await user.click(confirmacion().getByRole('button', { name: 'Volver' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(updateMueble).not.toHaveBeenCalled();
  });

  it('"Cancelar" y la cruz cierran el modal sin cambiar nada, y la selección sigue', async () => {
    const { user } = await abrirModal(['Silla Tolix']);

    await user.click(modal().getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog', { name: 'Asignar precio de alquiler' })).not.toBeInTheDocument();
    expect(screen.getByText('1 seleccionado')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Asignar precio de alquiler' }));
    await user.click(modal().getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog', { name: 'Asignar precio de alquiler' })).not.toBeInTheDocument();
    expect(updateMueble).not.toHaveBeenCalled();
  });

  it('un porcentaje que redondeado se queda en 0 no deja seguir', async () => {
    const { user } = await abrirModal(['Silla Tolix'], [mueble('m9', 'Silla Tolix', { precio_venta: 4 })]);

    await user.click(modal().getByRole('radio', { name: 'Porcentaje del precio de venta' }));
    await user.click(modal().getByRole('radio', { name: '5 %' }));

    expect(filaDeLaPrevia('Silla Tolix').getByText('Sin cambios')).toBeInTheDocument();
    expect(modal().getByRole('button', { name: 'Revisar y aplicar' })).toBeDisabled();
  });
});
