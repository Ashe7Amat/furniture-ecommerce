import { StrictMode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within, cleanup } from '@testing-library/react';
import { MemoryRouter, Link, Routes, Route } from 'react-router-dom';
import MusicaDeFondo from './MusicaDeFondo';
import { CONSULTA_ESCRITORIO } from '../utils/musica';

// Canciones de prueba: las de verdad se comprueban en utils/musica.test.js. Es la misma lista que
// lee el componente, así que un test puede dejarla con menos canciones (y restaurarla al acabar).
const { canciones } = vi.hoisted(() => ({
  canciones: [
    { titulo: 'Primera', artista: 'Artista Uno', url: '/audio/primera.mp3', pixabay: 1 },
    { titulo: 'Segunda', artista: 'Artista Dos', url: '/audio/segunda.mp3', pixabay: 2 },
    { titulo: 'Tercera', artista: 'Artista Tres', url: '/audio/tercera.mp3', pixabay: 3 },
  ],
}));
vi.mock('../utils/musica', async (importOriginal) => ({ ...(await importOriginal()), CANCIONES: canciones }));
const originales = [...canciones];

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
  // Desmontar antes de quitar los simulacros: al desmontarse el reproductor pausa el audio, y el
  // pause() de jsdom solo escribe "Not implemented" en la consola.
  cleanup();
  vi.restoreAllMocks();
  delete window.matchMedia;
  canciones.splice(0, canciones.length, ...originales);
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
const panel = () => screen.queryByRole('region', { name: 'Reproductor de música' });
const progreso = (container) => container.querySelector('.musica-progreso span').style.transform;

const pulsar = async (nombre) => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: nombre }));
  });
};
const abrir = () => pulsar('Escuchar música');

// Como el navegador al llegar al final de una canción: primero "pause" y luego "ended".
const terminar = async (container) => {
  await act(async () => {
    pausado = true;
    audioDe(container).dispatchEvent(new Event('pause'));
    audioDe(container).dispatchEvent(new Event('ended'));
  });
};

const avanzarA = async (container, currentTime, duration) => {
  const audio = audioDe(container);
  Object.defineProperty(audio, 'currentTime', { value: currentTime, configurable: true });
  Object.defineProperty(audio, 'duration', { value: duration, configurable: true });
  await act(async () => { audio.dispatchEvent(new Event('timeupdate')); });
};

describe('MusicaDeFondo', () => {
  it('no suena sola: empieza plegado, en pausa y sin descargar la canción', () => {
    const { container } = pintar();
    expect(audioDe(container).getAttribute('preload')).toBe('none');
    expect(fuente(container)).toBe(canciones[0].url);
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Escuchar música' })).toBeInTheDocument();
    expect(panel()).not.toBeInTheDocument();
  });

  it('al pulsar el botón se despliega el reproductor y suena la primera canción', async () => {
    const { container } = pintar();
    await abrir();
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    expect(audioDe(container).volume).toBe(0.35);
    expect(within(panel()).getByText('Primera')).toHaveAttribute('title', 'Primera · Artista Uno');
    expect(within(panel()).getByText('Artista Uno')).toBeInTheDocument();
    // El foco pasa al botón de pausa, para seguir con el teclado.
    expect(screen.getByRole('button', { name: 'Pausar música' })).toHaveFocus();
  });

  it('mientras carga dice "Cargando…" en lugar del artista', async () => {
    HTMLMediaElement.prototype.play.mockImplementation(function () {
      pausado = false;
      this.dispatchEvent(new Event('play'));
      return new Promise(() => {}); // el archivo aún no ha llegado
    });
    const { container } = pintar();
    await abrir();
    expect(within(panel()).getByText('Cargando…')).toBeInTheDocument();
    expect(within(panel()).queryByText('Artista Uno')).not.toBeInTheDocument();
    await act(async () => { audioDe(container).dispatchEvent(new Event('playing')); });
    expect(within(panel()).getByText('Artista Uno')).toBeInTheDocument();
  });

  it('el botón central pausa y, al reanudar, sigue por donde iba', async () => {
    const { container } = pintar();
    await abrir();
    await pulsar('Pausar música');
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1);
    await pulsar('Reproducir música');
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
    // Sin volver a cargar el archivo ni cambiar de canción (eso la empezaría de cero).
    expect(HTMLMediaElement.prototype.load).not.toHaveBeenCalled();
    expect(fuente(container)).toBe(canciones[0].url);
    expect(screen.getByRole('button', { name: 'Pausar música' })).toBeInTheDocument();
  });

  it('"siguiente" pasa a la siguiente canción y sigue sonando; desde la última vuelve a la primera', async () => {
    const { container } = pintar();
    await abrir();
    for (let i = 1; i < canciones.length; i++) {
      await pulsar('Canción siguiente');
      expect(fuente(container)).toBe(canciones[i].url);
      expect(within(panel()).getByText(canciones[i].titulo)).toBeInTheDocument();
      expect(within(panel()).getByText(canciones[i].artista)).toBeInTheDocument();
    }
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(canciones.length);
    await pulsar('Canción siguiente');
    expect(fuente(container)).toBe(canciones[0].url);
  });

  it('"anterior" desde la primera va a la última', async () => {
    const { container } = pintar();
    await abrir();
    await pulsar('Canción anterior');
    expect(fuente(container)).toBe(canciones[canciones.length - 1].url);
  });

  it('cambiar de canción en pausa no la pone a sonar', async () => {
    const { container } = pintar();
    await abrir();
    await pulsar('Pausar música');
    await pulsar('Canción siguiente');
    expect(fuente(container)).toBe(canciones[1].url);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Reproducir música' })).toBeInTheDocument();
  });

  it('al acabar una canción empieza la siguiente; tras la última, la primera', async () => {
    const { container } = pintar();
    await abrir();
    await terminar(container);
    expect(fuente(container)).toBe(canciones[1].url);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: 'Pausar música' })).toBeInTheDocument();
    await terminar(container);
    await terminar(container);
    expect(fuente(container)).toBe(canciones[0].url);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(4);
  });

  it('con una sola canción, al acabar vuelve a empezarla', async () => {
    canciones.splice(1);
    const { container } = pintar();
    await abrir();
    await terminar(container);
    expect(fuente(container)).toBe(canciones[0].url);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
  });

  it('la línea de progreso avanza con la canción y vuelve a cero al cambiar', async () => {
    const { container } = pintar();
    await abrir();
    expect(progreso(container)).toBe('scaleX(0)');
    await avanzarA(container, 30, 120);
    expect(progreso(container)).toBe('scaleX(0.25)');
    // Sin duración conocida (aún cargando) no se inventa nada.
    await avanzarA(container, 5, NaN);
    expect(progreso(container)).toBe('scaleX(0)');
    await avanzarA(container, 60, 120);
    await pulsar('Canción siguiente');
    expect(progreso(container)).toBe('scaleX(0)');
  });

  it('si la canción no se puede reproducir lo dice y se queda en pausa; otra vuelve a intentarlo', async () => {
    const error = Object.assign(new Error('sin fuente'), { name: 'NotSupportedError' });
    HTMLMediaElement.prototype.play.mockImplementationOnce(() => Promise.reject(error));
    pintar();
    await abrir();
    expect(within(panel()).getByText('Error al cargar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reproducir música' })).toBeInTheDocument();
    await pulsar('Canción siguiente');
    expect(within(panel()).getByText('Artista Dos')).toBeInTheDocument();
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    await pulsar('Reproducir música');
    expect(screen.getByRole('button', { name: 'Pausar música' })).toBeInTheDocument();
  });

  it('un error de red a mitad también se avisa', async () => {
    const { container } = pintar();
    await abrir();
    await act(async () => { audioDe(container).dispatchEvent(new Event('error')); });
    expect(within(panel()).getByText('Error al cargar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reproducir música' })).toBeInTheDocument();
  });

  it('si el navegador no deja reproducir, se queda en pausa sin mensaje de error', async () => {
    const error = Object.assign(new Error('no'), { name: 'NotAllowedError' });
    HTMLMediaElement.prototype.play.mockImplementation(() => Promise.reject(error));
    pintar();
    await abrir();
    expect(screen.getByRole('button', { name: 'Reproducir música' })).toBeInTheDocument();
    expect(within(panel()).queryByText('Error al cargar')).not.toBeInTheDocument();
  });

  it('tras un fallo de carga, reintentar la misma canción vuelve a pedir el archivo y quita el aviso', async () => {
    const error = Object.assign(new Error('sin red'), { name: 'NotSupportedError' });
    HTMLMediaElement.prototype.play.mockImplementationOnce(() => Promise.reject(error));
    const { container } = pintar();
    await abrir();
    expect(within(panel()).getByText('Error al cargar')).toBeInTheDocument();
    // Como el navegador: el elemento se queda con el error puesto y play() solo no reintenta.
    Object.defineProperty(audioDe(container), 'error', { value: { code: 4 }, configurable: true });
    await pulsar('Reproducir música');
    expect(HTMLMediaElement.prototype.load).toHaveBeenCalledTimes(1);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
    expect(fuente(container)).toBe(canciones[0].url);
    expect(within(panel()).queryByText('Error al cargar')).not.toBeInTheDocument();
    expect(within(panel()).getByText('Artista Uno')).toBeInTheDocument();
  });

  it('tras un error de red a mitad, reanudar la misma canción quita el aviso', async () => {
    const { container } = pintar();
    await abrir();
    await act(async () => {
      pausado = true;
      audioDe(container).dispatchEvent(new Event('error'));
    });
    await pulsar('Reproducir música');
    expect(within(panel()).queryByText('Error al cargar')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pausar música' })).toBeInTheDocument();
  });

  it('un error con la música en pausa no da aviso', async () => {
    const { container } = pintar();
    await abrir();
    await pulsar('Pausar música');
    await act(async () => { audioDe(container).dispatchEvent(new Event('error')); });
    expect(within(panel()).queryByText('Error al cargar')).not.toBeInTheDocument();
  });

  it('tras un error de red a mitad, cambiar de canción no la pone a sonar sola', async () => {
    const { container } = pintar();
    await abrir();
    await act(async () => { audioDe(container).dispatchEvent(new Event('error')); });
    await pulsar('Canción siguiente');
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Reproducir música' })).toBeInTheDocument();
  });

  it('cambiar de canción mientras carga: el AbortError de la anterior no da aviso', async () => {
    const rechazos = [];
    HTMLMediaElement.prototype.play.mockImplementation(function () {
      pausado = false;
      this.dispatchEvent(new Event('play'));
      return new Promise((_, rechazar) => rechazos.push(rechazar));
    });
    const { container } = pintar();
    await abrir();
    await pulsar('Canción siguiente');
    await act(async () => { rechazos[0](new DOMException('interrumpido por otra carga', 'AbortError')); });
    expect(within(panel()).queryByText('Error al cargar')).not.toBeInTheDocument();
    // La nueva sigue arrancando: cuando llega a sonar, se ve su artista.
    await act(async () => { audioDe(container).dispatchEvent(new Event('playing')); });
    expect(within(panel()).getByText('Artista Dos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pausar música' })).toBeInTheDocument();
  });

  it('pausar mientras carga: el AbortError no da aviso', async () => {
    const rechazos = [];
    HTMLMediaElement.prototype.play.mockImplementation(function () {
      pausado = false;
      this.dispatchEvent(new Event('play'));
      return new Promise((_, rechazar) => rechazos.push(rechazar));
    });
    pintar();
    await abrir();
    await pulsar('Pausar música');
    await act(async () => { rechazos[0](new DOMException('interrumpido por pause()', 'AbortError')); });
    expect(within(panel()).queryByText('Error al cargar')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reproducir música' })).toBeInTheDocument();
  });

  it('si la canción se queda sin datos a mitad dice "Cargando…" hasta que vuelve a sonar', async () => {
    const { container } = pintar();
    await abrir();
    await act(async () => { audioDe(container).dispatchEvent(new Event('waiting')); });
    expect(within(panel()).getByText('Cargando…')).toBeInTheDocument();
    expect(panel()).toHaveClass('cargando');
    await act(async () => { audioDe(container).dispatchEvent(new Event('playing')); });
    expect(within(panel()).getByText('Artista Uno')).toBeInTheDocument();
    expect(panel()).not.toHaveClass('cargando');
  });

  it('si el sistema pausa mientras espera datos, queda en pausa y no en "Cargando…"', async () => {
    const { container } = pintar();
    await abrir();
    await act(async () => { audioDe(container).dispatchEvent(new Event('waiting')); });
    await act(async () => { audioDe(container).pause(); });
    expect(screen.getByRole('button', { name: 'Reproducir música' })).toBeInTheDocument();
    expect(within(panel()).queryByText('Cargando…')).not.toBeInTheDocument();
  });

  it('el botón redondo y el panel se marcan mientras suena (las barras se mueven) y el aviso de fallo se colorea', async () => {
    const error = Object.assign(new Error('sin fuente'), { name: 'NotSupportedError' });
    pintar();
    expect(screen.getByRole('button', { name: 'Escuchar música' })).not.toHaveClass('sonando');
    await abrir();
    expect(panel()).toHaveClass('sonando');
    await pulsar('Minimizar reproductor');
    expect(screen.getByRole('button', { name: 'Abrir reproductor de música' })).toHaveClass('sonando');
    await pulsar('Abrir reproductor de música');
    await pulsar('Pausar música');
    expect(panel()).not.toHaveClass('sonando');
    HTMLMediaElement.prototype.play.mockImplementationOnce(() => Promise.reject(error));
    await pulsar('Reproducir música');
    expect(within(panel()).getByText('Error al cargar')).toHaveClass('fallo');
  });

  it('el aviso para lectores de pantalla dice la canción al cambiar y avisa si falla, sin el "Cargando…"', async () => {
    const error = Object.assign(new Error('sin fuente'), { name: 'NotSupportedError' });
    HTMLMediaElement.prototype.play.mockImplementation(function () {
      pausado = false;
      this.dispatchEvent(new Event('play'));
      return new Promise(() => {});
    });
    pintar();
    await abrir();
    const aviso = within(panel()).getByRole('status');
    expect(aviso).toHaveTextContent('Primera, de Artista Uno');
    expect(aviso).not.toHaveTextContent('Cargando');
    HTMLMediaElement.prototype.play.mockImplementationOnce(() => Promise.reject(error));
    await pulsar('Canción siguiente');
    expect(aviso).toHaveTextContent('No se puede reproducir Segunda');
    await pulsar('Canción siguiente');
    expect(aviso).toHaveTextContent('Tercera, de Artista Tres');
  });

  it('minimizar pliega el reproductor sin parar la música y devuelve el foco al botón', async () => {
    pintar();
    await abrir();
    await pulsar('Minimizar reproductor');
    expect(panel()).not.toBeInTheDocument();
    expect(HTMLMediaElement.prototype.pause).not.toHaveBeenCalled();
    const boton = screen.getByRole('button', { name: 'Abrir reproductor de música' });
    expect(boton).toHaveAttribute('title', 'Sonando: Primera');
    expect(boton).toHaveFocus();
    // Al volver a abrirlo no se reinicia ni se pausa
    await act(async () => { fireEvent.click(boton); });
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Pausar música' })).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: 'Pausar música' })).toBeInTheDocument();
  });

  it('si pausa el sistema (auriculares, teclas multimedia), cambiar de canción no la vuelve a encender', async () => {
    const { container } = pintar();
    await abrir();
    await act(async () => { audioDe(container).pause(); });
    expect(screen.getByRole('button', { name: 'Reproducir música' })).toBeInTheDocument();
    await pulsar('Canción siguiente');
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  });

  it('cambiar de canción mientras carga arranca la nueva', async () => {
    HTMLMediaElement.prototype.play.mockImplementation(function () {
      pausado = false;
      this.dispatchEvent(new Event('play'));
      return new Promise(() => {});
    });
    const { container } = pintar();
    await abrir();
    await pulsar('Canción siguiente');
    expect(fuente(container)).toBe(canciones[1].url);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
  });

  it('registra los controles del sistema (teclas multimedia) y los quita al desmontarse', async () => {
    const manejadores = {};
    const mediaSession = { metadata: null, setActionHandler: vi.fn((accion, fn) => { manejadores[accion] = fn; }) };
    Object.defineProperty(navigator, 'mediaSession', { value: mediaSession, configurable: true });
    window.MediaMetadata = function MediaMetadata(datos) { Object.assign(this, datos); };
    try {
      const { container, unmount } = pintar();
      expect(mediaSession.metadata).toMatchObject({ title: 'Primera', artist: 'Artista Uno', album: 'Nave 5 Barcelona' });
      await act(async () => { manejadores.nexttrack(); });
      expect(fuente(container)).toBe(canciones[1].url);
      expect(mediaSession.metadata).toMatchObject({ title: 'Segunda', artist: 'Artista Dos' });
      await act(async () => { manejadores.previoustrack(); });
      expect(fuente(container)).toBe(canciones[0].url);
      await act(async () => { manejadores.play(); });
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
      await act(async () => { manejadores.pause(); });
      expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1);
      unmount();
      expect(manejadores.play).toBeNull();
      expect(manejadores.nexttrack).toBeNull();
      // Sin canción colgada en el widget del sistema.
      expect(mediaSession.metadata).toBeNull();
    } finally {
      delete navigator.mediaSession;
      delete window.MediaMetadata;
    }
  });

  it('la tecla Play del sistema con la música ya sonando no la deja en "Cargando…"', async () => {
    const manejadores = {};
    const mediaSession = { metadata: null, setActionHandler: vi.fn((accion, fn) => { manejadores[accion] = fn; }) };
    Object.defineProperty(navigator, 'mediaSession', { value: mediaSession, configurable: true });
    window.MediaMetadata = function MediaMetadata(datos) { Object.assign(this, datos); };
    try {
      const { container } = pintar();
      await abrir();
      // Sonando y con datos: un play() de verdad no lanzaría ni "play" ni "playing".
      Object.defineProperty(audioDe(container), 'readyState', { value: 4, configurable: true });
      HTMLMediaElement.prototype.play.mockImplementation(() => Promise.resolve());
      await act(async () => { manejadores.play(); });
      expect(within(panel()).queryByText('Cargando…')).not.toBeInTheDocument();
      expect(within(panel()).getByText('Artista Uno')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Pausar música' })).toBeInTheDocument();
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

  it('sin canciones en la lista no aparece', () => {
    canciones.splice(0);
    const { container } = pintar();
    expect(screen.queryByRole('button', { name: /música/ })).not.toBeInTheDocument();
    expect(audioDe(container)).toBeNull();
    expect(document.documentElement).not.toHaveClass('con-musica');
  });

  it('en el panel de administración no aparece y, si sonaba, se para', async () => {
    pintar();
    await abrir();
    fireEvent.click(screen.getByRole('link', { name: 'Panel' }));
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1);
    expect(panel()).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /música/ })).not.toBeInTheDocument();
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

  it('si el aparato deja de ser de ratón (p. ej. se pasa a modo tableta) la música se para y desaparece', async () => {
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
