import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import AuthModal from './AuthModal';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import { loginUser, registerUser } from '../services/api';

vi.mock('../services/api');

// El modal de acceso que abre la cesta al pagar sin sesión (CartDrawer).
const abrir = ({ isOpen = true } = {}) => {
  const props = { onClose: vi.fn(), onSuccess: vi.fn() };
  const contexto = { login: vi.fn(), showToast: vi.fn() };
  render(
    <AuthContext.Provider value={{ login: contexto.login }}>
      <ToastContext.Provider value={{ showToast: contexto.showToast }}>
        <AuthModal isOpen={isOpen} {...props} />
      </ToastContext.Provider>
    </AuthContext.Provider>
  );
  return { ...props, ...contexto };
};
const escribir = (placeholder, valor) => fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value: valor } });
const rellenarAcceso = () => {
  escribir('tu@correo.com', 'ana@correo.es');
  escribir('••••••••', 'secreta');
};
const enviar = () =>
  act(async () => {
    fireEvent.submit(screen.getByPlaceholderText('tu@correo.com').closest('form'));
  });
const aRegistro = () => fireEvent.click(screen.getByRole('button', { name: '¿Aún no eres miembro? Regístrate aquí' }));
const ANA = { id: 'u1', nombre: 'Ana' };

beforeEach(() => {
  vi.resetAllMocks();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('AuthModal', () => {
  it('cerrado no pinta nada', () => {
    abrir({ isOpen: false });
    expect(screen.queryByText('Iniciar Sesión')).not.toBeInTheDocument();
  });

  it('sin email o contraseña avisa y no llama al servidor', async () => {
    abrir();
    escribir('tu@correo.com', 'ana@correo.es');

    await enviar();

    expect(screen.getByText('Por favor, completa todos los campos.')).toBeInTheDocument();
    expect(loginUser).not.toHaveBeenCalled();
  });

  it('al entrar bien: abre la sesión, saluda, avisa a quien lo abrió y se cierra', async () => {
    loginUser.mockResolvedValue({ success: true, user: ANA, token: 'access', refreshToken: 'refresh' });
    const { login, showToast, onSuccess, onClose } = abrir();
    rellenarAcceso();

    await enviar();

    expect(loginUser).toHaveBeenCalledWith('ana@correo.es', 'secreta');
    expect(login).toHaveBeenCalledWith(ANA, 'access', 'refresh');
    expect(showToast).toHaveBeenCalledWith('¡Hola de nuevo, Ana!', 'success');
    expect(onSuccess).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('si el servidor rechaza el acceso, enseña su motivo; sin motivo, uno por defecto', async () => {
    const { login } = abrir();
    rellenarAcceso();

    loginUser.mockResolvedValue({ error: 'Email o contraseña incorrectos.' });
    await enviar();
    expect(screen.getByText('Email o contraseña incorrectos.')).toBeInTheDocument();

    loginUser.mockResolvedValue({});
    await enviar();
    expect(screen.getByText('Credenciales de acceso incorrectas.')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('si la petición lanza, dice que falló la comunicación y el botón vuelve a estar disponible', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    loginUser.mockRejectedValue(new Error('sin red'));
    abrir();
    rellenarAcceso();

    await enviar();

    expect(screen.getByText('Error en la comunicación con el servidor.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar y continuar pedido' })).toBeEnabled();
  });

  it('mientras conecta, el botón dice "Conectando..." y está desactivado', async () => {
    let terminar;
    loginUser.mockReturnValue(new Promise((resolve) => (terminar = resolve)));
    abrir();
    rellenarAcceso();

    await enviar();

    expect(screen.getByRole('button', { name: 'Conectando...' })).toBeDisabled();
    await act(async () => terminar({ error: 'x' }));
  });

  it('en modo registro pide el nombre, y crea la cuenta con él', async () => {
    registerUser.mockResolvedValue({ success: true, user: ANA, token: 'access', refreshToken: 'refresh' });
    const { login, showToast, onSuccess } = abrir();
    aRegistro();
    expect(screen.getByRole('heading', { name: 'Crear Cuenta' })).toBeInTheDocument();
    rellenarAcceso();

    await enviar();
    expect(screen.getByText('El nombre es obligatorio para registrarse.')).toBeInTheDocument();
    expect(registerUser).not.toHaveBeenCalled();

    escribir('Ej. Ana Martínez', 'Ana');
    await enviar();

    expect(registerUser).toHaveBeenCalledWith({ nombre: 'Ana', email: 'ana@correo.es', password: 'secreta' });
    expect(login).toHaveBeenCalledWith(ANA, 'access', 'refresh');
    expect(showToast).toHaveBeenCalledWith('¡Bienvenido a la comunidad, Ana!', 'success');
    expect(onSuccess).toHaveBeenCalled();
  });

  it('si el registro falla, enseña el motivo o uno por defecto', async () => {
    abrir();
    aRegistro();
    escribir('Ej. Ana Martínez', 'Ana');
    rellenarAcceso();

    registerUser.mockResolvedValue({ error: 'El correo electrónico ya está registrado.' });
    await enviar();
    expect(screen.getByText('El correo electrónico ya está registrado.')).toBeInTheDocument();

    registerUser.mockResolvedValue({});
    await enviar();
    expect(screen.getByText('Error al crear la cuenta.')).toBeInTheDocument();
  });

  it('cambiar de modo vacía lo escrito y el error', async () => {
    abrir();
    escribir('tu@correo.com', 'ana@correo.es');
    await enviar(); // deja el error de "completa todos los campos"

    aRegistro();

    expect(screen.getByPlaceholderText('tu@correo.com')).toHaveValue('');
    expect(screen.queryByText('Por favor, completa todos los campos.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '¿Ya tienes una cuenta? Inicia sesión aquí' }));
    expect(screen.getByRole('heading', { name: 'Iniciar Sesión' })).toBeInTheDocument();
  });

  it('la ✕ lo cierra, y lo escrito se borra tras la animación (300 ms)', () => {
    vi.useFakeTimers();
    const { onClose } = abrir();
    aRegistro();
    escribir('Ej. Ana Martínez', 'Ana');

    // CAMBIADO A PROPÓSITO (5 oct 2026): la ✕ tiene nombre accesible, "Cerrar" (auditoría de accesibilidad).
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByPlaceholderText('Ej. Ana Martínez')).toHaveValue('Ana'); // aún no

    act(() => vi.advanceTimersByTime(300));
    expect(screen.queryByPlaceholderText('Ej. Ana Martínez')).not.toBeInTheDocument(); // vuelve a "Iniciar Sesión"
  });
});
