import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Link, Routes, Route } from 'react-router-dom';
import MusicaDeFondo, { PISTA } from './MusicaDeFondo';

// jsdom no reproduce audio: simulamos play/pause y los eventos que dispararía el navegador.
let pausado;
beforeEach(() => {
  pausado = true;
  vi.spyOn(window.HTMLMediaElement.prototype, 'paused', 'get').mockImplementation(() => pausado);
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

describe('MusicaDeFondo', () => {
  it('no suena sola: empieza en pausa y no descarga la pista hasta pulsar', () => {
    const { container } = pintar();
    const audio = container.querySelector('audio');
    expect(audio.getAttribute('src')).toBe(PISTA);
    expect(audio.getAttribute('preload')).toBe('none');
    expect(audio.loop).toBe(true);
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    const boton = screen.getByRole('button', { name: 'Escuchar música' });
    expect(boton).toHaveAttribute('aria-pressed', 'false');
  });

  it('al pulsar suena a volumen moderado y el mismo botón la pausa', async () => {
    const { container } = pintar();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Escuchar música' }));
    });
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    expect(container.querySelector('audio').volume).toBe(0.35);
    const boton = screen.getByRole('button', { name: 'Pausar música' });
    expect(boton).toHaveAttribute('aria-pressed', 'true');

    await act(async () => {
      fireEvent.click(boton);
    });
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Escuchar música' })).toBeInTheDocument();
  });

  it('sigue sonando al cambiar de página', async () => {
    pintar();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Escuchar música' }));
    });
    fireEvent.click(screen.getByRole('link', { name: 'Catálogo' }));
    expect(HTMLMediaElement.prototype.pause).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Pausar música' })).toBeInTheDocument();
  });

  it('si el navegador rechaza reproducir, el botón se queda en pausa sin romper nada', async () => {
    HTMLMediaElement.prototype.play.mockImplementation(() => Promise.reject(new Error('NotAllowedError')));
    pintar();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Escuchar música' }));
    });
    expect(screen.getByRole('button', { name: 'Escuchar música' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('en el panel de administración no aparece y, si sonaba, se para', async () => {
    pintar();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Escuchar música' }));
    });
    fireEvent.click(screen.getByRole('link', { name: 'Panel' }));
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /música/ })).not.toBeInTheDocument();
  });

  it('entrando directamente al panel tampoco aparece', () => {
    pintar('/admin');
    expect(screen.queryByRole('button', { name: /música/ })).not.toBeInTheDocument();
  });
});
