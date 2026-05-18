const supabase = require('../data/supabase');
const { uploadToSupabase } = require('../utils/upload');

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

// 3. Crear un nuevo mueble con soporte de carga física de imágenes
const crearMueble = async (req, res) => {
  try {
    const { nombre, categoria, descripcion, precio_venta, precio_alquiler, disponible, estado } = req.body;
    let imagenes = [];

    // Si se subieron archivos físicos
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const url = await uploadToSupabase(file, 'muebles');
        if (url) imagenes.push(url);
      }
    } else if (req.body.imagenes) {
      if (typeof req.body.imagenes === 'string') {
        try {
          imagenes = JSON.parse(req.body.imagenes);
        } catch (e) {
          imagenes = [req.body.imagenes];
        }
      } else {
        imagenes = Array.isArray(req.body.imagenes) ? req.body.imagenes : [req.body.imagenes];
      }
    }

    const { data, error } = await supabase
      .from('muebles')
      .insert([
        {
          nombre,
          categoria,
          descripcion,
          precio_venta: (precio_venta === '' || precio_venta === null || precio_venta === undefined) ? null : parseFloat(precio_venta),
          precio_alquiler_dia: (precio_alquiler === '' || precio_alquiler === null || precio_alquiler === undefined) ? null : parseFloat(precio_alquiler),
          disponible: disponible !== undefined ? (disponible === 'true' || disponible === true) : true,
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

// 4. Editar un mueble
const editarMueble = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, categoria, descripcion, precio_venta, precio_alquiler, disponible, estado } = req.body;

    const updateData = {};
    if (nombre !== undefined) updateData.nombre = nombre;
    if (categoria !== undefined) updateData.categoria = categoria;
    if (descripcion !== undefined) updateData.descripcion = descripcion;
    if (precio_venta !== undefined) updateData.precio_venta = (precio_venta === '' || precio_venta === null || precio_venta === undefined) ? null : parseFloat(precio_venta);
    if (precio_alquiler !== undefined) updateData.precio_alquiler_dia = (precio_alquiler === '' || precio_alquiler === null || precio_alquiler === undefined) ? null : parseFloat(precio_alquiler);
    if (disponible !== undefined) updateData.disponible = disponible === 'true' || disponible === true;
    if (estado !== undefined) updateData.estado = estado;

    // Soporte para combinar imágenes existentes con las nuevas subidas físicas
    let imagenesFinales = [];
    if (req.body.imagenes_existentes !== undefined) {
      if (typeof req.body.imagenes_existentes === 'string') {
        try {
          imagenesFinales = JSON.parse(req.body.imagenes_existentes);
        } catch (e) {
          imagenesFinales = [req.body.imagenes_existentes];
        }
      } else {
        imagenesFinales = Array.isArray(req.body.imagenes_existentes) ? req.body.imagenes_existentes : [req.body.imagenes_existentes];
      }
    }

    // Si se subieron nuevos archivos de imágenes físicos
    if (req.files && req.files.length > 0) {
      const nuevasUrls = [];
      for (const file of req.files) {
        const url = await uploadToSupabase(file, 'muebles');
        if (url) nuevasUrls.push(url);
      }
      imagenesFinales = [...imagenesFinales, ...nuevasUrls];
    } else if (req.body.imagenes !== undefined && req.body.imagenes_existentes === undefined) {
      if (typeof req.body.imagenes === 'string') {
        try {
          imagenesFinales = JSON.parse(req.body.imagenes);
        } catch (e) {
          imagenesFinales = [req.body.imagenes];
        }
      } else {
        imagenesFinales = Array.isArray(req.body.imagenes) ? req.body.imagenes : [req.body.imagenes];
      }
    }

    if (imagenesFinales.length > 0 || req.body.imagenes_existentes !== undefined || req.body.imagenes !== undefined) {
      updateData.imagenes = imagenesFinales;
    }

    const { data, error } = await supabase
      .from('muebles')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) throw error;
    res.status(200).json({ success: true, message: 'Mueble editado con éxito', data });
  } catch (error) {
    console.error('Error al editar mueble:', error.message);
    res.status(500).json({ error: 'Error al editar el mueble.' });
  }
};

// 5. Eliminar un mueble
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

// 6. Buscar muebles por coincidencia de texto
const buscarMuebles = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(200).json([]);

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

module.exports = {
  obtenerMuebles,
  obtenerMueblePorId,
  crearMueble,
  editarMueble,
  eliminarMueble,
  buscarMuebles
};