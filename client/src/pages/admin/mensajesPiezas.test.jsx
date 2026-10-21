// Mensajes conectados con el inventario (21 oct 2026): si un mensaje nombra piezas por su referencia
// («(ref. NAV-SIL-001)», ver utils/preguntarPorPieza.js), el mensaje abierto enseña una tarjeta por
// pieza. No son tests de caracterización (los Admin.*.test.jsx, congelados): describen lo nuevo.
// scripts/mutantes/mensajes-piezas.js los usa para la comprobación por mutación.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getMensajes, crearEnCalendarioAdmin } from '../../services/api';
import { renderAdmin, irAPestana, CATEGORIAS } from '../adminTestUtils';
import { referenciasEn, piezasDelMensaje, textoEstado } from './mensajes';

vi.mock('../../services/api');

const SILLA = {
  id: 'm1',
  nombre: 'Silla Thonet',
  categoria: 'Sillas',
  estado: 'disponible',
  imagenes: ['https://img.test/silla-1.jpg', 'https://img.test/silla-2.jpg'],
  referencia: 'NAV-SIL-001',
  descripcion: 'Madera curvada.'
};
const APARADOR = {
  id: 'm2',
  nombre: 'Aparador de roble',
  categoria: 'Mesas',
  estado: 'vendido',
  imagenes: [],
  referencia: 'NAV-MES-004',
  descripcion: 'Roble macizo.'
};
const LAMPARA = { id: 'm3', nombre: 'Lámpara de pie', estado: 'alquilado', imagenes: [], referencia: 'NAV-ILU-002' };
// Una pieza antigua sin estado: cuenta como disponible, como en el inventario.
const BAUL = { id: 'm4', nombre: 'Baúl de viaje', imagenes: [], referencia: 'NAV-DEC-007' };
const MUEBLES = [SILLA, APARADOR, LAMPARA, BAUL];

const mensaje = (id, texto, extra = {}) => ({
  id,
  nombre: 'Marta Ruiz',
  email: 'marta@example.com',
  mensaje: texto,
  leido: true,
  created_at: '2026-10-20T09:00:00Z',
  ...extra
});
const UNA = mensaje('c1', 'Hola, me interesa la pieza "Silla Thonet" (ref. NAV-SIL-001). ¿Me podéis dar más información?');
const DOS = mensaje('c2', 'Queremos la NAV-SIL-001 y también la NAV-MES-004 para un rodaje. Otra vez: NAV-SIL-001.');
const NINGUNA = mensaje('c3', 'Hola, ¿abrís los sábados?');
const INEXISTENTE = mensaje('c4', 'Me interesa la pieza (ref. NAV-SIL-999).');

const abrirMensaje = async (m, muebles = MUEBLES) => {
  const user = userEvent.setup();
  getMensajes.mockResolvedValue([m]);
  const datos = await renderAdmin({ muebles, categorias: CATEGORIAS });
  await irAPestana(user, /^Mensajes/);
  await user.click(screen.getByRole('button', { name: m.nombre }));
  return { ...datos, user };
};
const modal = () => within(screen.getByRole('dialog', { name: /^Mensaje de/ }));
const tarjetas = () => modal().queryAllByRole('listitem');

beforeEach(() => {
  vi.resetAllMocks();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Mensajes con piezas — ayudantes', () => {
  it('referenciasEn: las referencias del texto, sin repetir y en orden', () => {
    expect(referenciasEn(DOS.mensaje)).toEqual(['NAV-SIL-001', 'NAV-MES-004']);
    expect(referenciasEn('sin nada')).toEqual([]);
    expect(referenciasEn(null)).toEqual([]);
    // Solo el formato de la web: tres letras mayúsculas y tres cifras.
    expect(referenciasEn('nav-sil-001 NAV-SI-001 NAV-SIL-01 NAV-SIL-0012')).toEqual(['NAV-SIL-001']);
  });

  it('piezasDelMensaje: cada referencia con su pieza, o null si no está en el inventario', () => {
    expect(piezasDelMensaje(INEXISTENTE, MUEBLES)).toEqual({ porReferencia: [{ referencia: 'NAV-SIL-999', mueble: null }], porNombre: [] });
    // El mensaje nombra la Silla Thonet por su referencia y por su nombre: sale una vez, por referencia.
    expect(piezasDelMensaje(UNA, MUEBLES)).toEqual({ porReferencia: [{ referencia: 'NAV-SIL-001', mueble: SILLA }], porNombre: [] });
  });

  it('textoEstado: los tres estados, y sin estado cuenta como disponible', () => {
    expect(textoEstado('disponible')).toBe('Disponible');
    expect(textoEstado('vendido')).toBe('Vendido');
    expect(textoEstado('alquilado')).toBe('Alquilado');
    expect(textoEstado(undefined)).toBe('Disponible');
    expect(textoEstado('otro')).toBe('otro');
  });
});

describe('Mensajes con piezas — tarjetas', () => {
  it('un mensaje con una referencia enseña su tarjeta: foto, nombre, referencia y estado', async () => {
    await abrirMensaje(UNA);

    expect(modal().getByRole('heading', { level: 4, name: 'Pieza del mensaje' })).toBeInTheDocument();
    expect(tarjetas()).toHaveLength(1);
    const tarjeta = within(tarjetas()[0]);
    expect(tarjeta.getByText('Silla Thonet')).toBeInTheDocument();
    expect(tarjeta.getByText('NAV-SIL-001')).toBeInTheDocument();
    const estado = tarjeta.getByText('Disponible');
    expect(estado).toHaveClass('status-pill', 'disponible');
    // La primera foto, en miniatura.
    const foto = tarjetas()[0].querySelector('img');
    expect(foto).toHaveAttribute('src', 'https://img.test/silla-1.jpg');
    expect(foto).toHaveAttribute('width', '60');
    expect(foto).toHaveAttribute('height', '60');
  });

  it('dos referencias distintas, dos tarjetas (una repetida no cuenta dos veces)', async () => {
    await abrirMensaje(DOS);

    expect(modal().getByRole('heading', { level: 4, name: 'Piezas del mensaje' })).toBeInTheDocument();
    expect(tarjetas()).toHaveLength(2);
    expect(within(tarjetas()[0]).getByText('Silla Thonet')).toBeInTheDocument();
    expect(within(tarjetas()[1]).getByText('Aparador de roble')).toBeInTheDocument();
    expect(within(tarjetas()[1]).getByText('Vendido')).toHaveClass('status-pill', 'vendido');
    // Sin fotos, un hueco en su lugar.
    expect(tarjetas()[1].querySelector('img')).toBeNull();
    expect(tarjetas()[1].querySelector('.mensaje-pieza-foto.sin-foto')).not.toBeNull();
  });

  it('una pieza alquilada lleva su insignia', async () => {
    await abrirMensaje(mensaje('c5', 'Sobre la NAV-ILU-002'));

    expect(within(tarjetas()[0]).getByText('Alquilado')).toHaveClass('status-pill', 'alquilado');
  });

  it('una pieza sin estado sale como disponible', async () => {
    await abrirMensaje(mensaje('c6', 'Sobre la NAV-DEC-007'));

    expect(within(tarjetas()[0]).getByText('Disponible')).toHaveClass('status-pill', 'disponible');
  });

  it('sin referencias no hay tarjetas, y el mensaje funciona como antes', async () => {
    await abrirMensaje(NINGUNA);

    expect(modal().getByText('Hola, ¿abrís los sábados?')).toBeInTheDocument();
    expect(modal().queryByRole('region', { name: 'Piezas del mensaje' })).not.toBeInTheDocument();
    expect(tarjetas()).toHaveLength(0);
    expect(modal().getByRole('button', { name: 'Volver a la lista' })).toBeInTheDocument();
  });

  it('una referencia que no está en el inventario dice «Pieza no encontrada», sin botones', async () => {
    await abrirMensaje(INEXISTENTE);

    expect(tarjetas()).toHaveLength(1);
    expect(tarjetas()[0]).toHaveTextContent('Pieza no encontrada (NAV-SIL-999)');
    expect(within(tarjetas()[0]).queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('Mensajes con piezas — botones', () => {
  it('«Ver/Editar pieza» cierra el mensaje y abre el editor de esa pieza', async () => {
    const { user } = await abrirMensaje(DOS);

    await user.click(within(tarjetas()[1]).getByRole('button', { name: 'Ver/Editar pieza' }));

    const editor = within(screen.getByRole('heading', { level: 3, name: 'Editar Producto' }).closest('.admin-modal-content'));
    expect(editor.getByDisplayValue('Aparador de roble')).toBeInTheDocument();
    expect(editor.getByDisplayValue('NAV-MES-004')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /^Mensaje de/ })).not.toBeInTheDocument();
  });

  it('con las reservas apagadas no hay «Crear reserva»', async () => {
    vi.stubEnv('VITE_RESERVAS_ACTIVAS', 'false');
    await abrirMensaje(UNA);

    expect(within(tarjetas()[0]).getByRole('button', { name: 'Ver/Editar pieza' })).toBeInTheDocument();
    expect(modal().queryByRole('button', { name: 'Crear reserva' })).not.toBeInTheDocument();
  });

  it('con las reservas encendidas, «Crear reserva» abre el alta de alquiler con la pieza, el nombre y el email', async () => {
    vi.stubEnv('VITE_RESERVAS_ACTIVAS', 'true');
    const { user } = await abrirMensaje(DOS);

    await user.click(within(tarjetas()[1]).getByRole('button', { name: 'Crear reserva' }));

    const alta = within(screen.getByRole('dialog', { name: 'Registrar alquiler fuera de la web' }));
    expect(alta.getByRole('combobox', { name: 'Pieza' })).toHaveValue('m2');
    expect(alta.getByRole('textbox', { name: 'Nombre del cliente' })).toHaveValue('Marta Ruiz');
    expect(alta.getByRole('textbox', { name: 'Email' })).toHaveValue('marta@example.com');
    expect(screen.queryByRole('dialog', { name: /^Mensaje de/ })).not.toBeInTheDocument();
  });

  it('el alta se guarda como un alquiler del calendario y avisa', async () => {
    vi.stubEnv('VITE_RESERVAS_ACTIVAS', 'true');
    crearEnCalendarioAdmin.mockResolvedValue({ data: { reserva: { id: 'r1' } }, error: null, status: 201 });
    const { user, showToast } = await abrirMensaje(UNA);

    await user.click(within(tarjetas()[0]).getByRole('button', { name: 'Crear reserva' }));
    const alta = within(screen.getByRole('dialog', { name: 'Registrar alquiler fuera de la web' }));
    await user.type(alta.getByLabelText('Día de recogida'), '2099-01-10');
    await user.selectOptions(alta.getByRole('combobox', { name: 'Entrega' }), 'tienda');
    await user.selectOptions(alta.getByRole('combobox', { name: 'Recogida' }), 'tienda');
    await user.click(alta.getByRole('button', { name: 'Registrar alquiler' }));

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Alquiler registrado', 'success'));
    expect(crearEnCalendarioAdmin).toHaveBeenCalledTimes(1);
    const [tipo, datos] = crearEnCalendarioAdmin.mock.calls[0];
    expect(tipo).toBe('alquiler');
    expect(datos).toMatchObject({
      mueble_id: 'm1',
      fecha_fin: '2099-01-10',
      contacto: { nombre: 'Marta Ruiz', email: 'marta@example.com' }
    });
    expect(screen.queryByRole('dialog', { name: 'Registrar alquiler fuera de la web' })).not.toBeInTheDocument();
  });

  it('si el servidor rechaza el alta, su motivo sale en el diálogo y se puede cerrar', async () => {
    vi.stubEnv('VITE_RESERVAS_ACTIVAS', 'true');
    crearEnCalendarioAdmin.mockResolvedValue({ data: null, error: 'La pieza ya está reservada esas fechas.', status: 409 });
    const { user, showToast } = await abrirMensaje(UNA);

    await user.click(within(tarjetas()[0]).getByRole('button', { name: 'Crear reserva' }));
    const alta = within(screen.getByRole('dialog', { name: 'Registrar alquiler fuera de la web' }));
    await user.type(alta.getByLabelText('Día de recogida'), '2099-01-10');
    await user.selectOptions(alta.getByRole('combobox', { name: 'Entrega' }), 'tienda');
    await user.selectOptions(alta.getByRole('combobox', { name: 'Recogida' }), 'tienda');
    await user.click(alta.getByRole('button', { name: 'Registrar alquiler' }));

    expect(await alta.findByRole('alert')).toHaveTextContent('La pieza ya está reservada esas fechas.');
    expect(showToast).not.toHaveBeenCalledWith(expect.anything(), 'success');

    await user.click(alta.getByRole('button', { name: 'Volver' }));
    expect(screen.queryByRole('dialog', { name: 'Registrar alquiler fuera de la web' })).not.toBeInTheDocument();
  });

  it('un segundo envío mientras se guarda no registra otro alquiler', async () => {
    vi.stubEnv('VITE_RESERVAS_ACTIVAS', 'true');
    let responder;
    crearEnCalendarioAdmin.mockImplementation(() => new Promise((r) => { responder = r; }));
    const { user, showToast } = await abrirMensaje(UNA);

    await user.click(within(tarjetas()[0]).getByRole('button', { name: 'Crear reserva' }));
    const alta = within(screen.getByRole('dialog', { name: 'Registrar alquiler fuera de la web' }));
    await user.type(alta.getByLabelText('Día de recogida'), '2099-01-10');
    await user.selectOptions(alta.getByRole('combobox', { name: 'Entrega' }), 'tienda');
    await user.selectOptions(alta.getByRole('combobox', { name: 'Recogida' }), 'tienda');
    const formulario = alta.getByRole('button', { name: 'Registrar alquiler' }).closest('form');
    await user.click(alta.getByRole('button', { name: 'Registrar alquiler' }));
    act(() => formulario.requestSubmit());
    await act(async () => responder({ data: {}, error: null, status: 201 }));

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Alquiler registrado', 'success'));
    expect(crearEnCalendarioAdmin).toHaveBeenCalledTimes(1);
  });
});
