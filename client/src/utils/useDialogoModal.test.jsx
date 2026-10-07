import { describe, it, expect, vi, afterEach } from 'vitest';
import { useRef, useState } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import useDialogoModal, { enfocables } from './useDialogoModal';

// Un diálogo mínimo con el hook (H55), y un botón fuera para abrirlo y ver adónde vuelve el foco.
const Prueba = ({ alCerrar = vi.fn(), sinBotones = false, abiertoInicial = false }) => {
  const [abierto, setAbierto] = useState(abiertoInicial);
  const ref = useRef(null);
  useDialogoModal(abierto, ref, () => {
    alCerrar();
    setAbierto(false);
  });
  return (
    <>
      <button onClick={() => setAbierto(true)}>Abrir</button>
      {abierto && (
        <div role="dialog" aria-label="Prueba" tabIndex={-1} ref={ref}>
          {!sinBotones && (
            <>
              <button>Primero</button>
              <input aria-label="Campo" />
              <button disabled>Desactivado</button>
              <button>Último</button>
            </>
          )}
        </div>
      )}
    </>
  );
};

const abrir = () => {
  const abrirBtn = screen.getByRole('button', { name: 'Abrir' });
  abrirBtn.focus();
  fireEvent.click(abrirBtn);
  return abrirBtn;
};
const pulsar = (tecla, opciones = {}) => fireEvent.keyDown(document.activeElement, { key: tecla, ...opciones });

afterEach(cleanup);

describe('useDialogoModal (H55)', () => {
  it('al abrir, el foco entra en el primer elemento enfocable del diálogo', () => {
    render(<Prueba />);
    abrir();
    expect(screen.getByRole('button', { name: 'Primero' })).toHaveFocus();
  });

  it('Tab en el último vuelve al primero, y Mayús+Tab en el primero va al último', () => {
    render(<Prueba />);
    abrir();
    screen.getByRole('button', { name: 'Último' }).focus();
    pulsar('Tab');
    expect(screen.getByRole('button', { name: 'Primero' })).toHaveFocus();
    pulsar('Tab', { shiftKey: true });
    expect(screen.getByRole('button', { name: 'Último' })).toHaveFocus();
  });

  it('Tab en medio del diálogo no se intercepta (lo mueve el navegador)', () => {
    render(<Prueba />);
    abrir();
    screen.getByRole('textbox', { name: 'Campo' }).focus();
    const evento = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.activeElement.dispatchEvent(evento);
    expect(evento.defaultPrevented).toBe(false);
    expect(screen.getByRole('textbox', { name: 'Campo' })).toHaveFocus();
  });

  it('los botones desactivados no cuentan como enfocables', () => {
    render(<Prueba />);
    abrir();
    expect(enfocables(screen.getByRole('dialog')).map((el) => el.textContent || el.getAttribute('aria-label'))).toEqual([
      'Primero',
      'Campo',
      'Último'
    ]);
  });

  it('si el foco se ha salido del diálogo, Tab lo devuelve dentro (al primero; con Mayús, al último)', () => {
    render(<Prueba />);
    const abrirBtn = abrir();
    abrirBtn.focus();
    pulsar('Tab');
    expect(screen.getByRole('button', { name: 'Primero' })).toHaveFocus();
    abrirBtn.focus();
    pulsar('Tab', { shiftKey: true });
    expect(screen.getByRole('button', { name: 'Último' })).toHaveFocus();
  });

  it('Escape lo cierra, no llega a quien escucha después (la cesta) y el foco vuelve al botón que lo abrió', () => {
    const alCerrar = vi.fn();
    const escuchaDeLaCesta = vi.fn();
    document.addEventListener('keydown', escuchaDeLaCesta);
    render(<Prueba alCerrar={alCerrar} />);
    const abrirBtn = abrir();

    pulsar('Escape');

    expect(alCerrar).toHaveBeenCalledTimes(1);
    expect(escuchaDeLaCesta).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(abrirBtn).toHaveFocus();
    document.removeEventListener('keydown', escuchaDeLaCesta);
  });

  it('otras teclas no hacen nada', () => {
    const alCerrar = vi.fn();
    render(<Prueba alCerrar={alCerrar} />);
    abrir();
    pulsar('Enter');
    pulsar('a');
    expect(alCerrar).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Primero' })).toHaveFocus();
  });

  it('sin nada enfocable dentro, el foco va al propio diálogo y Tab lo deja ahí', () => {
    render(<Prueba sinBotones />);
    abrir();
    const dialogo = screen.getByRole('dialog');
    expect(dialogo).toHaveFocus();
    pulsar('Tab');
    expect(dialogo).toHaveFocus();
  });

  it('cerrado no escucha el teclado', () => {
    const alCerrar = vi.fn();
    render(<Prueba alCerrar={alCerrar} />);
    pulsar('Escape');
    expect(alCerrar).not.toHaveBeenCalled();
  });

  it('si el elemento que tenía el foco ya no existe al cerrar, no falla', () => {
    const alCerrar = vi.fn();
    const { unmount } = render(<Prueba alCerrar={alCerrar} abiertoInicial />);
    expect(() => unmount()).not.toThrow();
  });

  it('enfocables de nada es una lista vacía', () => {
    expect(enfocables(null)).toEqual([]);
  });
});
