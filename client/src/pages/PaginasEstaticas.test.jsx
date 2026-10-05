// Páginas informativas y de vuelta del pago: se pintan con su título y fijan el título de la
// pestaña. No tenían tests (tarea 5 de la sesión del 5 oct 2026, cobertura).
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import About from './About';
import Sustainability from './Sustainability';
import Legal from './Legal';
import PrivacyPolicy from './PrivacyPolicy';
import Terms from './Terms';
import CheckoutCancelado from './CheckoutCancelado';

const montar = (Pagina) =>
  render(
    <MemoryRouter>
      <Pagina />
    </MemoryRouter>
  );

describe('páginas informativas', () => {
  it.each([
    ['Sobre nosotros', About, 'Nave 5 Barcelona'],
    ['Sostenibilidad', Sustainability, 'Sostenibilidad y Restauración'],
    ['Aviso legal', Legal, 'Aviso Legal'],
    ['Privacidad', PrivacyPolicy, 'Política de Privacidad'],
    ['Términos', Terms, 'Términos y Condiciones']
  ])('%s: su título como h1 y en la pestaña', (_nombre, Pagina, titulo) => {
    montar(Pagina);

    expect(screen.getByRole('heading', { level: 1, name: titulo })).toBeInTheDocument();
    expect(document.title).toContain(titulo);
  });

  it('el aviso legal y los términos enlazan entre sí y a la privacidad', () => {
    montar(Legal);
    const enlaces = [...document.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(enlaces.some((href) => ['/terminos', '/privacidad'].includes(href))).toBe(true);
  });
});

describe('pago cancelado', () => {
  it('dice que no se ha cobrado nada y lleva de vuelta a la tienda', () => {
    montar(CheckoutCancelado);

    expect(screen.getByRole('heading', { level: 1, name: 'Pago cancelado' })).toBeInTheDocument();
    expect(screen.getByText(/No te hemos cobrado nada/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a la tienda' })).toHaveAttribute('href', '/catalogo');
  });
});
