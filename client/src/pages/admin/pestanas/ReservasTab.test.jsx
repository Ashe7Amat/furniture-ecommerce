import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ReservasTab from './ReservasTab';
import { ToastContext } from '../../../context/ToastContext';
import {
  getReservasAdmin,
  entregarReservaAdmin,
  recogerReservaAdmin,
  cancelarReservaAdmin,
  bloquearFechasAdmin
} from '../../../services/api';
import { BRAND } from '../../../theme/brand.config';

vi.mock('../../../services/api', () => ({
  getReservasAdmin: vi.fn(),
  entregarReservaAdmin: vi.fn(),
  recogerReservaAdmin: vi.fn(),
  cancelarReservaAdmin: vi.fn(),
  bloquearFechasAdmin: vi.fn()
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

describe('ReservasTab — Panel Rediseñado de Reservas (Editorial, KPIs, 3 Vistas)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const HOY_MADRID = new Date().toISOString().slice(0, 10);

  const RESERVA_CONFIRMADA = {
    id: 'res-1',
    estado: 'confirmada',
    fecha_inicio: HOY_MADRID,
    fecha_fin: '2026-11-05',
    importe_total: 150,
    pieza: { nombre: 'Espejo vintage', referencia: 'NAV-ESP-004' },
    contacto: { nombre: 'Ashenafi Amat', email: 'amat@ejemplo.com', telefono: '600123456' }
  };

  const RESERVA_EN_CURSO = {
    id: 'res-2',
    estado: 'en_curso',
    fecha_inicio: '2026-11-01',
    fecha_fin: HOY_MADRID,
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

  const RESERVA_CANCELACION_SOLICITADA = {
    id: 'res-4',
    estado: 'confirmada',
    cancelacion_solicitada: true,
    cancelacion_solicitada_motivo: 'Cambio de planes en el evento',
    fecha_inicio: '2026-11-10',
    fecha_fin: '2026-11-12',
    importe_total: 120,
    pieza: { nombre: 'Lámpara Fase', referencia: 'NAV-ILU-003' },
    contacto: { nombre: 'Elena Gómez', email: 'elena@ejemplo.com', telefono: '633444555' }
  };

  /* -------------------------------------------------------------------------- */
  /* 1. ESTRUCTURA GENERAL Y KPIS                                               */
  /* -------------------------------------------------------------------------- */
  describe('Estructura general y KPIs ("Hoy en el almacén")', () => {
    it('renderiza la cabecera editorial con el título y las 3 tarjetas de KPIs', async () => {
      getReservasAdmin.mockResolvedValue({
        data: { reservas: [RESERVA_CONFIRMADA, RESERVA_EN_CURSO] }
      });

      renderConToast(<ReservasTab />);

      expect(await screen.findByRole('heading', { level: 2, name: 'Gestión de Reservas' })).toBeInTheDocument();
      expect(screen.getByText(`${BRAND.nombre} · Operaciones`)).toBeInTheDocument();

      // Las 3 tarjetas de KPIs
      expect(screen.getByRole('region', { name: 'Hoy en el almacén' })).toBeInTheDocument();
      expect(screen.getByText('Entregas pendientes hoy')).toBeInTheDocument();
      expect(screen.getByText('Recogidas pendientes hoy')).toBeInTheDocument();
      expect(screen.getByText('Ingresos Activos')).toBeInTheDocument();
    });

    it('calcula las métricas operativas correctamente basadas en las fechas de hoy', async () => {
      getReservasAdmin.mockResolvedValue({
        data: { reservas: [RESERVA_CONFIRMADA, RESERVA_EN_CURSO, RESERVA_DEVUELTA] }
      });

      renderConToast(<ReservasTab />);

      // RESERVA_CONFIRMADA inicia hoy -> entregas = 1
      // RESERVA_EN_CURSO finaliza hoy -> recogidas = 1
      // Activas: 150 + 80 = 230 €
      await waitFor(() => {
        expect(screen.getByText('150 €')).toBeInTheDocument();
      });
      expect(screen.getByText('230 €')).toBeInTheDocument();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 2. TOGGLE DE 3 VISTAS                                                      */
  /* -------------------------------------------------------------------------- */
  describe('Toggle de 3 vistas (Lista / Calendario / Master)', () => {
    it('renderiza los tres botones de toggle y permite cambiar de vista', async () => {
      getReservasAdmin.mockResolvedValue({
        data: { reservas: [RESERVA_CONFIRMADA] }
      });

      renderConToast(<ReservasTab />);

      const btnLista = await screen.findByRole('button', { name: /vista lista/i });
      const btnCalendario = screen.getByRole('button', { name: /vista calendario/i });
      const btnMaster = screen.getByRole('button', { name: /vista master/i });

      expect(btnLista).toHaveClass('is-active');
      expect(btnCalendario).not.toHaveClass('is-active');
      expect(btnMaster).not.toHaveClass('is-active');

      // Cambiar a Vista Calendario
      fireEvent.click(btnCalendario);
      expect(btnCalendario).toHaveClass('is-active');
      expect(screen.getByLabelText(/mueble a consultar/i)).toBeInTheDocument();

      // Cambiar a Vista Master
      fireEvent.click(btnMaster);
      expect(btnMaster).toHaveClass('is-active');
      expect(screen.getByText('Ocupación Global de Catálogo')).toBeInTheDocument();

      // Volver a Lista
      fireEvent.click(btnLista);
      expect(btnLista).toHaveClass('is-active');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 3. TABLA DE RESERVAS (VISTA LISTA)                                         */
  /* -------------------------------------------------------------------------- */
  describe('Tabla de Reservas (Vista Lista)', () => {
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
      expect(screen.getByRole('button', { name: 'Marcar Entregada' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '✕ Cancelar' })).toBeInTheDocument();
    });

    it('muestra el badge de cancelación solicitada y su motivo si está presente', async () => {
      getReservasAdmin.mockResolvedValue({
        data: { reservas: [RESERVA_CANCELACION_SOLICITADA] }
      });

      renderConToast(<ReservasTab />);

      expect(await screen.findByText(/cancelación solicitada/i)).toBeInTheDocument();
      expect(screen.getByText(/Cambio de planes en el evento/i)).toBeInTheDocument();
    });

    it('muestra mensaje vacío amigable cuando no hay reservas', async () => {
      getReservasAdmin.mockResolvedValue({
        data: { reservas: [] }
      });

      renderConToast(<ReservasTab />);

      expect(await screen.findByText('Todavía no se ha registrado ninguna reserva.')).toBeInTheDocument();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 4. BUSCADOR Y FILTROS                                                      */
  /* -------------------------------------------------------------------------- */
  describe('Buscador y Filtros', () => {
    it('el buscador filtra por nombre de cliente y por referencia de pieza', async () => {
      getReservasAdmin.mockResolvedValue({
        data: { reservas: [RESERVA_CONFIRMADA, RESERVA_EN_CURSO] }
      });

      renderConToast(<ReservasTab />);

      expect(await screen.findByText('Espejo vintage')).toBeInTheDocument();
      expect(screen.getByText('Silla Tolix')).toBeInTheDocument();

      const inputBusqueda = screen.getByLabelText('Buscar reservas');

      // Filtrar por cliente
      fireEvent.change(inputBusqueda, { target: { value: 'Carlos' } });
      await waitFor(() => {
        expect(screen.queryByText('Espejo vintage')).not.toBeInTheDocument();
        expect(screen.getByText('Silla Tolix')).toBeInTheDocument();
      });

      // Filtrar por referencia
      fireEvent.change(inputBusqueda, { target: { value: 'NAV-ESP-004' } });
      await waitFor(() => {
        expect(screen.getByText('Espejo vintage')).toBeInTheDocument();
        expect(screen.queryByText('Silla Tolix')).not.toBeInTheDocument();
      });

      // Limpiar filtros
      fireEvent.click(screen.getByRole('button', { name: /limpiar filtros/i }));
      await waitFor(() => {
        expect(screen.getByText('Espejo vintage')).toBeInTheDocument();
        expect(screen.getByText('Silla Tolix')).toBeInTheDocument();
      });
    });

    it('el selector de estado filtra por estado de reserva', async () => {
      getReservasAdmin.mockResolvedValue({
        data: { reservas: [RESERVA_CONFIRMADA, RESERVA_EN_CURSO] }
      });

      renderConToast(<ReservasTab />);

      expect(await screen.findByText('Espejo vintage')).toBeInTheDocument();

      const selectEstado = screen.getByLabelText('Filtrar por estado');
      fireEvent.change(selectEstado, { target: { value: 'en_curso' } });

      await waitFor(() => {
        expect(screen.queryByText('Espejo vintage')).not.toBeInTheDocument();
        expect(screen.getByText('Silla Tolix')).toBeInTheDocument();
      });
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 5. ACCIONES SOBRE LA RESERVA                                               */
  /* -------------------------------------------------------------------------- */
  describe('Acciones sobre la reserva', () => {
    it('al pulsar "Marcar Entregada" llama a entregarReservaAdmin', async () => {
      getReservasAdmin.mockResolvedValue({
        data: { reservas: [RESERVA_CONFIRMADA] }
      });
      entregarReservaAdmin.mockResolvedValue({ data: { id: 'res-1', estado: 'en_curso' } });

      const { showToast } = renderConToast(<ReservasTab />);

      const btnEntregar = await screen.findByRole('button', { name: 'Marcar Entregada' });
      fireEvent.click(btnEntregar);

      await waitFor(() => {
        expect(entregarReservaAdmin).toHaveBeenCalledWith('res-1');
        expect(showToast).toHaveBeenCalledWith(expect.stringContaining('entregada'), 'success');
      });
    });

    it('al pulsar "Marcar Recogida" llama a recogerReservaAdmin', async () => {
      getReservasAdmin.mockResolvedValue({
        data: { reservas: [RESERVA_EN_CURSO] }
      });
      recogerReservaAdmin.mockResolvedValue({ data: { id: 'res-2', estado: 'devuelta' } });

      const { showToast } = renderConToast(<ReservasTab />);

      const btnRecoger = await screen.findByRole('button', { name: 'Marcar Recogida' });
      fireEvent.click(btnRecoger);

      await waitFor(() => {
        expect(recogerReservaAdmin).toHaveBeenCalledWith('res-2');
        expect(showToast).toHaveBeenCalledWith(expect.stringContaining('recogida'), 'success');
      });
    });

    it('para reservas devueltas muestra botón deshabilitado "Finalizada"', async () => {
      getReservasAdmin.mockResolvedValue({
        data: { reservas: [RESERVA_DEVUELTA] }
      });

      renderConToast(<ReservasTab />);

      const btnFinalizada = await screen.findByRole('button', { name: 'Finalizada' });
      expect(btnFinalizada).toBeDisabled();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 6. MODAL DE CANCELACIÓN Y REEMBOLSO FLEXIBLE                               */
  /* -------------------------------------------------------------------------- */
  describe('Modal de Cancelación y Reembolso flexible', () => {
    it('envía el 100% del importe en céntimos por defecto', async () => {
      getReservasAdmin.mockResolvedValue({
        data: { reservas: [RESERVA_CONFIRMADA] }
      });
      cancelarReservaAdmin.mockResolvedValue({ data: { reserva: { id: 'res-1', estado: 'cancelada' } } });

      renderConToast(<ReservasTab />);

      fireEvent.click(await screen.findByRole('button', { name: '✕ Cancelar' }));

      expect(screen.getByText(/¿Cancelar la reserva\?/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/reembolsar el 100%/i)).toBeChecked();

      // Confirmar
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar reserva' }));

      await waitFor(() => {
        expect(cancelarReservaAdmin).toHaveBeenCalledWith(
          'res-1',
          expect.objectContaining({
            motivo: 'Cancelada por el administrador',
            reembolso_centimos: 15000 // 150€ -> 15000 céntimos
          })
        );
      });
    });

    it('al desmarcar el 100%, permite enviar importe personalizado en céntimos (ej. 2€ → 200)', async () => {
      getReservasAdmin.mockResolvedValue({
        data: { reservas: [RESERVA_CONFIRMADA] }
      });
      cancelarReservaAdmin.mockResolvedValue({ data: { reserva: { id: 'res-1', estado: 'cancelada' } } });

      renderConToast(<ReservasTab />);

      fireEvent.click(await screen.findByRole('button', { name: '✕ Cancelar' }));

      // Desmarcar 100%
      const checkbox100 = screen.getByLabelText(/reembolsar el 100%/i);
      fireEvent.click(checkbox100);
      expect(checkbox100).not.toBeChecked();

      // Cambiar a 2 euros
      const inputImporte = screen.getByLabelText(/importe a reembolsar/i);
      fireEvent.change(inputImporte, { target: { value: '2' } });

      // Confirmar
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar reserva' }));

      await waitFor(() => {
        expect(cancelarReservaAdmin).toHaveBeenCalledWith(
          'res-1',
          expect.objectContaining({
            reembolso_centimos: 200 // 2€ -> 200 céntimos
          })
        );
      });
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 7. MODAL DE BLOQUEO DE FECHAS                                              */
  /* -------------------------------------------------------------------------- */
  describe('Modal de Bloqueo de Fechas', () => {
    it('permite rellenar y guardar un bloqueo administrativo', async () => {
      getReservasAdmin.mockResolvedValue({
        data: { reservas: [] }
      });
      bloquearFechasAdmin.mockResolvedValue({ data: { id: 'bloq-1', tipo: 'bloqueo' } });
      const MUEBLES_MOCK = [{ id: 'm-1', nombre: 'Mesa Roble', referencia: 'NAV-MES-001' }];

      const { showToast } = renderConToast(<ReservasTab muebles={MUEBLES_MOCK} />);

      fireEvent.click(await screen.findByRole('button', { name: /bloquear fechas/i }));
      expect(screen.getByText('🔒 Bloquear fechas manualmente')).toBeInTheDocument();

      const selectMueble = screen.getByLabelText(/mueble/i);
      fireEvent.change(selectMueble, { target: { value: 'm-1' } });

      const inputMotivo = screen.getByPlaceholderText(/Exposición, Mantenimiento/i);
      fireEvent.change(inputMotivo, { target: { value: 'Restauración barniz' } });

      fireEvent.click(screen.getByRole('button', { name: 'Bloquear fechas' }));

      await waitFor(() => {
        expect(bloquearFechasAdmin).toHaveBeenCalledWith(
          expect.objectContaining({
            mueble_id: 'm-1',
            motivo: 'Restauración barniz'
          })
        );
        expect(showToast).toHaveBeenCalledWith('Fechas bloqueadas correctamente', 'success');
      });
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 8. VISTA MASTER E INSPECTOR LATERAL                                        */
  /* -------------------------------------------------------------------------- */
  describe('Vista Master e Inspector Lateral', () => {
    it('en Vista Master, al pulsar una celda ocupada se abre el inspector lateral de la reserva', async () => {
      getReservasAdmin.mockResolvedValue({
        data: { reservas: [RESERVA_CONFIRMADA] }
      });
      const MUEBLES_MOCK = [{ id: 'm-1', nombre: 'Espejo vintage', referencia: 'NAV-ESP-004' }];

      renderConToast(<ReservasTab muebles={MUEBLES_MOCK} />);

      fireEvent.click(await screen.findByRole('button', { name: /vista master/i }));
      expect(await screen.findByText('Ocupación Global de Catálogo')).toBeInTheDocument();

      // Navegar a noviembre 2026 (mes de la reserva)
      fireEvent.click(screen.getByText(/mes siguiente/i));

      // Localizar celda ocupada
      const celdaOcupada = document.querySelector('.n5-master-cell.is-booked');
      expect(celdaOcupada).toBeInTheDocument();
      fireEvent.click(celdaOcupada);

      // Debe abrirse el inspector lateral con el detalle
      expect(
        await screen.findByRole('complementary', { name: /detalle de reserva seleccionada/i })
      ).toBeInTheDocument();
      expect(screen.getByText('Detalle de la Reserva')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Marcar Entregada' })).toBeInTheDocument();

      // Cerrar inspector
      fireEvent.click(screen.getByRole('button', { name: /cerrar panel de detalle/i }));
      expect(screen.queryByRole('complementary', { name: /detalle de reserva seleccionada/i })).toBeNull();
    });
  });
});
