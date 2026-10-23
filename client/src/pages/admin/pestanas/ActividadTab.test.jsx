import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ActividadTab from './ActividadTab';
import {
  obtenerResumenDetalle,
  formatearValor,
  traducirCampo,
  construirMensajeBorrado,
  CAMPOS_IGNORADOS
} from '../actividad';
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
      id: 'm-001',
      created_at: '2026-10-21T10:00:00.000Z',
      nombre: 'Mesa Roble',
      referencia: 'NAV-MES-001',
      precio_venta: 250,
      imagenes: ['https://example.com/foto1.jpg', 'https://example.com/foto2.jpg']
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
    datos_anteriores: {
      id: 'm-001',
      precio_venta: 100,
      updated_at: '2026-10-21T10:00:00.000Z'
    },
    datos_nuevos: {
      precio_venta: 120,
      updated_at: '2026-10-21T11:30:00.000Z'
    }
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
  },
  {
    id: 'log-5',
    created_at: '2026-10-21T14:00:00.000Z',
    admin_id: 'admin-1',
    admin_email: 'admin@nave5barcelona.com',
    accion: 'eliminar',
    entidad: 'muebles',
    entidad_id: 'm-002',
    datos_anteriores: {
      id: 'm-002',
      nombre: 'Silla Vintage',
      referencia: 'NAV-SIL-001',
      created_at: '2026-10-20T10:00:00.000Z'
    },
    datos_nuevos: null
  },
  {
    id: 'log-6',
    created_at: '2026-10-21T15:00:00.000Z',
    admin_id: 'admin-1',
    admin_email: 'admin@nave5barcelona.com',
    accion: 'editar',
    entidad: 'muebles',
    entidad_id: 'm-003',
    datos_anteriores: { updated_at: '2026-10-21T14:00:00.000Z' },
    datos_nuevos: { updated_at: '2026-10-21T15:00:00.000Z' }
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

  describe('Funciones auxiliares (actividad.js)', () => {
    it('comprueba que un cambio de precio muestra "Precio de venta: 100 € -> 120 €"', () => {
      const resumen = obtenerResumenDetalle(LOGS_MOCK[1]);
      expect(resumen).toBe('Precio de venta: 100 € -> 120 €');
    });

    it('formatea booleanos y vacíos de forma legible', () => {
      expect(formatearValor('activo', true)).toBe('Sí');
      expect(formatearValor('activo', false)).toBe('No');
      expect(formatearValor('descripcion', null)).toBe('—');
      expect(formatearValor('descripcion', undefined)).toBe('—');
      expect(formatearValor('descripcion', '')).toBe('—');
    });

    it('formatea arrays de fotos y elementos', () => {
      expect(formatearValor('imagenes', [])).toBe('Ninguna');
      expect(formatearValor('imagenes', ['url1', 'url2'])).toBe('2 fotos');
      expect(formatearValor('items', ['item1'])).toBe('1 elemento');
    });

    it('formatea precios con símbolo de euro', () => {
      expect(formatearValor('precio_venta', 100)).toBe('100 €');
      expect(formatearValor('precio_alquiler_dia', 15)).toBe('15 €');
    });

    it('traduce los nombres de campos técnicos al castellano', () => {
      expect(traducirCampo('nombre')).toBe('Nombre');
      expect(traducirCampo('precio_venta')).toBe('Precio de venta');
      expect(traducirCampo('precio_alquiler_dia')).toBe('Precio alquiler/día');
      expect(traducirCampo('imagenes')).toBe('Fotografías');
      expect(traducirCampo('categoria')).toBe('Categoría');
    });

    it('construye un mensaje amigable para eliminaciones', () => {
      const mensaje = construirMensajeBorrado(LOGS_MOCK[4]);
      expect(mensaje).toBe(
        'El administrador admin@nave5barcelona.com eliminó Mueble con nombre: Silla Vintage y referencia NAV-SIL-001.'
      );
    });

    it('contiene la lista de campos técnicos ignorados', () => {
      expect(CAMPOS_IGNORADOS.has('id')).toBe(true);
      expect(CAMPOS_IGNORADOS.has('created_at')).toBe(true);
      expect(CAMPOS_IGNORADOS.has('updated_at')).toBe(true);
      expect(CAMPOS_IGNORADOS.has('categoria_id')).toBe(true);
      expect(CAMPOS_IGNORADOS.has('disponible')).toBe(true);
      expect(CAMPOS_IGNORADOS.has('stripe_session_id')).toBe(true);
      expect(CAMPOS_IGNORADOS.has('pedido_id')).toBe(true);
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
      expect(screen.getByText('Precio de venta: 100 € -> 120 €')).toBeInTheDocument();
      expect(screen.getByText('Estado cambiado a Enviado')).toBeInTheDocument();
    });

    it('muestra mensaje cuando no hay actividades', async () => {
      vi.mocked(api.getAuditLogs).mockResolvedValue({ logs: [], total: 0 });
      render(<ActividadTab />);

      expect(
        await screen.findByText('Todavía no hay ningún registro de actividad.')
      ).toBeInTheDocument();
    });
  });

  describe('Modal de Diff legible y amigable', () => {
    it('muestra "Precio de venta: 100 € -> 120 €" con Antes en rojo y Después en verde', async () => {
      const user = userEvent.setup();
      render(<ActividadTab />);

      await screen.findByText('Precio de venta: 100 € -> 120 €');
      const filaEditar = screen.getByText('Precio de venta: 100 € -> 120 €').closest('tr');
      await user.click(filaEditar);

      expect(await screen.findByText('Detalle de Actividad')).toBeInTheDocument();
      expect(screen.getByText('Comparativa de cambios')).toBeInTheDocument();

      // Comprobar que no muestra id ni created_at
      expect(screen.queryByText('created_at')).not.toBeInTheDocument();
      expect(screen.queryByText('updated_at')).not.toBeInTheDocument();

      // Nombre del campo traducido
      expect(screen.getByText('Precio de venta')).toBeInTheDocument();

      // Valores con euro y clases correspondientes
      const anterior = screen.getByText('100 €').closest('.diff-anterior');
      const nuevo = screen.getByText('120 €').closest('.diff-nuevo');
      expect(anterior).toBeInTheDocument();
      expect(nuevo).toBeInTheDocument();

      // Cerrar modal
      const botonCerrar = screen.getByRole('button', { name: 'Cerrar' });
      await user.click(botonCerrar);

      await waitFor(() => {
        expect(screen.queryByText('Detalle de Actividad')).not.toBeInTheDocument();
      });
    });

    it('un borrado muestra el mensaje amigable y no la tabla con "(vacío / no definido)"', async () => {
      const user = userEvent.setup();
      render(<ActividadTab />);

      await screen.findByText(/Mueble eliminado NAV-SIL-001/);
      const filaEliminar = screen.getByText(/Mueble eliminado NAV-SIL-001/).closest('tr');
      await user.click(filaEliminar);

      expect(await screen.findByText('Detalle de Actividad')).toBeInTheDocument();

      // Mensaje amigable presente
      expect(
        screen.getByText(
          'El administrador admin@nave5barcelona.com eliminó Mueble con nombre: Silla Vintage y referencia NAV-SIL-001.'
        )
      ).toBeInTheDocument();

      // No muestra tabla de diffs ni texto técnico
      expect(screen.queryByText('Comparativa de cambios')).not.toBeInTheDocument();
      expect(screen.queryByText('(vacío / no definido)')).not.toBeInTheDocument();
    });

    it('los campos id y created_at no se renderizan nunca en el modal', async () => {
      const user = userEvent.setup();
      render(<ActividadTab />);

      await screen.findByText(/NAV-MES-001/);
      const filaCrear = screen.getByText(/Mueble NAV-MES-001/).closest('tr');
      await user.click(filaCrear);

      expect(await screen.findByText('Detalle de Actividad')).toBeInTheDocument();

      // Verificar que ni id ni created_at aparecen como campos
      expect(screen.queryByText('created_at')).not.toBeInTheDocument();
      expect(screen.queryByText('categoria_id')).not.toBeInTheDocument();

      // Campos traducidos
      expect(screen.getByText('Fotografías')).toBeInTheDocument();
      expect(screen.getByText('2 fotos')).toBeInTheDocument();
      expect(screen.getByText('250 €')).toBeInTheDocument();
    });

    it('si un cambio solo afecta a campos técnicos, no abre el modal de diff', async () => {
      const user = userEvent.setup();
      render(<ActividadTab />);

      await screen.findByText(/Edición en muebles/);
      const filaTecnica = screen.getByText(/Edición en muebles/).closest('tr');
      await user.click(filaTecnica);

      // El modal no se debe abrir
      expect(screen.queryByText('Detalle de Actividad')).not.toBeInTheDocument();
    });
  });

  describe('Filtros', () => {
    it('filtra por acción', async () => {
      const user = userEvent.setup();
      render(<ActividadTab />);

      await screen.findByText('Precio de venta: 100 € -> 120 €');
      const filtroAccion = screen.getByLabelText('Filtrar por acción');

      await user.selectOptions(filtroAccion, 'editar');

      expect(screen.getByText('Precio de venta: 100 € -> 120 €')).toBeInTheDocument();
      expect(screen.queryByText('Estado cambiado a Enviado')).not.toBeInTheDocument();
    });

    it('filtra por administrador', async () => {
      const user = userEvent.setup();
      render(<ActividadTab />);

      await screen.findByText('Precio de venta: 100 € -> 120 €');
      const filtroAdmin = screen.getByLabelText('Filtrar por admin');

      await user.selectOptions(filtroAdmin, 'gestor@nave5barcelona.com');

      expect(screen.queryByText('Precio de venta: 100 € -> 120 €')).not.toBeInTheDocument();
      expect(screen.getByText('Estado cambiado a Enviado')).toBeInTheDocument();
    });

    it('botón Limpiar filtros restablece todos los filtros', async () => {
      const user = userEvent.setup();
      render(<ActividadTab />);

      await screen.findByText('Precio de venta: 100 € -> 120 €');
      const filtroAccion = screen.getByLabelText('Filtrar por acción');
      await user.selectOptions(filtroAccion, 'editar');

      const botonLimpiar = screen.getByRole('button', { name: 'Limpiar filtros' });
      await user.click(botonLimpiar);

      expect(screen.getByText('Precio de venta: 100 € -> 120 €')).toBeInTheDocument();
      expect(screen.getByText('Estado cambiado a Enviado')).toBeInTheDocument();
    });
  });
});
