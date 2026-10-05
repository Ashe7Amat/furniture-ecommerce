// H45: solo se vuelve a rutas de esta misma web tras iniciar sesión.
import { describe, it, expect } from 'vitest';
import { rutaInterna } from './rutaInterna';

describe('rutaInterna', () => {
  it.each(['/cuenta', '/cuenta?tab=pedidos', '/admin', '/mueble/m1#fotos', '/catalogo?categoria=Decoraci%C3%B3n'])(
    'una ruta de la web se usa tal cual: %s',
    (ruta) => {
      expect(rutaInterna(ruta)).toBe(ruta);
    }
  );

  it.each([
    ['otra web con protocolo', 'https://otra.web/cuenta'],
    ['otra web sin protocolo', '//otra.web'],
    ['barra invertida (GHSA-wrjc-x8rr-h8h6)', '/\\otra.web'],
    ['barra invertida en medio', '/cuenta\\..\\otra'],
    ['tabulador que el navegador quitaría', '/\t/otra.web'],
    ['salto de línea', '/\n/otra.web'],
    ['espacio', '/ /otra.web'],
    ['carácter de control', '/cuenta\u0000'],
    ['DEL', '/cuenta\u007F'],
    ['javascript:', 'javascript:alert(1)'],
    ['sin barra inicial', 'cuenta'],
    ['vacía', '']
  ])('%s: a la portada', (_caso, ruta) => {
    expect(rutaInterna(ruta)).toBe('/');
  });

  it.each([undefined, null, 42, { pathname: '/cuenta' }, ['/cuenta']])('lo que no es texto, a la portada: %o', (valor) => {
    expect(rutaInterna(valor)).toBe('/');
  });
});
