import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AlbaranPedido from './AlbaranPedido';
import { PLACEHOLDER_IMG } from '../../utils/images';

const PEDIDO_EJEMPLO = {
  id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  estado: 'procesando',
  created_at: '2026-10-15T10:30:00Z',
  total: 450,
  direccion_envio: 'Carrer de Mallorca, 123, 2-1, Barcelona',
  cliente_info: {
    nombre: 'Carla Valls',
    email: 'carla@ejemplo.com',
    telefono: '611223344',
    direccion: 'Carrer de Mallorca, 123, 2-1, Barcelona'
  },
  items: [
    {
      productId: 'p1',
      nombre: 'Silla Thonet Original',
      referencia: 'NAV-SIL-001',
      modalidad: 'compra',
      imagen: 'https://x.supabase.co/storage/v1/object/public/imagenes/muebles/thonet-full.webp'
    },
    {
      productId: 'p2',
      nombre: 'Mesa de Centro Nogal',
      referencia: 'NAV-MES-014',
      modalidad: 'alquiler',
      imagen: 'https://x.supabase.co/storage/v1/object/public/imagenes/muebles/mesa-nogal.jpg'
    }
  ]
};

beforeEach(() => {
  vi.resetAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('AlbaranPedido — test unitario', () => {
  it('renderiza la cabecera corporativa de Nave 5 Barcelona con dirección y NIF', () => {
    render(<AlbaranPedido pedido={PEDIDO_EJEMPLO} />);

    expect(screen.getByText('NAVE 5 BARCELONA')).toBeInTheDocument();
    expect(screen.getByText('Carrer del Plom, 32-34, Barcelona')).toBeInTheDocument();
    expect(screen.getByText('NIF: B-00000000')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'ALBARÁN DE PEDIDO' })).toBeInTheDocument();
    expect(screen.getByText('Ref. A1B2C3D4')).toBeInTheDocument();
  });

  it('renderiza los datos del pedido (ID y fecha) y del cliente (nombre, email, teléfono, dirección)', () => {
    render(<AlbaranPedido pedido={PEDIDO_EJEMPLO} />);

    expect(screen.getByText('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d')).toBeInTheDocument();
    // La fecha contiene al menos el día y año
    expect(screen.getByText(/2026/)).toBeInTheDocument();

    expect(screen.getByText('Carla Valls')).toBeInTheDocument();
    expect(screen.getByText('carla@ejemplo.com')).toBeInTheDocument();
    expect(screen.getByText('611223344')).toBeInTheDocument();
    expect(screen.getByText('Carrer de Mallorca, 123, 2-1, Barcelona')).toBeInTheDocument();
  });

  it('si falta el teléfono o la dirección, no muestra etiquetas vacías', () => {
    const pedidoSinTelNiDir = {
      ...PEDIDO_EJEMPLO,
      direccion_envio: null,
      cliente_info: {
        nombre: 'Marc Rovira',
        email: 'marc@ejemplo.com',
        telefono: '',
        direccion: null
      }
    };

    render(<AlbaranPedido pedido={pedidoSinTelNiDir} />);

    expect(screen.getByText('Marc Rovira')).toBeInTheDocument();
    expect(screen.getByText('marc@ejemplo.com')).toBeInTheDocument();
    expect(screen.queryByText(/Teléfono:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Dirección:/)).not.toBeInTheDocument();
  });

  it('renderiza la tabla de piezas con miniaturas, referencia, nombre y columnas en blanco para rellenar a mano', () => {
    render(<AlbaranPedido pedido={PEDIDO_EJEMPLO} />);

    expect(screen.getByRole('columnheader', { name: 'Foto' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Referencia' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Nombre' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Estado a la salida' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Observaciones' })).toBeInTheDocument();

    // Pieza 1
    expect(screen.getByText('Silla Thonet Original')).toBeInTheDocument();
    expect(screen.getByText('NAV-SIL-001')).toBeInTheDocument();
    const imgThonet = screen.getByRole('img', { name: 'Miniatura de Silla Thonet Original' });
    // Convierte -full.webp a -thumb.webp según la lógica del catálogo (miniatura())
    expect(imgThonet).toHaveAttribute(
      'src',
      'https://x.supabase.co/storage/v1/object/public/imagenes/muebles/thonet-thumb.webp'
    );

    // Pieza 2 (alquiler)
    expect(screen.getByText('Mesa de Centro Nogal')).toBeInTheDocument();
    expect(screen.getByText('NAV-MES-014')).toBeInTheDocument();
    expect(screen.getByText('(alquiler)')).toBeInTheDocument();
    const imgMesa = screen.getByRole('img', { name: 'Miniatura de Mesa de Centro Nogal' });
    expect(imgMesa).toHaveAttribute(
      'src',
      'https://x.supabase.co/storage/v1/object/public/imagenes/muebles/mesa-nogal.jpg'
    );

    // Celdas de salida y observaciones vacías
    const celdasSalida = screen.getAllByRole('cell', { name: 'Estado a la salida' });
    expect(celdasSalida).toHaveLength(2);
    expect(celdasSalida[0]).toBeEmptyDOMElement();

    const celdasObs = screen.getAllByRole('cell', { name: 'Observaciones' });
    expect(celdasObs).toHaveLength(2);
    expect(celdasObs[0]).toBeEmptyDOMElement();
  });

  it('si una pieza no tiene imagen, usa el PLACEHOLDER_IMG propio', () => {
    const pedidoSinFotos = {
      ...PEDIDO_EJEMPLO,
      items: [{ productId: 'p3', nombre: 'Taburete Rústico', referencia: 'NAV-TAB-003' }]
    };

    render(<AlbaranPedido pedido={pedidoSinFotos} />);

    const img = screen.getByRole('img', { name: 'Miniatura de Taburete Rústico' });
    expect(img).toHaveAttribute('src', PLACEHOLDER_IMG);
  });

  it('resuelve referencias y fotos desde el catálogo `muebles` si el item del pedido no las tiene', () => {
    const pedidoIds = {
      ...PEDIDO_EJEMPLO,
      items: [{ productId: 'm-cat-1', nombre: 'Aparador Mid-Century' }]
    };
    const mueblesCatalogo = [
      {
        id: 'm-cat-1',
        nombre: 'Aparador Mid-Century',
        referencia: 'NAV-APA-099',
        imagenes: ['https://x.supabase.co/storage/v1/object/public/imagenes/muebles/aparador-full.webp']
      }
    ];

    render(<AlbaranPedido pedido={pedidoIds} muebles={mueblesCatalogo} />);

    expect(screen.getByText('NAV-APA-099')).toBeInTheDocument();
    const img = screen.getByRole('img', { name: 'Miniatura de Aparador Mid-Century' });
    expect(img).toHaveAttribute(
      'src',
      'https://x.supabase.co/storage/v1/object/public/imagenes/muebles/aparador-thumb.webp'
    );
  });

  it('renderiza las cajas de firmas de entrega y devolución con sus títulos y campos de fecha', () => {
    render(<AlbaranPedido pedido={PEDIDO_EJEMPLO} />);

    expect(
      screen.getByText('Firma de conformidad en la Entrega (Recibido en buen estado)')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Firma de conformidad en la Devolución (Revisado por almacén)')
    ).toBeInTheDocument();
    const fechas = screen.getAllByText('Fecha: ____');
    expect(fechas).toHaveLength(2);
  });

  it('con onCerrar, se renderiza dentro de VistaImpresion con su barra de botones e imprime/cierra', async () => {
    const user = userEvent.setup();
    const onCerrar = vi.fn();
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

    render(<AlbaranPedido pedido={PEDIDO_EJEMPLO} onCerrar={onCerrar} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Albarán de pedido Ref. A1B2C3D4' })).toBeInTheDocument();
    expect(document.body).toHaveClass('con-impresion');

    // Botón Imprimir
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Imprimir' }));
    expect(printSpy).toHaveBeenCalledTimes(1);

    // Botón Cerrar
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cerrar' }));
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });
});
