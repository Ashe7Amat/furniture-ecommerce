import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Profile from './Profile';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import { FavoritesContext } from '../context/FavoritesContext';
import { getMuebles, updateProfile, getMisPedidos } from '../services/api';

vi.mock('../services/api');

const ANA = { id: 'u1', nombre: 'Ana', email: 'ana@correo.es' };

const abrir = ({ user = ANA, favorites = [], ruta = '/cuenta' } = {}) => {
  const login = vi.fn();
  const showToast = vi.fn();
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <AuthContext.Provider value={{ user, login }}>
        <ToastContext.Provider value={{ showToast }}>
          <FavoritesContext.Provider value={{ favorites }}>
            <Profile />
          </FavoritesContext.Provider>
        </ToastContext.Provider>
      </AuthContext.Provider>
    </MemoryRouter>
  );
  return { login, showToast };
};

// Las etiquetas del formulario no están asociadas a sus campos: el nombre y el email se buscan por
// su valor, y las contraseñas por su placeholder.
const cambiar = (campo, valor) => fireEvent.change(campo, { target: { value: valor } });
const passwordActual = () => screen.getByPlaceholderText('Introduce tu contraseña para autorizar');
const nuevaPassword = () => screen.getByPlaceholderText('Mínimo 6 caracteres');
const confirmar = () => screen.getByPlaceholderText('Repite la nueva contraseña');
const guardar = () =>
  act(async () => {
    fireEvent.submit(screen.getByRole('button', { name: /GUARDAR CAMBIOS|Guardando/ }).closest('form'));
  });

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Profile — sin sesión', () => {
  it('pide iniciar sesión', () => {
    abrir({ user: null });
    expect(screen.getByText('Debes iniciar sesión para ver tu perfil.')).toBeInTheDocument();
  });
});

describe('Profile — mis datos', () => {
  it('saluda y trae el nombre y el email de la cuenta', () => {
    abrir();
    expect(screen.getByText('Ana', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Ana')).toBeInTheDocument();
    expect(screen.getByDisplayValue('ana@correo.es')).toBeInTheDocument();
  });

  it('cambiar solo el nombre no pide la contraseña, y guarda la sesión que devuelve el servidor', async () => {
    const respuesta = { user: { ...ANA, nombre: 'Ana María' }, token: 'access-nuevo' };
    updateProfile.mockResolvedValue(respuesta);
    const { login, showToast } = abrir();
    cambiar(screen.getByDisplayValue('Ana'), 'Ana María');

    await guardar();

    expect(updateProfile).toHaveBeenCalledWith({
      emailActual: 'ana@correo.es',
      nuevoNombre: 'Ana María',
      nuevoEmail: 'ana@correo.es',
      passwordActual: undefined,
      nuevaPassword: undefined,
    });
    // Sin refreshToken en la respuesta (solo cambió el nombre): login() conserva el que había.
    expect(login).toHaveBeenCalledWith(respuesta.user, 'access-nuevo', undefined);
    expect(showToast).toHaveBeenCalledWith('¡Perfil actualizado con éxito!', 'success');
  });

  it('cambiar el email sin la contraseña actual avisa y no manda nada', async () => {
    const { showToast } = abrir();
    cambiar(screen.getByDisplayValue('ana@correo.es'), 'ana@nuevo.es');

    await guardar();

    expect(showToast).toHaveBeenCalledWith(
      'Debes ingresar tu contraseña actual para autorizar cambios en tu correo o contraseña.',
      'error'
    );
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('si la nueva contraseña y su confirmación no coinciden, avisa y no manda nada', async () => {
    const { showToast } = abrir();
    cambiar(passwordActual(), 'actual');
    cambiar(nuevaPassword(), 'nueva-1');
    cambiar(confirmar(), 'nueva-2');

    await guardar();

    expect(showToast).toHaveBeenCalledWith('Las nuevas contraseñas no coinciden.', 'error');
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('cambiar la contraseña manda la actual y la nueva, guarda el refresh token nuevo (H21) y vacía los campos', async () => {
    const respuesta = { user: ANA, token: 'access-nuevo', refreshToken: 'refresh-nuevo' };
    updateProfile.mockResolvedValue(respuesta);
    const { login } = abrir();
    cambiar(passwordActual(), 'actual');
    cambiar(nuevaPassword(), 'nueva-segura');
    cambiar(confirmar(), 'nueva-segura');

    await guardar();

    expect(updateProfile).toHaveBeenCalledWith(expect.objectContaining({ passwordActual: 'actual', nuevaPassword: 'nueva-segura' }));
    expect(login).toHaveBeenCalledWith(ANA, 'access-nuevo', 'refresh-nuevo');
    expect([passwordActual(), nuevaPassword(), confirmar()].map((c) => c.value)).toEqual(['', '', '']);
  });

  it('si el servidor lo rechaza, avisa con su motivo y no toca la sesión', async () => {
    updateProfile.mockResolvedValue({ error: 'La contraseña actual es incorrecta.' });
    const { login, showToast } = abrir();
    cambiar(passwordActual(), 'mala');
    cambiar(nuevaPassword(), 'nueva');
    cambiar(confirmar(), 'nueva');

    await guardar();

    expect(showToast).toHaveBeenCalledWith('La contraseña actual es incorrecta.', 'error');
    expect(login).not.toHaveBeenCalled();
    expect(passwordActual()).toHaveValue('mala');
  });

  it('si la petición lanza, avisa de un error de conexión', async () => {
    updateProfile.mockRejectedValue(new Error('sin red'));
    const { showToast } = abrir();
    cambiar(screen.getByDisplayValue('Ana'), 'Ana María');

    await guardar();

    expect(showToast).toHaveBeenCalledWith('Error de conexión con el servidor', 'error');
    expect(screen.getByRole('button', { name: 'GUARDAR CAMBIOS' })).toBeEnabled();
  });

  it('mientras guarda, el botón dice "Guardando..." y está desactivado', async () => {
    let terminar;
    updateProfile.mockReturnValue(new Promise((resolve) => (terminar = resolve)));
    abrir();

    await guardar();

    expect(screen.getByRole('button', { name: 'Guardando...' })).toBeDisabled();
    await act(async () => terminar({ user: ANA, token: 't' }));
    expect(screen.getByRole('button', { name: 'GUARDAR CAMBIOS' })).toBeEnabled();
  });
});

describe('Profile — historial de pedidos', () => {
  it('con ?tab=pedidos abre directamente el historial, y mientras carga lo dice', () => {
    getMisPedidos.mockReturnValue(new Promise(() => {}));
    abrir({ ruta: '/cuenta?tab=pedidos' });

    expect(screen.getByRole('heading', { name: 'Historial de Compras' })).toBeInTheDocument();
    expect(screen.getByText('Cargando tus pedidos...')).toBeInTheDocument();
  });

  it('enseña cada pedido: referencia, estado, fecha, líneas y total', async () => {
    getMisPedidos.mockResolvedValue([
      {
        id: 'abcdef12-3456-7890',
        estado: 'enviado',
        created_at: '2026-09-20T10:00:00Z',
        total: 128,
        items: [
          { nombre: 'Silla Tolix', precio: 120, cantidad: 1, modalidad: 'compra' },
          { nombre: 'Mesa de roble', precio: 8, modalidad: 'alquiler' },
        ],
      },
    ]);
    abrir({ ruta: '/cuenta?tab=pedidos' });

    const pedido = (await screen.findByText('#ABCDEF12')).closest('.order-mock-item');
    const p = within(pedido);
    expect(p.getByText('Enviado')).toHaveClass('badge-info');
    expect(p.getByText('Realizado el: 20 de septiembre de 2026')).toBeInTheDocument();
    expect(p.getByText('Silla Tolix')).toBeInTheDocument();
    expect(p.getByText('Mesa de roble (alquiler/día)')).toBeInTheDocument();
    expect(p.getByText('1 x 8 €')).toBeInTheDocument(); // sin cantidad cuenta como 1
    expect(p.getByText('Total: 128 €')).toBeInTheDocument();
  });

  it('un pedido sin estado, sin fecha y sin líneas no rompe la página', async () => {
    getMisPedidos.mockResolvedValue([{ id: '00000000-aaaa', total: 0, items: null }]);
    abrir({ ruta: '/cuenta?tab=pedidos' });

    const pedido = (await screen.findByText('#00000000')).closest('.order-mock-item');
    expect(within(pedido).getByText('Procesando')).toHaveClass('badge-warning');
    expect(within(pedido).getByText('Realizado el: —')).toBeInTheDocument();
    expect(pedido.querySelector('.order-items-list')).toBeNull();
  });

  it('sin pedidos (o si la carga falla, contrato C de H12) dice que todavía no hay compras con ese correo', async () => {
    getMisPedidos.mockResolvedValue({ error: 'algo raro' }); // lo que no es una lista cuenta como vacía
    abrir({ ruta: '/cuenta?tab=pedidos' });

    expect(await screen.findByText(/Todavía no has hecho ninguna compra\. Cuando compres algo con este correo \(ana@correo\.es\)/)).toBeInTheDocument();
  });

  it('sin pedidos, también un enlace a "Explorar catálogo"; mientras carga, no (H40)', async () => {
    let responder;
    getMisPedidos.mockReturnValue(new Promise((r) => { responder = r; }));
    abrir({ ruta: '/cuenta?tab=pedidos' });

    expect(screen.getByText('Cargando tus pedidos...')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Explorar catálogo' })).not.toBeInTheDocument();

    await act(async () => responder([]));
    const enlace = screen.getByRole('link', { name: 'Explorar catálogo' });
    expect(enlace).toHaveAttribute('href', '/catalogo');
    expect(enlace.closest('.empty-tab')).toHaveClass('empty-tab--pedidos');
  });

  it('se llega también desde el menú lateral', async () => {
    getMisPedidos.mockResolvedValue([]);
    abrir();

    fireEvent.click(screen.getByRole('button', { name: 'Historial de Pedidos' }));

    expect(await screen.findByText(/Todavía no has hecho ninguna compra/)).toBeInTheDocument();
    expect(getMisPedidos).toHaveBeenCalledTimes(1);
  });
});

describe('Profile — favoritos', () => {
  it('sin favoritos lo dice (y no hace falta pedir el catálogo para enseñarlo)', () => {
    getMuebles.mockResolvedValue([]);
    abrir({ ruta: '/cuenta?tab=favoritos' });

    expect(screen.getByText('Aún no has guardado ningún mueble en tus favoritos.')).toBeInTheDocument();
  });

  it('sin favoritos, un panel con corazón y "Explorar catálogo" (H40)', () => {
    getMuebles.mockResolvedValue([]);
    abrir({ ruta: '/cuenta?tab=favoritos' });

    const enlace = screen.getByRole('link', { name: 'Explorar catálogo' });
    expect(enlace).toHaveAttribute('href', '/catalogo');
    expect(enlace.closest('.empty-tab')).toHaveClass('empty-tab--favoritos');
  });

  it('enseña solo los muebles favoritos, con su precio de venta, de alquiler o "Consultar precio"', async () => {
    getMuebles.mockResolvedValue([
      { id: 'm1', nombre: 'Silla Tolix', precio_venta: 120, imagenes: ['https://img.test/silla.jpg'] },
      { id: 'm2', nombre: 'Mesa de roble', precio_alquiler_dia: 8, imagenes: [] },
      { id: 'm3', nombre: 'Lámpara', imagenes: [] },
      { id: 'm4', nombre: 'No es favorito', precio_venta: 1 },
    ]);
    abrir({ ruta: '/cuenta?tab=favoritos', favorites: ['m1', 'm2', 'm3'] });

    const silla = (await screen.findByRole('heading', { name: 'Silla Tolix' })).closest('a');
    expect(silla).toHaveAttribute('href', '/mueble/m1');
    expect(within(silla).getByText('120 €')).toBeInTheDocument();
    expect(within(screen.getByRole('heading', { name: 'Mesa de roble' }).closest('a')).getByText('8 €/día')).toBeInTheDocument();
    // CAMBIADO A PROPÓSITO (fase C, 2 oct 2026): el texto unificado es "Consultar precio" (antes, "Consultar").
    expect(within(screen.getByRole('heading', { name: 'Lámpara' }).closest('a')).getByText('Consultar precio')).toBeInTheDocument();
    expect(screen.queryByText('No es favorito')).not.toBeInTheDocument();
  });

  it('se llega también desde el menú lateral, que cuenta los favoritos', async () => {
    getMuebles.mockResolvedValue([]);
    abrir({ favorites: ['m1', 'm2'] });

    fireEvent.click(screen.getByRole('button', { name: 'Mis Favoritos (2)' }));

    expect(screen.getByRole('heading', { name: 'Tus Piezas Favoritas' })).toBeInTheDocument();
    await act(async () => {});
    expect(getMuebles).toHaveBeenCalled();
  });
});
