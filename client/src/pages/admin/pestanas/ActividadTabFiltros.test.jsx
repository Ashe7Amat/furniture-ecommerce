// Pestaña Actividad: formas de la respuesta del servidor, los filtros de fecha («hoy», «7 días») y
// las filas sin fecha, sin admin o sin cambios. El resto está en ActividadTab.test.jsx.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ActividadTab from './ActividadTab';
import { getAuditLogs } from '../../../services/api';

vi.mock('../../../services/api', () => ({ getAuditLogs: vi.fn() }));

const AHORA = '2026-10-29T12:00:00.000Z';
const log = (extra) => ({
  id: extra.id,
  admin_email: 'admin@nave5barcelona.com',
  accion: 'editar',
  entidad: 'muebles',
  entidad_id: 'm-1',
  datos_anteriores: null,
  datos_nuevos: { nombre: 'Silla' },
  ...extra
});

const LOGS = [
  log({ id: 'hoy', created_at: '2026-10-29T09:00:00.000Z', datos_nuevos: { nombre: 'Hoy' } }),
  log({ id: 'ayer', created_at: '2026-10-28T09:00:00.000Z', datos_nuevos: { nombre: 'Ayer' } }),
  log({ id: 'mes-pasado', created_at: '2026-09-20T09:00:00.000Z', datos_nuevos: { nombre: 'Viejo' } }),
  log({ id: 'otro-anio', created_at: '2025-10-29T09:00:00.000Z', datos_nuevos: { nombre: 'Hace un año' } })
];

const filas = () => [...document.querySelectorAll('tbody tr')];

describe('ActividadTab — filtros y formas de los datos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(AHORA));
  });
  afterEach(() => vi.useRealTimers());

  it('acepta la lista sin envolver', async () => {
    getAuditLogs.mockResolvedValue(LOGS);
    render(<ActividadTab />);
    expect(await screen.findByText('4 registros de actividad')).toBeInTheDocument();
  });

  it('una respuesta sin lista es un error, y «Reintentar» vuelve a pedirla', async () => {
    getAuditLogs.mockResolvedValueOnce(null).mockResolvedValueOnce({ logs: [LOGS[0]] });
    render(<ActividadTab />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar el registro de actividad.');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('1 registro de actividad')).toBeInTheDocument();
  });

  it('si la petición lanza, también es un error', async () => {
    getAuditLogs.mockRejectedValue(new Error('red'));
    render(<ActividadTab />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('«Hoy» deja solo lo de hoy, «Últimos 7 días» lo de la semana, y «Limpiar filtros» lo quita', async () => {
    getAuditLogs.mockResolvedValue({ logs: LOGS });
    render(<ActividadTab initialLogs={LOGS} />);
    const fecha = screen.getByRole('combobox', { name: 'Filtrar por fecha' });

    fireEvent.change(fecha, { target: { value: 'hoy' } });
    await waitFor(() => expect(filas()).toHaveLength(1));
    expect(screen.getByText('Nombre cambiado a "Hoy"')).toBeInTheDocument();

    fireEvent.change(fecha, { target: { value: '7dias' } });
    await waitFor(() => expect(filas()).toHaveLength(2));
    expect(screen.queryByText('Nombre cambiado a "Viejo"')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    await waitFor(() => expect(filas()).toHaveLength(4));
  });

  it('filas sin fecha ni admin, con acción y entidad desconocidas y sin cambios: no se abren', () => {
    const raro = {
      id: 'raro',
      accion: 'exportar',
      entidad: 'informes',
      entidad_id: 9,
      datos_anteriores: null,
      datos_nuevos: { updated_at: 'x' }
    };
    render(<ActividadTab initialLogs={[raro]} />);
    const fila = filas()[0];
    expect(fila).toHaveTextContent('—');
    expect(fila).toHaveTextContent('Sistema');
    expect(fila).toHaveTextContent('exportar');
    expect(fila).toHaveTextContent('informes');
    expect(fila).not.toHaveAttribute('role');
    expect(fila).toHaveClass('audit-row-no-diff');
    fireEvent.click(fila);
    fireEvent.keyDown(fila, { key: 'Enter' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('una fila con cambios se abre con Enter, no con otra tecla', () => {
    render(<ActividadTab initialLogs={[LOGS[0]]} />);
    const fila = screen.getByRole('button', { name: 'Ver detalle de Editar en Mueble' });
    fireEvent.keyDown(fila, { key: 'a' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.keyDown(fila, { key: 'Enter' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
