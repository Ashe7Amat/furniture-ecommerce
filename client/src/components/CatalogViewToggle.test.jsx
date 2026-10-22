import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CatalogViewToggle from './CatalogViewToggle';

describe('CatalogViewToggle', () => {
  const BOTONES = [
    { vista: 'grid-large', nombre: 'Vista de 2 columnas' },
    { vista: 'grid-normal', nombre: 'Vista de 3 columnas' },
    { vista: 'grid-compact', nombre: 'Vista de 4 columnas' },
    { vista: 'table', nombre: 'Vista de lista' }
  ];

  it.each(BOTONES)('con vista="$vista", marca aria-pressed=true en "$nombre" y false en las demás', ({ vista, nombre }) => {
    render(<CatalogViewToggle vista={vista} onChange={() => {}} />);

    BOTONES.forEach((b) => {
      const boton = screen.getByRole('button', { name: b.nombre });
      if (b.nombre === nombre) {
        expect(boton).toHaveAttribute('aria-pressed', 'true');
        expect(boton).toHaveClass('active');
      } else {
        expect(boton).toHaveAttribute('aria-pressed', 'false');
        expect(boton).not.toHaveClass('active');
      }
    });
  });

  it.each(BOTONES)('llama a onChange con "$vista" al pulsar "$nombre"', async ({ vista, nombre }) => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<CatalogViewToggle vista="grid-normal" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: nombre }));
    expect(onChange).toHaveBeenCalledWith(vista);
  });

  it('cambia de vista de forma interactiva con estado real', async () => {
    const user = userEvent.setup();
    const ToggleConEstado = () => {
      const [vista, setVista] = useState('grid-normal');
      return <CatalogViewToggle vista={vista} onChange={setVista} />;
    };
    render(<ToggleConEstado />);

    // Inicialmente normal (3 columnas)
    expect(screen.getByRole('button', { name: 'Vista de 3 columnas' })).toHaveAttribute('aria-pressed', 'true');

    // Cambiar a grande (2 columnas)
    await user.click(screen.getByRole('button', { name: 'Vista de 2 columnas' }));
    expect(screen.getByRole('button', { name: 'Vista de 2 columnas' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Vista de 3 columnas' })).toHaveAttribute('aria-pressed', 'false');

    // Cambiar a compacto (4 columnas)
    await user.click(screen.getByRole('button', { name: 'Vista de 4 columnas' }));
    expect(screen.getByRole('button', { name: 'Vista de 4 columnas' })).toHaveAttribute('aria-pressed', 'true');

    // Cambiar a tabla/lista
    await user.click(screen.getByRole('button', { name: 'Vista de lista' }));
    expect(screen.getByRole('button', { name: 'Vista de lista' })).toHaveAttribute('aria-pressed', 'true');
  });
});
