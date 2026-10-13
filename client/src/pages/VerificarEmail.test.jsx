import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import VerificarEmail from './VerificarEmail';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import { verificarEmail, reenviarVerificacion } from '../services/api';

vi.mock('../services/api');

// H18: la página a la que lleva el enlace del correo: /verificar-email?token=...
const abrir = ({ ruta = '/verificar-email?token=tok-1', user = null } = {}) => {
  const actualizarUsuario = vi.fn();
  const logout = vi.fn().mockResolvedValue();
  const showToast = vi.fn();
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <AuthContext.Provider value={{ user, actualizarUsuario, logout }}>
        <ToastContext.Provider value={{ showToast }}>
          <VerificarEmail />
        </ToastContext.Provider>
      </AuthContext.Provider>
    </MemoryRouter>
  );
  return { actualizarUsuario, logout, showToast };
};
const pulsarConfirmar = () =>
  act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar mi email' }));
  });

const ANA = { nombre: 'Ana', email: 'ana@correo.es', rol: 'cliente', email_verificado: false };

beforeEach(() => {
  vi.resetAllMocks();
});

describe('VerificarEmail', () => {
  it('no confirma nada al cargar: hace falta pulsar el botón (los filtros de correo abren los enlaces)', () => {
    abrir();

    expect(screen.getByRole('heading', { name: 'Confirma tu email' })).toBeInTheDocument();
    expect(verificarEmail).not.toHaveBeenCalled();
  });

  it('al pulsar, manda el token; mientras tanto el botón dice "Confirmando..." y está desactivado', async () => {
    let responder;
    verificarEmail.mockReturnValue(new Promise((r) => (responder = r)));
    abrir();

    await pulsarConfirmar();

    expect(verificarEmail).toHaveBeenCalledWith('tok-1');
    expect(screen.getByRole('button', { name: 'Confirmando...' })).toBeDisabled();
    await act(async () => responder({ success: true, motivo: 'registro', user: { ...ANA, email_verificado: true } }));
  });

  it('si sale bien, dice que la cuenta está activa y actualiza la sesión de esa misma cuenta', async () => {
    const verificada = { ...ANA, email_verificado: true };
    verificarEmail.mockResolvedValue({ success: true, motivo: 'registro', user: verificada, sesionCerrada: false });
    const { actualizarUsuario } = abrir({ user: ANA });

    await pulsarConfirmar();

    expect(screen.getByRole('heading', { name: 'Tu cuenta ya está activa' })).toBeInTheDocument();
    expect(actualizarUsuario).toHaveBeenCalledWith(verificada);
    expect(screen.getByRole('link', { name: 'Ir a Mi cuenta' })).toHaveAttribute('href', '/cuenta?tab=pedidos');
  });

  it('con la sesión de otra cuenta abierta, no la toca', async () => {
    verificarEmail.mockResolvedValue({
      success: true,
      motivo: 'registro',
      user: { ...ANA, email: 'otra@correo.es', email_verificado: true }
    });
    const { actualizarUsuario } = abrir({ user: ANA });

    await pulsarConfirmar();

    expect(actualizarUsuario).not.toHaveBeenCalled();
  });

  it('sin sesión, ofrece iniciar sesión', async () => {
    verificarEmail.mockResolvedValue({ success: true, motivo: 'registro', user: { ...ANA, email_verificado: true } });
    abrir();

    await pulsarConfirmar();

    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/login');
  });

  it('tras confirmar un cambio de email, cierra la sesión local y pide entrar con el email nuevo', async () => {
    verificarEmail.mockResolvedValue({
      success: true,
      motivo: 'cambio_email',
      user: { ...ANA, email: 'ana.nueva@correo.es', email_verificado: true },
      sesionCerrada: true
    });
    const { logout, actualizarUsuario } = abrir({ user: { ...ANA, email_verificado: true } });

    await pulsarConfirmar();

    expect(screen.getByRole('heading', { name: 'Tu email ya está cambiado' })).toBeInTheDocument();
    expect(screen.getByText(/tu cuenta usa ana\.nueva@correo\.es/)).toBeInTheDocument();
    expect(logout).toHaveBeenCalledTimes(1);
    expect(actualizarUsuario).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/login');
  });

  it('un cambio de email confirmado desde otro navegador sin sesión no intenta cerrar nada', async () => {
    verificarEmail.mockResolvedValue({
      success: true,
      motivo: 'cambio_email',
      user: { ...ANA, email: 'ana.nueva@correo.es' },
      sesionCerrada: true
    });
    const { logout } = abrir();

    await pulsarConfirmar();

    expect(logout).not.toHaveBeenCalled();
  });

  it('si el enlace no vale, lo dice; con sesión ofrece pedir otro', async () => {
    verificarEmail.mockResolvedValue({ error: 'El enlace no es válido o ha caducado.' });
    reenviarVerificacion.mockResolvedValue({ success: true });
    const { showToast } = abrir({ user: ANA });

    await pulsarConfirmar();

    expect(screen.getByRole('heading', { name: 'No hemos podido confirmar tu email' })).toBeInTheDocument();
    expect(screen.getByText('El enlace no es válido o ha caducado.')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Enviar otro enlace' }));
    });
    expect(reenviarVerificacion).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith('Te hemos enviado otro correo.', 'success');
  });

  it('si pedir otro falla, enseña el motivo', async () => {
    verificarEmail.mockResolvedValue({ error: 'El enlace no es válido o ha caducado.' });
    reenviarVerificacion.mockResolvedValue({ error: 'Espera un rato.' });
    const { showToast } = abrir({ user: ANA });

    await pulsarConfirmar();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Enviar otro enlace' }));
    });

    expect(showToast).toHaveBeenCalledWith('Espera un rato.', 'error');
  });

  it('sin sesión, el error dice que hay que entrar para pedir otro', async () => {
    verificarEmail.mockResolvedValue({ error: 'El enlace no es válido o ha caducado.' });
    abrir();

    await pulsarConfirmar();

    expect(screen.getByText('Inicia sesión para pedir otro enlace.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar otro enlace' })).toBeNull();
  });

  it('sin token en la dirección, enseña el error directamente', () => {
    abrir({ ruta: '/verificar-email' });

    expect(screen.getByText('El enlace no es válido o ha caducado.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmar mi email' })).toBeNull();
  });
});
