import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CatalogViewToggle from './CatalogViewToggle';

describe('CatalogViewToggle', () => {
  it('con vista="grid", marca aria-pressed=true en "Vista cuadrícula" y false en "Vista lista"', () => {
    render(<CatalogViewToggle vista="grid" onChange={() => {}} />);

    expect(screen.getByRole('button', { name: 'Vista cuadrícula' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Vista lista' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('con vista="table", marca aria-pressed=true en "Vista lista" y false en "Vista cuadrícula"', () => {
    render(<CatalogViewToggle vista="table" onChange={() => {}} />);

    expect(screen.getByRole('button', { name: 'Vista lista' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Vista cuadrícula' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('llama a onChange con "table" al pulsar "Vista lista"', async () => {
    const onChange = vi.fn();
    render(<CatalogViewToggle vista="grid" onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Vista lista' }));

    expect(onChange).toHaveBeenCalledWith('table');
  });

  it('llama a onChange con "grid" al pulsar "Vista cuadrícula"', async () => {
    const onChange = vi.fn();
    render(<CatalogViewToggle vista="table" onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Vista cuadrícula' }));

    expect(onChange).toHaveBeenCalledWith('grid');
  });

  it('cambia de vista de verdad al hacer clic (estado real, no solo la llamada a onChange)', async () => {
    // Envoltorio con estado real: comprueba el cambio de vista de punta a punta a nivel
    // del toggle, sin necesitar montar Catalog.jsx completo (que arrastra getMuebles/
    // getCategorias/FavoritesContext solo para probar el interruptor).
    const ToggleConEstado = () => {
      const [vista, setVista] = useState('grid');
      return <CatalogViewToggle vista={vista} onChange={setVista} />;
    };
    render(<ToggleConEstado />);

    expect(screen.getByRole('button', { name: 'Vista cuadrícula' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'Vista lista' }));

    expect(screen.getByRole('button', { name: 'Vista lista' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Vista cuadrícula' })).toHaveAttribute('aria-pressed', 'false');
  });
});
