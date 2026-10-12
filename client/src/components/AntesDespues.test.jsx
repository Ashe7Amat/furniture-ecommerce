import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AntesDespues from './AntesDespues';

const montar = () =>
  render(<AntesDespues antes="https://img.test/antes.jpg" despues="https://img.test/despues.jpg" nombre="Butaca" />);

describe('AntesDespues', () => {
  it('las dos fotos, con su texto alternativo, y el deslizador a la mitad', () => {
    montar();
    expect(screen.getByRole('img', { name: 'Butaca, antes de restaurar' })).toHaveAttribute('src', 'https://img.test/antes.jpg');
    expect(screen.getByRole('img', { name: 'Butaca, después de restaurar' })).toHaveAttribute('src', 'https://img.test/despues.jpg');
    const deslizador = screen.getByRole('slider', { name: 'Comparar antes y después de la restauración' });
    expect(deslizador).toHaveValue('50');
    expect(document.querySelector('.ad-marco').style.getPropertyValue('--ad-pos')).toBe('50%');
  });

  it('al mover el deslizador, el corte de la foto de antes se mueve con él', () => {
    montar();
    const deslizador = screen.getByRole('slider');
    fireEvent.change(deslizador, { target: { value: '20' } });
    expect(document.querySelector('.ad-marco').style.getPropertyValue('--ad-pos')).toBe('20%');
    expect(deslizador).toHaveAttribute('aria-valuetext', '20 % de la foto de antes');
  });
});
