// Cálculos de las métricas del dashboard del panel (GET /api/admin/dashboard/metricas). Son
// funciones puras: reciben las filas ya leídas y devuelven números, para probarlas sin base de datos.
// Los meses se cuentan en hora de Madrid (igual que el resto del panel), no en UTC.
const { hoyEnMadrid } = require('./fechasMadrid');

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MESES_EN_GRAFICO = 6;
const MAX_CATEGORIAS = 5;

const redondear = (numero) => Math.round(numero * 100) / 100;

// Un pedido cancelado no cuenta como venta en ninguna métrica.
const pedidosValidos = (pedidos) => (pedidos || []).filter((p) => p.estado !== 'cancelado');

// "2026-10" del mes de una fecha ISO en hora de Madrid; null si la fecha no es válida.
const mesDe = (fechaIso) => {
  const fecha = new Date(fechaIso);
  return Number.isNaN(fecha.getTime()) ? null : hoyEnMadrid(fecha).slice(0, 7);
};

const totalDe = (pedido) => Number(pedido.total) || 0;

// Suma de totales / número de pedidos (sin cancelados). Sin pedidos, 0 (no se inventa nada).
const calcularTicketMedio = (pedidos) => {
  const validos = pedidosValidos(pedidos);
  if (validos.length === 0) return 0;
  return redondear(validos.reduce((suma, p) => suma + totalDe(p), 0) / validos.length);
};

// Los últimos 6 meses, el actual incluido y en orden cronológico, con 0 en los meses sin ventas.
const calcularVentasPorMes = (pedidos, ahora = new Date()) => {
  const [anio, mes] = mesDe(ahora).split('-').map(Number);
  const meses = [];
  for (let atras = MESES_EN_GRAFICO - 1; atras >= 0; atras--) {
    const indice = anio * 12 + (mes - 1) - atras;
    const a = Math.floor(indice / 12);
    const m = (indice % 12) + 1;
    meses.push({ clave: `${a}-${String(m).padStart(2, '0')}`, mes: MESES[m - 1], total: 0 });
  }
  for (const pedido of pedidosValidos(pedidos)) {
    const destino = meses.find((m) => m.clave === mesDe(pedido.created_at));
    if (destino) destino.total += totalDe(pedido);
  }
  return meses.map(({ mes: nombre, total }) => ({ mes: nombre, total: redondear(total) }));
};

// Las 5 categorías con más piezas vendidas. Cada línea de pedidos.items lleva productId (el id del
// mueble); la categoría sale de la tabla muebles. Los alquileres no son ventas y no cuentan; una
// pieza que ya no existe en el catálogo tampoco (no se sabe su categoría).
const calcularTopCategorias = (pedidos, muebles) => {
  const categoriaDe = new Map((muebles || []).map((m) => [m.id, m.categoria]));
  const cuentas = new Map();
  for (const pedido of pedidosValidos(pedidos)) {
    for (const linea of Array.isArray(pedido.items) ? pedido.items : []) {
      if (linea.modalidad === 'alquiler') continue;
      const categoria = categoriaDe.get(linea.productId);
      if (!categoria) continue;
      cuentas.set(categoria, (cuentas.get(categoria) || 0) + (Number(linea.cantidad) || 1));
    }
  }
  return [...cuentas.entries()]
    .map(([categoria, cantidad]) => ({ categoria, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad || a.categoria.localeCompare(b.categoria, 'es'))
    .slice(0, MAX_CATEGORIAS);
};

// Quién hizo el pedido: la cuenta si la hay; si no, el email del comprador (en minúsculas).
const claveDeCliente = (pedido) => {
  if (pedido.cliente_id) return `id:${pedido.cliente_id}`;
  const email = pedido.cliente_info?.email;
  return email ? `email:${String(email).trim().toLowerCase()}` : null;
};

// nuevosEsteMes: cuentas de clientes creadas este mes (los administradores no son clientes).
// recurrentes: compradores con más de un pedido en total (sin cancelados).
const calcularClientes = (pedidos, clientes, ahora = new Date()) => {
  const mesActual = mesDe(ahora);
  const nuevosEsteMes = (clientes || []).filter(
    (c) => c.rol !== 'admin' && mesDe(c.creado_en) === mesActual
  ).length;
  const pedidosPorCliente = new Map();
  for (const pedido of pedidosValidos(pedidos)) {
    const clave = claveDeCliente(pedido);
    if (clave) pedidosPorCliente.set(clave, (pedidosPorCliente.get(clave) || 0) + 1);
  }
  const recurrentes = [...pedidosPorCliente.values()].filter((n) => n > 1).length;
  return { nuevosEsteMes, recurrentes };
};

const calcularMetricas = ({ pedidos, muebles, clientes, ahora = new Date() }) => ({
  ticketMedio: calcularTicketMedio(pedidos),
  ventasPorMes: calcularVentasPorMes(pedidos, ahora),
  topCategorias: calcularTopCategorias(pedidos, muebles),
  clientes: calcularClientes(pedidos, clientes, ahora),
  // Preparado para cuando las reservas aporten ingresos; de momento no se inventa ningún dato.
  ingresosAlquiler: 0
});

module.exports = {
  calcularMetricas,
  calcularTicketMedio,
  calcularVentasPorMes,
  calcularTopCategorias,
  calcularClientes
};
