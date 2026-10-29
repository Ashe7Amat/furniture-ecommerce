// La barra de modo admin de la ficha pública (21 oct 2026): quién la ve, «Editar en panel» y «Cambiar
// estado». scripts/mutantes/modo-admin.js la usa para la comprobación por mutación. El enlace
// /admin?editar={id} del panel está en src/pages/admin/editarDesdeEnlace.test.jsx.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import ProductDetail from '../pages/ProductDetail';
import { CartContext } from '../context/CartContext';
import { FavoritesContext } from '../context/FavoritesContext';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import { getMuebleById, updateMueble } from '../services/api';

vi.mock('../services/api');

const MUEBLE = {
  id: 'a1b2c3d4-0000-4000-8000-000000000000',
  nombre: 'Aparador de roble',
  categoria: 'Mesas y mobiliario',
  descripcion: 'Restaurado en el taller',
  precio_venta: 1250,
  imagenes: [],
  estado: 'disponible',
  referencia: 'NAV-MES-004'
};
const ADMIN = { id: 'u-admin', nombre: 'Admin Nave 5', rol: 'admin' };
const CLIENTE = { id: 'u-ana', nombre: 'Ana', rol: 'cliente' };

const Ubicacion = () => {
  const { pathname, search } = useLocation();
  return <p>Estás en {pathname + search}</p>;
};

const montar = async ({ usuario = ADMIN, sinContexto = false, mueble = MUEBLE } = {}) => {
  getMuebleById.mockResolvedValue(mueble);
  const showToast = vi.fn();
  const user = userEvent.setup();
  const rutas = (
    <MemoryRouter initialEntries={[`/mueble/${encodeURIComponent(mueble.id)}`]}>
      <CartContext.Provider value={{ addToCart: vi.fn(), cestaLlena: false }}>
        <FavoritesContext.Provider value={{ favorites: [], toggleFavorite: vi.fn() }}>
          <ToastContext.Provider value={{ showToast }}>
            <Routes>
              <Route path="/mueble/:id" element={<ProductDetail />} />
              <Route path="/admin" element={<Ubicacion />} />
            </Routes>
          </ToastContext.Provider>
        </FavoritesContext.Provider>
      </CartContext.Provider>
    </MemoryRouter>
  );
  render(sinContexto ? rutas : <AuthContext.Provider value={{ user: usuario }}>{rutas}</AuthContext.Provider>);
  await screen.findByRole('heading', { level: 1 });
  return { user, showToast };
};
const barra = () => screen.queryByRole('region', { name: 'Modo admin' });
const enBarra = () => within(barra());
const abrirEstados = (user) => user.click(enBarra().getByRole('button', { name: 'Cambiar estado de Aparador de roble' }));

beforeEach(() => {
  vi.resetAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Ficha pública — barra de modo admin', () => {
  it('con un administrador: «Modo admin: {nombre}», el estado y los dos botones', async () => {
    await montar();

    expect(await screen.findByRole('region', { name: 'Modo admin' })).toBeInTheDocument();
    expect(barra()).toHaveTextContent('Modo admin: Aparador de roble');
    expect(enBarra().getByText('Disponible')).toHaveClass('barra-admin-estado');
    expect(enBarra().getByRole('link', { name: 'Editar en panel' })).toHaveAttribute(
      'href',
      `/admin?editar=${MUEBLE.id}`
    );
    expect(enBarra().getByRole('button', { name: 'Cambiar estado de Aparador de roble' })).toHaveTextContent('Cambiar estado');
    expect(document.querySelector('.pd-container')).toHaveClass('con-barra-admin');
  });

  it('con un cliente, no sale', async () => {
    await montar({ usuario: CLIENTE });

    expect(barra()).not.toBeInTheDocument();
    expect(document.querySelector('.pd-container')).not.toHaveClass('con-barra-admin');
  });

  it('sin sesión, no sale', async () => {
    await montar({ usuario: null });
    expect(barra()).not.toBeInTheDocument();
  });

  it('sin el contexto de la sesión, tampoco', async () => {
    await montar({ sinContexto: true });
    expect(barra()).not.toBeInTheDocument();
  });

  it('«Editar en panel» lleva a /admin?editar={id}', async () => {
    const { user } = await montar();

    await user.click(await screen.findByRole('link', { name: 'Editar en panel' }));

    expect(screen.getByText(`Estás en /admin?editar=${MUEBLE.id}`)).toBeInTheDocument();
  });

  it('el id va codificado en el enlace', async () => {
    await montar({ mueble: { ...MUEBLE, id: 'a b/c' } });

    expect(await screen.findByRole('link', { name: 'Editar en panel' })).toHaveAttribute('href', '/admin?editar=a%20b%2Fc');
  });

  it('«Cambiar estado» ofrece los tres estados, con el actual marcado', async () => {
    const { user } = await montar({ mueble: { ...MUEBLE, estado: 'alquilado' } });
    await screen.findByRole('region', { name: 'Modo admin' });

    await abrirEstados(user);

    const opciones = screen.getAllByRole('menuitemradio');
    expect(opciones.map((o) => o.textContent)).toEqual(['Disponible', 'Vendido', 'Alquilado']);
    expect(opciones.map((o) => o.getAttribute('aria-checked'))).toEqual(['false', 'false', 'true']);
    expect(opciones[2].querySelector('svg')).not.toBeNull();
    expect(opciones[0].querySelector('svg')).toBeNull();
    expect(enBarra().getByText('Alquilado')).toHaveClass('barra-admin-estado');
  });

  it('el menú de estados se maneja con el teclado como el del inventario', async () => {
    const { user } = await montar();
    await screen.findByRole('region', { name: 'Modo admin' });

    await abrirEstados(user);
    const opciones = screen.getAllByRole('menuitemradio');
    expect(opciones[0]).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(opciones[1]).toHaveFocus();
    await user.keyboard('{End}');
    expect(opciones[2]).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(enBarra().getByRole('button', { name: 'Cambiar estado de Aparador de roble' })).toHaveFocus();
  });

  it('un estado que no es de los tres se enseña tal cual, sin ninguno marcado', async () => {
    const { user } = await montar({ mueble: { ...MUEBLE, estado: 'reservado' } });
    await screen.findByRole('region', { name: 'Modo admin' });

    expect(enBarra().getByText('reservado')).toHaveClass('barra-admin-estado');
    await abrirEstados(user);
    expect(screen.getAllByRole('menuitemradio').map((o) => o.getAttribute('aria-checked'))).toEqual(['false', 'false', 'false']);
  });

  it('elegir otro estado lo guarda en la API y la ficha se pinta con él', async () => {
    updateMueble.mockResolvedValue({ success: true });
    const { user, showToast } = await montar();
    await screen.findByRole('region', { name: 'Modo admin' });
    expect(screen.getByRole('button', { name: 'Añadir a mi cesta' })).toBeEnabled();

    await abrirEstados(user);
    await user.click(screen.getByRole('menuitemradio', { name: 'Vendido' }));

    expect(updateMueble).toHaveBeenCalledTimes(1);
    expect(updateMueble).toHaveBeenCalledWith(MUEBLE.id, { estado: 'vendido' });
    expect(showToast).toHaveBeenCalledWith('Estado actualizado', 'success');
    expect(enBarra().getByText('Vendido')).toHaveClass('barra-admin-estado');
    expect(document.querySelector('.pd-status-banner.sold')).toHaveTextContent('Vendido');
    expect(screen.getByRole('button', { name: 'Agotado' })).toBeDisabled();

    await abrirEstados(user);
    expect(screen.getByRole('menuitemradio', { name: 'Vendido' })).toHaveAttribute('aria-checked', 'true');
  });

  it('si la API falla, se avisa y el estado no cambia', async () => {
    updateMueble.mockResolvedValue(null);
    const { user, showToast } = await montar();
    await screen.findByRole('region', { name: 'Modo admin' });

    await abrirEstados(user);
    await user.click(screen.getByRole('menuitemradio', { name: 'Alquilado' }));

    expect(showToast).toHaveBeenCalledWith('Error al cambiar estado', 'error');
    expect(enBarra().getByText('Disponible')).toHaveClass('barra-admin-estado');
    expect(document.querySelector('.pd-status-banner')).toBeNull();
  });

  it('elegir el estado que ya tiene no llama a la API', async () => {
    const { user, showToast } = await montar();
    await screen.findByRole('region', { name: 'Modo admin' });

    await abrirEstados(user);
    await user.click(screen.getByRole('menuitemradio', { name: 'Disponible' }));

    expect(updateMueble).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('mientras se guarda, elegir otra vez no manda una segunda petición', async () => {
    let responder;
    updateMueble.mockReturnValue(new Promise((r) => { responder = r; }));
    const { user } = await montar();
    await screen.findByRole('region', { name: 'Modo admin' });

    await abrirEstados(user);
    await user.click(screen.getByRole('menuitemradio', { name: 'Vendido' }));
    await abrirEstados(user);
    await user.click(screen.getByRole('menuitemradio', { name: 'Alquilado' }));

    expect(updateMueble).toHaveBeenCalledTimes(1);
    responder({ success: true });
    expect(await screen.findByRole('button', { name: 'Agotado' })).toBeDisabled();
  });

  it('una pieza sin estado cuenta como disponible', async () => {
    const { user } = await montar({ mueble: { ...MUEBLE, estado: undefined } });
    await screen.findByRole('region', { name: 'Modo admin' });

    expect(enBarra().getByText('Disponible')).toHaveClass('barra-admin-estado');
    await abrirEstados(user);
    expect(screen.getByRole('menuitemradio', { name: 'Disponible' })).toHaveAttribute('aria-checked', 'true');
  });

  // El botón de la música se sube encima de la barra con este alto (styles/MusicaDeFondo.css). jsdom no
  // calcula tamaños: el alto se simula.
  it('deja su alto (más 8 px) en --alto-barra-admin, y al salir de la ficha lo quita', async () => {
    const alto = () => document.documentElement.style.getPropertyValue('--alto-barra-admin');
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(50);
    const { user } = await montar();
    await screen.findByRole('region', { name: 'Modo admin' });
    expect(alto()).toBe('58px');

    await user.click(screen.getByRole('link', { name: 'Editar en panel' }));
    expect(alto()).toBe('');
  });

  it('si cambia de alto (en el móvil pasa a dos filas), lo actualiza', async () => {
    const alto = () => document.documentElement.style.getPropertyValue('--alto-barra-admin');
    let avisar;
    let observado = null;
    const desconectar = vi.fn();
    vi.stubGlobal('ResizeObserver', class {
      constructor(fn) { avisar = fn; }
      observe(elemento) { observado = elemento; }
      disconnect() { desconectar(); }
    });
    const altura = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(50);
    const { user } = await montar();
    await screen.findByRole('region', { name: 'Modo admin' });
    expect(observado).toBe(barra());

    altura.mockReturnValue(96);
    avisar();
    expect(alto()).toBe('104px');

    await user.click(screen.getByRole('link', { name: 'Editar en panel' }));
    expect(desconectar).toHaveBeenCalledTimes(1);
  });

  // e2e/admin.spec.js: al pulsar «Editar en panel», React pone la ref a null antes de la limpieza del efecto, y
  // Chrome aún avisa una vez al observador (la barra sale del DOM). Medía sobre barra.current y saltaba
  // «Cannot read properties of null (reading 'offsetHeight')». Aquí el aviso tardío se simula a mano.
  it('un aviso del observador que llega con la barra ya desmontada no da error', async () => {
    let avisar;
    vi.stubGlobal('ResizeObserver', class {
      constructor(fn) { avisar = fn; }
      observe() {}
      disconnect() {}
    });
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(50);
    const { user } = await montar();
    await screen.findByRole('region', { name: 'Modo admin' });

    await user.click(screen.getByRole('link', { name: 'Editar en panel' }));
    expect(screen.queryByRole('region', { name: 'Modo admin' })).toBeNull();
    expect(() => avisar()).not.toThrow();
  });
});
