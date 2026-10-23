// server/src/controllers/dashboardController.js
const supabase = require('../data/supabase');
const { calcularMetricas } = require('../utils/metricasDashboard');

const TAMANO_PAGINA = 1000; // el máximo de filas por consulta de Supabase

// Lee TODAS las filas de una tabla (solo SELECT), página a página, para no quedarse en las primeras 1000.
const leerTodo = async (tabla, columnas, ordenarPor) => {
  const filas = [];
  for (let desde = 0; ; desde += TAMANO_PAGINA) {
    const { data, error } = await supabase
      .from(tabla)
      .select(columnas)
      .order(ordenarPor, { ascending: true })
      .range(desde, desde + TAMANO_PAGINA - 1);
    if (error) throw error;
    filas.push(...(data || []));
    if (!data || data.length < TAMANO_PAGINA) return filas;
  }
};

// GET /api/admin/dashboard/metricas: ticket medio, ventas de los últimos 6 meses, top de categorías y
// clientes. Pide solo las columnas que hacen falta (nunca la contraseña de `clientes`).
const obtenerMetricasDashboard = async (req, res) => {
  try {
    const [pedidos, muebles, clientes] = await Promise.all([
      leerTodo(
        'pedidos',
        'id, created_at, estado, total, items, cliente_id, cliente_info',
        'created_at'
      ),
      leerTodo('muebles', 'id, categoria', 'id'),
      leerTodo('clientes', 'id, rol, creado_en', 'creado_en')
    ]);
    res.status(200).json(calcularMetricas({ pedidos, muebles, clientes }));
  } catch (error) {
    console.error('Error al calcular las métricas del dashboard:', error.message || error);
    res.status(500).json({ error: 'Error al calcular las métricas del dashboard.' });
  }
};

module.exports = { obtenerMetricasDashboard };
