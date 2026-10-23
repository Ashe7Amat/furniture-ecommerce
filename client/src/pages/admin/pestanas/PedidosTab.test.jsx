import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PedidosTab from './PedidosTab';
import { ToastContext } from '../../../context/ToastContext';

vi.mock('../../../services/api');

const PEDIDO_1 = {
  id: 'b1c2d3e4-1111-4000-8000-000000000001',
  estado: 'procesando',
  created_at: '2026-10-10T12:00:00Z',
  total: 620,
  direccion_envio: 'Passeig de Gràcia, 45, Barcelona',
  cliente_info: {
    nombre: 'Elena Morales',
    email: 'elena@ejemplo.com',
    telefono: '677889900',
    direccion: 'Passeig de Gràcia, 45, Barcelona'
  },
  items: [
    {
      productId: 'm1',
      nombre: 'Sillón Lounge Cuero',
      referencia: 'NAV-SIL-088',
      modalidad: 'compra',
      precio: 620
    }
  ]
};

const PEDIDO_2 = {
  id: 'c2d3e4f5-2222-4000-8000-000000000002',
  estado: 'enviado',
  created_at: '2026-10-12T14:30:00Z',
  total: 150,
  direccion_envio: null,
  cliente_info: {
    nombre: 'Jordi Soler',
    email: 'jordi@ejemplo.com',
    telefono: null,
    direccion: null
  },
  items: [
    {
      productId: 'm2',
      nombre: 'Lámpara de Mesa Latón',
      referencia: 'NAV-ILU-012',
      modalidad: 'compra',
      precio: 150
    }
  ]
};

const renderizarPedidosTab = (props = {}) => {
  const showToast = vi.fn();
  const setPedidos = vi.fn();
  const ajustarTrasCambioDeEstado = vi.fn();
  const setFiltroEstadoPedido = vi.fn();
  const cargarPedidos = vi.fn();

  const utils = render(
    <ToastContext.Provider value={{ showToast }}>
      <PedidosTab
        pedidos={[PEDIDO_1, PEDIDO_2]}
        setPedidos={setPedidos}
        infoPedidos={{ total: 2, pagina: 1, totalPaginas: 1 }}
        ajustarTrasCambioDeEstado={ajustarTrasCambioDeEstado}
        filtroEstadoPedido=""
        setFiltroEstadoPedido={setFiltroEstadoPedido}
        cargarPedidos={cargarPedidos}
        {...props}
      />
    </ToastContext.Provider>
  );

  return { showToast, setPedidos, ...utils };
};

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PedidosTab — botón Imprimir albarán y VistaImpresion', () => {
  it('cada fila de pedido incluye un botón "Imprimir albarán"', () => {
    renderizarPedidosTab();

    const botonesAlbaran = screen.getAllByRole('button', { name: 'Imprimir albarán' });
    expect(botonesAlbaran).toHaveLength(2);
    for (const btn of botonesAlbaran) {
      expect(btn).toHaveClass('admin-btn-ghost', 'pedido-btn-albaran');
    }
  });

  it('pulsar "Imprimir albarán" abre la vista de impresión del pedido correspondiente', async () => {
    const user = userEvent.setup();
    renderizarPedidosTab();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body).not.toHaveClass('con-impresion');

    // Pulsamos el albarán del primer pedido (Elena Morales)
    const botones = screen.getAllByRole('button', { name: 'Imprimir albarán' });
    await user.click(botones[0]);

    const dialogo = screen.getByRole('dialog');
    expect(dialogo).toBeInTheDocument();
    expect(document.body).toHaveClass('con-impresion');

    // Comprobamos que el título del diálogo tiene la referencia corta del pedido
    expect(within(dialogo).getByRole('heading', { level: 3, name: 'Albarán de pedido Ref. B1C2D3E4' })).toBeInTheDocument();

    // Comprobamos que los datos del albarán están presentes en el diálogo
    expect(within(dialogo).getByText('Elena Morales')).toBeInTheDocument();
    expect(within(dialogo).getByText('Sillón Lounge Cuero')).toBeInTheDocument();
    expect(within(dialogo).getByText('NAV-SIL-088')).toBeInTheDocument();
    expect(within(dialogo).getByText('NAVE 5 BARCELONA')).toBeInTheDocument();
    expect(
      within(dialogo).getByText('Firma de conformidad en la Entrega (Recibido en buen estado)')
    ).toBeInTheDocument();
  });

  it('cerrar el albarán con el botón "Cerrar" quita la vista de impresión y la clase de body', async () => {
    const user = userEvent.setup();
    renderizarPedidosTab();

    const botones = screen.getAllByRole('button', { name: 'Imprimir albarán' });
    await user.click(botones[1]); // Jordi Soler (Ref. C2D3E4F5)

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).getByText('Jordi Soler')).toBeInTheDocument();

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cerrar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body).not.toHaveClass('con-impresion');
  });

  it('cerrar el albarán con Escape también lo cierra', async () => {
    const user = userEvent.setup();
    renderizarPedidosTab();

    const botones = screen.getAllByRole('button', { name: 'Imprimir albarán' });
    await user.click(botones[0]);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body).not.toHaveClass('con-impresion');
  });

  it('el botón "Imprimir" de la vista de impresión llama a window.print', async () => {
    const user = userEvent.setup();
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    renderizarPedidosTab();

    const botones = screen.getAllByRole('button', { name: 'Imprimir albarán' });
    await user.click(botones[0]);

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Imprimir' }));

    expect(printSpy).toHaveBeenCalledTimes(1);
  });
});
