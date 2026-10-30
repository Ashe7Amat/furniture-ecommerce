import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import Footer from './Footer';
import ProtectedRoute from './ProtectedRoute';
import { AuthContext } from '../context/AuthContext';
import { BRAND } from '../theme/brand.config';

const pintar = (user = null) =>
  render(
    <MemoryRouter>
      <AuthContext.Provider value={{ user }}>
        <Footer />
      </AuthContext.Provider>
    </MemoryRouter>
  );
const enlace = (nombre) => screen.getByRole('link', { name: nombre });

describe('Footer', () => {
  it('enlaza las páginas de la marca, las legales y el contacto', () => {
    pintar();
    expect(enlace('La marca')).toHaveAttribute('href', '/sobre-nosotros');
    expect(enlace('Sostenibilidad')).toHaveAttribute('href', '/sostenibilidad');
    expect(enlace('Aviso Legal')).toHaveAttribute('href', '/legal');
    expect(enlace('Privacidad')).toHaveAttribute('href', '/privacidad');
    expect(enlace('Términos y Condiciones')).toHaveAttribute('href', '/terminos');
    expect(enlace('Contacto')).toHaveAttribute('href', '/contacto');
  });

  it('solo anuncia los medios de pago que funcionan: tarjeta, sin PayPal ni Apple Pay', () => {
    const { container } = pintar();
    const medios = container.querySelector('.payment-icons');
    expect(medios).toHaveTextContent('Visa');
    expect(medios).toHaveTextContent('Mastercard');
    expect(medios).not.toHaveTextContent('PayPal');
    expect(medios).not.toHaveTextContent('Apple Pay');
  });

  it('no ofrece una newsletter que no guarda nada (quitada el 28 oct 2026)', () => {
    pintar();
    expect(screen.queryByRole('button', { name: 'Suscribirme' })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Tu email')).not.toBeInTheDocument();
    expect(screen.getByText(BRAND.contacto.direccion, { exact: false })).toBeInTheDocument();
  });

  it('Instagram se abre en otra pestaña, sin darle acceso a esta (noopener)', () => {
    pintar();
    const instagram = enlace(`Instagram @${BRAND.redes.instagramUsuario}`);
    expect(instagram).toHaveAttribute('href', BRAND.redes.instagram);
    expect(instagram).toHaveAttribute('target', '_blank');
    expect(instagram).toHaveAttribute('rel', 'noopener noreferrer');
  });

  // CAMBIADO A PROPÓSITO (6 oct 2026, H50): sin sesión, "Mi cuenta" y "Mis pedidos" ya no apuntan directos a
  // /login (así se perdía la ruta de vuelta de H45): apuntan a /cuenta, y ProtectedRoute manda al login.
  it('"Mi cuenta" y "Mis pedidos" apuntan a la cuenta y a su historial, con o sin sesión', () => {
    for (const user of [null, { nombre: 'Ana', rol: 'cliente' }]) {
      const { unmount } = pintar(user);
      expect(enlace('Mi cuenta')).toHaveAttribute('href', '/cuenta');
      expect(enlace('Mis pedidos')).toHaveAttribute('href', '/cuenta?tab=pedidos');
      unmount();
    }
  });

  it('sin sesión, pulsar "Mis pedidos" lleva al login guardando la ruta (con su ?tab=) para volver a ella (H50)', async () => {
    const user = userEvent.setup();
    const LoginDePrueba = () => <p>login (desde: {useLocation().state?.from ?? 'ninguna'})</p>;
    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthContext.Provider value={{ user: null, loading: false, reconectando: false, reintentarSesion: vi.fn(), logout: vi.fn() }}>
          <Routes>
            <Route path="/" element={<Footer />} />
            <Route path="/cuenta" element={<ProtectedRoute><p>mi cuenta</p></ProtectedRoute>} />
            <Route path="/login" element={<LoginDePrueba />} />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>
    );

    await user.click(enlace('Mis pedidos'));

    expect(screen.getByText('login (desde: /cuenta?tab=pedidos)')).toBeInTheDocument();
  });

  it('"Panel Admin" se enseña al administrador', () => {
    pintar({ nombre: 'Admin', rol: 'admin' });
    expect(enlace('Panel Admin')).toHaveAttribute('href', '/admin');
  });

  it('a un cliente con sesión no se le enseña "Panel Admin"', () => {
    pintar({ nombre: 'Ana', rol: 'cliente' });
    expect(screen.queryByRole('link', { name: 'Panel Admin' })).not.toBeInTheDocument();
  });

  // CAMBIADO CON H30 (29 sep 2026): hasta entonces este test fijaba lo contrario, que sin sesión
  // también se enseñaba "Panel Admin" (la condición era `!user || user.rol === 'admin'`).
  it('sin sesión no se enseña "Panel Admin" (H30)', () => {
    pintar();
    expect(screen.queryByRole('link', { name: 'Panel Admin' })).not.toBeInTheDocument();
  });

  it('un usuario sin rol (p. ej. datos guardados de una versión antigua) tampoco lo ve', () => {
    pintar({ nombre: 'Ana' });
    expect(screen.queryByRole('link', { name: 'Panel Admin' })).not.toBeInTheDocument();
  });
});
