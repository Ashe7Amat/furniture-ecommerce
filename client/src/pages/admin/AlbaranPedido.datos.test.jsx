// El albarán con datos incompletos: pedido sin id, sin fecha o con una fecha que no se entiende,
// cliente sin datos, piezas sin nombre ni referencia (se toman del catálogo) y las distintas formas
// en que llega la foto. El resto está en AlbaranPedido.test.jsx.
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import AlbaranPedido, { ContenidoAlbaran } from './AlbaranPedido';
import { PLACEHOLDER_IMG } from '../../utils/images';

const filas = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);

describe('AlbaranPedido — datos incompletos', () => {
  it('sin pedido: guiones, «Sin nombre» y sin piezas', () => {
    render(<ContenidoAlbaran />);
    expect(screen.getByRole('article', { name: 'Albarán de pedido' })).toBeInTheDocument();
    expect(screen.queryByText(/^Ref\./)).not.toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(2);
    expect(screen.getByText('Sin nombre')).toBeInTheDocument();
    expect(screen.queryByText('Email:')).not.toBeInTheDocument();
    expect(screen.queryByText('Teléfono:')).not.toBeInTheDocument();
    expect(screen.queryByText('Dirección:')).not.toBeInTheDocument();
    expect(screen.getByText('No hay piezas registradas en este pedido.')).toBeInTheDocument();
  });

  it('una fecha que no se entiende se deja tal cual; la dirección puede venir del envío', () => {
    render(
      <AlbaranPedido
        pedido={{ id: 'abc', created_at: 'mañana', direccion_envio: 'C/ Mar 1', items: 'no es lista' }}
        muebles={null}
      />
    );
    expect(screen.getByText('mañana')).toBeInTheDocument();
    expect(screen.getByText('C/ Mar 1')).toBeInTheDocument();
    expect(screen.getByText('Ref. ABC')).toBeInTheDocument();
  });

  it('nombre, referencia y foto del catálogo cuando la pieza del pedido no los trae', () => {
    const muebles = [
      { id: 'p1', nombre: 'Silla Tolix', referencia: 'NAV-SIL-001', imagenes: ['https://img.test/silla.jpg'] },
      { id: 'p2', nombre: 'Mesa', referencia: 'NAV-MES-002', imagen: 'https://img.test/mesa.jpg' },
      { id: 'p3', nombre: 'Banco', referencia: 'NAV-BAN-003', imagenes: [] }
    ];
    const items = [
      { productId: 'p1' },
      { id: 'p2' },
      { productId: 'p3' },
      { productId: 'x1', imagenes: ['https://img.test/lista.jpg'] },
      { productId: 'x2', foto: 'https://img.test/foto.jpg' },
      { productId: 'x3' }
    ];
    render(<ContenidoAlbaran pedido={{ id: 'p-1', items }} muebles={muebles} />);
    const [silla, mesa, banco, lista, foto, nada] = filas();

    expect(silla).toHaveTextContent('NAV-SIL-001');
    expect(silla).toHaveTextContent('Silla Tolix');
    expect(within(silla).getByRole('img').getAttribute('src')).toContain('silla');
    expect(within(mesa).getByRole('img').getAttribute('src')).toContain('mesa');
    expect(within(banco).getByRole('img')).toHaveAttribute('src', PLACEHOLDER_IMG);
    expect(within(lista).getByRole('img').getAttribute('src')).toContain('lista');
    expect(within(foto).getByRole('img').getAttribute('src')).toContain('foto');
    expect(nada).toHaveTextContent('—');
    expect(nada).toHaveTextContent('Pieza');
    expect(within(nada).getByRole('img')).toHaveAttribute('src', PLACEHOLDER_IMG);
  });
});
