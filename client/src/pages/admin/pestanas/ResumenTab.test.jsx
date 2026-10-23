// Las tarjetas y los gráficos nuevos del Resumen (métricas del dashboard). Los gráficos de Recharts
// necesitan medir su contenedor, y jsdom no mide nada: ResponsiveContainer se sustituye por uno de
// tamaño fijo y el resto de Recharts es el de verdad.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cloneElement } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ResumenTab from './ResumenTab';
import { ToastContext } from '../../../context/ToastContext';
import { getMetricasDashboard, exportarClientesCsv } from '../../../services/api';
import { descargarArchivo } from '../../../utils/descargarArchivo';

vi.mock('../../../services/api');
vi.mock('../../../utils/descargarArchivo');
vi.mock('recharts', async (importOriginal) => ({
  ...(await importOriginal()),
  ResponsiveContainer: ({ children }) => cloneElement(children, { width: 600, height: 260 })
}));

const METRICAS = {
  ticketMedio: 125,
  ingresosAlquiler: 0,
  ventasPorMes: [
    { mes: 'May', total: 0 },
    { mes: 'Jun', total: 400 },
    { mes: 'Jul', total: 0 },
    { mes: 'Ago', total: 60 },
    { mes: 'Sep', total: 1250.5 },
    { mes: 'Oct', total: 300 }
  ],
  topCategorias: [
    { categoria: 'Sillas', cantidad: 3 },
    { categoria: 'Mesas', cantidad: 1 }
  ],
  clientes: { nuevosEsteMes: 2, recurrentes: 1 }
};

const renderResumen = (props = {}) =>
  render(
    <ToastContext.Provider value={{ showToast: vi.fn() }}>
      <ResumenTab muebles={[]} pedidosPendientes={0} irA={vi.fn()} {...props} />
    </ToastContext.Provider>
  );

// Cada tarjeta es un <h3> con la cifra seguido de un <p> con su etiqueta.
const valorDeTarjeta = (etiqueta) =>
  within(screen.getByText(etiqueta, { selector: 'p' }).parentElement).getByRole('heading', {
    level: 3
  });

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Resumen — tarjetas de métricas', () => {
  it('pide las métricas una sola vez al montar', async () => {
    getMetricasDashboard.mockResolvedValue(METRICAS);
    renderResumen();

    await screen.findByText('125 €');
    expect(getMetricasDashboard).toHaveBeenCalledTimes(1);
  });

  it('"Ticket Medio" enseña el ticket medio en euros', async () => {
    getMetricasDashboard.mockResolvedValue(METRICAS);
    renderResumen();

    await screen.findByText('125 €');
    expect(valorDeTarjeta('Ticket Medio')).toHaveTextContent('125 €');
  });

  it('el ticket medio conserva los decimales, a la española', async () => {
    getMetricasDashboard.mockResolvedValue({ ...METRICAS, ticketMedio: 99.5 });
    renderResumen();

    expect(await screen.findByText('99,5 €')).toBeInTheDocument();
  });

  it('"Ingresos Alquiler/mes" sale a 0 € mientras no haya reservas con ingresos', async () => {
    getMetricasDashboard.mockResolvedValue(METRICAS);
    renderResumen();

    await screen.findByText('125 €');
    expect(valorDeTarjeta('Ingresos Alquiler/mes')).toHaveTextContent('0 €');
  });

  it('mientras cargan las métricas, las dos tarjetas enseñan un guion y no hay gráficos', () => {
    getMetricasDashboard.mockReturnValue(new Promise(() => {}));
    renderResumen();

    expect(valorDeTarjeta('Ticket Medio')).toHaveTextContent('—');
    expect(valorDeTarjeta('Ingresos Alquiler/mes')).toHaveTextContent('—');
    expect(screen.queryByTestId('grafico-ventas')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('las tarjetas de siempre siguen ahí, con sus cifras', async () => {
    getMetricasDashboard.mockResolvedValue(METRICAS);
    renderResumen({
      muebles: [{ id: 'm1', nombre: 'Silla', categoria: 'Sillas', estado: 'vendido', imagenes: ['a'] }],
      pedidosPendientes: 4
    });

    await screen.findByText('125 €');
    expect(valorDeTarjeta('Total Catálogo')).toHaveTextContent('1');
    expect(valorDeTarjeta('Vendidos')).toHaveTextContent('1');
    expect(valorDeTarjeta('Pedidos por procesar')).toHaveTextContent('4');
  });
});

describe('Resumen — gráfico de ventas (líneas)', () => {
  it('se monta con los 6 meses, con el eje X en meses y la línea dibujada', async () => {
    getMetricasDashboard.mockResolvedValue(METRICAS);
    renderResumen();

    const grafico = await screen.findByTestId('grafico-ventas');
    expect(
      screen.getByRole('heading', { level: 3, name: 'Ventas de los últimos 6 meses' })
    ).toBeInTheDocument();
    for (const mes of ['May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct']) {
      expect(within(grafico).getByText(mes)).toBeInTheDocument();
    }
    expect(grafico.querySelector('path.recharts-line-curve')).toBeInTheDocument();
  });

  it('el eje Y va en euros', async () => {
    getMetricasDashboard.mockResolvedValue(METRICAS);
    renderResumen();

    const grafico = await screen.findByTestId('grafico-ventas');
    const marcas = [...grafico.querySelectorAll('.recharts-yAxis-tick-labels text')];
    expect(marcas.length).toBeGreaterThan(0);
    expect(marcas.every((marca) => marca.textContent.endsWith(' €'))).toBe(true);
  });

  it('se describe con una frase para lectores de pantalla', async () => {
    getMetricasDashboard.mockResolvedValue(METRICAS);
    renderResumen();

    const grafico = await screen.findByTestId('grafico-ventas');
    expect(grafico).toHaveAttribute('role', 'img');
    expect(grafico).toHaveAttribute(
      'aria-label',
      'Ventas de los últimos 6 meses: May 0 €, Jun 400 €, Jul 0 €, Ago 60 €, Sep 1250,5 €, Oct 300 €.'
    );
  });

  it('sin ninguna venta en 6 meses dice "Sin datos" en vez de dibujar una línea plana', async () => {
    getMetricasDashboard.mockResolvedValue({
      ...METRICAS,
      ventasPorMes: METRICAS.ventasPorMes.map((m) => ({ ...m, total: 0 }))
    });
    renderResumen();

    await screen.findByText('125 €');
    const seccion = screen.getByRole('region', { name: 'Ventas de los últimos 6 meses' });
    expect(within(seccion).getByText('Sin datos')).toBeInTheDocument();
    expect(screen.queryByTestId('grafico-ventas')).not.toBeInTheDocument();
  });
});

describe('Resumen — gráfico de categorías (barras)', () => {
  it('se monta con las categorías en el eje X y una barra por categoría', async () => {
    getMetricasDashboard.mockResolvedValue(METRICAS);
    renderResumen();

    const grafico = await screen.findByTestId('grafico-categorias');
    expect(
      screen.getByRole('heading', { level: 3, name: 'Top 5 categorías más vendidas' })
    ).toBeInTheDocument();
    expect(within(grafico).getByText('Sillas')).toBeInTheDocument();
    expect(within(grafico).getByText('Mesas')).toBeInTheDocument();
    expect(grafico.querySelectorAll('.recharts-bar-rectangle')).toHaveLength(2);
  });

  it('el eje Y cuenta piezas enteras, sin decimales', async () => {
    getMetricasDashboard.mockResolvedValue(METRICAS);
    renderResumen();

    const grafico = await screen.findByTestId('grafico-categorias');
    const marcas = [...grafico.querySelectorAll('.recharts-yAxis-tick-labels text')];
    expect(marcas.length).toBeGreaterThan(0);
    expect(marcas.every((marca) => /^\d+$/.test(marca.textContent))).toBe(true);
  });

  it('se describe con una frase, con el singular y el plural', async () => {
    getMetricasDashboard.mockResolvedValue(METRICAS);
    renderResumen();

    expect(await screen.findByTestId('grafico-categorias')).toHaveAttribute(
      'aria-label',
      'Categorías más vendidas: Sillas 3 piezas, Mesas 1 pieza.'
    );
  });

  it('sin categorías vendidas dice "Sin datos"', async () => {
    getMetricasDashboard.mockResolvedValue({ ...METRICAS, topCategorias: [] });
    renderResumen();

    await screen.findByTestId('grafico-ventas');
    const seccion = screen.getByRole('region', { name: 'Top 5 categorías más vendidas' });
    expect(within(seccion).getByText('Sin datos')).toBeInTheDocument();
    expect(screen.queryByTestId('grafico-categorias')).not.toBeInTheDocument();
  });
});

describe('Resumen — si fallan las métricas', () => {
  it('avisa, deja las tarjetas con un guion y no dibuja gráficos', async () => {
    getMetricasDashboard.mockResolvedValue(null);
    renderResumen();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudieron cargar las métricas de ventas.'
    );
    expect(valorDeTarjeta('Ticket Medio')).toHaveTextContent('—');
    expect(screen.queryByTestId('grafico-ventas')).not.toBeInTheDocument();
  });

  it('"Reintentar" vuelve a pedirlas y, si llegan, quita el aviso y enseña todo', async () => {
    const user = userEvent.setup();
    getMetricasDashboard.mockResolvedValueOnce(null).mockResolvedValue(METRICAS);
    renderResumen();

    await user.click(await screen.findByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('125 €')).toBeInTheDocument();
    expect(getMetricasDashboard).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(await screen.findByTestId('grafico-ventas')).toBeInTheDocument();
  });

  it('si el Resumen se cierra antes de que lleguen las métricas, no actualiza nada', async () => {
    let responder;
    getMetricasDashboard.mockReturnValue(new Promise((resolver) => (responder = resolver)));
    const { unmount } = renderResumen();

    unmount();
    responder(METRICAS);
    await Promise.resolve();

    expect(console.error).not.toHaveBeenCalled();
  });
});

describe('Resumen — tarjetas clicables y navegación', () => {
  it('al pulsar "Disponibles", navega a la pestaña de Inventario', async () => {
    const user = userEvent.setup();
    const irA = vi.fn();
    getMetricasDashboard.mockResolvedValue(METRICAS);
    renderResumen({
      muebles: [{ id: 'm1', nombre: 'Silla', estado: 'disponible' }],
      irA
    });

    const tarjeta = screen.getByRole('button', { name: 'Ver piezas disponibles en inventario' });
    await user.click(tarjeta);

    expect(irA).toHaveBeenCalledTimes(1);
    expect(irA).toHaveBeenCalledWith('inventario');
  });

  it('al pulsar "Pedidos por procesar", navega a Pedidos con filtro "procesando"', async () => {
    const user = userEvent.setup();
    const irA = vi.fn();
    getMetricasDashboard.mockResolvedValue(METRICAS);
    renderResumen({ pedidosPendientes: 3, irA });

    const tarjeta = screen.getByRole('button', { name: 'Ver pedidos pendientes de procesar' });
    await user.click(tarjeta);

    expect(irA).toHaveBeenCalledTimes(1);
    expect(irA).toHaveBeenCalledWith('pedidos', 'procesando');
  });

  it('al pulsar "Clientes", activa la exportación de clientes y descarga el archivo', async () => {
    const user = userEvent.setup();
    getMetricasDashboard.mockResolvedValue(METRICAS);
    exportarClientesCsv.mockResolvedValue({
      blob: new Blob(['id;email'], { type: 'text/csv' }),
      nombreArchivo: 'clientes.csv'
    });
    renderResumen();

    const tarjeta = screen.getByRole('button', { name: 'Exportar clientes en CSV' });
    await user.click(tarjeta);

    expect(exportarClientesCsv).toHaveBeenCalled();
    expect(descargarArchivo).toHaveBeenCalled();
  });

  it('permite activar la navegación con el teclado (Enter / Espacio)', async () => {
    const user = userEvent.setup();
    const irA = vi.fn();
    getMetricasDashboard.mockResolvedValue(METRICAS);
    renderResumen({
      muebles: [{ id: 'm1', nombre: 'Silla', estado: 'disponible' }],
      irA
    });

    const tarjeta = screen.getByRole('button', { name: 'Ver piezas disponibles en inventario' });
    tarjeta.focus();
    await user.keyboard('{Enter}');

    expect(irA).toHaveBeenCalledWith('inventario');
  });
});

describe('Resumen — semáforo de pedidos pendientes', () => {
  it('con pedidos pendientes > 0, la tarjeta se pone en advertencia (naranja/rojo) con clase semaforo-alerta', () => {
    getMetricasDashboard.mockResolvedValue(METRICAS);
    renderResumen({ pedidosPendientes: 5 });

    const tarjeta = screen.getByRole('button', { name: 'Ver pedidos pendientes de procesar' });
    expect(tarjeta).toHaveClass('accent-warning');
    expect(tarjeta).toHaveClass('semaforo-alerta');
    expect(tarjeta).not.toHaveClass('accent-success');
    expect(tarjeta).not.toHaveClass('semaforo-ok');
  });

  it('con 0 pedidos pendientes, la tarjeta se pone en verde con clase semaforo-ok', () => {
    getMetricasDashboard.mockResolvedValue(METRICAS);
    renderResumen({ pedidosPendientes: 0 });

    const tarjeta = screen.getByRole('button', { name: 'Ver pedidos pendientes de procesar' });
    expect(tarjeta).toHaveClass('accent-success');
    expect(tarjeta).toHaveClass('semaforo-ok');
    expect(tarjeta).not.toHaveClass('accent-warning');
    expect(tarjeta).not.toHaveClass('semaforo-alerta');
  });
});

describe('Resumen — miniaturas en últimas ventas', () => {
  it('cada fila de últimas ventas muestra una miniatura de 40x40px', () => {
    getMetricasDashboard.mockResolvedValue(METRICAS);
    renderResumen({
      muebles: [
        {
          id: 'm1',
          nombre: 'Mesa Roble',
          categoria: 'Mesas',
          estado: 'vendido',
          precio_venta: 200,
          imagenes: ['https://example.com/mesa.jpg']
        }
      ]
    });

    const imagen = screen.getByRole('img', { name: 'Mesa Roble' });
    expect(imagen).toBeInTheDocument();
    expect(imagen).toHaveAttribute('width', '40');
    expect(imagen).toHaveAttribute('height', '40');
    expect(imagen.closest('.sale-thumb')).toBeInTheDocument();
  });
});

describe('Resumen — resumen de clientes (nuevos este mes y recurrentes)', () => {
  it('enseña los clientes nuevos este mes y los recurrentes en la tarjeta y en la sección', async () => {
    getMetricasDashboard.mockResolvedValue(METRICAS);
    renderResumen();

    await screen.findByText('125 €');
    const textos = screen.getAllByText('2 nuevos este mes · 1 recurrentes');
    expect(textos.length).toBeGreaterThanOrEqual(1);
  });
});
