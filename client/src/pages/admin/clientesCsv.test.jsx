// Exportar las cuentas de clientes en CSV desde el Resumen (el panel no tiene pestaña de clientes).
// No son tests de caracterización (los Admin.*.test.jsx, congelados): describen lo nuevo.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { exportarClientesCsv } from '../../services/api';
import { descargarArchivo } from '../../utils/descargarArchivo';
import { renderAdmin } from '../adminTestUtils';

vi.mock('../../services/api');
vi.mock('../../utils/descargarArchivo');

beforeEach(() => {
  vi.resetAllMocks();
});

const abrirResumen = async () => {
  const user = userEvent.setup();
  const { showToast } = await renderAdmin();
  return { user, showToast };
};

describe('Resumen — exportar clientes (CSV)', () => {
  it('está en el Resumen, en su propia sección "Clientes", y dice qué lleva el archivo', async () => {
    await abrirResumen();

    const seccion = within(screen.getByRole('region', { name: 'Clientes' }));
    expect(seccion.getByRole('button', { name: 'Exportar clientes (CSV)' })).toBeEnabled();
    expect(seccion.getByText(/email, nombre, rol y fecha de alta\. Nunca la contraseña\./)).toBeInTheDocument();
  });

  it('el botón descarga el CSV con el nombre que da la API y avisa', async () => {
    const blob = new Blob(['csv']);
    exportarClientesCsv.mockResolvedValue({ blob, nombreArchivo: 'clientes-nave5-2026-10-07.csv' });
    const { user, showToast } = await abrirResumen();

    await user.click(screen.getByRole('button', { name: 'Exportar clientes (CSV)' }));

    expect(exportarClientesCsv).toHaveBeenCalledTimes(1);
    expect(descargarArchivo).toHaveBeenCalledWith(blob, 'clientes-nave5-2026-10-07.csv');
    expect(showToast).toHaveBeenCalledWith('Clientes exportados', 'success');
  });

  it('mientras se prepara, el botón dice "Exportando…" y no se puede pulsar otra vez', async () => {
    let terminar;
    exportarClientesCsv.mockReturnValue(new Promise((resolver) => (terminar = resolver)));
    const { user } = await abrirResumen();

    await user.click(screen.getByRole('button', { name: 'Exportar clientes (CSV)' }));

    expect(screen.getByRole('button', { name: 'Exportando…' })).toBeDisabled();
    terminar({ blob: new Blob(['x']), nombreArchivo: 'c.csv' });
    expect(await screen.findByRole('button', { name: 'Exportar clientes (CSV)' })).toBeEnabled();
  });

  it('si falla, avisa del error y no descarga nada', async () => {
    exportarClientesCsv.mockResolvedValue(null);
    const { user, showToast } = await abrirResumen();

    await user.click(screen.getByRole('button', { name: 'Exportar clientes (CSV)' }));

    expect(descargarArchivo).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('No se pudieron exportar los clientes', 'error');
  });
});
