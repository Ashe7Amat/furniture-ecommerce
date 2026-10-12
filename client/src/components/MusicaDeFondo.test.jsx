import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { MemoryRouter, Link, Routes, Route } from 'react-router-dom';
import MusicaDeFondo from './MusicaDeFondo';
import { PISTAS, formatearTiempo } from '../utils/musica';

// jsdom no reproduce audio: simulamos play/pause, la posición y los eventos que dispararía el navegador.
let pausado;
let posicion;
beforeEach(() => {
  pausado = true;
  posicion = 0;
  vi.spyOn(window.HTMLMediaElement.prototype, 'paused', 'get').mockImplementation(() => pausado);
  vi.spyOn(window.HTMLMediaElement.prototype, 'currentTime', 'get').mockImplementation(() => posicion);
  vi.spyOn(window.HTMLMediaElement.prototype, 'currentTime', 'set').mockImplementation((v) => { posicion = v; });
  vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(function () {
    pausado = false;
    this.dispatchEvent(new Event('play'));
    return Promise.resolve();
  });
  vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(function () {
    pausado = true;
    this.dispatchEvent(new Event('pause'));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const pintar = (ruta = '/') =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <MusicaDeFondo />
      <Link to="/catalogo">Catálogo</Link>
      <Link to="/admin">Panel</Link>
      <Routes>
        <Route path="*" element={<p>Página</p>} />
      </Routes>
    </MemoryRouter>
  );

const audioDe = (container) => container.querySelector('audio');
const fuenteActual = (container) => audioDe(container).getAttribute('src');

const abrir = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Escuchar música' }));
  });
  return screen.getByRole('region', { name: 'Reproductor de música' });
};

const pulsar = async (nombre) => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: nombre }));
  });
};

describe('MusicaDeFondo', () => {
  it('todas las canciones de la lista tienen título, artista y archivo en /audio/', () => {
    expect(PISTAS.length).toBeGreaterThanOrEqual(2);
    PISTAS.forEach((p) => {
      expect(p.titulo).toBeTruthy();
      expect(p.artista).toBeTruthy();
      expect(p.src).toMatch(/^\/audio\/[a-z0-9-]+\.mp3$/);
    });
  });

  it('no suena sola: empieza plegado, en pausa y sin descargar nada', () => {
    const { container } = pintar();
    expect(audioDe(container).getAttribute('preload')).toBe('none');
    expect(fuenteActual(container)).toBe(PISTAS[0].src);
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Escuchar música' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Reproductor de música' })).not.toBeInTheDocument();
  });

  it('al pulsar el botón se despliega el reproductor y empieza a sonar la primera canción', async () => {
    const { container } = pintar();
    const panel = await abrir();
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    expect(audioDe(container).volume).toBe(0.35);
    expect(within(panel).getByText(PISTAS[0].titulo)).toBeInTheDocument();
    expect(within(panel).getByText(PISTAS[0].artista)).toBeInTheDocument();
    // El foco pasa al botón de pausa, para seguir con el teclado.
    expect(screen.getByRole('button', { name: 'Pausar música' })).toHaveFocus();
  });

  it('el botón central pausa y vuelve a reproducir', async () => {
    pintar();
    await abrir();
    await pulsar('Pausar música');
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1);
    await pulsar('Reproducir música');
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: 'Pausar música' })).toBeInTheDocument();
  });

  it('"siguiente" pasa a la siguiente canción y sigue sonando; desde la última vuelve a la primera', async () => {
    const { container } = pintar();
    const panel = await abrir();
    for (let i = 1; i < PISTAS.length; i++) {
      await pulsar('Canción siguiente');
      expect(fuenteActual(container)).toBe(PISTAS[i].src);
      expect(within(panel).getByText(PISTAS[i].titulo)).toBeInTheDocument();
    }
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(PISTAS.length);
    await pulsar('Canción siguiente');
    expect(fuenteActual(container)).toBe(PISTAS[0].src);
  });

  it('"siguiente" en pausa cambia de canción sin ponerla a sonar', async () => {
    const { container } = pintar();
    await abrir();
    await pulsar('Pausar música');
    await pulsar('Canción siguiente');
    expect(fuenteActual(container)).toBe(PISTAS[1].src);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Reproducir música' })).toBeInTheDocument();
  });

  it('"anterior" al principio de la canción va a la anterior (desde la primera, a la última)', async () => {
    const { container } = pintar();
    await abrir();
    await pulsar('Canción anterior');
    expect(fuenteActual(container)).toBe(PISTAS[PISTAS.length - 1].src);
  });

  it('"anterior" con la canción avanzada la vuelve a empezar', async () => {
    const { container } = pintar();
    await abrir();
    posicion = 42;
    await pulsar('Canción anterior');
    expect(fuenteActual(container)).toBe(PISTAS[0].src);
    expect(posicion).toBe(0);
  });

  it('al acabar una canción empieza la siguiente sola', async () => {
    const { container } = pintar();
    await abrir();
    await act(async () => {
      pausado = true;
      audioDe(container).dispatchEvent(new Event('pause'));
      audioDe(container).dispatchEvent(new Event('ended'));
    });
    expect(fuenteActual(container)).toBe(PISTAS[1].src);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
  });

  it('muestra el tiempo y la barra permite saltar a otro punto', async () => {
    const { container } = pintar();
    await abrir();
    const audio = audioDe(container);
    vi.spyOn(audio, 'duration', 'get').mockReturnValue(77);
    await act(async () => {
      audio.dispatchEvent(new Event('loadedmetadata'));
      posicion = 18.4;
      audio.dispatchEvent(new Event('timeupdate'));
    });
    expect(screen.getByText('0:18')).toBeInTheDocument();
    expect(screen.getByText('1:17')).toBeInTheDocument();
    const barra = screen.getByRole('slider', { name: 'Posición de la canción' });
    expect(barra).toHaveAttribute('aria-valuetext', '0:18 de 1:17');
    fireEvent.change(barra, { target: { value: '60' } });
    expect(posicion).toBe(60);
    expect(screen.getByText('1:00')).toBeInTheDocument();
  });

  it('minimizar pliega el reproductor sin parar la música y devuelve el foco al botón', async () => {
    pintar();
    await abrir();
    await pulsar('Minimizar reproductor');
    expect(screen.queryByRole('region', { name: 'Reproductor de música' })).not.toBeInTheDocument();
    expect(HTMLMediaElement.prototype.pause).not.toHaveBeenCalled();
    const boton = screen.getByRole('button', { name: `Abrir reproductor de música (sonando: ${PISTAS[0].titulo})` });
    expect(boton).toHaveFocus();
    // Al volver a abrirlo no se reinicia ni se pausa
    await act(async () => { fireEvent.click(boton); });
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Pausar música' })).toBeInTheDocument();
  });

  it('Escape también pliega el reproductor', async () => {
    pintar();
    const panel = await abrir();
    fireEvent.keyDown(panel, { key: 'Escape' });
    expect(screen.queryByRole('region', { name: 'Reproductor de música' })).not.toBeInTheDocument();
  });

  it('sigue sonando al cambiar de página', async () => {
    pintar();
    await abrir();
    fireEvent.click(screen.getByRole('link', { name: 'Catálogo' }));
    expect(HTMLMediaElement.prototype.pause).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Pausar música' })).toBeInTheDocument();
  });

  it('si el navegador rechaza reproducir, se queda en pausa sin romper nada', async () => {
    HTMLMediaElement.prototype.play.mockImplementation(() => Promise.reject(new Error('NotAllowedError')));
    pintar();
    await abrir();
    expect(screen.getByRole('button', { name: 'Reproducir música' })).toBeInTheDocument();
  });

  it('en el panel de administración no aparece y, si sonaba, se para', async () => {
    pintar();
    await abrir();
    fireEvent.click(screen.getByRole('link', { name: 'Panel' }));
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('region', { name: 'Reproductor de música' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /música/ })).not.toBeInTheDocument();
  });

  it('entrando directamente al panel tampoco aparece', () => {
    pintar('/admin');
    expect(screen.queryByRole('button', { name: /música/ })).not.toBeInTheDocument();
  });
});

describe('formatearTiempo', () => {
  it('formatea minutos y segundos, y aguanta valores raros', () => {
    expect(formatearTiempo(0)).toBe('0:00');
    expect(formatearTiempo(9.9)).toBe('0:09');
    expect(formatearTiempo(77)).toBe('1:17');
    expect(formatearTiempo(600)).toBe('10:00');
    expect(formatearTiempo(NaN)).toBe('0:00');
    expect(formatearTiempo(Infinity)).toBe('0:00');
    expect(formatearTiempo(-5)).toBe('0:00');
  });
});
