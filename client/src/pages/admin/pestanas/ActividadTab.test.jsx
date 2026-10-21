import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ActividadTab from './ActividadTab';
import { obtenerResumenDetalle } from '../actividad';
import * as api from '../../../services/api';

vi.mock('../../../services/api');

const LOGS_MOCK = [
  {
    id: 'log-1',
    created_at: '2026-10-21T10:00:00.000Z',
    admin_id: 'admin-1',
    admin_email: 'admin@nave5barcelona.com',
    accion: 'crear',
    entidad: 'muebles',
    entidad_id: 'm-001',
    datos_anteriores: null,
    datos_nuevos: {
      nombre: 'Mesa Roble',
      referencia: 'NAV-MES-001',
      precio_venta: 250
    }
  },
  {
    id: 'log-2',
    created_at: '2026-10-21T11:30:00.000Z',
    admin_id: 'admin-1',
    admin_email: 'admin@nave5barcelona.com',
    accion: 'editar',
    entidad: 'muebles',
    entidad_id: 'm-001',
    datos_anteriores: { precio_venta: 250 },
    datos_nuevos: { precio_venta: 280 }
  },
  {
    id: 'log-3',
    created_at: '2026-10-21T12:00:00.000Z',
    admin_id: 'admin-2',
    admin_email: 'gestor@nave5barcelona.com',
    accion: 'cambio_estado',
    entidad: 'pedidos',
    entidad_id: 'ped-100',
    datos_anteriores: { estado: 'procesando' },
    datos_nuevos: { estado: 'enviado' }
  },
  {
    id: 'log-4',
    created_at: '2026-10-21T13:00:00.000Z',
    admin_id: 'admin-2',
    admin_email: 'gestor@nave5barcelona.com',
    accion: 'login',
    entidad: 'auth',
    entidad_id: 'admin-2',
    datos_anteriores: null,
    datos_nuevos: { email: 'gestor@nave5barcelona.com', rol: 'admin' }
  }
];

describe('ActividadTab', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(api.getAuditLogs).mockResolvedValue({
      logs: LOGS_MOCK,
      total: LOGS_MOCK.length,
      pagina: 1,
      porPagina: 50
    });
  });

  describe('obtenerResumenDetalle', () => {
    it('resume correctamente un cambio de precio', () => {
      const resumen = obtenerResumenDetalle(LOGS_MOCK[1]);
      expect(resumen).toBe('Precio cambiado');
    });

    it('resume correctamente la creación de un mueble con referencia', () => {
      const resumen = obtenerResumenDetalle(LOGS_MOCK[0]);
      expect(resumen).toContain('NAV-MES-001');
    });

    it('resume un cambio de estado de pedido', () => {
      const resumen = obtenerResumenDetalle(LOGS_MOCK[2]);
      expect(resumen).toBe('Estado cambiado a enviado');
    });

    it('resume un login', () => {
      const resumen = obtenerResumenDetalle(LOGS_MOCK[3]);
      expect(resumen).toContain('Inicio de sesión');
      expect(resumen).toContain('gestor@nave5barcelona.com');
    });
  });

  describe('Renderizado de la tabla', () => {
    it('renderiza las columnas principales y las filas de actividad', async () => {
      render(<ActividadTab />);

      expect(await screen.findByText('Actividad')).toBeInTheDocument();
      expect(screen.getByText('Fecha')).toBeInTheDocument();
      expect(screen.getByText('Admin')).toBeInTheDocument();
      expect(screen.getByText('Acción')).toBeInTheDocument();
      expect(screen.getByText('Entidad')).toBeInTheDocument();
      expect(screen.getByText('Detalle')).toBeInTheDocument();

      expect(screen.getAllByText('admin@nave5barcelona.com').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('gestor@nave5barcelona.com').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Precio cambiado')).toBeInTheDocument();
      expect(screen.getByText('Estado cambiado a enviado')).toBeInTheDocument();
    });

    it('muestra mensaje cuando no hay actividades', async () => {
      vi.mocked(api.getAuditLogs).mockResolvedValue({ logs: [], total: 0 });
      render(<ActividadTab />);

      expect(
        await screen.findByText('Todavía no hay ningún registro de actividad.')
      ).toBeInTheDocument();
    });
  });

  describe('Modal de Diff', () => {
    it('al hacer clic en una fila, abre el modal de diff con datos anteriores en rojo y nuevos en verde', async () => {
      const user = userEvent.setup();
      render(<ActividadTab />);

      await screen.findByText('Precio cambiado');
      const filaEditar = screen.getByText('Precio cambiado').closest('tr');
      await user.click(filaEditar);

      expect(await screen.findByText('Detalle de Actividad')).toBeInTheDocument();
      expect(screen.getByText('Comparativa de cambios (Diff)')).toBeInTheDocument();

      // Comprobar campos del diff
      expect(screen.getByText('precio_venta')).toBeInTheDocument();

      const anterior = screen.getByText('250').closest('.diff-anterior');
      const nuevo = screen.getByText('280').closest('.diff-nuevo');
      expect(anterior).toBeInTheDocument();
      expect(nuevo).toBeInTheDocument();

      // Cerrar modal
      const botonCerrar = screen.getByRole('button', { name: 'Cerrar' });
      await user.click(botonCerrar);

      await waitFor(() => {
        expect(screen.queryByText('Detalle de Actividad')).not.toBeInTheDocument();
      });
    });
  });

  describe('Filtros', () => {
    it('filtra por acción', async () => {
      const user = userEvent.setup();
      render(<ActividadTab />);

      await screen.findByText('Precio cambiado');
      const filtroAccion = screen.getByLabelText('Filtrar por acción');

      await user.selectOptions(filtroAccion, 'editar');

      expect(screen.getByText('Precio cambiado')).toBeInTheDocument();
      expect(screen.queryByText('Estado cambiado a enviado')).not.toBeInTheDocument();
    });

    it('filtra por administrador', async () => {
      const user = userEvent.setup();
      render(<ActividadTab />);

      await screen.findByText('Precio cambiado');
      const filtroAdmin = screen.getByLabelText('Filtrar por admin');

      await user.selectOptions(filtroAdmin, 'gestor@nave5barcelona.com');

      expect(screen.queryByText('Precio cambiado')).not.toBeInTheDocument();
      expect(screen.getByText('Estado cambiado a enviado')).toBeInTheDocument();
    });

    it('botón Limpiar filtros restablece todos los filtros', async () => {
      const user = userEvent.setup();
      render(<ActividadTab />);

      await screen.findByText('Precio cambiado');
      const filtroAccion = screen.getByLabelText('Filtrar por acción');
      await user.selectOptions(filtroAccion, 'editar');

      const botonLimpiar = screen.getByRole('button', { name: 'Limpiar filtros' });
      await user.click(botonLimpiar);

      expect(screen.getByText('Precio cambiado')).toBeInTheDocument();
      expect(screen.getByText('Estado cambiado a enviado')).toBeInTheDocument();
    });
  });
});
