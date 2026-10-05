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

  // H43: un solo h1 por página y sin saltos de nivel hacia abajo (de h1 a h3, de h2 a h4...), contando
  // la cabecera, el pie y la cesta, que van en todas. El orden se mira en el documento entero, como
  // la regla heading-order de axe (subir de nivel, p. ej. de h3 a h2, sí vale).
  const titulos = () => [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((h) => Number(h.tagName[1]));
  const saltos = (niveles) =>
    niveles.flatMap((nivel, i) => (i > 0 && nivel > niveles[i - 1] + 1 ? [`h${niveles[i - 1]} → h${nivel}`] : []));
  const MUEBLE = { id: 'm1', nombre: 'Aparador de roble', estado: 'disponible', imagenes: [], descripcion: 'Restaurado' };

  it.each([
    ['/', 'Nave 5 Barcelona'],
    ['/catalogo', 'Colección Completa'],
    ['/mueble/m1', 'Aparador de roble'],
    ['/login', 'Acceder a mi cuenta'],
    ['/contacto', 'Conecta con Nosotros'],
    ['/cuenta', 'Mi Cuenta'],
    ['/sobre-nosotros', 'Nave 5 Barcelona'],
    ['/esto-no-existe', 'Esta pieza no está en el almacén']
  ])('%s: exactamente un h1 y los títulos no se saltan niveles (H43)', async (ruta, h1) => {
    api.getMuebles.mockResolvedValue([MUEBLE, { ...MUEBLE, id: 'm2', nombre: 'Banco' }]);
    api.getMuebleById.mockResolvedValue(MUEBLE);
    api.getMisPedidos.mockResolvedValue([]);
    // Sesión guardada sin refresh token: se usa tal cual, sin llamar al servidor (ver AuthContext).
    if (ruta === '/cuenta') localStorage.setItem('kaveUser', JSON.stringify({ nombre: 'Ana', email: 'ana@correo.test', rol: 'cliente' }));
    visitar(ruta);

    await screen.findByRole('heading', { level: 1, name: h1 }, { timeout: 3000 });
    if (ruta === '/catalogo') await screen.findByRole('heading', { level: 2, name: 'Banco' });

    expect(document.querySelectorAll('h1')).toHaveLength(1);
    expect(saltos(titulos())).toEqual([]);
  });

  it('sin sesión, /admin manda al inicio de sesión', async () => {
    visitar('/admin');
    expect(await screen.findByRole('button', { name: 'Continuar' }, { timeout: 3000 })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
  });
});
