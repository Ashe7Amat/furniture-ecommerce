import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ResetPassword from './ResetPassword';
import { ToastContext } from '../context/ToastContext';
import * as api from '../services/api';

vi.mock('../services/api');

const cargar = ({ url = '/reset-password?token=tok-123' } = {}) => {
  const showToast = vi.fn();
  render(
    <MemoryRouter initialEntries={[url]}>
      <ToastContext.Provider value={{ showToast }}>
        <Routes>
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/login" element={<p>Página de login</p>} />
        </Routes>
      </ToastContext.Provider>
    </MemoryRouter>
  );
  return { showToast };
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('ResetPassword', () => {
  it('si falta el token en la URL, avisa y muestra enlace a login', () => {
    cargar({ url: '/reset-password' });
    expect(screen.getByRole('heading', { level: 1, name: 'Restablecer contraseña' })).toBeInTheDocument();
    expect(screen.getByText(/no es válido o no incluye ningún token/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver al inicio de sesión' })).toHaveAttribute('href', '/login');
  });

  it('con token en la URL, muestra inputs para nueva contraseña y confirmación', () => {
    cargar();
    expect(screen.getByPlaceholderText('Nueva contraseña')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Confirmar nueva contraseña')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restablecer contraseña' })).toBeInTheDocument();
  });

  it('si la contraseña tiene menos de 8 caracteres, avisa y no llama a la API', async () => {
    cargar();
    fireEvent.change(screen.getByPlaceholderText('Nueva contraseña'), { target: { value: 'corta' } });
    fireEvent.change(screen.getByPlaceholderText('Confirmar nueva contraseña'), { target: { value: 'corta' } });

    await act(async () => {
      fireEvent.submit(screen.getByPlaceholderText('Nueva contraseña').closest('form'));
    });

    expect(screen.getByText('La contraseña debe tener al menos 8 caracteres.')).toBeInTheDocument();
    expect(api.restablecerPassword).not.toHaveBeenCalled();
  });

  it('si las contraseñas no coinciden, avisa y no llama a la API', async () => {
    cargar();
    fireEvent.change(screen.getByPlaceholderText('Nueva contraseña'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByPlaceholderText('Confirmar nueva contraseña'), { target: { value: 'password999' } });

    await act(async () => {
      fireEvent.submit(screen.getByPlaceholderText('Nueva contraseña').closest('form'));
    });

    expect(screen.getByText('Las contraseñas no coinciden.')).toBeInTheDocument();
    expect(api.restablecerPassword).not.toHaveBeenCalled();
  });

  it('si la API devuelve error, lo enseña en pantalla', async () => {
    api.restablecerPassword.mockResolvedValue({
      error: 'El enlace de recuperación ha caducado.'
    });

    cargar();
    fireEvent.change(screen.getByPlaceholderText('Nueva contraseña'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByPlaceholderText('Confirmar nueva contraseña'), { target: { value: 'password123' } });

    await act(async () => {
      fireEvent.submit(screen.getByPlaceholderText('Nueva contraseña').closest('form'));
    });

    expect(api.restablecerPassword).toHaveBeenCalledWith('tok-123', 'password123');
    expect(screen.getByText('El enlace de recuperación ha caducado.')).toBeInTheDocument();
  });

  it('con token y contraseña válidos, restablece con éxito, avisa con toast y redirige a login', async () => {
    api.restablecerPassword.mockResolvedValue({
      success: true,
      message: 'Contraseña restablecida con éxito.'
    });

    const { showToast } = cargar();
    fireEvent.change(screen.getByPlaceholderText('Nueva contraseña'), { target: { value: 'nueva-super-clave-123' } });
    fireEvent.change(screen.getByPlaceholderText('Confirmar nueva contraseña'), { target: { value: 'nueva-super-clave-123' } });

    await act(async () => {
      fireEvent.submit(screen.getByPlaceholderText('Nueva contraseña').closest('form'));
    });

    expect(api.restablecerPassword).toHaveBeenCalledWith('tok-123', 'nueva-super-clave-123');
    expect(showToast).toHaveBeenCalledWith(
      'Contraseña actualizada correctamente. Ya puedes entrar con tu nueva clave.',
      'success'
    );
    expect(screen.getByText('Página de login')).toBeInTheDocument();
  });

  it('permite alternar la visibilidad de las contraseñas con el botón de ojo', () => {
    cargar();
    const inputPass = screen.getByPlaceholderText('Nueva contraseña');
    const inputConfirm = screen.getByPlaceholderText('Confirmar nueva contraseña');
    expect(inputPass).toHaveAttribute('type', 'password');
    expect(inputConfirm).toHaveAttribute('type', 'password');

    const botonOjoPass = screen.getByRole('button', { name: 'Mostrar contraseña' });
    const botonOjoConfirm = screen.getByRole('button', { name: 'Mostrar confirmación de contraseña' });

    // Alternar visibilidad de contraseña
    fireEvent.click(botonOjoPass);
    expect(inputPass).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Ocultar contraseña' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar contraseña' }));
    expect(inputPass).toHaveAttribute('type', 'password');

    // Alternar visibilidad de confirmación
    fireEvent.click(botonOjoConfirm);
    expect(inputConfirm).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Ocultar confirmación de contraseña' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar confirmación de contraseña' }));
    expect(inputConfirm).toHaveAttribute('type', 'password');
  });
});
