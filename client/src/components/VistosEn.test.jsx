import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import VistosEn, { PRODUCCIONES } from './VistosEn';

describe('VistosEn', () => {
  it('con la lista vacía no pinta nada (la del cliente aún no está)', () => {
    const { container } = render(<VistosEn producciones={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('la lista por defecto es la de PRODUCCIONES', () => {
    const { container } = render(<VistosEn />);
    expect(container.childElementCount).toBe(PRODUCCIONES.length ? 1 : 0);
  });

  it('con producciones, una sección con su título y un elemento por producción, con el tipo si lo tiene', () => {
    render(<VistosEn producciones={[{ nombre: 'Serie A', tipo: 'Serie' }, { nombre: 'Anuncio B' }]} />);
    const seccion = screen.getByRole('region', { name: 'Nuestras piezas han salido en' });
    const items = [...seccion.querySelectorAll('li')].map((li) => li.textContent);
    expect(items).toEqual(['Serie ASerie', 'Anuncio B']);
  });
});
