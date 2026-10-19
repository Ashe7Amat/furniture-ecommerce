// La pestaña "Reservas" dentro del panel (Admin.jsx), detrás del interruptor VITE_RESERVAS_ACTIVAS
// (docs/reservas-diseno.md, 9.1). No son tests de caracterización: describen lo nuevo. Con el
// interruptor apagado, el panel es exactamente el de antes (lo fijan también los Admin.*.test.jsx).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getReservasAdmin } from '../../services/api';
import { renderAdmin, irAPestana, barraLateral, CATEGORIAS } from '../adminTestUtils';

vi.mock('../../services/api');

const MUEBLES = [
  {
    id: 'm1',
    nombre: 'Silla Tolix',
    categoria: 'Sillas',
    descripcion: 'Metal',
    precio_venta: 120,
    precio_alquiler_dia: null,
    imagenes: [],
    estado: 'disponible',
    referencia: 'NAV-SIL-001'
  }
];

beforeEach(() => {
  vi.resetAllMocks();
  getReservasAdmin.mockResolvedValue({ data: { hoy: '2026-10-13', reservas: [] }, error: null, status: 200 });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const botonesBarra = () => barraLateral().getAllByRole('button').map((b) => b.textContent.trim());

describe('Panel — pestaña "Reservas" con el interruptor apagado', () => {
  it('la barra lateral es la de siempre y no se pide ninguna reserva', async () => {
    vi.stubEnv('VITE_RESERVAS_ACTIVAS', 'false');
    await renderAdmin({ muebles: MUEBLES, categorias: CATEGORIAS });

    expect(botonesBarra()).toEqual(['Resumen', 'Añadir Mueble', 'Gestionar Inventario', 'Pedidos', 'Mensajes', 'Gestionar Categorías']);
    expect(getReservasAdmin).not.toHaveBeenCalled();
  });

  it('sin la variable, igual', async () => {
    vi.stubEnv('VITE_RESERVAS_ACTIVAS', undefined);
    await renderAdmin({ muebles: MUEBLES, categorias: CATEGORIAS });
    expect(barraLateral().queryByRole('button', { name: 'Reservas' })).toBeNull();
    expect(getReservasAdmin).not.toHaveBeenCalled();
  });
});

describe('Panel — pestaña "Reservas" con el interruptor encendido', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_RESERVAS_ACTIVAS', 'true');
  });

  it('sale después de "Pedidos", y hasta abrirla no se pide nada', async () => {
    await renderAdmin({ muebles: MUEBLES, categorias: CATEGORIAS });
    expect(botonesBarra()).toEqual([
      'Resumen', 'Añadir Mueble', 'Gestionar Inventario', 'Pedidos', 'Reservas', 'Mensajes', 'Gestionar Categorías'
    ]);
    expect(getReservasAdmin).not.toHaveBeenCalled();
  });

  it('al pulsarla se abre (y queda marcada), pide las próximas y las altas usan el inventario del panel', async () => {
    const user = userEvent.setup();
    await renderAdmin({ muebles: MUEBLES, categorias: CATEGORIAS });
    await irAPestana(user, 'Reservas');

    expect(screen.getByRole('heading', { level: 2, name: 'Reservas' })).toBeInTheDocument();
    expect(barraLateral().getByRole('button', { name: 'Reservas' })).toHaveClass('active');
    expect(getReservasAdmin).toHaveBeenCalledWith({ vista: 'proximas' });
    expect(await screen.findByText('No hay reservas próximas.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Bloquear fechas' }));
    const pieza = within(screen.getByRole('dialog')).getByLabelText('Pieza');
    expect([...pieza.options].map((o) => o.textContent)).toEqual(['Elige una pieza', 'Silla Tolix (NAV-SIL-001)']);
  });

  it('las demás pestañas siguen funcionando igual', async () => {
    const user = userEvent.setup();
    await renderAdmin({ muebles: MUEBLES, categorias: CATEGORIAS });
    await irAPestana(user, 'Reservas');
    await irAPestana(user, /^Pedidos/);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Pedidos');
    expect(screen.queryByRole('heading', { level: 2, name: 'Reservas' })).toBeNull();
  });
});
