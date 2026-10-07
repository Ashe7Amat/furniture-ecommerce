// Ficha de un mueble (/mueble/:id). No tenía tests: se añaden con A6, al empezar a enseñar aquí la
// referencia real (y quitar la "Ref. SKU-…" que se inventaba con el id).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import ProductDetail from './ProductDetail';
import { CartContext } from '../context/CartContext';
import { FavoritesContext } from '../context/FavoritesContext';
import { getMuebleById } from '../services/api';
import { PLACEHOLDER_IMG } from '../utils/images';

vi.mock('../services/api');

const MUEBLE = {
  id: 'a1b2c3d4-0000-4000-8000-000000000000',
  nombre: 'Aparador de roble',
  categoria: 'Mesas y mobiliario',
  descripcion: 'Restaurado en el taller',
  precio_venta: 1250,
  precio_alquiler_dia: 40,
  imagenes: ['https://img.test/1.jpg', 'https://img.test/2.jpg'],
  estado: 'disponible',
  referencia: 'NAV-MES-004'
};

const montar = async (mueble = MUEBLE, { favorites = [], cestaLlena = false } = {}) => {
  getMuebleById.mockResolvedValue(mueble);
  const addToCart = vi.fn();
  const toggleFavorite = vi.fn();
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={['/', `/mueble/${MUEBLE.id}`]} initialIndex={1}>
      <CartContext.Provider value={{ addToCart, cestaLlena }}>
        <FavoritesContext.Provider value={{ favorites, toggleFavorite }}>
          <Routes>
            <Route path="/" element={<p>Portada</p>} />
            <Route path="/mueble/:id" element={<ProductDetail />} />
            <Route path="/contacto" element={<p>Página de contacto</p>} />
          </Routes>
        </FavoritesContext.Provider>
      </CartContext.Provider>
    </MemoryRouter>
  );
  if (mueble) await screen.findByRole('heading', { level: 1 });
  return { user, addToCart, toggleFavorite };
};
const imagenPrincipal = () => document.querySelector('.pd-main-image');
const opcion = (texto) => screen.getByText(texto).closest('button');

beforeEach(() => {
  vi.resetAllMocks();
});

describe('ProductDetail — cesta llena (H35)', () => {
  it('con la cesta en el máximo, el botón queda desactivado y se explica por qué', async () => {
    await montar(MUEBLE, { cestaLlena: true });

    const boton = screen.getByRole('button', { name: 'Cesta llena' });
    expect(boton).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(/el máximo por pedido/);
  });

  it('sin la cesta llena, ni aviso ni botón desactivado', async () => {
    await montar();

    expect(screen.getByRole('button', { name: 'Añadir a mi cesta' })).toBeEnabled();
    expect(screen.queryByText(/el máximo por pedido/)).not.toBeInTheDocument();
  });

  it('una pieza vendida dice "Agotado" aunque la cesta esté llena, sin el aviso', async () => {
    await montar({ ...MUEBLE, estado: 'vendido' }, { cestaLlena: true });

    expect(screen.getByRole('button', { name: 'Agotado' })).toBeDisabled();
    expect(screen.queryByText(/el máximo por pedido/)).not.toBeInTheDocument();
  });
});

describe('ProductDetail', () => {
  it('pide el mueble del id de la ruta y enseña nombre, categoría, referencia, precio y descripción', async () => {
    await montar();

    expect(getMuebleById).toHaveBeenCalledWith(MUEBLE.id);
    expect(screen.getByRole('heading', { level: 1, name: 'Aparador de roble' })).toBeInTheDocument();
    expect(screen.getByText('Mesas y mobiliario')).toBeInTheDocument();
    expect(screen.getByText('Ref. NAV-MES-004')).toHaveClass('ref-producto', 'pd-ref');
    expect(document.querySelector('.pd-price')).toHaveTextContent(/^1250 €$/);
    expect(screen.getByText('Restaurado en el taller')).toBeInTheDocument();
  });

  it('ya no se inventa una "Ref. SKU-…" con el id; sin referencia, no hay ninguna', async () => {
    await montar({ ...MUEBLE, referencia: null });

    expect(screen.queryByText(/SKU/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Ref\./)).not.toBeInTheDocument();
  });

  it('mientras carga, enseña el cargador', async () => {
    getMuebleById.mockReturnValue(new Promise(() => {}));
    render(
      <MemoryRouter>
        <CartContext.Provider value={{ addToCart: vi.fn() }}>
          <FavoritesContext.Provider value={{ favorites: [], toggleFavorite: vi.fn() }}>
            <ProductDetail />
          </FavoritesContext.Provider>
        </CartContext.Provider>
      </MemoryRouter>
    );
    expect(document.querySelector('.pd-loader')).toBeInTheDocument();
  });

  it('si no existe (o falla la petición), "Pieza no encontrada" y un botón que lleva a la portada', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    getMuebleById.mockRejectedValue(new Error('red caída'));
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/mueble/x']}>
        <CartContext.Provider value={{ addToCart: vi.fn() }}>
          <FavoritesContext.Provider value={{ favorites: [], toggleFavorite: vi.fn() }}>
            <Routes>
              <Route path="/" element={<p>Portada</p>} />
              <Route path="/mueble/:id" element={<ProductDetail />} />
            </Routes>
          </FavoritesContext.Provider>
        </CartContext.Provider>
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Pieza no encontrada' })).toBeInTheDocument();
    expect(error).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Volver al catálogo' }));
    expect(screen.getByText('Portada')).toBeInTheDocument();
  });

  it('si la API no devuelve nada, también "Pieza no encontrada"', async () => {
    await montar(null);
    expect(await screen.findByRole('heading', { name: 'Pieza no encontrada' })).toBeInTheDocument();
  });

  it('"Volver a la colección" vuelve a la página anterior', async () => {
    const { user } = await montar();
    await user.click(screen.getByRole('button', { name: /Volver a la colección/ }));
    expect(screen.getByText('Portada')).toBeInTheDocument();
  });

  it('las miniaturas cambian la foto principal', async () => {
    const { user } = await montar();
    expect(imagenPrincipal()).toHaveAttribute('src', 'https://img.test/1.jpg');

    await user.click(screen.getByRole('img', { name: 'Miniatura 2' }).closest('button'));
    expect(imagenPrincipal()).toHaveAttribute('src', 'https://img.test/2.jpg');
    expect(screen.getByRole('img', { name: 'Miniatura 2' }).closest('button')).toHaveClass('active');
  });

  it('la foto principal es la grande aunque tenga miniatura para las tarjetas (H61)', async () => {
    const foto = 'https://x.supabase.co/storage/v1/object/public/imagenes/muebles/abc-1791300000000';
    await montar({ ...MUEBLE, imagenes: [`${foto}-full.webp`] });
    expect(imagenPrincipal()).toHaveAttribute('src', `${foto}-full.webp`);
  });

  it('sin fotos, la imagen genérica y sin miniaturas', async () => {
    await montar({ ...MUEBLE, imagenes: [] });
    expect(imagenPrincipal()).toHaveAttribute('src', PLACEHOLDER_IMG);
    expect(document.querySelector('.pd-thumbnails')).toBeNull();
  });

  it('el corazón marca y desmarca favorito, y se rellena si ya lo es', async () => {
    const { user, toggleFavorite } = await montar(MUEBLE, { favorites: [MUEBLE.id] });
    const corazon = screen.getByRole('button', { name: 'Añadir a favoritos' });
    expect(corazon.querySelector('svg')).toHaveAttribute('fill', 'var(--accent-color)');

    await user.click(corazon);
    expect(toggleFavorite).toHaveBeenCalledWith(MUEBLE.id);
  });

  it('añade a la cesta en compra por defecto, o en alquiler si se elige', async () => {
    const { user, addToCart } = await montar();

    await user.click(screen.getByRole('button', { name: 'Añadir a mi cesta' }));
    expect(addToCart).toHaveBeenLastCalledWith(MUEBLE, 'compra');

    await user.click(opcion('Alquilar por días'));
    expect(opcion('Alquilar por días')).toHaveClass('active');
    await user.click(screen.getByRole('button', { name: 'Añadir a mi cesta' }));
    expect(addToCart).toHaveBeenLastCalledWith(MUEBLE, 'alquiler');

    await user.click(opcion('Comprar pieza única'));
    expect(opcion('Comprar pieza única')).toHaveClass('active');
  });

  // CAMBIADO A PROPÓSITO (fase C, 2 oct 2026): sin precio de venta enseña el de alquiler (antes, "Consultar precio"
  // aunque lo tuviera), como el resto del catálogo.
  it('sin precio de venta empieza en alquiler y enseña el precio de alquiler', async () => {
    await montar({ ...MUEBLE, precio_venta: null });
    expect(document.querySelector('.pd-price')).toHaveTextContent(/^40 €\/día$/);
    expect(opcion('Alquilar por días')).toHaveClass('active');
  });

  it('sin ningún precio, "Consultar precio"', async () => {
    await montar({ ...MUEBLE, precio_venta: null, precio_alquiler_dia: null });
    expect(document.querySelector('.pd-price')).toHaveTextContent(/^Consultar precio$/);
  });

  it('sin precio de alquiler, esa opción está desactivada y dice "No disponible"', async () => {
    await montar({ ...MUEBLE, precio_alquiler_dia: null });
    expect(opcion('Alquilar por días')).toBeDisabled();
    expect(within(opcion('Alquilar por días')).getByText('No disponible')).toBeInTheDocument();
  });

  it.each([
    ['vendido', 'Vendido', 'Agotado'],
    ['alquilado', 'Alquilado', 'Actualmente alquilado']
  ])('%s: lo marca sobre la foto y no deja añadirlo a la cesta', async (estado, banda, boton) => {
    await montar({ ...MUEBLE, estado });
    expect(document.querySelector('.pd-status-banner')).toHaveTextContent(banda);
    expect(screen.getByRole('button', { name: boton })).toBeDisabled();
  });

  it('sin categoría, enseña "Selected Collection"', async () => {
    await montar({ ...MUEBLE, categoria: null });
    expect(screen.getByText('Selected Collection')).toBeInTheDocument();
  });

  it('el acordeón abre una sección cada vez y se cierra al pulsarla otra vez', async () => {
    const { user } = await montar();
    const detalles = screen.getByRole('button', { name: /Detalles del artículo/ });
    const envios = screen.getByRole('button', { name: /Envíos y devoluciones/ });
    const contenido = (boton) => boton.nextElementSibling;

    await user.click(detalles);
    expect(contenido(detalles)).toHaveClass('open');
    expect(detalles).toHaveTextContent('−');

    await user.click(envios);
    expect(contenido(envios)).toHaveClass('open');
    expect(contenido(detalles)).not.toHaveClass('open');

    await user.click(envios);
    expect(contenido(envios)).not.toHaveClass('open');
  });
});

// C3: sin precios a la vista, la ficha no vende: pregunta.
describe('ProductDetail — sin precios, "Preguntar por esta pieza" (fase C)', () => {
  const SIN_PRECIOS = { ...MUEBLE, precio_venta: null, precio_alquiler_dia: null };

  it('enlace a contacto con la pieza, sin "Añadir a mi cesta" ni las opciones de cantidad y modalidad', async () => {
    await montar(SIN_PRECIOS);

    const enlace = screen.getByRole('link', { name: 'Preguntar por esta pieza' });
    expect(enlace).toHaveAttribute('href', '/contacto?pieza=Aparador+de+roble&ref=NAV-MES-004');
    expect(enlace).toHaveClass('pd-cta-btn');
    expect(screen.queryByRole('button', { name: 'Añadir a mi cesta' })).not.toBeInTheDocument();
    expect(screen.queryByText('Modalidad')).not.toBeInTheDocument();
    expect(screen.queryByText('Cantidad')).not.toBeInTheDocument();
    expect(document.querySelector('.pd-price')).toHaveTextContent('Consultar precio');
  });

  it('pulsarlo lleva a contacto y no añade nada a la cesta', async () => {
    const { user, addToCart } = await montar(SIN_PRECIOS);
    await user.click(screen.getByRole('link', { name: 'Preguntar por esta pieza' }));

    expect(screen.getByText('Página de contacto')).toBeInTheDocument();
    expect(addToCart).not.toHaveBeenCalled();
  });

  it('vendida sin precios: "Agotado", no se pregunta', async () => {
    await montar({ ...SIN_PRECIOS, estado: 'vendido' });
    expect(screen.getByRole('button', { name: 'Agotado' })).toBeDisabled();
    expect(screen.queryByRole('link', { name: 'Preguntar por esta pieza' })).not.toBeInTheDocument();
  });

  it('con precios (MOSTRAR_PRECIOS=true), "Añadir a mi cesta" como siempre', async () => {
    await montar();
    expect(screen.getByRole('button', { name: 'Añadir a mi cesta' })).toBeEnabled();
    expect(screen.queryByRole('link', { name: 'Preguntar por esta pieza' })).not.toBeInTheDocument();
  });
});

// Tarea 4 (7 oct 2026): el <title>, la descripción y la imagen para compartir de cada ficha. Solo con
// JavaScript (las vistas previas de WhatsApp o redes no lo ven: H34).
describe('ProductDetail — título, descripción y og:image de la ficha', () => {
  const meta = (selector) => document.head.querySelector(selector)?.getAttribute('content');
  const OTRA = {
    ...MUEBLE,
    id: 'b2b2b2b2-0000-4000-8000-000000000000',
    nombre: 'Lámpara de latón',
    descripcion: null,
    imagenes: ['https://img.test/lampara-1.jpg']
  };

  // Con un enlace fuera de las rutas para ir de una ficha a otra, y otro para salir a la portada.
  const montarConEnlaces = async () => {
    getMuebleById.mockImplementation(async (id) => [MUEBLE, OTRA].find((m) => m.id === id) ?? null);
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={[`/mueble/${MUEBLE.id}`]}>
        <CartContext.Provider value={{ addToCart: vi.fn(), cestaLlena: false }}>
          <FavoritesContext.Provider value={{ favorites: [], toggleFavorite: vi.fn() }}>
            <Link to={`/mueble/${OTRA.id}`}>Ir a la otra pieza</Link>
            <Link to="/">Ir a la portada</Link>
            <Routes>
              <Route path="/" element={<p>Portada</p>} />
              <Route path="/mueble/:id" element={<ProductDetail />} />
            </Routes>
          </FavoritesContext.Provider>
        </CartContext.Provider>
      </MemoryRouter>
    );
    await screen.findByRole('heading', { level: 1, name: MUEBLE.nombre });
    return { user };
  };

  it('al abrir una ficha: título con el nombre, su descripción y su primera foto', async () => {
    await montar();

    expect(document.title).toBe('Aparador de roble | Nave 5 Barcelona');
    expect(meta('meta[name="description"]')).toBe('Restaurado en el taller');
    expect(meta('meta[property="og:description"]')).toBe('Restaurado en el taller');
    expect(meta('meta[property="og:title"]')).toBe('Aparador de roble | Nave 5 Barcelona');
    expect(meta('meta[property="og:image"]')).toBe('https://img.test/1.jpg');
    expect(meta('meta[name="twitter:image"]')).toBe('https://img.test/1.jpg');
  });

  it('una descripción larga se resume a 150 caracteres como mucho', async () => {
    const larga = `Aparador de roble macizo ${'con mucha historia '.repeat(12)}y herrajes originales.`;
    await montar({ ...MUEBLE, descripcion: larga });

    const descripcion = meta('meta[name="description"]');
    expect(descripcion.length).toBeLessThanOrEqual(150);
    expect(descripcion.endsWith('…')).toBe(true);
    expect(larga.startsWith(descripcion.slice(0, -1))).toBe(true);
  });

  it('el og:image sigue siendo la primera foto aunque se mire otra en la ficha', async () => {
    const { user } = await montar();

    await user.click(screen.getByRole('img', { name: 'Miniatura 2' }).closest('button'));

    expect(imagenPrincipal()).toHaveAttribute('src', 'https://img.test/2.jpg');
    expect(meta('meta[property="og:image"]')).toBe('https://img.test/1.jpg');
  });

  it('sin fotos, la imagen para compartir de la web (no la imagen genérica de "sin foto")', async () => {
    await montar({ ...MUEBLE, imagenes: [] });
    expect(meta('meta[property="og:image"]')).toBe('/og-image.png');
  });

  it('al pasar a otra ficha cambian el título, la descripción y la imagen; al salir, vuelven los de la web', async () => {
    const { user } = await montarConEnlaces();
    expect(meta('meta[property="og:image"]')).toBe('https://img.test/1.jpg');

    await user.click(screen.getByRole('link', { name: 'Ir a la otra pieza' }));
    await screen.findByRole('heading', { level: 1, name: OTRA.nombre });

    expect(document.title).toBe('Lámpara de latón | Nave 5 Barcelona');
    expect(meta('meta[name="description"]')).toBe(
      'Lámpara de latón — pieza única disponible en Nave 5 Barcelona.'
    );
    expect(meta('meta[property="og:image"]')).toBe('https://img.test/lampara-1.jpg');

    await user.click(screen.getByRole('link', { name: 'Ir a la portada' }));
    expect(await screen.findByText('Portada')).toBeInTheDocument();
    expect(document.title).toBe('Nave 5 Barcelona | Almacén de ideas');
    expect(meta('meta[property="og:image"]')).toBe('/og-image.png');
    expect(meta('meta[name="description"]')).toMatch(/^Almacén de ideas en el corazón de Barcelona/);
  });
});
