import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ForgotPassword from './ForgotPassword';
import * as api from '../services/api';

vi.mock('../services/api');

const cargar = () => {
  return render(
    <MemoryRouter initialEntries={['/forgot-password']}>
      <Routes>
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/login" element={<p>Página de login</p>} />
      </Routes>
    </MemoryRouter>
  );
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('ForgotPassword', () => {
  it('renderiza el h1 y el formulario con input de email y botón', () => {
    cargar();
    expect(screen.getByRole('heading', { level: 1, name: 'Recuperar contraseña' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar enlace' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a iniciar sesión' })).toHaveAttribute('href', '/login');
  });

  it('al enviar el formulario, llama a la API y muestra el mensaje de confirmación', async () => {
    api.solicitarRecuperacionPassword.mockResolvedValue({
      success: true,
      message: 'Si el correo está registrado, recibirás un enlace.'
    });

    cargar();
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'usuario@correo.com' } });

    await act(async () => {
      fireEvent.submit(screen.getByPlaceholderText('Email').closest('form'));
    });

    expect(api.solicitarRecuperacionPassword).toHaveBeenCalledWith('usuario@correo.com');
    expect(screen.getByText('Si el correo está registrado, recibirás un enlace.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a iniciar sesión' })).toBeInTheDocument();
  });

  it('si la API devuelve error, lo muestra en pantalla', async () => {
    api.solicitarRecuperacionPassword.mockResolvedValue({
      error: 'Error de conexión con el servidor.'
    });

    cargar();
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'usuario@correo.com' } });

    await act(async () => {
      fireEvent.submit(screen.getByPlaceholderText('Email').closest('form'));
    });

    expect(screen.getByText('Error de conexión con el servidor.')).toBeInTheDocument();
  });
});
