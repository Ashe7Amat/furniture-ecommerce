import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ReservasTab from './ReservasTab';
import PedidosTab from './PedidosTab';
import { ToastContext } from '../../../context/ToastContext';
import { getReservasAdmin, entregarReservaAdmin, recogerReservaAdmin } from '../../../services/api';

vi.mock('../../../services/api', () => ({
  getReservasAdmin: vi.fn(),
  entregarReservaAdmin: vi.fn(),
  recogerReservaAdmin: vi.fn(),
  actualizarEstadoPedido: vi.fn()
}));

const renderConToast = (ui) => {
  const showToast = vi.fn();
  const utils = render(
    <ToastContext.Provider value={{ showToast }}>
      {ui}
    </ToastContext.Provider>
  );
  return { ...utils, showToast };
};

describe('ReservasTab — Estructura básica del Panel de Reservas (R-d)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const RESERVA_CONFIRMADA = {
    id: 'res-1',
    estado: 'confirmada',
    fecha_inicio: '2026-11-03',
    fecha_fin: '2026-11-05',
    importe_total: 150,
    pieza: { nombre: 'Espejo vintage', referencia: 'NAV-ESP-004' },
    contacto: { nombre: 'Ashenafi Amat', email: 'amat@ejemplo.com', telefono: '600123456' }
  };

  const RESERVA_EN_CURSO = {
    id: 'res-2',
    estado: 'en_curso',
    fecha_inicio: '2026-11-01',
    fecha_fin: '2026-11-04',
    importe_total: 80,
    pieza: { nombre: 'Silla Tolix', referencia: 'NAV-SIL-001' },
    contacto: { nombre: 'Carlos Ruiz', email: 'carlos@ejemplo.com', telefono: '611222333' }
  };

  const RESERVA_DEVUELTA = {
    id: 'res-3',
    estado: 'devuelta',
    fecha_inicio: '2026-10-20',
    fecha_fin: '2026-10-23',
    importe_total: 50,
    pieza: { nombre: 'Mesa Bistro', referencia: 'NAV-MES-002' },
    contacto: { nombre: 'Lucía Díaz', email: 'lucia@ejemplo.com', telefono: '622333444' }
  };

  it('muestra las columnas requeridas: Mueble, Cliente, Fechas, Estado, Total y Acción', async () => {
    getReservasAdmin.mockResolvedValue({
      data: { reservas: [RESERVA_CONFIRMADA] }
    });

    renderConToast(<ReservasTab />);

    await waitFor(() => {
      expect(screen.getByText('Mueble')).toBeInTheDocument();
      expect(screen.getByText('Cliente')).toBeInTheDocument();
      expect(screen.getByText('Fechas (Inicio - Fin)')).toBeInTheDocument();
      expect(screen.getByText('Estado')).toBeInTheDocument();
      expect(screen.getByText('Total')).toBeInTheDocument();
      expect(screen.getByText('Acción')).toBeInTheDocument();
    });

    expect(screen.getByText('Espejo vintage')).toBeInTheDocument();
    expect(screen.getByText('Ref. NAV-ESP-004')).toBeInTheDocument();
    expect(screen.getByText('Ashenafi Amat')).toBeInTheDocument();
    expect(screen.getByText('amat@ejemplo.com')).toBeInTheDocument();
    expect(screen.getByText('03/11/2026 - 05/11/2026')).toBeInTheDocument();
    expect(screen.getByText('Confirmada')).toBeInTheDocument();
    expect(screen.getByText('150 €')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Marcar Entregada' })).toBeInTheDocument();
  });

  it('si estado === confirmada muestra "Marcar Entregada" y al pulsar llama a entregarReservaAdmin', async () => {
    getReservasAdmin.mockResolvedValue({
      data: { reservas: [RESERVA_CONFIRMADA] }
    });
    entregarReservaAdmin.mockResolvedValue({ data: { id: 'res-1', estado: 'en_curso' } });

    const { showToast } = renderConToast(<ReservasTab />);

    const botonEntregar = await screen.findByRole('button', { name: 'Marcar Entregada' });
    fireEvent.click(botonEntregar);

    await waitFor(() => {
      expect(entregarReservaAdmin).toHaveBeenCalledWith('res-1');
      expect(showToast).toHaveBeenCalledWith(expect.stringContaining('entregada'), 'success');
      expect(screen.getByRole('button', { name: 'Marcar Recogida' })).toBeInTheDocument();
    });
  });

  it('si estado === en_curso muestra "Marcar Recogida" y al pulsar llama a recogerReservaAdmin', async () => {
    getReservasAdmin.mockResolvedValue({
      data: { reservas: [RESERVA_EN_CURSO] }
    });
    recogerReservaAdmin.mockResolvedValue({ data: { id: 'res-2', estado: 'devuelta' } });

    const { showToast } = renderConToast(<ReservasTab />);

    const botonRecoger = await screen.findByRole('button', { name: 'Marcar Recogida' });
    fireEvent.click(botonRecoger);

    await waitFor(() => {
      expect(recogerReservaAdmin).toHaveBeenCalledWith('res-2');
      expect(showToast).toHaveBeenCalledWith(expect.stringContaining('recogida'), 'success');
      expect(screen.getByRole('button', { name: 'Finalizada' })).toBeInTheDocument();
    });
  });

  it('si estado === devuelta muestra botón deshabilitado "Finalizada"', async () => {
    getReservasAdmin.mockResolvedValue({
      data: { reservas: [RESERVA_DEVUELTA] }
    });

    renderConToast(<ReservasTab />);

    const botonFinalizada = await screen.findByRole('button', { name: 'Finalizada' });
    expect(botonFinalizada).toBeDisabled();
  });
});

describe('PedidosTab — Distintivo visual en alquileres (Tarea 1)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_RESERVAS_ACTIVAS', 'true');
  });

  const PEDIDO_ALQUILER = {
    id: 'a1b2c3d4-1111-4000-8000-000000000001',
    estado: 'procesando',
    created_at: '2026-10-24T12:00:00Z',
    total: 2,
    cliente_info: { nombre: 'Ashenafi Amat', email: 'amat@ejemplo.com' },
    items: [
      { productId: 'm-esp-004', nombre: 'Espejo vintage', modalidad: 'alquiler', precio: 1, cantidad: 2 }
    ]
  };

  const PEDIDO_COMPRA = {
    id: 'b2c3d4e5-2222-4000-8000-000000000002',
    estado: 'procesando',
    created_at: '2026-10-24T12:00:00Z',
    total: 250,
    cliente_info: { nombre: 'María Pérez', email: 'maria@ejemplo.com' },
    items: [
      { productId: 'm-sof-001', nombre: 'Sofá Chester', modalidad: 'compra', precio: 250, cantidad: 1 }
    ]
  };

  it('añade el badge ALQUILER al lado de la referencia y deshabilita el selector con aviso', () => {
    renderConToast(
      <PedidosTab
        pedidos={[PEDIDO_ALQUILER, PEDIDO_COMPRA]}
        setPedidos={vi.fn()}
        infoPedidos={{ total: 2, totalPaginas: 1, pagina: 1 }}
        ajustarTrasCambioDeEstado={vi.fn()}
        filtroEstadoPedido=""
        setFiltroEstadoPedido={vi.fn()}
        cargarPedidos={vi.fn()}
      />
    );

    // Comprobamos el badge ALQUILER en el pedido de alquiler
    expect(screen.getByText('ALQUILER')).toBeInTheDocument();

    // Comprobamos el aviso explicativo
    expect(
      screen.getByText('Este pedido corresponde a un alquiler. Gestiónalo desde la pestaña Reservas.')
    ).toBeInTheDocument();

    // El selector de estado del pedido de alquiler está deshabilitado
    const selectores = screen.getAllByRole('combobox');
    // selectores[0] es el filtro de la barra de herramientas
    expect(selectores[1]).toBeDisabled();
    expect(selectores[1]).toHaveClass('pedido-estado-select--deshabilitado');

    // El pedido de compra no tiene el badge ALQUILER y su selector no está deshabilitado
    expect(selectores[2]).not.toBeDisabled();
  });
});
