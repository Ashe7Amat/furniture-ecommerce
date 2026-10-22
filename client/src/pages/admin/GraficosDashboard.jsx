import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';
import {
  formatearImporte,
  textoPiezas,
  hayVentas,
  hayCategorias,
  tooltipVentas,
  tooltipCategorias,
  etiquetaMes
} from './dashboard';

// Los dos gráficos del Resumen. Van en su propio fichero para cargarse aparte (React.lazy en
// ResumenTab): recharts pesa bastante y el panel no lo necesita hasta llegar al Resumen.
// Todos los colores salen de las variables del tema (claro u oscuro), ninguno en duro.
const COLOR_TEXTO = 'var(--secondary-color)';
const COLOR_LINEA = 'var(--accent-color)';
const COLOR_BORDE = 'var(--border-color)';
const ALTURA = 260;

const estiloTooltip = {
  background: 'var(--bg-color)',
  border: '1px solid var(--border-color)',
  borderRadius: 8,
  color: 'var(--text-color)',
  fontFamily: 'var(--font-body)',
  fontSize: 13
};
const ejeX = { fill: COLOR_TEXTO, fontSize: 12, fontFamily: 'var(--font-body)' };

const SinDatos = () => <p className="admin-empty-note grafico-vacio">Sin datos</p>;

// Texto para lectores de pantalla: el gráfico es un dibujo, así que se resume en una frase.
const resumenVentas = (ventasPorMes) =>
  `Ventas de los últimos 6 meses: ${ventasPorMes.map((m) => `${m.mes} ${formatearImporte(m.total)}`).join(', ')}.`;
const resumenCategorias = (topCategorias) =>
  `Categorías más vendidas: ${topCategorias.map((c) => `${c.categoria} ${textoPiezas(c.cantidad)}`).join(', ')}.`;

const GraficosDashboard = ({ ventasPorMes, topCategorias }) => (
  <div className="resumen-graficos">
    <section className="grafico-card" aria-labelledby="grafico-ventas-titulo">
      <h3 id="grafico-ventas-titulo" className="grafico-titulo">
        Ventas de los últimos 6 meses
      </h3>
      {hayVentas(ventasPorMes) ? (
        <div role="img" aria-label={resumenVentas(ventasPorMes)} data-testid="grafico-ventas">
          <ResponsiveContainer width="100%" height={ALTURA}>
            <LineChart data={ventasPorMes} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={COLOR_BORDE} strokeOpacity={0.6} />
              <XAxis
                dataKey="mes"
                tick={ejeX}
                tickLine={false}
                axisLine={{ stroke: COLOR_BORDE }}
              />
              <YAxis
                tick={ejeX}
                tickLine={false}
                axisLine={false}
                width={56}
                tickFormatter={formatearImporte}
              />
              <Tooltip
                contentStyle={estiloTooltip}
                cursor={{ stroke: COLOR_BORDE }}
                formatter={tooltipVentas}
                labelFormatter={etiquetaMes}
              />
              <Line
                type="monotone"
                dataKey="total"
                name="Ventas"
                stroke={COLOR_LINEA}
                strokeWidth={1.5}
                dot={{ r: 3, fill: COLOR_LINEA, stroke: COLOR_LINEA }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <SinDatos />
      )}
    </section>

    <section className="grafico-card" aria-labelledby="grafico-categorias-titulo">
      <h3 id="grafico-categorias-titulo" className="grafico-titulo">
        Top 5 categorías más vendidas
      </h3>
      {hayCategorias(topCategorias) ? (
        <div
          role="img"
          aria-label={resumenCategorias(topCategorias)}
          data-testid="grafico-categorias"
        >
          <ResponsiveContainer width="100%" height={ALTURA}>
            <BarChart data={topCategorias} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={COLOR_BORDE} strokeOpacity={0.6} />
              <XAxis
                dataKey="categoria"
                tick={ejeX}
                tickLine={false}
                axisLine={{ stroke: COLOR_BORDE }}
                interval={0}
              />
              <YAxis
                tick={ejeX}
                tickLine={false}
                axisLine={false}
                width={32}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={estiloTooltip}
                cursor={{ fill: COLOR_BORDE, fillOpacity: 0.4 }}
                formatter={tooltipCategorias}
              />
              <Bar
                dataKey="cantidad"
                name="Vendidas"
                fill={COLOR_LINEA}
                radius={[4, 4, 0, 0]}
                maxBarSize={36}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <SinDatos />
      )}
    </section>
  </div>
);

export default GraficosDashboard;
