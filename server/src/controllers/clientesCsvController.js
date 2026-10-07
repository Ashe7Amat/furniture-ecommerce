const supabase = require('../data/supabase');
const { construirCsv } = require('../utils/csv');
const { fechaDeHoy } = require('./catalogoCsvController');

// Exportar las cuentas de clientes a CSV desde el panel (GET /api/admin/clientes/export, con
// verificarAdmin). Mismo formato que el del catálogo (utils/csv.js): BOM, punto y coma y CRLF.
//
// Las columnas se piden una a una, nunca con select('*'): la tabla `clientes` también tiene
// `password` (el hash de bcrypt), que no sale nunca de aquí.
const COLUMNAS_CLIENTES = ['id', 'email', 'nombre', 'rol', 'creado_en'];

const exportarClientesCsv = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('clientes')
      .select(COLUMNAS_CLIENTES.join(', '))
      .order('creado_en', { ascending: false });
    if (error) throw error;

    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="clientes-nave5-${fechaDeHoy()}.csv"`);
    // Datos personales (emails): que no se guarden en ninguna caché.
    res.set('Cache-Control', 'private, no-store');
    res.status(200).send(construirCsv(COLUMNAS_CLIENTES, data || []));
  } catch (error) {
    console.error('Error al exportar los clientes:', error.message);
    res.status(500).json({ error: 'Error al exportar los clientes.' });
  }
};

module.exports = { exportarClientesCsv, COLUMNAS_CLIENTES };
