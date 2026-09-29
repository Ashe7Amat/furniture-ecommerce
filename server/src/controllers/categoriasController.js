const supabase = require('../data/supabase');
const { uploadToSupabase } = require('../utils/upload');

// Columnas que devuelve la lectura pública de categorías (H26): las cuatro que tiene hoy la tabla y
// que usa la web. Explícitas, para que una columna nueva no salga al público sin decidirlo.
const COLUMNAS_PUBLICAS_CATEGORIA = 'id, nombre, imagen_url, categoria_padre_id';

// 1. Obtener todas las categorías (pública: la cabecera, el catálogo, la portada...). Sin
// estadísticas: esas son del panel y van en obtenerCategoriasConEstadisticas (H26).
const obtenerCategorias = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('categorias')
      .select(COLUMNAS_PUBLICAS_CATEGORIA)
      .order('nombre', { ascending: true });

    if (error) throw error;

    // Las categorías casi no cambian entre visitas: se cachean un rato corto en el navegador y en
    // la CDN.
    res.set('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=120');
    res.status(200).json(data);
  } catch (error) {
    console.error('Error al obtener las categorías:', error.message);
    res.status(500).json({ error: 'Error al obtener las categorías.' });
  }
};

// 1b. Las categorías con sus estadísticas de inventario, solo para el panel
// (GET /api/admin/categorias/con-stats, con verificarAdmin). Antes iban en la lectura pública, y
// cualquiera veía cuántas piezas se habían vendido o alquilado y el valor del catálogo (H26).
const obtenerCategoriasConEstadisticas = async (req, res) => {
  try {
    const { data: categorias, error: errCat } = await supabase
      .from('categorias')
      .select(COLUMNAS_PUBLICAS_CATEGORIA)
      .order('nombre', { ascending: true });

    if (errCat) throw errCat;

    // De los muebles solo hace falta lo que entra en las cuentas
    const { data: muebles, error: errMue } = await supabase
      .from('muebles')
      .select('categoria, estado, precio_venta');

    if (errMue) throw errMue;

    // Calculamos los KPIs para cada categoría.
    // Las categorías específicas (con padre) cruzan directo por nombre contra muebles.categoria.
    // Las categorías generales (sin padre) no tienen productos con ese nombre exacto —
    // sus estadísticas son la suma de las de sus categorías hijas.
    const mueblesPorNombre = (nombreCategoria) =>
      muebles.filter((m) => m.categoria === nombreCategoria);

    const calcularStats = (mueblesDeCat) => {
      const totalProductos = mueblesDeCat.length;
      const disponibles = mueblesDeCat.filter((m) => m.estado === 'disponible').length;
      const vendidos = mueblesDeCat.filter((m) => m.estado === 'vendido').length;
      const alquilados = mueblesDeCat.filter((m) => m.estado === 'alquilado').length;

      // Valor económico total de la categoría en el catálogo
      const valorTotalVenta = mueblesDeCat.reduce((sum, m) => sum + (m.precio_venta || 0), 0);

      return {
        totalProductos,
        disponibles,
        vendidos,
        alquilados,
        valorTotalVenta: valorTotalVenta.toLocaleString('es-ES', {
          style: 'currency',
          currency: 'EUR'
        })
      };
    };

    const categoriasConStats = categorias.map((cat) => {
      const esGeneral = !cat.categoria_padre_id;
      let mueblesDeCat;

      if (esGeneral) {
        const hijas = categorias.filter((c) => c.categoria_padre_id === cat.id);
        mueblesDeCat = hijas.flatMap((hija) => mueblesPorNombre(hija.nombre));
      } else {
        mueblesDeCat = mueblesPorNombre(cat.nombre);
      }

      return {
        ...cat,
        stats: calcularStats(mueblesDeCat)
      };
    });

    // Del panel: ni el navegador ni la CDN la guardan, para que se vea al momento lo que se acaba
    // de cambiar (y porque son datos de administración).
    res.set('Cache-Control', 'private, no-store');
    res.status(200).json(categoriasConStats);
  } catch (error) {
    console.error('Error al calcular estadísticas de categorías:', error.message);
    res.status(500).json({ error: 'Error al obtener las categorías con analíticas.' });
  }
};

// 2. Crear una nueva categoría con soporte de carga física de imágenes
const crearCategoria = async (req, res) => {
  try {
    const { nombre } = req.body;
    let imagen_url = req.body.imagen_url;

    // categoria_padre_id: vacío/ausente = categoría general (nivel superior)
    const categoria_padre_id = req.body.categoria_padre_id
      ? parseInt(req.body.categoria_padre_id, 10)
      : null;

    // Si se subió un archivo físico
    if (req.file) {
      imagen_url = await uploadToSupabase(req.file, 'categorias');
    }

    const { data, error } = await supabase
      .from('categorias')
      .insert([
        {
          nombre,
          imagen_url:
            imagen_url || 'https://images.unsplash.com/photo-1540518614846-7eded433c457?q=80&w=200',
          categoria_padre_id
        }
      ])
      .select();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (error) {
    console.error('Error al crear categoría:', error);
    res.status(500).json({ error: 'Error al crear la categoría.' });
  }
};

// 3. Editar una categoría
const editarCategoria = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre } = req.body;
    let imagen_url = req.body.imagen_url;

    // Si se subió un archivo físico para reemplazar la imagen anterior
    if (req.file) {
      imagen_url = await uploadToSupabase(req.file, 'categorias');
    }

    const updateData = {};
    if (nombre !== undefined) {
      updateData.nombre = nombre;
    }
    if (imagen_url !== undefined) {
      updateData.imagen_url = imagen_url === '' ? null : imagen_url;
    }
    // categoria_padre_id: string vacío = pasa a ser categoría general (sin padre)
    if (req.body.categoria_padre_id !== undefined) {
      updateData.categoria_padre_id = req.body.categoria_padre_id
        ? parseInt(req.body.categoria_padre_id, 10)
        : null;
    }

    const { data, error } = await supabase
      .from('categorias')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error al editar categoría:', error);
    res.status(500).json({ error: 'Error al editar la categoría.' });
  }
};

// 4. Eliminar una categoría
const eliminarCategoria = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('categorias').delete().eq('id', id);
    if (error) throw error;
    res.status(200).json({ success: true, message: 'Categoría eliminada.' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar la categoría.' });
  }
};

module.exports = {
  obtenerCategorias,
  obtenerCategoriasConEstadisticas,
  crearCategoria,
  editarCategoria,
  eliminarCategoria
};
