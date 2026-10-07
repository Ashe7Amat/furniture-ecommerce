import { describe, it, expect } from 'vitest';
import { moverFoto, usarComoPrincipal, fotosTrasSoltar, idsDeFotos, anuncios, INSTRUCCIONES } from './fotos';

// H57: el orden de las fotos en el editor de muebles.
const FOTOS = ['a.jpg', 'b.jpg', 'c.jpg'];

describe('fotos del editor (H57)', () => {
  it('moverFoto lleva una foto a otra posición, desplaza las demás y no toca la lista original', () => {
    expect(moverFoto(FOTOS, 0, 2)).toEqual(['b.jpg', 'c.jpg', 'a.jpg']);
    expect(moverFoto(FOTOS, 2, 0)).toEqual(['c.jpg', 'a.jpg', 'b.jpg']);
    expect(FOTOS).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
  });

  it('"Usar como principal" pone la foto la primera y el resto conserva su orden', () => {
    expect(usarComoPrincipal(FOTOS, 2)).toEqual(['c.jpg', 'a.jpg', 'b.jpg']);
    expect(usarComoPrincipal(FOTOS, 1)).toEqual(['b.jpg', 'a.jpg', 'c.jpg']);
    expect(usarComoPrincipal(FOTOS, 0)).toEqual(FOTOS);
  });

  it('al soltar sobre otra foto, la arrastrada pasa a esa posición', () => {
    const ids = idsDeFotos(FOTOS);
    expect(fotosTrasSoltar(FOTOS, ids, 'a.jpg', 'c.jpg')).toEqual(['b.jpg', 'c.jpg', 'a.jpg']);
    expect(fotosTrasSoltar(FOTOS, ids, 'c.jpg', 'b.jpg')).toEqual(['a.jpg', 'c.jpg', 'b.jpg']);
  });

  it('al soltar fuera, en su mismo sitio o con un id desconocido, devuelve la misma lista', () => {
    const ids = idsDeFotos(FOTOS);
    expect(fotosTrasSoltar(FOTOS, ids, 'a.jpg', undefined)).toBe(FOTOS);
    expect(fotosTrasSoltar(FOTOS, ids, 'a.jpg', null)).toBe(FOTOS);
    expect(fotosTrasSoltar(FOTOS, ids, 'b.jpg', 'b.jpg')).toBe(FOTOS);
    expect(fotosTrasSoltar(FOTOS, ids, 'x.jpg', 'a.jpg')).toBe(FOTOS);
    expect(fotosTrasSoltar(FOTOS, ids, 'a.jpg', 'x.jpg')).toBe(FOTOS);
  });

  it('los ids son la URL; si una URL se repite, la segunda y siguientes llevan #2, #3...', () => {
    expect(idsDeFotos(FOTOS)).toEqual(FOTOS);
    expect(idsDeFotos(['a.jpg', 'b.jpg', 'a.jpg', 'a.jpg'])).toEqual(['a.jpg', 'b.jpg', 'a.jpg#2', 'a.jpg#3']);
    expect(idsDeFotos([])).toEqual([]);
  });

  it('con URLs repetidas, mover una mueve esa y no la otra igual', () => {
    const fotos = ['a.jpg', 'b.jpg', 'a.jpg'];
    expect(fotosTrasSoltar(fotos, idsDeFotos(fotos), 'a.jpg#2', 'a.jpg')).toEqual(['a.jpg', 'a.jpg', 'b.jpg']);
  });

  it('los anuncios para lectores de pantalla dicen la posición, en castellano', () => {
    const a = anuncios(idsDeFotos(FOTOS));
    expect(a.onDragStart({ active: { id: 'b.jpg' } })).toBe('Has cogido la foto 2.');
    expect(a.onDragOver({ active: { id: 'b.jpg' }, over: { id: 'c.jpg' } })).toBe('La foto 2 está sobre la posición 3.');
    expect(a.onDragOver({ active: { id: 'b.jpg' }, over: null })).toBe('La foto 2 no está sobre ninguna posición.');
    expect(a.onDragEnd({ active: { id: 'a.jpg' }, over: { id: 'c.jpg' } })).toBe('La foto 1 se ha soltado en la posición 3.');
    expect(a.onDragEnd({ active: { id: 'a.jpg' }, over: null })).toBe('La foto 1 se ha soltado.');
    expect(a.onDragCancel({ active: { id: 'c.jpg' } })).toBe('Cancelado: la foto 3 vuelve a su sitio.');
    expect(INSTRUCCIONES.draggable).toMatch(/^Para mover la foto, pulsa espacio o Intro\./);
  });
});
