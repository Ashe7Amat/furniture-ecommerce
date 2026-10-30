// Ficha de un mueble (/mueble/:id). No tenía tests: se añaden con A6, al empezar a enseñar aquí la
// referencia real (y quitar la "Ref. SKU-…" que se inventaba con el id).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import ProductDetail from './ProductDetail';
import { extraerMedidas } from '../utils/medidas';
import { CartContext } from '../context/CartContext';
import { FavoritesContext } from '../context/FavoritesContext';
import { getMuebleById } from '../services/api';
import { PLACEHOLDER_IMG } from '../utils/images';
// Reservas por fechas (al final del archivo)
import { afterEach } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import { getDisponibilidad, getPresupuestoReserva, crearSesionPagoReserva } from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import { BRAND } from '../theme/brand.config';

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
  vi.stubEnv('VITE_RESERVAS_ACTIVAS', '');
});
afterEach(() => {
  vi.unstubAllEnvs();
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

    await user.click(screen.getByRole('img', { name: /, foto 2 de \d+$/ }).closest('button'));
    expect(imagenPrincipal()).toHaveAttribute('src', 'https://img.test/2.jpg');
    expect(screen.getByRole('img', { name: /, foto 2 de \d+$/ }).closest('button')).toHaveClass('active');
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

  it('sin categoría, las migas acaban en "Catálogo" (antes salía "Selected Collection", en inglés)', async () => {
    await montar({ ...MUEBLE, categoria: null });
    const breadcrumbs = screen.getByRole('navigation', { name: 'Migas de pan' });
    expect(within(breadcrumbs).getAllByRole('link').map((a) => a.textContent)).toEqual(['Inicio', 'Catálogo']);
    expect(screen.queryByText('Selected Collection')).not.toBeInTheDocument();
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

// CAMBIADO A PROPÓSITO (rediseño premium, 22 oct 2026): sin precios a la vista, el CTA principal es
// el botón negro "Solicitar información", que abre el modal de contacto con la referencia pre-rellenada.
describe('ProductDetail — "Cantidad" y "Modalidad" como títulos de grupo (H53)', () => {
  it('son grupos con nombre, y la modalidad elegida se anuncia como pulsada', async () => {
    const { user } = await montar();

    expect(screen.getByRole('group', { name: 'Cantidad' })).toBeInTheDocument();
    const modalidad = screen.getByRole('group', { name: 'Modalidad' });
    const comprar = within(modalidad).getByRole('button', { name: /Comprar pieza única/ });
    const alquilar = within(modalidad).getByRole('button', { name: /Alquilar por días/ });
    expect(comprar).toHaveAttribute('aria-pressed', 'true');
    expect(alquilar).toHaveAttribute('aria-pressed', 'false');

    await user.click(alquilar);
    expect(comprar).toHaveAttribute('aria-pressed', 'false');
    expect(alquilar).toHaveAttribute('aria-pressed', 'true');
  });

  it('ya no son <label> sin campo', async () => {
    await montar();
    expect(screen.getByText('Cantidad').tagName).not.toBe('LABEL');
    expect(screen.getByText('Modalidad').tagName).not.toBe('LABEL');
  });
});

describe('ProductDetail — sin precios, "Solicitar información" (rediseño premium)', () => {
  const SIN_PRECIOS = { ...MUEBLE, precio_venta: null, precio_alquiler_dia: null };

  it('botón para solicitar información, sin "Añadir a mi cesta" ni las opciones de cantidad y modalidad', async () => {
    await montar(SIN_PRECIOS);

    const boton = screen.getByRole('button', { name: 'Solicitar información' });
    expect(boton).toBeInTheDocument();
    expect(boton).toHaveClass('pd-cta-solicitar');
    expect(screen.queryByRole('button', { name: 'Añadir a mi cesta' })).not.toBeInTheDocument();
    expect(screen.queryByText('Modalidad')).not.toBeInTheDocument();
    expect(screen.queryByText('Cantidad')).not.toBeInTheDocument();
    expect(document.querySelector('.pd-price')).toHaveTextContent('Consultar precio');
  });

  it('pulsarlo abre el modal de contacto con la pieza y referencia pre-rellenadas', async () => {
    const { user, addToCart } = await montar(SIN_PRECIOS);
    await user.click(screen.getByRole('button', { name: 'Solicitar información' }));

    const modal = screen.getByRole('dialog', { name: 'Solicitar información' });
    expect(modal).toBeInTheDocument();
    expect(within(modal).getByText('Aparador de roble')).toBeInTheDocument();
    expect(within(modal).getByText('Ref. NAV-MES-004')).toBeInTheDocument();
    expect(within(modal).getByLabelText('Mensaje')).toHaveValue(
      'Hola, me interesa la pieza "Aparador de roble" (ref. NAV-MES-004). ¿Me podéis dar más información?'
    );
    expect(addToCart).not.toHaveBeenCalled();
  });

  it('vendida sin precios: "Agotado", no se solicita información', async () => {
    await montar({ ...SIN_PRECIOS, estado: 'vendido' });
    expect(screen.getByRole('button', { name: 'Agotado' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Solicitar información' })).not.toBeInTheDocument();
  });

  it('con precios (MOSTRAR_PRECIOS=true), "Añadir a mi cesta" como compra principal y opción de solicitar información', async () => {
    await montar();
    expect(screen.getByRole('button', { name: 'Añadir a mi cesta' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Solicitar información' })).toBeInTheDocument();
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

    expect(document.title).toBe(`Aparador de roble | ${BRAND.nombre}`);
    expect(meta('meta[name="description"]')).toBe(`Aparador de roble. Restaurado en el taller. Pieza única en ${BRAND.nombre}.`);
    expect(meta('meta[property="og:description"]')).toBe(`Aparador de roble. Restaurado en el taller. Pieza única en ${BRAND.nombre}.`);
    expect(meta('meta[property="og:title"]')).toBe(`Aparador de roble | ${BRAND.nombre}`);
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

    await user.click(screen.getByRole('img', { name: /, foto 2 de \d+$/ }).closest('button'));

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

    expect(document.title).toBe(`Lámpara de latón | ${BRAND.nombre}`);
    expect(meta('meta[name="description"]')).toBe(
      `Lámpara de latón — pieza única en ${BRAND.nombre}, ${BRAND.tipoNegocio} en ${BRAND.contacto.ciudad}.`
    );
    expect(meta('meta[property="og:image"]')).toBe('https://img.test/lampara-1.jpg');

    await user.click(screen.getByRole('link', { name: 'Ir a la portada' }));
    expect(await screen.findByText('Portada')).toBeInTheDocument();
    expect(document.title).toBe(`${BRAND.nombre} | ${BRAND.eslogan}`);
    expect(meta('meta[property="og:image"]')).toBe('/og-image.png');
    expect(meta('meta[name="description"]')).toBe(BRAND.descripcion);
  });
});

// ─── Reservas por fechas (docs/reservas-diseno.md, 6.2 y 6.7), detrás de VITE_RESERVAS_ACTIVAS ───

// Hoy es el lunes 2 de noviembre de 2026. Ocupado del 10 al 14 de noviembre.
const DISPONIBILIDAD = {
  mueble_id: MUEBLE.id,
  zona_horaria: 'Europe/Madrid',
  hoy: '2026-11-02',
  alquilable: true,
  comprable: true,
  motivo_no_comprable: null,
  comprable_desde: null,
  precio_dia_centimos: 4000,
  reglas: {
    version: 1,
    duracion_min_dias: 1,
    duracion_max_dias: 30,
    antelacion_min_dias: 2,
    antelacion_max_meses: 1,
    dias_margen: 2,
    tramos_descuento: []
  },
  primer_inicio_posible: '2026-11-04',
  ultimo_inicio_posible: '2026-12-02',
  ocupado: [{ desde: '2026-11-10', hasta: '2026-11-15', tipo: 'reservado' }]
};
const disponibilidad = (extra = {}) => ({ data: { ...DISPONIBILIDAD, ...extra }, error: null, status: 200 });
const FALLO = { data: null, error: 'No se ha podido consultar la disponibilidad.', status: 0 };
const panel = () => screen.queryByRole('region', { name: 'Alquilar por fechas' });

describe('ProductDetail — reservas por fechas, con el interruptor apagado', () => {
  it('ni pide la disponibilidad ni enseña nada nuevo: sigue "Alquilar por días"', async () => {
    getDisponibilidad.mockResolvedValue(disponibilidad());
    await montar();
    await act(async () => {});

    expect(getDisponibilidad).not.toHaveBeenCalled();
    expect(panel()).not.toBeInTheDocument();
    expect(opcion('Alquilar por días')).toBeInTheDocument();
  });
});

describe('ProductDetail — reservas por fechas, con el interruptor encendido', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_RESERVAS_ACTIVAS', 'true');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('pide la disponibilidad de la pieza una vez cargada y enseña "Alquilar por fechas"', async () => {
    getDisponibilidad.mockResolvedValue(disponibilidad());
    await montar();

    expect(await screen.findByRole('region', { name: 'Alquilar por fechas' })).toBeInTheDocument();
    expect(getDisponibilidad).toHaveBeenCalledTimes(1);
    expect(getDisponibilidad).toHaveBeenCalledWith(MUEBLE.id);
    expect(screen.getByRole('button', { name: 'miércoles, 4 de noviembre de 2026' })).toBeEnabled();
  });

  it('la cesta es solo para comprar: sin "Modalidad" ni "Alquilar por días", y se añade como compra', async () => {
    getDisponibilidad.mockResolvedValue(disponibilidad());
    const { user, addToCart } = await montar();
    await screen.findByRole('region', { name: 'Alquilar por fechas' });

    expect(screen.queryByText('Alquilar por días')).not.toBeInTheDocument();
    expect(screen.queryByText('Modalidad')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Añadir a mi cesta' }));
    expect(addToCart).toHaveBeenCalledWith(MUEBLE, 'compra');
  });

  it.each([
    ['no se puede alquilar', { alquilable: false }],
    ['los precios están ocultos', { precio_dia_centimos: null }]
  ])('si %s, sin calendario y la compra como siempre', async (_caso, extra) => {
    getDisponibilidad.mockResolvedValue(disponibilidad(extra));
    await montar();
    await waitFor(() => expect(getDisponibilidad).toHaveBeenCalled());
    await act(async () => {});

    expect(panel()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Añadir a mi cesta' })).toBeEnabled();
  });

  it('si la disponibilidad falla, la ficha sigue como siempre: sin calendario y sin bloquear la compra', async () => {
    getDisponibilidad.mockResolvedValue(FALLO);
    await montar();
    await waitFor(() => expect(getDisponibilidad).toHaveBeenCalled());
    await act(async () => {});

    expect(panel()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Añadir a mi cesta' })).toBeEnabled();
    expect(screen.queryByText(/tiene reservas/)).not.toBeInTheDocument();
  });

  it('con reservas que llegan a hoy no se puede comprar: botón desactivado, hasta cuándo y "Preguntar"', async () => {
    getDisponibilidad.mockResolvedValue(
      disponibilidad({ comprable: false, motivo_no_comprable: 'reservas_activas', comprable_desde: '2026-11-20' })
    );
    await montar();

    const aviso = await screen.findByText(/Esta pieza tiene reservas hasta el 19 de noviembre de 2026\./);
    expect(aviso).toHaveTextContent(
      'Esta pieza tiene reservas hasta el 19 de noviembre de 2026. Si quieres comprarla, pregúntanos. Preguntar por esta pieza'
    );
    expect(within(aviso).getByRole('link', { name: 'Preguntar por esta pieza' })).toHaveAttribute(
      'href',
      '/contacto?pieza=Aparador+de+roble&ref=NAV-MES-004'
    );
    const boton = screen.getByRole('button', { name: 'Añadir a mi cesta' });
    expect(boton).toBeDisabled();
    expect(boton).toHaveAccessibleDescription(/Esta pieza tiene reservas hasta el 19 de noviembre de 2026/);
    // El alquiler sigue disponible
    expect(panel()).toBeInTheDocument();
  });

  it('sin fecha de fin de las reservas, lo dice sin fecha', async () => {
    getDisponibilidad.mockResolvedValue(
      disponibilidad({ comprable: false, motivo_no_comprable: 'reservas_activas', comprable_desde: null })
    );
    await montar();
    expect(await screen.findByText(/^Esta pieza tiene reservas\. Si quieres comprarla, pregúntanos\./)).toBeInTheDocument();
  });

  it('no comprable por otro motivo (vendida): sin el aviso de reservas', async () => {
    getDisponibilidad.mockResolvedValue(
      disponibilidad({ alquilable: false, comprable: false, motivo_no_comprable: 'vendida' })
    );
    await montar({ ...MUEBLE, estado: 'vendido' });
    await waitFor(() => expect(getDisponibilidad).toHaveBeenCalled());
    await act(async () => {});

    expect(screen.queryByText(/tiene reservas/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agotado' })).toBeDisabled();
  });

  it('vendida en el calendario (venta con entrega diferida) aunque el catálogo la tenga disponible: "Agotado" desactivado', async () => {
    getDisponibilidad.mockResolvedValue(
      disponibilidad({ alquilable: false, comprable: false, motivo_no_comprable: 'vendida' })
    );
    await montar();
    await waitFor(() => expect(getDisponibilidad).toHaveBeenCalled());
    await act(async () => {});

    expect(screen.getByRole('button', { name: 'Agotado' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Añadir a mi cesta' })).not.toBeInTheDocument();
    expect(screen.queryByText(/tiene reservas/)).not.toBeInTheDocument();
  });

  describe('una pieza sin precio de venta (solo alquiler)', () => {
    const SOLO_ALQUILER = { ...MUEBLE, precio_venta: null };

    it('no va a la cesta: el calendario es la forma de alquilarla', async () => {
      getDisponibilidad.mockResolvedValue(disponibilidad());
      await montar(SOLO_ALQUILER);

      expect(await screen.findByRole('region', { name: 'Alquilar por fechas' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Añadir a mi cesta' })).not.toBeInTheDocument();
      expect(screen.queryByText('Cantidad')).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Preguntar por esta pieza' })).not.toBeInTheDocument();
    });

    // CAMBIADO A PROPÓSITO (rediseño premium, 22 oct 2026): si falla la disponibilidad o no se puede alquilar,
    // se ofrece el botón "Solicitar información".
    it('mientras llega la disponibilidad no ofrece nada; si falla o no se puede alquilar, "Solicitar información"', async () => {
      let responder;
      getDisponibilidad.mockReturnValue(new Promise((r) => (responder = r)));
      await montar(SOLO_ALQUILER);
      expect(screen.queryByRole('button', { name: 'Solicitar información' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Añadir a mi cesta' })).not.toBeInTheDocument();

      await act(async () => responder(FALLO));
      expect(screen.getByRole('button', { name: 'Solicitar información' })).toHaveClass('pd-cta-btn');
      expect(panel()).not.toBeInTheDocument();
    });

    it('vendida, sigue diciendo "Agotado"', async () => {
      getDisponibilidad.mockResolvedValue(disponibilidad({ alquilable: false }));
      await montar({ ...SOLO_ALQUILER, estado: 'vendido' });
      expect(screen.getByRole('button', { name: 'Agotado' })).toBeDisabled();
    });

    it('el precio por día sale una sola vez, arriba; el cuadro de alquiler no lo repite con otro formato', async () => {
      getDisponibilidad.mockResolvedValue(disponibilidad());
      await montar(SOLO_ALQUILER);

      await screen.findByRole('region', { name: 'Alquilar por fechas' });
      expect(document.querySelector('.pd-price')).toHaveTextContent('40 €/día');
      expect(document.querySelector('.reserva-panel-precio')).not.toBeInTheDocument();
      // Las reglas del alquiler siguen en el cuadro
      expect(screen.getByText(/^Mínimo 1 día, máximo 30 días\./)).toBeInTheDocument();
    });

    it('una pieza con precio de venta sí enseña el precio por día en el cuadro (arriba va el de venta)', async () => {
      getDisponibilidad.mockResolvedValue(disponibilidad());
      await montar();

      await screen.findByRole('region', { name: 'Alquilar por fechas' });
      expect(document.querySelector('.reserva-panel-precio')).toHaveTextContent('al día');
    });
  });

  describe('una pieza marcada a mano como alquilada', () => {
    const ALQUILADA = { ...MUEBLE, estado: 'alquilado' };

    it('no ofrece fechas libres: dice que está alquilada y deja preguntar', async () => {
      getDisponibilidad.mockResolvedValue(disponibilidad());
      await montar(ALQUILADA);
      await waitFor(() => expect(getDisponibilidad).toHaveBeenCalled());
      await act(async () => {});

      expect(panel()).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Actualmente alquilado' })).toBeDisabled();
      const aviso = screen.getByText(/^Ahora mismo está alquilada\./);
      expect(aviso).toHaveTextContent(
        'Ahora mismo está alquilada. Si te interesa, pregúntanos cuándo estará libre. Preguntar por esta pieza'
      );
      expect(within(aviso).getByRole('link', { name: 'Preguntar por esta pieza' })).toHaveAttribute(
        'href',
        '/contacto?pieza=Aparador+de+roble&ref=NAV-MES-004'
      );
    });

    it('con las reservas apagadas, la ficha es la de siempre: sin ese aviso', async () => {
      vi.stubEnv('VITE_RESERVAS_ACTIVAS', 'false');
      await montar(ALQUILADA);
      await act(async () => {});

      expect(screen.queryByText(/Ahora mismo está alquilada/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Actualmente alquilado' })).toBeDisabled();
    });
  });

  it('al pasar a otra pieza no enseña la disponibilidad de la anterior, aunque llegue tarde', async () => {
    const OTRA = { ...MUEBLE, id: 'b2b2b2b2-0000-4000-8000-000000000000', nombre: 'Lámpara de latón' };
    const respuestas = {};
    getMuebleById.mockImplementation(async (id) => [MUEBLE, OTRA].find((m) => m.id === id));
    getDisponibilidad.mockImplementation((id) => new Promise((r) => (respuestas[id] = r)));
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={[`/mueble/${MUEBLE.id}`]}>
        <CartContext.Provider value={{ addToCart: vi.fn(), cestaLlena: false }}>
          <FavoritesContext.Provider value={{ favorites: [], toggleFavorite: vi.fn() }}>
            <Link to={`/mueble/${OTRA.id}`}>Ir a la otra pieza</Link>
            <Routes>
              <Route path="/mueble/:id" element={<ProductDetail />} />
            </Routes>
          </FavoritesContext.Provider>
        </CartContext.Provider>
      </MemoryRouter>
    );
    await screen.findByRole('heading', { level: 1, name: MUEBLE.nombre });
    await waitFor(() => expect(respuestas[MUEBLE.id]).toBeDefined());

    await user.click(screen.getByRole('link', { name: 'Ir a la otra pieza' }));
    await screen.findByRole('heading', { level: 1, name: OTRA.nombre });
    await waitFor(() => expect(respuestas[OTRA.id]).toBeDefined());

    // La de la primera pieza llega tarde: no se usa
    await act(async () => respuestas[MUEBLE.id](disponibilidad({ comprable: false, motivo_no_comprable: 'reservas_activas' })));
    expect(panel()).not.toBeInTheDocument();
    expect(screen.queryByText(/tiene reservas/)).not.toBeInTheDocument();

    await act(async () => respuestas[OTRA.id](disponibilidad({ mueble_id: OTRA.id })));
    expect(await screen.findByRole('region', { name: 'Alquilar por fechas' })).toBeInTheDocument();
  });

  describe('tras un 409 al reservar', () => {
    const ANA = { nombre: 'Ana', email: 'ana@correo.es', email_verificado: true };
    const PRESUPUESTO = {
      fecha_inicio: '2026-11-04',
      hora_entrega: '10:00',
      fecha_fin: '2026-11-07',
      hora_recogida: '10:00',
      dias: 3,
      precio_dia_centimos: 4000,
      subtotal_alquiler_centimos: 12000,
      tramo: null,
      descuento_centimos: 0,
      entrega: { modo: 'domicilio', importe_centimos: 0 },
      recogida: { modo: 'domicilio', importe_centimos: 0 },
      importe_total_centimos: 12000,
      lineas: []
    };

    const reservarConConflicto = async () => {
      getMuebleById.mockResolvedValue(MUEBLE);
      getPresupuestoReserva.mockResolvedValue({ data: PRESUPUESTO, error: null, status: 200 });
      crearSesionPagoReserva.mockResolvedValue({ data: null, error: 'Esas fechas se acaban de reservar.', status: 409 });
      const user = userEvent.setup();
      render(
        <MemoryRouter initialEntries={[`/mueble/${MUEBLE.id}`]}>
          <ToastContext.Provider value={{ showToast: vi.fn() }}>
            <AuthContext.Provider value={{ user: ANA }}>
              <CartContext.Provider value={{ addToCart: vi.fn(), cestaLlena: false }}>
                <FavoritesContext.Provider value={{ favorites: [], toggleFavorite: vi.fn() }}>
                  <Routes>
                    <Route path="/mueble/:id" element={<ProductDetail />} />
                  </Routes>
                </FavoritesContext.Provider>
              </CartContext.Provider>
            </AuthContext.Provider>
          </ToastContext.Provider>
        </MemoryRouter>
      );
      await screen.findByRole('region', { name: 'Alquilar por fechas' });
      await user.click(screen.getByRole('button', { name: 'miércoles, 4 de noviembre de 2026' }));
      await user.click(screen.getByRole('button', { name: 'sábado, 7 de noviembre de 2026' }));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Reservar' })).toBeEnabled());
      await user.click(screen.getByRole('button', { name: 'Reservar' }));
      const dialogo = screen.getByRole('dialog', { name: 'Confirma tu reserva' });
      await user.type(within(dialogo).getByLabelText('Teléfono'), '600123123');
      await user.type(within(dialogo).getByLabelText('Dirección de entrega y recogida'), 'Calle Mayor 1');
      await user.click(within(dialogo).getByRole('checkbox'));
      await user.click(within(dialogo).getByRole('button', { name: /^Pagar/ }));
      return { user };
    };

    it('vuelve a pedir la disponibilidad y el calendario enseña lo que se acaba de ocupar', async () => {
      getDisponibilidad
        .mockResolvedValueOnce(disponibilidad())
        .mockResolvedValueOnce(
          disponibilidad({
            ocupado: [
              { desde: '2026-11-04', hasta: '2026-11-10', tipo: 'reservado' },
              ...DISPONIBILIDAD.ocupado
            ]
          })
        );
      await reservarConConflicto();

      expect(screen.getByRole('alert')).toHaveTextContent('Esas fechas se acaban de reservar.');
      await waitFor(() => expect(getDisponibilidad).toHaveBeenCalledTimes(2));
      expect(
        await screen.findByRole('button', { name: 'miércoles, 4 de noviembre de 2026, no disponible: ocupado' })
      ).toBeDisabled();
    });

    it('si esa recarga falla, se queda el calendario que había', async () => {
      getDisponibilidad.mockResolvedValueOnce(disponibilidad()).mockResolvedValueOnce(FALLO);
      await reservarConConflicto();

      await waitFor(() => expect(getDisponibilidad).toHaveBeenCalledTimes(2));
      await act(async () => {});
      expect(panel()).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'miércoles, 4 de noviembre de 2026' })).toBeEnabled();
    });
  });
});

describe('ProductDetail — Rediseño Interior Premium (Fase 2)', () => {
  it('extraerMedidas detecta dimensiones compuestas, simples o devuelve texto por defecto', () => {
    expect(extraerMedidas('Aparador vintage de roble. Medidas: 120 x 45 x 85 cm en perfecto estado.')).toBe('120 x 45 x 85 cm');
    expect(extraerMedidas('Mesa de centro 80×50 cm restaurada.')).toBe('80×50 cm');
    expect(extraerMedidas('Espejo dorado de 90 cm de diámetro.')).toBe('90 cm');
    expect(extraerMedidas('Silla sin detalles específicos.')).toBe('Medidas bajo consulta');
    expect(extraerMedidas(null)).toBe('Medidas bajo consulta');
  });

  it('renderiza breadcrumbs elegantes con Inicio, Catálogo y la Categoría', async () => {
    await montar({ ...MUEBLE, categoria: 'Iluminación y lámparas' });

    const breadcrumbs = screen.getByRole('navigation', { name: 'Migas de pan' });
    expect(within(breadcrumbs).getByRole('link', { name: 'Inicio' })).toHaveAttribute('href', '/');
    expect(within(breadcrumbs).getByRole('link', { name: 'Catálogo' })).toHaveAttribute('href', '/catalogo');
    expect(within(breadcrumbs).getByRole('link', { name: 'Iluminación y lámparas' })).toHaveAttribute(
      'href',
      '/catalogo?categoria=Iluminaci%C3%B3n%20y%20l%C3%A1mparas'
    );
  });

  it('muestra los tres sellos de confianza de la tienda', async () => {
    await montar();

    expect(screen.getByText('Pieza Única')).toBeInTheDocument();
    expect(screen.getByText('Restaurado a mano')).toBeInTheDocument();
    expect(screen.getByText(`Envío desde ${BRAND.contacto.ciudad}`)).toBeInTheDocument();
  });

  it('muestra detalles técnicos en el acordeón incluyendo medidas extraídas', async () => {
    const { user } = await montar({
      ...MUEBLE,
      descripcion: 'Aparador restaurado. Dimensiones 140 x 50 x 90 cm. Madera de cerezo.'
    });

    const botonDetalles = screen.getByRole('button', { name: /Detalles del artículo/ });
    await user.click(botonDetalles);

    expect(screen.getByText('140 x 50 x 90 cm')).toBeInTheDocument();
    // Sin datos inventados iguales para todas las piezas
    expect(screen.queryByText(/Madera noble/)).not.toBeInTheDocument();
    expect(screen.queryByText(/siglo XX|c\. 1960/)).not.toBeInTheDocument();
    expect(screen.queryByText(/restaurada en nuestro taller/)).not.toBeInTheDocument();
  });

  it('renderiza el contenedor con estructura de grid para el layout 60/40 y galería', async () => {
    await montar();

    const grid = document.querySelector('.pd-grid');
    expect(grid).toBeInTheDocument();
    expect(grid.querySelector('.pd-gallery')).toBeInTheDocument();
    expect(grid.querySelector('.pd-info')).toBeInTheDocument();
    expect(document.querySelector('.pd-main-image-wrapper')).toBeInTheDocument();
  });

  it('permite abrir y cerrar el modal de contacto con el botón Solicitar información', async () => {
    const { user } = await montar({ ...MUEBLE, precio_venta: null, precio_alquiler_dia: null });

    const btn = screen.getByRole('button', { name: 'Solicitar información' });
    await user.click(btn);

    const dialog = screen.getByRole('dialog', { name: 'Solicitar información' });
    expect(dialog).toBeInTheDocument();

    const closeBtn = within(dialog).getByRole('button', { name: 'Cerrar ventana' });
    await user.click(closeBtn);

    expect(screen.queryByRole('dialog', { name: 'Solicitar información' })).not.toBeInTheDocument();
  });
});


describe('ProductDetail, SEO: datos estructurados y canonical', () => {
  // useDocumentMeta pone un solo bloque JSON-LD; la ficha lleva dentro un @graph con los dos.
  const TIPOS = { producto: 'Product', migas: 'BreadcrumbList' };
  const jsonLd = (id) => {
    const script = document.getElementById('structured-data-jsonld');
    return script ? JSON.parse(script.textContent)['@graph']?.find((d) => d['@type'] === TIPOS[id]) ?? null : null;
  };

  it('pone el Product y las migas de la pieza, y el canonical a /mueble/:id', async () => {
    await montar();
    await waitFor(() => expect(jsonLd('producto')).not.toBeNull());

    expect(jsonLd('producto')).toMatchObject({
      '@type': 'Product',
      name: 'Aparador de roble',
      sku: 'NAV-MES-004',
      url: `${BRAND.web}/mueble/${MUEBLE.id}`,
    });
    expect(jsonLd('migas').itemListElement.map((m) => m.name)).toEqual([
      'Inicio',
      'Catálogo',
      'Mesas y mobiliario',
      'Aparador de roble',
    ]);
    expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `${BRAND.web}/mueble/${MUEBLE.id}`
    );
  });

  it('con los precios ocultos (la API los manda a null), el Product no lleva oferta ni precio', async () => {
    await montar({ ...MUEBLE, precio_venta: null, precio_alquiler_dia: null });
    await waitFor(() => expect(jsonLd('producto')).not.toBeNull());

    expect(jsonLd('producto').offers).toBeUndefined();
    expect(document.head.innerHTML).not.toMatch(/"price"/);
  });
});
