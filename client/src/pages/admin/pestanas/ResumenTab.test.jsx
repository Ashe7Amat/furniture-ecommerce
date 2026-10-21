// Las tarjetas y los gráficos nuevos del Resumen (métricas del dashboard). Los gráficos de Recharts
// necesitan medir su contenedor, y jsdom no mide nada: ResponsiveContainer se sustituye por uno de
// tamaño fijo y el resto de Recharts es el de verdad.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cloneElement } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ResumenTab from './ResumenTab';
import { ToastContext } from '../../../context/ToastContext';
import { getMetricasDashboard } from '../../../services/api';

vi.mock('../../../services/api');
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
