// server/src/controllers/ajustesController.js
const supabase = require('../data/supabase');
const { registrarActividad } = require('../utils/audit');

const normalizarArray = (val) => {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parseado = JSON.parse(val);
      if (Array.isArray(parseado)) return parseado;
    } catch {
      // Ignorar error de parseo si no es JSON válido
    }
  }
  return [];
};

// GET /api/ajustes/home (público): devuelve los ajustes de la portada (id = 1)
// Sin caché (navegador ni CDN): lo que guarda el panel debe verse al recargar la portada.
const obtenerAjustesHome = async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const { data, error } = await supabase
      .from('ajustes_home')
      .select(
        'id, hero_imagenes, productos_destacados, imagenes_seccion_inspiracion, imagen_seccion_sostenibilidad, updated_at'
      )
      .eq('id', 1)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return res.status(200).json({
        id: 1,
        hero_imagenes: [],
        productos_destacados: [],
        imagenes_seccion_inspiracion: [],
        imagen_seccion_sostenibilidad: null
      });
    }

    res.status(200).json({
      ...data,
      hero_imagenes: normalizarArray(data.hero_imagenes),
      productos_destacados: normalizarArray(data.productos_destacados),
      imagenes_seccion_inspiracion: normalizarArray(data.imagenes_seccion_inspiracion),
      imagen_seccion_sostenibilidad: data.imagen_seccion_sostenibilidad ?? null
    });
  } catch (error) {
    console.error('Error al obtener los ajustes de portada:', error.message);
    res.status(500).json({ error: 'Error al obtener los ajustes de portada.' });
  }
};

// PUT /api/admin/ajustes/home (admin): actualiza hero_imagenes, productos_destacados,
// imagenes_seccion_inspiracion y/o imagen_seccion_sostenibilidad
const actualizarAjustesHome = async (req, res) => {
  console.log(
    '[PUT /api/admin/ajustes/home] req.body recibido:',
    JSON.stringify(req.body, null, 2)
  );
  try {
    const {
      hero_imagenes,
      productos_destacados,
      imagenes_seccion_inspiracion,
      imagen_seccion_sostenibilidad
    } = req.body;
    const datosActualizar = {
      updated_at: new Date().toISOString()
    };

    if (hero_imagenes !== undefined) {
      datosActualizar.hero_imagenes = normalizarArray(hero_imagenes);
    }
    if (productos_destacados !== undefined) {
      datosActualizar.productos_destacados = normalizarArray(productos_destacados);
    }
    if (imagenes_seccion_inspiracion !== undefined) {
      datosActualizar.imagenes_seccion_inspiracion = normalizarArray(imagenes_seccion_inspiracion);
    }
    if (imagen_seccion_sostenibilidad !== undefined) {
      datosActualizar.imagen_seccion_sostenibilidad = imagen_seccion_sostenibilidad;
    }

    // Leemos el estado anterior para la auditoría
    const { data: anterior, error: errorAnterior } = await supabase
      .from('ajustes_home')
      .select(
        'id, hero_imagenes, productos_destacados, imagenes_seccion_inspiracion, imagen_seccion_sostenibilidad'
      )
      .eq('id', 1)
      .maybeSingle();

    if (errorAnterior) throw errorAnterior;

    let data;
    if (anterior) {
      const { data: updated, error: errorUpdate } = await supabase
        .from('ajustes_home')
        .update(datosActualizar)
        .eq('id', 1)
        .select(
          'id, hero_imagenes, productos_destacados, imagenes_seccion_inspiracion, imagen_seccion_sostenibilidad, updated_at'
        )
        .single();
      if (errorUpdate) throw errorUpdate;
      data = updated;
    } else {
      const { data: inserted, error: errorInsert } = await supabase
        .from('ajustes_home')
        .insert({
          id: 1,
          hero_imagenes: normalizarArray(hero_imagenes),
          productos_destacados: normalizarArray(productos_destacados),
          imagenes_seccion_inspiracion: normalizarArray(imagenes_seccion_inspiracion),
          imagen_seccion_sostenibilidad: imagen_seccion_sostenibilidad ?? null,
          ...datosActualizar
        })
        .select(
          'id, hero_imagenes, productos_destacados, imagenes_seccion_inspiracion, imagen_seccion_sostenibilidad, updated_at'
        )
        .single();
      if (errorInsert) throw errorInsert;
      data = inserted;
    }

    try {
      await registrarActividad(req, 'editar', 'ajustes_home', '1', anterior, datosActualizar);
    } catch (errAudit) {
      console.error('Error al registrar auditoría en ajustes_home:', errAudit.message);
    }

    const respuestaData = data
      ? {
          ...data,
          hero_imagenes: normalizarArray(data.hero_imagenes),
          productos_destacados: normalizarArray(data.productos_destacados),
          imagenes_seccion_inspiracion: normalizarArray(data.imagenes_seccion_inspiracion),
          imagen_seccion_sostenibilidad: data.imagen_seccion_sostenibilidad ?? null
        }
      : data;

    console.log(
      '[PUT /api/admin/ajustes/home] Respuesta enviada (guardado en BD):',
      JSON.stringify(respuestaData, null, 2)
    );

    res.status(200).json({
      success: true,
      message: 'Ajustes de portada actualizados correctamente.',
      data: respuestaData
    });
  } catch (error) {
    console.error('Error al actualizar los ajustes de portada:', error.message);
    res.status(500).json({ error: 'Error al actualizar los ajustes de portada.' });
  }
};

const uploadUtils = require('../utils/upload');

// POST /api/admin/ajustes/home/imagen (admin): sube una imagen a Supabase Storage en la carpeta 'home'
const subirImagenHero = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se ha seleccionado ninguna imagen.' });
    }
    const url = await uploadUtils.uploadToSupabase(req.file, 'home');
    res.status(200).json({ url });
  } catch (error) {
    console.error('Error al subir imagen de portada:', error.message);
    res.status(500).json({ error: 'Error al subir la imagen de portada.' });
  }
};

module.exports = {
  obtenerAjustesHome,
  actualizarAjustesHome,
  subirImagenHero
};
