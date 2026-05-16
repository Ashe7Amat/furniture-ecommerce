const supabase = require('../data/supabase');

// 1. Obtener todos los muebles (Catálogo)
const obtenerMuebles = async (req, res) => {
  try {
    const { data, error } = await supabase.from('muebles').select('*');
    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    console.error('Error al obtener muebles:', error.message);
    res.status(500).json({ error: 'Error interno al obtener los muebles.' });
  }
};

// 2. Obtener un solo mueble por su ID (Detalle)
const obtenerMueblePorId = async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('muebles')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Mueble no encontrado.' });
    }
    res.status(200).json(data);
  } catch (error) {
    console.error('Error al obtener mueble por ID:', error.message);
    res.status(500).json({ error: 'Error al buscar el detalle del mueble.' });
  }
};

// 3. Crear un nuevo mueble
const crearMueble = async (req, res) => {
  try {
    const { nombre, categoria, descripcion, precio_venta, precio_alquiler_dia, disponible, imagenes, estado } = req.body;

    const { data, error } = await supabase
      .from('muebles')
      .insert([
        {
          nombre,
          categoria,
          descripcion,
          precio_venta: parseFloat(precio_venta),
          precio_alquiler_dia: parseFloat(precio_alquiler_dia),
          disponible: disponible !== undefined ? disponible : true,
          imagenes,
          estado: estado || 'disponible'
        }
      ])
      .select();

    if (error) throw error;
    res.status(201).json({ success: true, message: 'Mueble creado con éxito', data });
  } catch (error) {
    console.error('Error al crear mueble:', error.message);
    res.status(500).json({ error: 'Error al guardar en la base de datos.' });
  }
};

// 4. Eliminar un mueble (¡La nueva función!)
const eliminarMueble = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('muebles')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.status(200).json({ success: true, message: 'Mueble eliminado con éxito de la base de datos.' });
  } catch (error) {
    console.error('Error al eliminar mueble:', error.message);
    res.status(500).json({ error: 'Error interno del servidor al intentar borrar el mueble.' });
  }
};

module.exports = {
  obtenerMuebles,
  obtenerMueblePorId,
  crearMueble,
  eliminarMueble // <-- No olvides exportarla aquí
};

// Buscar muebles por coincidencia de texto (para las sugerencias en tiempo real)
const buscarMuebles = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(200).json([]);

    // Buscamos filas que contengan el texto en el nombre o descripción (ignore case)
    const { data, error } = await supabase
      .from('muebles')
      .select('*')
      .ilike('nombre', `%${q}%`);

    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    console.error('Error al buscar muebles:', error.message);
    res.status(500).json({ error: 'Error en el motor de búsqueda.' });
  }
};

// Asegúrate de añadir 'buscarMuebles' al module.exports final:
module.exports = {
  obtenerMuebles,
  obtenerMueblePorId,
  crearMueble,
  eliminarMueble,
  buscarMuebles // <-- Añadido
};