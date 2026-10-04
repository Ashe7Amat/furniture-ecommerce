const supabase = require('../data/supabase');
const { construirCsv } = require('../utils/csv');

// Exportar el catálogo a CSV desde el panel (GET /api/admin/muebles/export, con verificarAdmin).
// Lleva los precios reales siempre: es una ruta del panel, así que MOSTRAR_PRECIOS no se aplica.

const COLUMNAS_EXPORTACION = [
  'id',
  'referencia',
  'nombre',
  'categoria',
  'categoria_id',
  'descripcion',
  'precio_venta',
  'precio_alquiler_dia',
  'estado',
  'imagenes',
  'created_at'
];

// Precio con coma decimal, como lo escribe Excel en español (450,5). Vacío si no hay precio.
const precioParaCsv = (precio) =>
  precio === null || precio === undefined ? '' : String(precio).replace('.', ',');

// La fecha del nombre del archivo, en hora de Madrid (la del negocio): AAAA-MM-DD.
const fechaDeHoy = (ahora = new Date()) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(ahora);

const exportarCatalogoCsv = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('muebles')
      .select(COLUMNAS_EXPORTACION.join(', '))
      .order('created_at', { ascending: false });
    if (error) throw error;

    const filas = (data || []).map((mueble) => ({
      ...mueble,
      precio_venta: precioParaCsv(mueble.precio_venta),
      precio_alquiler_dia: precioParaCsv(mueble.precio_alquiler_dia),
      // Las fotos, separadas por un espacio (una URL no lleva espacios).
      imagenes: (mueble.imagenes || []).join(' ')
    }));

    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="catalogo-nave5-${fechaDeHoy()}.csv"`);
    res.set('Cache-Control', 'private, no-store');
    res.status(200).send(construirCsv(COLUMNAS_EXPORTACION, filas));
  } catch (error) {
    console.error('Error al exportar el catálogo:', error.message);
    res.status(500).json({ error: 'Error al exportar el catálogo.' });
  }
};

module.exports = { exportarCatalogoCsv, COLUMNAS_EXPORTACION, fechaDeHoy };
