import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import { AuthContext } from '../context/AuthContext';

// ProtectedRoute no pinta nada privado hasta que la sesión está confirmada (H16: sin access token,
// las lecturas del panel saldrían sin Authorization).
const renderRuta = (valor, { adminOnly = false } = {}) =>
  render(
    <AuthContext.Provider value={{ login: vi.fn(), logout: vi.fn(), reintentarSesion: vi.fn(), ...valor }}>
      <MemoryRouter initialEntries={['/privada']}>
        <Routes>
          <Route
            path="/privada"
            element={
              <ProtectedRoute adminOnly={adminOnly}>
                <p>contenido privado</p>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<p>página de login</p>} />
          <Route path="/" element={<p>portada</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );

const ANA = { nombre: 'Ana', rol: 'cliente' };

describe('ProtectedRoute', () => {
  it('mientras se confirma la sesión, enseña "Cargando..." y no el contenido', () => {
    renderRuta({ user: ANA, loading: true });

    expect(screen.getByText('Cargando...')).toBeInTheDocument();
    expect(screen.queryByText('contenido privado')).not.toBeInTheDocument();
  });

  it('si no se ha podido confirmar la sesión, ofrece reintentar o cerrar sesión, sin el contenido', async () => {
    const user = userEvent.setup();
    const reintentarSesion = vi.fn();
    const logout = vi.fn();
    renderRuta({ user: ANA, loading: false, reconectando: true, reintentarSesion, logout });

    expect(screen.getByRole('alert')).toHaveTextContent('No hemos podido comprobar tu sesión');
    expect(screen.queryByText('contenido privado')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(reintentarSesion).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('con la sesión confirmada, enseña el contenido', () => {
    renderRuta({ user: ANA, loading: false, reconectando: false });

    expect(screen.getByText('contenido privado')).toBeInTheDocument();
  });

  it('sin sesión, lleva al login', () => {
    renderRuta({ user: null, loading: false });

    expect(screen.getByText('página de login')).toBeInTheDocument();
  });

  it('una ruta de administración con una cuenta de cliente lleva a la portada', () => {
    renderRuta({ user: ANA, loading: false }, { adminOnly: true });

    expect(screen.getByText('portada')).toBeInTheDocument();
  });
});
