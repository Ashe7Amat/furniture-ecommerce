import { describe, it, expect } from 'vitest';
import { rutaPreguntarPorPieza, mensajeSobrePieza, TEXTO_PREGUNTAR } from './preguntarPorPieza';

describe('preguntarPorPieza (fase C, C3)', () => {
  it('el texto del botón es "Preguntar por esta pieza"', () => {
    expect(TEXTO_PREGUNTAR).toBe('Preguntar por esta pieza');
  });

  it('rutaPreguntarPorPieza: /contacto con el nombre y, si la tiene, la referencia, codificados', () => {
    expect(rutaPreguntarPorPieza({ nombre: 'Aparador de roble', referencia: 'NAV-MES-004' }))
      .toBe('/contacto?pieza=Aparador+de+roble&ref=NAV-MES-004');
    expect(rutaPreguntarPorPieza({ nombre: 'Baúl & maleta "viajera"', referencia: null }))
      .toBe('/contacto?pieza=Ba%C3%BAl+%26+maleta+%22viajera%22');
    expect(rutaPreguntarPorPieza({})).toBe('/contacto?pieza=');
  });

  it('mensajeSobrePieza: el mensaje con la pieza y la referencia, o vacío sin pieza', () => {
    const de = (query) => mensajeSobrePieza(new URLSearchParams(query));
    expect(de('pieza=Aparador+de+roble&ref=NAV-MES-004'))
      .toBe('Hola, me interesa la pieza "Aparador de roble" (ref. NAV-MES-004). ¿Me podéis dar más información?');
    expect(de('pieza=Aparador')).toBe('Hola, me interesa la pieza "Aparador". ¿Me podéis dar más información?');
    expect(de('')).toBe('');
    expect(de('pieza=++&ref=NAV-MES-004')).toBe('');
  });

  it('lo que llega por la URL se recorta: 200 caracteres de nombre y 30 de referencia', () => {
    const mensaje = mensajeSobrePieza(new URLSearchParams({ pieza: 'x'.repeat(500), ref: 'R'.repeat(100) }));
    expect(mensaje).toContain(`"${'x'.repeat(200)}"`);
    expect(mensaje).not.toContain('x'.repeat(201));
    expect(mensaje).toContain(`(ref. ${'R'.repeat(30)})`);
    expect(mensaje).not.toContain('R'.repeat(31));
  });
});
