import { StrictMode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { MemoryRouter, Link, Routes, Route } from 'react-router-dom';
import MusicaDeFondo from './MusicaDeFondo';
import { EMISORAS, CONSULTA_ESCRITORIO } from '../utils/musica';

// jsdom no reproduce audio ni sabe qué aparato es: simulamos play/pause/load, los eventos que
// dispararía el navegador y matchMedia (ordenador por defecto).
let pausado;
let esEscritorio;
let oyentesMedia;
beforeEach(() => {
  pausado = true;
  esEscritorio = true;
  oyentesMedia = [];
  window.matchMedia = vi.fn((consulta) => ({
    get matches() { return consulta === CONSULTA_ESCRITORIO && esEscritorio; },
    media: consulta,
    addEventListener: (_tipo, fn) => oyentesMedia.push(fn),
    removeEventListener: (_tipo, fn) => { oyentesMedia = oyentesMedia.filter((f) => f !== fn); },
  }));
  vi.spyOn(window.HTMLMediaElement.prototype, 'paused', 'get').mockImplementation(() => pausado);
  vi.spyOn(window.HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(function () {
    pausado = false;
    this.dispatchEvent(new Event('play'));
    this.dispatchEvent(new Event('playing'));
    return Promise.resolve();
  });
  vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(function () {
    if (pausado) return; // como el navegador: sin "pause" si ya estaba en pausa
    pausado = true;
    this.dispatchEvent(new Event('pause'));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  delete window.matchMedia;
});

const pintar = (ruta = '/', { estricto = false } = {}) => {
  const arbol = (
    <MemoryRouter initialEntries={[ruta]}>
      <MusicaDeFondo />
      <Link to="/catalogo">Catálogo</Link>
      <Link to="/admin">Panel</Link>
      <Routes>
        <Route path="*" element={<p>Página</p>} />
      </Routes>
    </MemoryRouter>
  );
  return render(estricto ? <StrictMode>{arbol}</StrictMode> : arbol);
};

const audioDe = (container) => container.querySelector('audio');
const fuente = (container) => audioDe(container).getAttribute('src');
const panel = () => screen.queryByRole('region', { name: 'Reproductor de radio' });

const pulsar = async (nombre) => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: nombre }));
  });
};
const abrir = () => pulsar('Escuchar música');

describe('MusicaDeFondo', () => {
  it('todas las emisoras tienen nombre, descripción y un flujo https', () => {
    expect(EMISORAS.length).toBeGreaterThanOrEqual(2);
    EMISORAS.forEach((e) => {
      expect(e.nombre).toBeTruthy();
      expect(e.descripcion).toBeTruthy();
      expect(e.url).toMatch(/^https:\/\//);
    });
  });

  it('no suena sola: empieza plegado, en pausa y sin conectarse a la emisora', () => {
    const { container } = pintar();
    expect(audioDe(container).getAttribute('preload')).toBe('none');
    expect(fuente(container)).toBe(EMISORAS[0].url);
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Escuchar música' })).toBeInTheDocument();
    expect(panel()).not.toBeInTheDocument();
  });

  it('al pulsar el botón se despliega el reproductor y empieza a sonar la primera emisora', async () => {
    const { container } = pintar();
    await abrir();
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    expect(audioDe(container).volume).toBe(0.35);
    expect(within(panel()).getByText(EMISORAS[0].nombre)).toHaveAttribute('title', EMISORAS[0].descripcion);
    expect(within(panel()).getByText('En directo')).toBeInTheDocument();
    // El foco pasa al botón de pausa, para seguir con el teclado.
    expect(screen.getByRole('button', { name: 'Pausar radio' })).toHaveFocus();
  });

  it('mientras conecta dice "Conectando…" y no "En directo"', async () => {
    HTMLMediaElement.prototype.play.mockImplementation(function () {
      pausado = false;
      this.dispatchEvent(new Event('play'));
      return new Promise(() => {}); // la emisora aún no responde
    });
    const { container } = pintar();
    await abrir();
    expect(within(panel()).getByText('Conectando…')).toBeInTheDocument();
    expect(within(panel()).queryByText('En directo')).not.toBeInTheDocument();
    await act(async () => { audioDe(container).dispatchEvent(new Event('playing')); });
    expect(within(panel()).getByText('En directo')).toBeInTheDocument();
  });

  it('el botón central pausa y, al reanudar, reconecta para volver al directo', async () => {
    pintar();
    await abrir();
    await pulsar('Pausar radio');
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1);
    expect(HTMLMediaElement.prototype.load).not.toHaveBeenCalled();
    await pulsar('Reproducir radio');
    expect(HTMLMediaElement.prototype.load).toHaveBeenCalledTimes(1);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: 'Pausar radio' })).toBeInTheDocument();
  });

  it('"siguiente" pasa a la siguiente emisora y sigue sonando; desde la última vuelve a la primera', async () => {
    const { container } = pintar();
    await abrir();
    for (let i = 1; i < EMISORAS.length; i++) {
      await pulsar('Emisora siguiente');
      expect(fuente(container)).toBe(EMISORAS[i].url);
      expect(within(panel()).getByText(EMISORAS[i].nombre)).toBeInTheDocument();
    }
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(EMISORAS.length);
    await pulsar('Emisora siguiente');
    expect(fuente(container)).toBe(EMISORAS[0].url);
  });

  it('"anterior" desde la primera va a la última', async () => {
    const { container } = pintar();
    await abrir();
    await pulsar('Emisora anterior');
    expect(fuente(container)).toBe(EMISORAS[EMISORAS.length - 1].url);
  });

  it('cambiar de emisora en pausa no la pone a sonar', async () => {
    const { container } = pintar();
    await abrir();
    await pulsar('Pausar radio');
    await pulsar('Emisora siguiente');
    expect(fuente(container)).toBe(EMISORAS[1].url);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Reproducir radio' })).toBeInTheDocument();
  });

  it('si la emisora no responde lo dice y se queda en pausa; otra emisora vuelve a intentarlo', async () => {
    const error = Object.assign(new Error('sin fuente'), { name: 'NotSupportedError' });
    HTMLMediaElement.prototype.play.mockImplementationOnce(() => Promise.reject(error));
    pintar();
    await abrir();
    expect(within(panel()).getByText('No disponible ahora')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reproducir radio' })).toBeInTheDocument();
    await pulsar('Emisora siguiente');
    expect(within(panel()).getByText('En pausa')).toBeInTheDocument();
    await pulsar('Reproducir radio');
    expect(within(panel()).getByText('En directo')).toBeInTheDocument();
  });

  it('un error de red a mitad también se avisa', async () => {
    const { container } = pintar();
    await abrir();
    await act(async () => { audioDe(container).dispatchEvent(new Event('error')); });
    expect(within(panel()).getByText('No disponible ahora')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reproducir radio' })).toBeInTheDocument();
  });

  it('si el navegador no deja reproducir, se queda en pausa sin mensaje de error', async () => {
    const error = Object.assign(new Error('no'), { name: 'NotAllowedError' });
    HTMLMediaElement.prototype.play.mockImplementation(() => Promise.reject(error));
    pintar();
    await abrir();
    expect(screen.getByRole('button', { name: 'Reproducir radio' })).toBeInTheDocument();
    expect(within(panel()).queryByText(/No disponible/)).not.toBeInTheDocument();
  });

  it('si el servidor corta el directo, se reconecta solo', async () => {
    const { container } = pintar();
    await abrir();
    await act(async () => {
      pausado = true;
      audioDe(container).dispatchEvent(new Event('pause'));
      audioDe(container).dispatchEvent(new Event('ended'));
    });
    expect(HTMLMediaElement.prototype.load).toHaveBeenCalledTimes(1);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
  });

  it('minimizar pliega el reproductor sin parar la radio y devuelve el foco al botón', async () => {
    pintar();
    await abrir();
    await pulsar('Minimizar reproductor');
    expect(panel()).not.toBeInTheDocument();
    expect(HTMLMediaElement.prototype.pause).not.toHaveBeenCalled();
    const boton = screen.getByRole('button', { name: 'Abrir reproductor de radio' });
    expect(boton).toHaveAttribute('title', `Sonando: ${EMISORAS[0].nombre}`);
    expect(boton).toHaveFocus();
    // Al volver a abrirlo no se reinicia ni se pausa
    await act(async () => { fireEvent.click(boton); });
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Pausar radio' })).toBeInTheDocument();
  });

  it('Escape también pliega el reproductor', async () => {
    pintar();
    await abrir();
    fireEvent.keyDown(panel(), { key: 'Escape' });
    expect(panel()).not.toBeInTheDocument();
  });

  it('sigue sonando al cambiar de página', async () => {
    pintar();
    await abrir();
    fireEvent.click(screen.getByRole('link', { name: 'Catálogo' }));
    expect(HTMLMediaElement.prototype.pause).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Pausar radio' })).toBeInTheDocument();
  });

  it('si pausa el sistema (auriculares, teclas multimedia), cambiar de emisora no la vuelve a encender', async () => {
    const { container } = pintar();
    await abrir();
    await act(async () => { audioDe(container).pause(); });
    expect(screen.getByRole('button', { name: 'Reproducir radio' })).toBeInTheDocument();
    await pulsar('Emisora siguiente');
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    // y al reanudar reconecta con el directo
    await pulsar('Reproducir radio');
    expect(HTMLMediaElement.prototype.load).toHaveBeenCalledTimes(1);
  });

  it('cambiar de emisora mientras conecta arranca la nueva', async () => {
    HTMLMediaElement.prototype.play.mockImplementation(function () {
      pausado = false;
      this.dispatchEvent(new Event('play'));
      return new Promise(() => {});
    });
    const { container } = pintar();
    await abrir();
    await pulsar('Emisora siguiente');
    expect(fuente(container)).toBe(EMISORAS[1].url);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
  });

  it('registra los controles del sistema (teclas multimedia) y los quita al desmontarse', async () => {
    const manejadores = {};
    const mediaSession = { metadata: null, setActionHandler: vi.fn((accion, fn) => { manejadores[accion] = fn; }) };
    Object.defineProperty(navigator, 'mediaSession', { value: mediaSession, configurable: true });
    window.MediaMetadata = function MediaMetadata(datos) { Object.assign(this, datos); };
    try {
      const { container, unmount } = pintar();
      expect(mediaSession.metadata).toMatchObject({ title: EMISORAS[0].nombre, artist: 'Radio France' });
      await act(async () => { manejadores.nexttrack(); });
      expect(fuente(container)).toBe(EMISORAS[1].url);
      expect(mediaSession.metadata).toMatchObject({ title: EMISORAS[1].nombre });
      await act(async () => { manejadores.play(); });
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
      await act(async () => { manejadores.pause(); });
      expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1);
      unmount();
      expect(manejadores.play).toBeNull();
      expect(manejadores.nexttrack).toBeNull();
    } finally {
      delete navigator.mediaSession;
      delete window.MediaMetadata;
    }
  });

  it('con StrictMode (desarrollo) no roba el foco al cargar la página', () => {
    pintar('/', { estricto: true });
    expect(screen.getByRole('button', { name: 'Escuchar música' })).not.toHaveFocus();
  });

  it('mientras está en pantalla marca la página para que el pie deje sitio al botón', () => {
    const { unmount } = pintar();
    expect(document.documentElement).toHaveClass('con-musica');
    unmount();
    expect(document.documentElement).not.toHaveClass('con-musica');
  });

  it('en el panel de administración no aparece y, si sonaba, se para', async () => {
    pintar();
    await abrir();
    fireEvent.click(screen.getByRole('link', { name: 'Panel' }));
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1);
    expect(panel()).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /música|radio/ })).not.toBeInTheDocument();
  });

  it('entrando directamente al panel tampoco aparece', () => {
    const { container } = pintar('/admin');
    expect(screen.queryByRole('button', { name: /música/ })).not.toBeInTheDocument();
    expect(audioDe(container)).toBeNull();
  });

  it('en el móvil (pantalla táctil) no hay música: ni botón ni audio', () => {
    esEscritorio = false;
    const { container } = pintar();
    expect(window.matchMedia).toHaveBeenCalledWith(CONSULTA_ESCRITORIO);
    expect(screen.queryByRole('button', { name: /música/ })).not.toBeInTheDocument();
    expect(audioDe(container)).toBeNull();
  });

  it('si el aparato deja de ser de ratón (p. ej. se pasa a modo tableta) la radio se para y desaparece', async () => {
    pintar();
    await abrir();
    await act(async () => {
      esEscritorio = false;
      oyentesMedia.forEach((fn) => fn());
    });
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1);
    expect(panel()).not.toBeInTheDocument();
  });

  it('sin matchMedia (navegadores muy antiguos) no se muestra', () => {
    delete window.matchMedia;
    const { container } = pintar();
    expect(audioDe(container)).toBeNull();
  });
});
