// La tabla de rutas de App.jsx: cada dirección pinta su página (las que van con carga diferida
// llegan tras un momento) y una dirección desconocida, la 404. No tenía tests (tarea 5 de la
// sesión del 5 oct 2026, cobertura). La API está simulada.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';
import * as api from './services/api';

vi.mock('./services/api');

const visitar = (ruta) => {
  window.history.pushState({}, '', ruta);
  return render(<App />);
};

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  window.scrollTo = vi.fn();
  api.getCategorias.mockResolvedValue([]);
  api.getMuebles.mockResolvedValue([]);
  api.getMuebleById.mockResolvedValue(null);
});
afterEach(() => {
  window.history.pushState({}, '', '/');
});

describe('App — rutas', () => {
  it('la portada va en el paquete inicial: su h1 sale sin esperar', () => {
    visitar('/');
    expect(screen.getByRole('heading', { level: 1, name: 'Nave 5 Barcelona' })).toBeInTheDocument();
  });

  it.each([
    ['/catalogo', 'Colección Completa'],
    ['/sobre-nosotros', 'Nave 5 Barcelona'],
    ['/sostenibilidad', 'Sostenibilidad y Restauración'],
    ['/legal', 'Aviso Legal'],
    ['/privacidad', 'Política de Privacidad'],
    ['/terminos', 'Términos y Condiciones'],
    ['/checkout/cancelado', 'Pago cancelado'],
    ['/esto-no-existe', 'Esta pieza no está en el almacén']
  ])('%s pinta su página', async (ruta, titulo) => {
    visitar(ruta);
    expect(await screen.findByRole('heading', { level: 1, name: titulo }, { timeout: 3000 })).toBeInTheDocument();
  });

  it('el contenido va dentro de <main id="contenido">, con el enlace para saltar a él', async () => {
    visitar('/legal');
    const titulo = await screen.findByRole('heading', { level: 1, name: 'Aviso Legal' });

    expect(titulo.closest('main')).toHaveAttribute('id', 'contenido');
    expect(screen.getByRole('link', { name: 'Saltar al contenido' })).toHaveAttribute('href', '#contenido');
  });

  it('sin sesión, /admin manda al inicio de sesión', async () => {
    visitar('/admin');
    expect(await screen.findByRole('button', { name: 'Continuar' }, { timeout: 3000 })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
  });
});
