import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ReservasTab from './ReservasTab';
import PedidosTab from './PedidosTab';
import { ToastContext } from '../../../context/ToastContext';
import {
  getReservasAdmin,
  entregarReservaAdmin,
  recogerReservaAdmin,
  cancelarReservaAdmin,
  bloquearFechasAdmin
} from '../../../services/api';

vi.mock('../../../services/api', () => ({
  getReservasAdmin: vi.fn(),
  entregarReservaAdmin: vi.fn(),
  recogerReservaAdmin: vi.fn(),
  cancelarReservaAdmin: vi.fn(),
  bloquearFechasAdmin: vi.fn(),
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
    expect(screen.getAllByText('Confirmada').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('150 €').length).toBeGreaterThanOrEqual(1);
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

  it('permite cancelar una reserva confirmada o en_curso abriendo modal de confirmación y reembolsando', async () => {
    getReservasAdmin.mockResolvedValue({
      data: { reservas: [RESERVA_CONFIRMADA] }
    });
    cancelarReservaAdmin.mockResolvedValue({ data: { reserva: { id: 'res-1', estado: 'cancelada' } } });
    const recargarMuebles = vi.fn();

    const { showToast } = renderConToast(<ReservasTab recargarMuebles={recargarMuebles} />);

    // El botón cancelar debe estar presente
    const botonCancelar = await screen.findByRole('button', { name: /cancelar/i });
    expect(botonCancelar).toBeInTheDocument();

    fireEvent.click(botonCancelar);

    // Debe abrirse el modal con el texto de advertencia de Stripe
    expect(
      await screen.findByText(
        '¿Cancelar la reserva? Se intentará reembolsar al cliente el importe total a través de Stripe.'
      )
    ).toBeInTheDocument();

    // Confirmamos la cancelación
    const botonConfirmar = screen.getByRole('button', { name: 'Cancelar reserva' });
    fireEvent.click(botonConfirmar);

    await waitFor(() => {
      expect(cancelarReservaAdmin).toHaveBeenCalledWith(
        'res-1',
        expect.objectContaining({
          motivo: 'Cancelada por el administrador',
          reembolso_centimos: 15000
        })
      );
      expect(showToast).toHaveBeenCalledWith('Reserva cancelada y reembolsada', 'success');
      expect(recargarMuebles).toHaveBeenCalled();
    });
  });

  it('permite abrir el modal de bloqueo, rellenar y enviar llamando a bloquearFechasAdmin y actualizando inventario', async () => {
    getReservasAdmin.mockResolvedValue({
      data: { reservas: [] }
    });
    bloquearFechasAdmin.mockResolvedValue({ data: { id: 'bloq-1', tipo: 'bloqueo' } });
    const recargarMuebles = vi.fn();
    const MUEBLES_MOCK = [
      { id: 'm-1', nombre: 'Mesa Roble', referencia: 'NAV-MES-001' }
    ];

    const { showToast } = renderConToast(<ReservasTab muebles={MUEBLES_MOCK} recargarMuebles={recargarMuebles} />);

    const botonBloquear = await screen.findByRole('button', { name: /bloquear fechas/i });
    fireEvent.click(botonBloquear);

    // Modal abierto
    expect(screen.getByText('🔒 Bloquear fechas manualmente')).toBeInTheDocument();

    // Rellenamos el motivo
    const inputMotivo = screen.getByPlaceholderText(/Exposición, Mantenimiento/i);
    fireEvent.change(inputMotivo, { target: { value: 'Mantenimiento preventivo' } });

    // Enviamos el formulario
    const botonGuardar = screen.getByRole('button', { name: 'Bloquear fechas' });
    fireEvent.click(botonGuardar);

    await waitFor(() => {
      expect(bloquearFechasAdmin).toHaveBeenCalledWith(
        expect.objectContaining({
          mueble_id: 'm-1',
          motivo: 'Mantenimiento preventivo'
        })
      );
      expect(showToast).toHaveBeenCalledWith('Fechas bloqueadas correctamente', 'success');
      expect(recargarMuebles).toHaveBeenCalled();
    });
  });

  it('maneja el error 409 de solape al intentar bloquear fechas', async () => {
    getReservasAdmin.mockResolvedValue({
      data: { reservas: [] }
    });
    bloquearFechasAdmin.mockResolvedValue({
      error: 'Esas fechas chocan con otra reserva activa',
      status: 409
    });
    const MUEBLES_MOCK = [
      { id: 'm-1', nombre: 'Mesa Roble', referencia: 'NAV-MES-001' }
    ];

    const { showToast } = renderConToast(<ReservasTab muebles={MUEBLES_MOCK} />);

    fireEvent.click(await screen.findByRole('button', { name: /bloquear fechas/i }));

    const inputMotivo = screen.getByPlaceholderText(/Exposición, Mantenimiento/i);
    fireEvent.change(inputMotivo, { target: { value: 'Exposición' } });

    fireEvent.click(screen.getByRole('button', { name: 'Bloquear fechas' }));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Esas fechas chocan con otra reserva activa', 'error');
      expect(screen.getByText('Esas fechas chocan con otra reserva activa')).toBeInTheDocument();
    });
  });

  it('permite alternar entre Vista Lista y Vista Calendario', async () => {
    getReservasAdmin.mockResolvedValue({
      data: { reservas: [RESERVA_CONFIRMADA] }
    });

    renderConToast(<ReservasTab />);

    expect(await screen.findByRole('button', { name: /vista calendario/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /vista calendario/i }));

    // Se muestra el selector de mueble de la vista calendario
    expect(await screen.findByLabelText(/mueble a consultar/i)).toBeInTheDocument();
    expect(screen.getByText(/mes anterior/i)).toBeInTheDocument();
    expect(screen.getByText(/mes siguiente/i)).toBeInTheDocument();
  });

  it('permite reembolso parcial en el modal de cancelación enviando los céntimos exactos', async () => {
    getReservasAdmin.mockResolvedValue({
      data: { reservas: [RESERVA_CONFIRMADA] }
    });
    cancelarReservaAdmin.mockResolvedValue({ data: { reserva: { id: 'res-1', estado: 'cancelada' } } });

    renderConToast(<ReservasTab />);

    const botonCancelar = await screen.findByRole('button', { name: /cancelar/i });
    fireEvent.click(botonCancelar);

    // Desmarcar reembolso del 100%
    const checkboxTotal = screen.getByLabelText(/reembolsar el 100%/i);
    expect(checkboxTotal).toBeChecked();
    fireEvent.click(checkboxTotal);
    expect(checkboxTotal).not.toBeChecked();

    // Cambiar importe a 50 euros
    const inputImporte = screen.getByLabelText(/importe a reembolsar/i);
    fireEvent.change(inputImporte, { target: { value: '50' } });

    // Confirmar cancelación
    const botonConfirmar = screen.getByRole('button', { name: 'Cancelar reserva' });
    fireEvent.click(botonConfirmar);

    await waitFor(() => {
      expect(cancelarReservaAdmin).toHaveBeenCalledWith(
        'res-1',
        expect.objectContaining({
          motivo: 'Cancelada por el administrador',
          reembolso_centimos: 5000
        })
      );
    });
  });

  it('muestra el dashboard operativo de almacén con sus 3 KPIs y permite filtrar reservas por texto', async () => {
    getReservasAdmin.mockResolvedValue({
      data: { reservas: [RESERVA_CONFIRMADA, RESERVA_EN_CURSO] }
    });

    renderConToast(<ReservasTab />);

    // Verificar las 3 tarjetas de KPIs
    expect(await screen.findByText('Entregas pendientes hoy')).toBeInTheDocument();
    expect(screen.getByText('Recogidas pendientes hoy')).toBeInTheDocument();
    expect(screen.getByText('Ingresos Activos')).toBeInTheDocument();

    // Filtro por texto
    const inputBusqueda = screen.getByPlaceholderText(/buscar por cliente/i);
    fireEvent.change(inputBusqueda, { target: { value: 'Tolix' } });

    // Debe mostrar la Silla Tolix y ocultar el Espejo vintage
    await waitFor(() => {
      expect(screen.getByText('Silla Tolix')).toBeInTheDocument();
      expect(screen.queryByText('Espejo vintage')).not.toBeInTheDocument();
    });

    // Limpiar filtro
    const botonLimpiar = screen.getByRole('button', { name: /limpiar filtros/i });
    fireEvent.click(botonLimpiar);

    await waitFor(() => {
      expect(screen.getByText('Espejo vintage')).toBeInTheDocument();
      expect(screen.getByText('Silla Tolix')).toBeInTheDocument();
    });
  });

  it('permite alternar a la Vista Master (Gantt) y renderiza las filas de los muebles y las celdas de los días', async () => {
    getReservasAdmin.mockResolvedValue({
      data: { reservas: [RESERVA_CONFIRMADA] }
    });
    const MUEBLES_MOCK = [
      { id: 'm-1', nombre: 'Espejo vintage', referencia: 'NAV-ESP-004' },
      { id: 'm-2', nombre: 'Silla Tolix', referencia: 'NAV-SIL-001' }
    ];

    renderConToast(<ReservasTab muebles={MUEBLES_MOCK} />);

    const botonMaster = await screen.findByRole('button', { name: /vista master/i });
    expect(botonMaster).toBeInTheDocument();
    fireEvent.click(botonMaster);

    // Debe mostrar la cabecera y tabla de la vista master
    expect(await screen.findByText('Ocupación Global de Catálogo')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /calendario global de muebles/i })).toBeInTheDocument();

    // Debe renderizar las filas con los nombres de los muebles
    expect(screen.getAllByText('Espejo vintage').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Silla Tolix')).toBeInTheDocument();

    // Debe renderizar las celdas de los días del mes
    const celdas = document.querySelectorAll('.n5-master-cell');
    expect(celdas.length).toBeGreaterThan(0);
  });

  it('en la Vista Master, al hacer clic en una celda ocupada se abre el inspector lateral de la reserva', async () => {
    getReservasAdmin.mockResolvedValue({
      data: { reservas: [RESERVA_CONFIRMADA] }
    });

    renderConToast(<ReservasTab />);

    fireEvent.click(await screen.findByRole('button', { name: /vista master/i }));

    expect(await screen.findByText('Ocupación Global de Catálogo')).toBeInTheDocument();

    // Navegar al mes de la reserva (noviembre 2026)
    fireEvent.click(screen.getByText(/mes siguiente/i));
    expect(screen.getByText(/noviembre de 2026/i)).toBeInTheDocument();

    // Localizar una celda ocupada (is-booked)
    const celdaOcupada = document.querySelector('.n5-master-cell.is-booked');
    expect(celdaOcupada).toBeInTheDocument();
    fireEvent.click(celdaOcupada);

    // Debe abrir el inspector lateral con los datos y acciones
    expect(
      await screen.findByRole('complementary', { name: /detalle de reserva seleccionada/i })
    ).toBeInTheDocument();
    expect(screen.getByText('Detalle de la Reserva')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Marcar Entregada' })).toBeInTheDocument();
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
