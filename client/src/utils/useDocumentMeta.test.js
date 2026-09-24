import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDocumentMeta } from './useDocumentMeta';

const DEFAULT_TITLE = 'Nave 5 Barcelona | Almacén de ideas';

const contenidoDe = (selector) => document.querySelector(selector)?.getAttribute('content');

beforeEach(() => {
  // Cada test empieza con el <head> limpio de restos de meta[name="robots"] de un test
  // anterior (el propio hook las quita al desmontar, pero por si algún test no desmonta).
  document.title = DEFAULT_TITLE;
  document.querySelectorAll('meta[name="robots"]').forEach((el) => el.remove());
});

describe('useDocumentMeta', () => {
  it('sin título, usa el título por defecto de la web', () => {
    renderHook(() => useDocumentMeta({}));
    expect(document.title).toBe(DEFAULT_TITLE);
  });

  it('con título, lo combina con el nombre de la marca', () => {
    renderHook(() => useDocumentMeta({ title: 'Catálogo' }));
    expect(document.title).toBe('Catálogo | Nave 5 Barcelona');
  });

  it('pone la descripción y las etiquetas Open Graph/Twitter a partir de la misma descripción', () => {
    renderHook(() => useDocumentMeta({ title: 'Silla X', description: 'Una silla muy especial' }));
    expect(contenidoDe('meta[name="description"]')).toBe('Una silla muy especial');
    expect(contenidoDe('meta[property="og:description"]')).toBe('Una silla muy especial');
    expect(contenidoDe('meta[name="twitter:description"]')).toBe('Una silla muy especial');
    expect(contenidoDe('meta[property="og:title"]')).toBe('Silla X | Nave 5 Barcelona');
  });

  it('sin imagen, usa la imagen por defecto del sitio', () => {
    renderHook(() => useDocumentMeta({ title: 'X' }));
    expect(contenidoDe('meta[property="og:image"]')).toBe('/og-image.png');
  });

  it('con imagen propia, la usa en lugar de la por defecto', () => {
    renderHook(() => useDocumentMeta({ title: 'X', image: '/fotos/silla.jpg' }));
    expect(contenidoDe('meta[property="og:image"]')).toBe('/fotos/silla.jpg');
    expect(contenidoDe('meta[name="twitter:image"]')).toBe('/fotos/silla.jpg');
  });

  it('noindex=true añade meta robots=noindex', () => {
    renderHook(() => useDocumentMeta({ title: 'X', noindex: true }));
    expect(contenidoDe('meta[name="robots"]')).toBe('noindex');
  });

  it('sin noindex, no hay meta robots (o se quita si ya había una)', () => {
    renderHook(() => useDocumentMeta({ title: 'X', noindex: false }));
    expect(document.querySelector('meta[name="robots"]')).toBeNull();
  });

  it('al desmontar, restaura el título y la descripción por defecto', () => {
    const { unmount } = renderHook(() => useDocumentMeta({ title: 'Página temporal' }));
    expect(document.title).toBe('Página temporal | Nave 5 Barcelona');

    unmount();

    expect(document.title).toBe(DEFAULT_TITLE);
    expect(contenidoDe('meta[name="description"]')).not.toBe(undefined);
  });

  it('al desmontar una página con noindex, quita la etiqueta robots', () => {
    const { unmount } = renderHook(() => useDocumentMeta({ title: 'X', noindex: true }));
    expect(document.querySelector('meta[name="robots"]')).not.toBeNull();

    unmount();

    expect(document.querySelector('meta[name="robots"]')).toBeNull();
  });

  it('cambiar de props (nueva navegación) actualiza el título sin necesitar desmontar', () => {
    const { rerender } = renderHook((props) => useDocumentMeta(props), {
      initialProps: { title: 'Página A' }
    });
    expect(document.title).toBe('Página A | Nave 5 Barcelona');

    rerender({ title: 'Página B' });
    expect(document.title).toBe('Página B | Nave 5 Barcelona');
  });
});
