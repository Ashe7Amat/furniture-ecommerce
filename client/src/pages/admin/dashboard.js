// Ayudas de la pestaña Resumen para las métricas del dashboard (ver GET /api/admin/dashboard/metricas).

// Un importe en euros con hasta dos decimales y a la española: 125 € · 1.250,5 € · 0 €.
// (formatPrice redondea a euros enteros: aquí no vale, el ticket medio puede ser 99,5 €.)
export const formatearImporte = (valor) => {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return '—';
  return `${numero.toLocaleString('es-ES', { maximumFractionDigits: 2 })} €`;
};

export const textoPiezas = (cantidad) => `${cantidad} ${cantidad === 1 ? 'pieza' : 'piezas'}`;

// Tooltips de Recharts (formatter devuelve [valor, nombre de la serie]; labelFormatter, el título).
export const tooltipVentas = (valor) => [formatearImporte(valor), 'Ventas'];
export const tooltipCategorias = (cantidad) => [textoPiezas(cantidad), 'Vendidas'];
export const etiquetaMes = (mes) => `Mes: ${mes}`;

// Sin ninguna venta en los 6 meses no hay línea que dibujar: se dice "Sin datos".
export const hayVentas = (ventasPorMes) =>
  Array.isArray(ventasPorMes) && ventasPorMes.some((mes) => mes.total > 0);

export const hayCategorias = (topCategorias) =>
  Array.isArray(topCategorias) && topCategorias.length > 0;
