import { useContext } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastContext, ToastProvider } from './ToastContext';

// Componente mínimo que expone showToast a través de botones, para no tener que montar
// ninguna de las páginas/componentes reales que ya lo consumen (Admin, CartDrawer, etc.).
// Se usa fireEvent en vez de userEvent en este archivo porque userEvent se cuelga al
// combinarlo con temporizadores falsos (necesarios aquí para probar el auto-cierre a los 3s).
const Disparador = () => {
  const { showToast } = useContext(ToastContext);
  return (
    <>
      <button onClick={() => showToast('Guardado con éxito')}>Éxito</button>
      <button onClick={() => showToast('Algo falló', 'error')}>Error</button>
    </>
  );
};

const renderConProvider = () => render(
  <ToastProvider>
    <Disparador />
  </ToastProvider>
);

describe('ToastContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sin llamar a showToast, no muestra ningún toast', () => {
    renderConProvider();
    expect(screen.queryByText('Guardado con éxito')).not.toBeInTheDocument();
  });

  it('showToast sin tipo muestra el mensaje con estilo de éxito', () => {
    renderConProvider();

    act(() => {
      fireEvent.click(screen.getByText('Éxito'));
    });

    const toast = screen.getByText('Guardado con éxito').closest('.toast-item');
    expect(toast).toHaveClass('toast-success');
  });

  it('showToast con tipo "error" muestra el mensaje con estilo de error', () => {
    renderConProvider();

    act(() => {
      fireEvent.click(screen.getByText('Error'));
    });

    const toast = screen.getByText('Algo falló').closest('.toast-item');
    expect(toast).toHaveClass('toast-error');
  });

  it('el toast desaparece solo a los 3 segundos', () => {
    renderConProvider();

    act(() => {
      fireEvent.click(screen.getByText('Éxito'));
    });
    expect(screen.getByText('Guardado con éxito')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.queryByText('Guardado con éxito')).not.toBeInTheDocument();
  });

  it('el botón de cerrar quita el toast antes de que pasen los 3 segundos', () => {
    renderConProvider();

    act(() => {
      fireEvent.click(screen.getByText('Éxito'));
    });
    act(() => {
      fireEvent.click(screen.getByLabelText('Cerrar'));
    });

    expect(screen.queryByText('Guardado con éxito')).not.toBeInTheDocument();
  });

  it('varios toasts a la vez conviven de forma independiente', () => {
    renderConProvider();

    act(() => {
      fireEvent.click(screen.getByText('Éxito'));
      // El id de cada toast es Date.now(); con timers falsos el reloj no avanza solo, así
      // que se adelanta 1ms para que el segundo toast no reciba el mismo id que el primero.
      vi.advanceTimersByTime(1);
      fireEvent.click(screen.getByText('Error'));
    });

    expect(screen.getByText('Guardado con éxito')).toBeInTheDocument();
    expect(screen.getByText('Algo falló')).toBeInTheDocument();
  });
});
