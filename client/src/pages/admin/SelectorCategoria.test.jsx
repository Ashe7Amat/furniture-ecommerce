import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SelectorCategoria from './SelectorCategoria';

const CATEGORIAS = [
  { id: 2, nombre: 'Decoración y hogar', categoria_padre_id: null },
  { id: 21, nombre: 'Lámparas', categoria_padre_id: 2 },
  { id: 1, nombre: 'Mobiliario', categoria_padre_id: null },
  { id: 11, nombre: 'Sillas', categoria_padre_id: 1 }
];

describe('SelectorCategoria', () => {
  it('agrupa las específicas bajo su general, con una opción vacía al principio, y es obligatorio', () => {
    render(<SelectorCategoria categorias={CATEGORIAS} name="categoria" value="" onChange={() => {}} />);
    const selector = screen.getByRole('combobox');

    expect(selector).toHaveAttribute('name', 'categoria');
    expect(selector).toBeRequired();
    expect(selector).toHaveValue('');
    expect([...selector.children].map(el => el.tagName === 'OPTGROUP' ? el.label : el.textContent)).toEqual([
      'Selecciona una categoría',
      'Decoración y hogar',
      'Mobiliario'
    ]);
    expect([...selector.querySelectorAll('optgroup option')].map(o => o.value)).toEqual(['Lámparas', 'Sillas']);
  });

  it('sin name no pone el atributo, y avisa de los cambios con el valor elegido (el nombre)', async () => {
    // El valor se lee dentro del manejador: después, React devuelve el <select> controlado a `value`.
    const elegidos = [];
    const onChange = vi.fn((e) => elegidos.push(e.target.value));
    render(<SelectorCategoria categorias={CATEGORIAS} value="Lámparas" onChange={onChange} />);
    const selector = screen.getByRole('combobox');

    expect(selector).not.toHaveAttribute('name');
    expect(selector).toHaveValue('Lámparas');
    await userEvent.setup().selectOptions(selector, 'Sillas');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(elegidos).toEqual(['Sillas']);
  });
});
