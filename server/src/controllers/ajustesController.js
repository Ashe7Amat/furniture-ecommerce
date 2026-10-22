// server/src/controllers/ajustesController.js
const supabase = require('../data/supabase');
const { registrarActividad } = require('../utils/audit');

// GET /api/ajustes/home (público): devuelve los ajustes de la portada (id = 1)
const obtenerAjustesHome = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('ajustes_home')
      .select('id, hero_imagenes, productos_destacados, updated_at')
      .eq('id', 1)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return res.status(200).json({
        id: 1,
        hero_imagenes: [],
        productos_destacados: []
      });
    }

    res.status(200).json(data);
  } catch (error) {
    console.error('Error al obtener los ajustes de portada:', error.message);
    res.status(500).json({ error: 'Error al obtener los ajustes de portada.' });
  }
};

// PUT /api/admin/ajustes/home (admin): actualiza hero_imagenes y/o productos_destacados
const actualizarAjustesHome = async (req, res) => {
  try {
    const { hero_imagenes, productos_destacados } = req.body;
    const datosActualizar = {
      updated_at: new Date().toISOString()
    };

    if (hero_imagenes !== undefined) {
      datosActualizar.hero_imagenes = hero_imagenes;
    }
    if (productos_destacados !== undefined) {
      datosActualizar.productos_destacados = productos_destacados;
    }

    // Leemos el estado anterior para la auditoría
    const { data: anterior, error: errorAnterior } = await supabase
      .from('ajustes_home')
      .select('id, hero_imagenes, productos_destacados')
      .eq('id', 1)
      .maybeSingle();

    if (errorAnterior) throw errorAnterior;

    let data;
    if (anterior) {
      const { data: updated, error: errorUpdate } = await supabase
        .from('ajustes_home')
        .update(datosActualizar)
        .eq('id', 1)
        .select('id, hero_imagenes, productos_destacados, updated_at')
        .single();
      if (errorUpdate) throw errorUpdate;
      data = updated;
    } else {
      const { data: inserted, error: errorInsert } = await supabase
        .from('ajustes_home')
        .insert({
          id: 1,
          hero_imagenes: hero_imagenes ?? [],
          productos_destacados: productos_destacados ?? [],
          ...datosActualizar
        })
        .select('id, hero_imagenes, productos_destacados, updated_at')
        .single();
      if (errorInsert) throw errorInsert;
      data = inserted;
    }

    try {
      await registrarActividad(req, 'editar', 'ajustes_home', '1', anterior, datosActualizar);
    } catch (errAudit) {
      console.error('Error al registrar auditoría en ajustes_home:', errAudit.message);
    }

    res.status(200).json({
      success: true,
      message: 'Ajustes de portada actualizados correctamente.',
      data
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
