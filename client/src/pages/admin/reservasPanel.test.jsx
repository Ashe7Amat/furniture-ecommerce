// La pestaña "Reservas" dentro del panel (Admin.jsx), detrás del interruptor VITE_RESERVAS_ACTIVAS
// (docs/reservas-diseno.md, 9.1). No son tests de caracterización: describen lo nuevo. Con el
// interruptor apagado, el panel es exactamente el de antes (lo fijan también los Admin.*.test.jsx).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getReservasAdmin, getResumenReservasAdmin } from '../../services/api';
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

    // CAMBIADO A PROPÓSITO: pestaña nueva "Portada" junto a Resumen.
    expect(botonesBarra()).toEqual([
      'Resumen',
      'Portada',
      'Añadir Mueble',
      'Gestionar Inventario',
      'Pedidos',
      'Mensajes',
      'Gestionar Categorías',
      'Actividad'
    ]);
    expect(getReservasAdmin).not.toHaveBeenCalled();
    expect(getResumenReservasAdmin).not.toHaveBeenCalled();
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
    // CAMBIADO A PROPÓSITO: pestaña nueva "Portada" junto a Resumen.
    expect(botonesBarra()).toEqual([
      'Resumen',
      'Portada',
      'Añadir Mueble',
      'Gestionar Inventario',
      'Pedidos',
      'Reservas',
      'Mensajes',
      'Gestionar Categorías',
      'Actividad'
    ]);
    expect(getReservasAdmin).not.toHaveBeenCalled();
  });


  it('al pulsarla se abre (y queda marcada), pide las reservas y las altas usan el inventario del panel', async () => {
    const user = userEvent.setup();
    await renderAdmin({ muebles: MUEBLES, categorias: CATEGORIAS });
    await irAPestana(user, 'Reservas');

    expect(screen.getByRole('heading', { level: 2, name: 'Gestión de Reservas' })).toBeInTheDocument();
    expect(barraLateral().getByRole('button', { name: 'Reservas' })).toHaveClass('active');
    expect(getReservasAdmin).toHaveBeenCalled();
    expect(await screen.findByText('Todavía no se ha registrado ninguna reserva.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Bloquear fechas/i }));
    const select = screen.getByLabelText(/Mueble/i);
    expect([...select.options].map((o) => o.textContent.trim())).toEqual([
      'Selecciona un mueble…',
      'Silla Tolix (NAV-SIL-001)'
    ]);
  });

  it('las demás pestañas siguen funcionando igual', async () => {
    const user = userEvent.setup();
    await renderAdmin({ muebles: MUEBLES, categorias: CATEGORIAS });
    await irAPestana(user, 'Reservas');
    await irAPestana(user, /^Pedidos/);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Pedidos');
    expect(screen.queryByRole('heading', { level: 2, name: 'Gestión de Reservas' })).toBeNull();
  });
});

// La insignia de «Reservas» (20 oct 2026): cuántas reservas piden atención, como la de «Pedidos».
describe('Panel — insignia de «Reservas»', () => {
  const RESUMEN = { hoy: '2026-10-20', total: 3, retrasadas: 2, en_conflicto: 1, reembolsos_a_medias: 0 };
  const insignia = () => barraLateral().getByRole('button', { name: /^Reservas/ }).querySelector('.sidebar-badge');

  beforeEach(() => {
    vi.stubEnv('VITE_RESERVAS_ACTIVAS', 'true');
    getResumenReservasAdmin.mockResolvedValue({ data: RESUMEN, error: null, status: 200 });
  });

  it('con avisos, el número sale junto a «Reservas», con el detalle al pasar el ratón', async () => {
    await renderAdmin({ muebles: MUEBLES, categorias: CATEGORIAS });

    expect(getResumenReservasAdmin).toHaveBeenCalled();
    expect(insignia()).toHaveTextContent('3');
    expect(insignia()).toHaveAttribute('title', '2 retrasadas, 1 sin confirmar');
  });

  it('sin avisos no hay insignia', async () => {
    getResumenReservasAdmin.mockResolvedValue({
      data: { ...RESUMEN, total: 0, retrasadas: 0, en_conflicto: 0 },
      error: null,
      status: 200
    });
    await renderAdmin({ muebles: MUEBLES, categorias: CATEGORIAS });

    expect(insignia()).toBeNull();
  });

  it('si no se pueden leer, tampoco hay insignia: ni un 0 ni un error en el menú', async () => {
    getResumenReservasAdmin.mockResolvedValue({ data: null, error: 'Sin conexión.', status: 0 });
    await renderAdmin({ muebles: MUEBLES, categorias: CATEGORIAS });

    expect(insignia()).toBeNull();
  });

  it('dentro de la pestaña, la sección de almacén está presente y el botón actualizar refresca', async () => {
    const user = userEvent.setup();
    await renderAdmin({ muebles: MUEBLES, categorias: CATEGORIAS });
    await irAPestana(user, /^Reservas/);

    expect(screen.getByRole('region', { name: 'Hoy en el almacén' })).toBeInTheDocument();
    const lecturas = getReservasAdmin.mock.calls.length;

    await user.click(screen.getByRole('button', { name: 'Actualizar' }));

    expect(getReservasAdmin.mock.calls.length).toBeGreaterThan(lecturas);
  });
});
