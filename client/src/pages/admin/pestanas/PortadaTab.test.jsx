import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PortadaTab from './PortadaTab';
import { ToastContext } from '../../../context/ToastContext';
import * as api from '../../../services/api';
import * as imagenUtils from '../../../utils/imagen';

vi.mock('../../../services/api');
vi.mock('../../../utils/imagen');

const MUEBLES_PRUEBA = [
  {
    id: 'm1',
    nombre: 'Aparador Nórdico de Roble',
    referencia: 'NAV-APA-001',
    categoria: 'Aparadores',
    imagenes: ['https://img.test/aparador.webp']
  },
  {
    id: 'm2',
    nombre: 'Mesa de Centro Rústica',
    referencia: 'NAV-MES-002',
    categoria: 'Mesas',
    imagenes: ['https://img.test/mesa.webp']
  },
  {
    id: 'm3',
    nombre: 'Sillón Orejero Vintage',
    referencia: 'NAV-SIL-003',
    categoria: 'Sillones',
    imagenes: ['https://img.test/sillon.webp']
  }
];

describe('PortadaTab — Pestaña de Portada en el Panel de Administración', () => {
  let showToastMock;

  const renderPortadaTab = (props = {}) => {
    showToastMock = vi.fn();
    return render(
      <ToastContext.Provider value={{ showToast: showToastMock }}>
        <PortadaTab muebles={MUEBLES_PRUEBA} {...props} />
      </ToastContext.Provider>
    );
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    imagenUtils.redimensionarImagen.mockImplementation(async (file) => file);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('muestra estado de carga inicialmente y luego renderiza los slots por defecto si no hay datos', async () => {
    api.getAjustesHome.mockResolvedValueOnce({
      hero_imagenes: [],
      productos_destacados: []
    });

    renderPortadaTab();

    expect(screen.getByText('Cargando ajustes de portada...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: 'Gestión de Portada' })).toBeInTheDocument();
    });

    // 4 placeholders del carrusel Hero
    expect(screen.getByText('Por defecto 1 (Almacén)')).toBeInTheDocument();
    expect(screen.getByText('Por defecto 2 (Vista aérea)')).toBeInTheDocument();
    expect(screen.getByText('Por defecto 3 (Butacas)')).toBeInTheDocument();
    expect(screen.getByText('Por defecto 4 (Showroom)')).toBeInTheDocument();

    // Estado vacío en destacados
    expect(screen.getByText('No hay ningún mueble destacado seleccionado.')).toBeInTheDocument();
  });

  it('muestra las imágenes del Hero y piezas destacadas cuando ya existen en la configuración', async () => {
    api.getAjustesHome.mockResolvedValueOnce({
      hero_imagenes: [
        'https://img.test/foto1.webp',
        'https://img.test/foto2.webp'
      ],
      productos_destacados: ['m1', 'm2']
    });

    renderPortadaTab();

    await waitFor(() => {
      expect(screen.getByText('Imagen 1')).toBeInTheDocument();
    });

    expect(screen.getByText('Imagen 2')).toBeInTheDocument();
    // Con fotos propias, los placeholders ya no salen: no hay huecos fijos
    expect(screen.queryByText('Por defecto 3 (Butacas)')).not.toBeInTheDocument();
    expect(screen.queryByText('Por defecto 4 (Showroom)')).not.toBeInTheDocument();

    // Piezas destacadas
    expect(screen.getByText('Aparador Nórdico de Roble')).toBeInTheDocument();
    expect(screen.getByText('Mesa de Centro Rústica')).toBeInTheDocument();
    expect(screen.getByText('2 muebles seleccionados')).toBeInTheDocument();
  });

  it('permite reordenar y eliminar imágenes del Hero', async () => {
    const user = userEvent.setup();
    api.getAjustesHome.mockResolvedValueOnce({
      hero_imagenes: [
        'https://img.test/foto1.webp',
        'https://img.test/foto2.webp'
      ],
      productos_destacados: []
    });

    renderPortadaTab();

    await waitFor(() => {
      expect(screen.getByText('Imagen 1')).toBeInTheDocument();
    });

    // Bajar imagen 1 a la posición 2
    const btnBajar = screen.getByRole('button', { name: 'Mover imagen 1 hacia abajo' });
    await user.click(btnBajar);

    // Comprobar que los botones de acción se actualizan
    expect(screen.getByRole('button', { name: 'Mover imagen 2 hacia arriba' })).toBeInTheDocument();

    // Eliminar la imagen 1
    const btnEliminar = screen.getByRole('button', { name: 'Eliminar imagen 1' });
    await user.click(btnEliminar);

    // CAMBIADO A PROPÓSITO: el hero ya no tiene 4 huecos fijos; el resumen cuenta sobre el máximo (10)
    expect(screen.getByText('Imágenes personalizadas: 1 de 10.')).toBeInTheDocument();
    const heroSection = document.getElementById('seccion-hero');
    expect(within(heroSection).getAllByRole('listitem')).toHaveLength(1);
  });

  it('permite subir una nueva imagen al Hero con optimización y Supabase Storage', async () => {
    const user = userEvent.setup();
    api.getAjustesHome.mockResolvedValueOnce({
      hero_imagenes: ['https://img.test/foto1.webp'],
      productos_destacados: []
    });
    api.subirImagenHero.mockResolvedValueOnce({
      url: 'https://supabase.co/storage/v1/object/public/imagenes/home/nueva.webp'
    });

    renderPortadaTab();

    await waitFor(() => {
      expect(screen.getByText('Imagen 1')).toBeInTheDocument();
    });

    const file = new File(['mock-image-content'], 'hero-nuevo.png', { type: 'image/png' });
    const input = document.getElementById('seccion-hero-file-input');
    expect(input).toBeInTheDocument();

    await user.upload(input, file);

    await waitFor(() => {
      expect(api.subirImagenHero).toHaveBeenCalledTimes(1);
    });

    expect(imagenUtils.redimensionarImagen).toHaveBeenCalledTimes(1);
    expect(showToastMock).toHaveBeenCalledWith('Imagen añadida al Hero', 'success');
    expect(screen.getByText('Imagen 2')).toBeInTheDocument();
  });

  it('el hero admite más de 4 imágenes y la nueva se añade al final, hasta un máximo de 10', async () => {
    const user = userEvent.setup();
    const seis = Array.from({ length: 6 }, (_, i) => `https://img.test/h${i + 1}.webp`);
    api.getAjustesHome.mockResolvedValueOnce({ hero_imagenes: seis, productos_destacados: [] });
    api.subirImagenHero.mockResolvedValueOnce({ url: 'https://img.test/h7.webp' });
    api.actualizarAjustesHome.mockResolvedValueOnce({ success: true });

    renderPortadaTab();
    await waitFor(() => expect(screen.getByText('Imagen 6')).toBeInTheDocument());

    await user.upload(document.getElementById('seccion-hero-file-input'), new File(['x'], 'h7.png', { type: 'image/png' }));
    await waitFor(() => expect(screen.getByText('Imagen 7')).toBeInTheDocument());
    expect(screen.getByAltText('Imagen de portada 7')).toHaveAttribute('src', 'https://img.test/h7.webp');

    await user.click(screen.getByRole('button', { name: 'Guardar cambios de la portada' }));
    expect(api.actualizarAjustesHome).toHaveBeenCalledWith(
      expect.objectContaining({ hero_imagenes: [...seis, 'https://img.test/h7.webp'] })
    );
  });

  it('con 10 imágenes en el hero no se puede subir otra', async () => {
    const diez = Array.from({ length: 10 }, (_, i) => `https://img.test/h${i + 1}.webp`);
    api.getAjustesHome.mockResolvedValueOnce({ hero_imagenes: diez, productos_destacados: [] });

    renderPortadaTab();
    await waitFor(() => expect(screen.getByText('Imagen 10')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: 'Subir nueva imagen al carrusel Hero' })).toBeDisabled();
  });

  it('permite buscar y añadir un mueble a la lista de destacados', async () => {
    const user = userEvent.setup();
    api.getAjustesHome.mockResolvedValueOnce({
      hero_imagenes: [],
      productos_destacados: ['m1']
    });

    renderPortadaTab();

    await waitFor(() => {
      expect(screen.getByText('Aparador Nórdico de Roble')).toBeInTheDocument();
    });

    const buscador = screen.getByLabelText('Buscar muebles para añadir a destacados');
    await user.type(buscador, 'orejero');

    // Debe mostrar la sugerencia del Sillón Orejero
    const sugerencias = await screen.findByRole('region', { name: 'Resultados de búsqueda' });
    expect(within(sugerencias).getByText('Sillón Orejero Vintage')).toBeInTheDocument();

    // Clic en destacar
    const btnDestacar = within(sugerencias).getByRole('button', { name: 'Añadir Sillón Orejero Vintage a destacados' });
    await user.click(btnDestacar);

    // Debe añadirse a la lista y limpiarse el buscador
    expect(buscador.value).toBe('');
    expect(screen.getByText('2 muebles seleccionados')).toBeInTheDocument();
    expect(screen.getByText('Sillón Orejero Vintage')).toBeInTheDocument();
  });

  it('permite quitar y reordenar un mueble de la lista de destacados', async () => {
    const user = userEvent.setup();
    api.getAjustesHome.mockResolvedValueOnce({
      hero_imagenes: [],
      productos_destacados: ['m1', 'm2']
    });

    renderPortadaTab();

    await waitFor(() => {
      expect(screen.getByText('Aparador Nórdico de Roble')).toBeInTheDocument();
    });

    // Mover m1 abajo
    const btnBajar = screen.getByRole('button', { name: 'Mover Aparador Nórdico de Roble abajo' });
    await user.click(btnBajar);

    // Quitar m1 de destacados
    const btnQuitar = screen.getByRole('button', { name: 'Quitar Aparador Nórdico de Roble de destacados' });
    await user.click(btnQuitar);

    expect(screen.queryByText('Aparador Nórdico de Roble')).not.toBeInTheDocument();
    expect(screen.getByText('1 mueble seleccionado')).toBeInTheDocument();
  });

  it('llama a actualizarAjustesHome al hacer clic en Guardar cambios y muestra toast de éxito', async () => {
    const user = userEvent.setup();
    api.getAjustesHome.mockResolvedValueOnce({
      hero_imagenes: ['https://img.test/hero1.webp'],
      productos_destacados: ['m1']
    });
    api.actualizarAjustesHome.mockResolvedValueOnce({ success: true });

    renderPortadaTab();

    await waitFor(() => {
      expect(screen.getByText('Imagen 1')).toBeInTheDocument();
    });

    const btnGuardar = screen.getByRole('button', { name: 'Guardar cambios de la portada' });
    await user.click(btnGuardar);

    expect(api.actualizarAjustesHome).toHaveBeenCalledWith({
      hero_imagenes: ['https://img.test/hero1.webp'],
      productos_destacados: ['m1'],
      imagenes_seccion_inspiracion: [],
      imagen_seccion_sostenibilidad: null
    });

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith('Ajustes de portada guardados correctamente', 'success');
    });
  });

  it('el botón de Vista previa abre la portada en una pestaña nueva', async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    api.getAjustesHome.mockResolvedValueOnce({
      hero_imagenes: [],
      productos_destacados: []
    });

    renderPortadaTab();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: 'Gestión de Portada' })).toBeInTheDocument();
    });

    const btnVistaPrevia = screen.getByRole('button', {
      name: 'Abrir vista previa de la portada en una pestaña nueva'
    });
    await user.click(btnVistaPrevia);

    expect(openSpy).toHaveBeenCalledWith('/', '_blank', 'noopener,noreferrer');
  });

  it('guarda los cambios de inspiración y sostenibilidad al pulsar Guardar cambios', async () => {
    const user = userEvent.setup();
    api.getAjustesHome.mockResolvedValueOnce({
      hero_imagenes: [],
      productos_destacados: [],
      imagenes_seccion_inspiracion: ['https://img.test/insp1.webp'],
      imagen_seccion_sostenibilidad: 'https://img.test/sost.webp'
    });
    api.actualizarAjustesHome.mockResolvedValueOnce({ success: true });

    renderPortadaTab();

    await waitFor(() => {
      expect(screen.getByText('Galería: Espacios que inspiran')).toBeInTheDocument();
    });

    expect(screen.getByText('Sección Sostenibilidad (Segunda vida)')).toBeInTheDocument();

    const btnGuardar = screen.getByRole('button', { name: 'Guardar cambios de la portada' });
    await user.click(btnGuardar);

    expect(api.actualizarAjustesHome).toHaveBeenCalledWith({
      hero_imagenes: [],
      productos_destacados: [],
      imagenes_seccion_inspiracion: ['https://img.test/insp1.webp'],
      imagen_seccion_sostenibilidad: 'https://img.test/sost.webp'
    });
  });

  it('muestra toast de error si la llamada de Guardar cambios falla', async () => {
    const user = userEvent.setup();
    api.getAjustesHome.mockResolvedValueOnce({
      hero_imagenes: [],
      productos_destacados: []
    });
    api.actualizarAjustesHome.mockResolvedValueOnce(null);

    renderPortadaTab();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: 'Gestión de Portada' })).toBeInTheDocument();
    });

    const btnGuardar = screen.getByRole('button', { name: 'Guardar cambios de la portada' });
    await user.click(btnGuardar);

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith('Error al guardar los ajustes de portada', 'error');
    });
  });
});
