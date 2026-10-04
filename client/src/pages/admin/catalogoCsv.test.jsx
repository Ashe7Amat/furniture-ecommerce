// Exportar (e importar) el catálogo en CSV desde "Gestionar Inventario". No son tests de
// caracterización (los Admin.*.test.jsx, congelados): describen lo nuevo.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { exportarCatalogoCsv, importarCatalogoCsv, getMuebles } from '../../services/api';
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

describe('Inventario — importar catálogo (CSV)', () => {
  const csv = (nombre = 'catalogo.csv', tipo = 'text/csv') => new File(['nombre;categoria\n'], nombre, { type: tipo });
  const PREVIA = {
    total: 3,
    validas: 2,
    errores: [{ linea: 3, motivo: 'La categoría "Taburetes" no existe.' }],
    columnasIgnoradas: ['color'],
    filas: [
      { linea: 2, nombre: 'Silla Tolix', categoria: 'Sillas', valida: true, motivo: null },
      { linea: 3, nombre: 'Taburete', categoria: null, valida: false, motivo: 'La categoría "Taburetes" no existe.' },
      { linea: 4, nombre: 'Mesa', categoria: 'Mesas', valida: true, motivo: null }
    ]
  };
  const RESULTADO = {
    creadas: 2,
    saltadas: 1,
    errores: [{ linea: 3, motivo: 'La categoría "Taburetes" no existe.' }],
    columnasIgnoradas: [],
    piezas: []
  };

  const abrirModal = async () => {
    const datos = await abrirInventario();
    await datos.user.click(screen.getByRole('button', { name: 'Importar catálogo (CSV)' }));
    const dialogo = within(screen.getByRole('dialog', { name: 'Importar catálogo (CSV)' }));
    return { ...datos, dialogo };
  };
  const elegir = (user, dialogo, archivo = csv()) => user.upload(dialogo.getByLabelText('Archivo CSV'), archivo);

  it('sin archivo no se puede previsualizar, y "Aplicar" está apagado hasta tener una previsualización', async () => {
    const { user, dialogo } = await abrirModal();

    expect(dialogo.getByRole('button', { name: 'Previsualizar' })).toBeDisabled();
    expect(dialogo.getByRole('button', { name: 'Aplicar' })).toBeDisabled();

    await elegir(user, dialogo);
    expect(dialogo.getByText('catalogo.csv')).toBeInTheDocument();
    expect(dialogo.getByRole('button', { name: 'Previsualizar' })).toBeEnabled();
    expect(dialogo.getByRole('button', { name: 'Aplicar' })).toBeDisabled();
  });

  it('previsualiza: manda el archivo en modo preview y enseña cada fila con su estado', async () => {
    importarCatalogoCsv.mockResolvedValue({ datos: PREVIA });
    const { user, dialogo } = await abrirModal();
    const archivo = csv();
    await elegir(user, dialogo, archivo);

    await user.click(dialogo.getByRole('button', { name: 'Previsualizar' }));

    expect(importarCatalogoCsv).toHaveBeenCalledWith(archivo, 'preview');
    expect(dialogo.getByText('2 de 3 filas se pueden importar.')).toBeInTheDocument();
    expect(dialogo.getByText('Columnas que no se usan: color.')).toBeInTheDocument();
    const filasTabla = dialogo.getAllByRole('row').slice(1);
    expect(filasTabla.map((f) => f.textContent)).toEqual([
      '2Silla TolixSillasLista para importar',
      '3Taburete—La categoría "Taburetes" no existe.',
      '4MesaMesasLista para importar'
    ]);
    expect(dialogo.getByRole('button', { name: 'Aplicar' })).toBeEnabled();
  });

  it('si ninguna fila es válida, "Aplicar" sigue apagado', async () => {
    importarCatalogoCsv.mockResolvedValue({ datos: { ...PREVIA, validas: 0 } });
    const { user, dialogo } = await abrirModal();
    await elegir(user, dialogo);

    await user.click(dialogo.getByRole('button', { name: 'Previsualizar' }));

    expect(dialogo.getByRole('button', { name: 'Aplicar' })).toBeDisabled();
  });

  it('aplicar pide confirmación; al confirmar crea, avisa, recarga el inventario y enseña el resultado', async () => {
    importarCatalogoCsv.mockResolvedValueOnce({ datos: PREVIA }).mockResolvedValueOnce({ datos: RESULTADO });
    const { user, dialogo, showToast } = await abrirModal();
    const archivo = csv();
    await elegir(user, dialogo, archivo);
    await user.click(dialogo.getByRole('button', { name: 'Previsualizar' }));
    const cargasAntes = getMuebles.mock.calls.length;

    await user.click(dialogo.getByRole('button', { name: 'Aplicar' }));
    expect(importarCatalogoCsv).toHaveBeenCalledTimes(1); // todavía no: falta confirmar
    expect(
      dialogo.getByText('Se van a dar de alta 2 piezas nuevas en el catálogo y se saltarán 1 fila con errores. ¿Seguir?')
    ).toBeInTheDocument();

    await user.click(dialogo.getByRole('button', { name: 'Sí, importar' }));

    expect(importarCatalogoCsv).toHaveBeenLastCalledWith(archivo, 'apply');
    expect(showToast).toHaveBeenCalledWith('2 piezas importadas', 'success');
    expect(getMuebles.mock.calls.length).toBeGreaterThan(cargasAntes);
    expect(dialogo.getByText('Se han creado 2 piezas. Se han saltado 1 fila.')).toBeInTheDocument();
    expect(dialogo.getByText('Línea 3: La categoría "Taburetes" no existe.')).toBeInTheDocument();

    await user.click(dialogo.getByRole('button', { name: 'Volver al inventario' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('cancelar la confirmación no importa nada', async () => {
    importarCatalogoCsv.mockResolvedValue({ datos: PREVIA });
    const { user, dialogo } = await abrirModal();
    await elegir(user, dialogo);
    await user.click(dialogo.getByRole('button', { name: 'Previsualizar' }));

    await user.click(dialogo.getByRole('button', { name: 'Aplicar' }));
    await user.click(dialogo.getByRole('button', { name: 'Cancelar' }));

    expect(dialogo.queryByText(/¿Seguir\?/)).not.toBeInTheDocument();
    expect(importarCatalogoCsv).toHaveBeenCalledTimes(1);
  });

  it('un error del servidor sale en el modal (y en la previsualización no deja aplicar)', async () => {
    importarCatalogoCsv.mockResolvedValue({ error: 'Faltan las cabeceras obligatorias: nombre.' });
    const { user, dialogo } = await abrirModal();
    await elegir(user, dialogo);

    await user.click(dialogo.getByRole('button', { name: 'Previsualizar' }));

    expect(dialogo.getByRole('alert')).toHaveTextContent('Faltan las cabeceras obligatorias: nombre.');
    expect(dialogo.getByRole('button', { name: 'Aplicar' })).toBeDisabled();
  });

  it('si falla al aplicar, el error sale en el modal y no se recarga nada', async () => {
    importarCatalogoCsv.mockResolvedValueOnce({ datos: PREVIA }).mockResolvedValueOnce({ error: 'Sin conexión.' });
    const { user, dialogo, showToast } = await abrirModal();
    await elegir(user, dialogo);
    await user.click(dialogo.getByRole('button', { name: 'Previsualizar' }));
    await user.click(dialogo.getByRole('button', { name: 'Aplicar' }));

    await user.click(dialogo.getByRole('button', { name: 'Sí, importar' }));

    expect(dialogo.getByRole('alert')).toHaveTextContent('Sin conexión.');
    expect(showToast).not.toHaveBeenCalledWith(expect.stringMatching(/importada/), 'success');
  });

  it('se puede soltar el archivo arrastrándolo; uno que no es .csv se rechaza', async () => {
    const { dialogo } = await abrirModal();
    const zona = dialogo.getByText(/Arrastra aquí el archivo CSV/).closest('label');

    fireEvent.dragOver(zona);
    expect(zona).toHaveClass('is-arrastrando');
    fireEvent.drop(zona, { dataTransfer: { files: [new File(['x'], 'fotos.zip', { type: 'application/zip' })] } });
    expect(zona).not.toHaveClass('is-arrastrando');
    expect(dialogo.getByRole('alert')).toHaveTextContent('Elige un archivo .csv.');
    expect(dialogo.getByRole('button', { name: 'Previsualizar' })).toBeDisabled();

    fireEvent.drop(zona, { dataTransfer: { files: [csv('precios.CSV', '')] } });
    expect(dialogo.getByText('precios.CSV')).toBeInTheDocument();
    expect(dialogo.queryByRole('alert')).not.toBeInTheDocument();

    fireEvent.dragOver(zona);
    fireEvent.dragLeave(zona);
    expect(zona).not.toHaveClass('is-arrastrando');
  });

  it('cambiar de archivo borra la previsualización anterior', async () => {
    importarCatalogoCsv.mockResolvedValue({ datos: PREVIA });
    const { user, dialogo } = await abrirModal();
    await elegir(user, dialogo);
    await user.click(dialogo.getByRole('button', { name: 'Previsualizar' }));

    await elegir(user, dialogo, csv('otro.csv'));

    expect(dialogo.queryByRole('table')).not.toBeInTheDocument();
    expect(dialogo.getByRole('button', { name: 'Aplicar' })).toBeDisabled();
  });

  it('la X cierra el modal sin importar nada', async () => {
    const { user, dialogo } = await abrirModal();
    await user.click(dialogo.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(importarCatalogoCsv).not.toHaveBeenCalled();
  });
});
