import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Footer from './Footer';
import { AuthContext } from '../context/AuthContext';

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

  it('Instagram se abre en otra pestaña, sin darle acceso a esta (noopener)', () => {
    pintar();
    const instagram = enlace('Instagram @nave5bcn');
    expect(instagram).toHaveAttribute('href', 'https://www.instagram.com/nave5bcn');
    expect(instagram).toHaveAttribute('target', '_blank');
    expect(instagram).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('sin sesión, "Mi cuenta" y "Mis pedidos" llevan al login', () => {
    pintar();
    expect(enlace('Mi cuenta')).toHaveAttribute('href', '/login');
    expect(enlace('Mis pedidos')).toHaveAttribute('href', '/login');
  });

  it('con sesión, llevan a la cuenta y a su historial de pedidos', () => {
    pintar({ nombre: 'Ana', rol: 'cliente' });
    expect(enlace('Mi cuenta')).toHaveAttribute('href', '/cuenta');
    expect(enlace('Mis pedidos')).toHaveAttribute('href', '/cuenta?tab=pedidos');
  });

  it('"Panel Admin" se enseña al administrador', () => {
    pintar({ nombre: 'Admin', rol: 'admin' });
    expect(enlace('Panel Admin')).toHaveAttribute('href', '/admin');
  });

  it('a un cliente con sesión no se le enseña "Panel Admin"', () => {
    pintar({ nombre: 'Ana', rol: 'cliente' });
    expect(screen.queryByRole('link', { name: 'Panel Admin' })).not.toBeInTheDocument();
  });

  it('COMPORTAMIENTO ACTUAL, anotado en la auditoría de seguridad (fase 6): sin sesión también se enseña "Panel Admin"', () => {
    // La condición es (!user || user.rol === 'admin'). La ruta está protegida (ProtectedRoute con
    // adminOnly y verificarAdmin en el servidor), así que no abre nada, pero anuncia el panel a
    // cualquier visitante. Si se cambia, este test se cambia con ello.
    pintar();
    expect(enlace('Panel Admin')).toHaveAttribute('href', '/admin');
  });
});
