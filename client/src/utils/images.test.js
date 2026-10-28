import { describe, it, expect } from 'vitest';
import { getImagen, miniatura, PLACEHOLDER_IMG, obtenerVariantesWebp } from './images';

describe('getImagen', () => {
  it('devuelve la imagen en la posición pedida cuando existe', () => {
    const imagenes = ['foto1.jpg', 'foto2.jpg'];
    expect(getImagen(imagenes, 0)).toBe('foto1.jpg');
    expect(getImagen(imagenes, 1)).toBe('foto2.jpg');
  });

  it('usa la posición 0 por defecto cuando no se indica índice', () => {
    expect(getImagen(['foto1.jpg'])).toBe('foto1.jpg');
  });

  it('devuelve el placeholder si el array está vacío', () => {
    expect(getImagen([])).toBe(PLACEHOLDER_IMG);
  });

  it('devuelve el placeholder si el índice pedido no existe', () => {
    expect(getImagen(['foto1.jpg'], 3)).toBe(PLACEHOLDER_IMG);
  });

  it('devuelve el placeholder si "imagenes" no es un array (null, undefined, string)', () => {
    expect(getImagen(null)).toBe(PLACEHOLDER_IMG);
    expect(getImagen(undefined)).toBe(PLACEHOLDER_IMG);
    expect(getImagen('no-es-un-array')).toBe(PLACEHOLDER_IMG);
  });
});

describe('miniatura (H61)', () => {
  const BASE = 'https://x.supabase.co/storage/v1/object/public/imagenes/muebles/abc123-1791300000000';

  it('una foto subida con miniatura (-full.webp) da la URL de su miniatura (-thumb.webp)', () => {
    expect(miniatura(`${BASE}-full.webp`)).toBe(`${BASE}-thumb.webp`);
  });

  it('las fotos sin miniatura (las anteriores, JPG o WebP) se devuelven tal cual', () => {
    expect(miniatura(`${BASE}.webp`)).toBe(`${BASE}.webp`);
    expect(miniatura('https://x.supabase.co/.../145-silla-plegable-1.jpg')).toBe('https://x.supabase.co/.../145-silla-plegable-1.jpg');
    expect(miniatura(PLACEHOLDER_IMG)).toBe(PLACEHOLDER_IMG);
  });

  it('solo cambia el final: un "-full.webp" en medio de la URL no cuenta', () => {
    expect(miniatura('https://x.test/a-full.webp/b.jpg')).toBe('https://x.test/a-full.webp/b.jpg');
  });

  it('lo que no es un texto se devuelve tal cual', () => {
    expect(miniatura(undefined)).toBeUndefined();
    expect(miniatura(null)).toBeNull();
  });
});

describe('obtenerVariantesWebp', () => {
  it('genera las 3 variantes y el srcset para URLs estándar', () => {
    const res = obtenerVariantesWebp('https://img.test/uploads/pieza.jpg');
    expect(res).toEqual({
      w400: 'https://img.test/uploads/pieza-400.webp',
      w800: 'https://img.test/uploads/pieza-800.webp',
      w1200: 'https://img.test/uploads/pieza-1200.webp',
      srcset: 'https://img.test/uploads/pieza-400.webp 400w, https://img.test/uploads/pieza-800.webp 800w, https://img.test/uploads/pieza-1200.webp 1200w',
    });
  });

  it('limpia sufijos previos como -full.webp o -thumb.webp antes de generar variantes', () => {
    const res = obtenerVariantesWebp('https://img.test/uploads/mesa-full.webp');
    expect(res.w800).toBe('https://img.test/uploads/mesa-800.webp');
  });

  it('devuelve null si es un SVG o no es una URL de imagen válida', () => {
    expect(obtenerVariantesWebp('/img/sin-imagen.svg')).toBeNull();
    expect(obtenerVariantesWebp(null)).toBeNull();
    expect(obtenerVariantesWebp('')).toBeNull();
  });
});
