// Exportar (e importar) el catálogo en CSV desde "Gestionar Inventario". No son tests de
// caracterización (los Admin.*.test.jsx, congelados): describen lo nuevo.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { exportarCatalogoCsv } from '../../services/api';
import { descargarArchivo } from '../../utils/descargarArchivo';
import { renderAdmin, irAPestana, CATEGORIAS } from '../adminTestUtils';

vi.mock('../../services/api');
vi.mock('../../utils/descargarArchivo');

const SILLA = {
  id: 'm1',
  nombre: 'Silla Tolix',
  categoria: 'Sillas',
  descripcion: 'Metal',
  precio_venta: 120,
  precio_alquiler_dia: null,
  imagenes: [],
  estado: 'disponible',
  referencia: 'NAV-SIL-001'
};

beforeEach(() => {
  vi.resetAllMocks();
});

const abrirInventario = async () => {
  const user = userEvent.setup();
  const { showToast } = await renderAdmin({ muebles: [SILLA], categorias: CATEGORIAS });
  await irAPestana(user, 'Gestionar Inventario');
  return { user, showToast };
};

describe('Inventario — exportar catálogo (CSV)', () => {
  it('el botón descarga el CSV con el nombre que da la API y avisa', async () => {
    const blob = new Blob(['csv']);
    exportarCatalogoCsv.mockResolvedValue({ blob, nombreArchivo: 'catalogo-nave5-2026-10-04.csv' });
    const { user, showToast } = await abrirInventario();

    await user.click(screen.getByRole('button', { name: 'Exportar catálogo (CSV)' }));

    expect(exportarCatalogoCsv).toHaveBeenCalledTimes(1);
    expect(descargarArchivo).toHaveBeenCalledWith(blob, 'catalogo-nave5-2026-10-04.csv');
    expect(showToast).toHaveBeenCalledWith('Catálogo exportado', 'success');
  });

  it('mientras se prepara, el botón dice "Exportando…" y no se puede pulsar otra vez', async () => {
    let terminar;
    exportarCatalogoCsv.mockReturnValue(new Promise((resolver) => (terminar = resolver)));
    const { user } = await abrirInventario();

    await user.click(screen.getByRole('button', { name: 'Exportar catálogo (CSV)' }));

    expect(screen.getByRole('button', { name: 'Exportando…' })).toBeDisabled();
    terminar({ blob: new Blob(['x']), nombreArchivo: 'c.csv' });
    expect(await screen.findByRole('button', { name: 'Exportar catálogo (CSV)' })).toBeEnabled();
  });

  it('si falla, avisa del error y no descarga nada', async () => {
    exportarCatalogoCsv.mockResolvedValue(null);
    const { user, showToast } = await abrirInventario();

    await user.click(screen.getByRole('button', { name: 'Exportar catálogo (CSV)' }));

    expect(descargarArchivo).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('No se pudo exportar el catálogo', 'error');
  });
});
