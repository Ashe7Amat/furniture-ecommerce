import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within, fireEvent, act, cleanup } from '@testing-library/react';
import { useState } from 'react';
import GaleriaFotos from './GaleriaFotos';

// H57: la galería de fotos del editor de muebles.
const FOTOS = ['https://img.test/a.jpg', 'https://img.test/b.jpg', 'https://img.test/c.jpg'];

// Con su estado, como en el editor: cada cambio de orden se ve en la galería.
const Galeria = ({ fotos = FOTOS, alPedirQuitar = vi.fn(), alCambiar = vi.fn() }) => {
  const [lista, setLista] = useState(fotos);
  return (
    <GaleriaFotos
      fotos={lista}
      onCambiar={(nuevas) => {
        alCambiar(nuevas);
        setLista(nuevas);
      }}
      alPedirQuitar={alPedirQuitar}
    />
  );
};
const ordenVisto = () => screen.getAllByRole('img').map((img) => img.getAttribute('src').replace('https://img.test/', ''));
const item = (n) => screen.getAllByRole('listitem')[n];

afterEach(cleanup);

describe('GaleriaFotos (H57)', () => {
  it('enseña las fotos en orden, numeradas, con la primera marcada como principal', () => {
    render(<Galeria />);
    expect(screen.getByRole('list', { name: 'Fotos del mueble, en orden' })).toBeInTheDocument();
    expect(ordenVisto()).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
    expect(within(item(0)).getByText('1 · Principal')).toBeInTheDocument();
    expect(within(item(1)).getByText('2')).toBeInTheDocument();
    expect(within(item(2)).getByText('3')).toBeInTheDocument();
  });

  it('cada foto lleva su asa para moverla y su ✕; "Usar como principal" en todas menos la primera', () => {
    render(<Galeria />);
    for (const n of [1, 2, 3]) {
      expect(screen.getByRole('button', { name: `Mover la foto ${n}` })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: `Quitar la foto ${n}` })).toBeInTheDocument();
    }
    expect(within(item(0)).queryByRole('button', { name: 'Usar como principal' })).not.toBeInTheDocument();
    expect(within(item(1)).getByRole('button', { name: 'Usar como principal' })).toBeInTheDocument();
    expect(within(item(2)).getByRole('button', { name: 'Usar como principal' })).toBeInTheDocument();
  });

  it('"Usar como principal" pone esa foto la primera, y el resto conserva su orden', () => {
    const alCambiar = vi.fn();
    render(<Galeria alCambiar={alCambiar} />);
    fireEvent.click(within(item(2)).getByRole('button', { name: 'Usar como principal' }));
    expect(alCambiar).toHaveBeenCalledWith(['https://img.test/c.jpg', 'https://img.test/a.jpg', 'https://img.test/b.jpg']);
    expect(ordenVisto()).toEqual(['c.jpg', 'a.jpg', 'b.jpg']);
    expect(within(item(0)).getByText('1 · Principal')).toBeInTheDocument();
  });

  it('la ✕ pide quitar esa foto (la confirmación y el borrado los hace el editor)', () => {
    const alPedirQuitar = vi.fn();
    render(<Galeria alPedirQuitar={alPedirQuitar} />);
    fireEvent.click(screen.getByRole('button', { name: 'Quitar la foto 2' }));
    expect(alPedirQuitar).toHaveBeenCalledWith(1);
  });

  it('la miniatura conserva la estructura que miran los tests del panel: .image-thumb con la foto y un solo botón', () => {
    render(<Galeria />);
    const miniatura = screen.getByRole('img', { name: 'Mueble 1' }).closest('.image-thumb');
    expect(within(miniatura).getAllByRole('button')).toHaveLength(1);
  });

  // El arrastre con el teclado de dnd-kit (espacio, flechas, espacio) se mide con las posiciones de las fotos en
  // pantalla, que jsdom no calcula: aquí se les da una fila de cajas de 150 px. El arrastre con el ratón se prueba
  // en el navegador (e2e/admin.spec.js).
  it('con el teclado: espacio coge la foto, la flecha la mueve una posición y espacio la suelta', async () => {
    const original = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function caja() {
      const li = this.closest?.('li.foto-galeria-item');
      if (!li) return original.call(this);
      const i = [...li.parentElement.children].indexOf(li);
      return { x: i * 160, y: 0, left: i * 160, top: 0, right: i * 160 + 150, bottom: 200, width: 150, height: 200, toJSON() {} };
    };
    try {
      const alCambiar = vi.fn();
      render(<Galeria alCambiar={alCambiar} />);
      const asa = screen.getByRole('button', { name: 'Mover la foto 1' });
      asa.focus();
      const pausa = () => new Promise((r) => setTimeout(r, 50));
      await act(async () => {
        fireEvent.keyDown(asa, { code: 'Space', key: ' ' });
        await pausa();
      });
      await act(async () => {
        fireEvent.keyDown(document.activeElement, { code: 'ArrowRight', key: 'ArrowRight' });
        await pausa();
      });
      await act(async () => {
        fireEvent.keyDown(document.activeElement, { code: 'Space', key: ' ' });
        await pausa();
      });
      expect(alCambiar).toHaveBeenCalledWith(['https://img.test/b.jpg', 'https://img.test/a.jpg', 'https://img.test/c.jpg']);
      expect(ordenVisto()).toEqual(['b.jpg', 'a.jpg', 'c.jpg']);
    } finally {
      Element.prototype.getBoundingClientRect = original;
    }
  });

  it('con el teclado, Escape cancela y el orden no cambia', async () => {
    const alCambiar = vi.fn();
    render(<Galeria alCambiar={alCambiar} />);
    const asa = screen.getByRole('button', { name: 'Mover la foto 2' });
    asa.focus();
    await act(async () => {
      fireEvent.keyDown(asa, { code: 'Space', key: ' ' });
    });
    await act(async () => {
      fireEvent.keyDown(document.activeElement, { code: 'Escape', key: 'Escape' });
    });
    expect(alCambiar).not.toHaveBeenCalled();
    expect(ordenVisto()).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
  });
});
