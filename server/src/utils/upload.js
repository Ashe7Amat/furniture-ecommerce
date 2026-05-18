const multer = require('multer');
const supabase = require('../data/supabase');

// Configuración de Multer para almacenamiento en memoria
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // Límite de 5MB
});

/**
 * Sube un archivo en memoria al bucket público "imagenes" en Supabase.
 * Retorna la URL pública o lanza un error.
 */
const uploadToSupabase = async (file, folder = 'uploads') => {
  if (!file) return null;

  const fileExt = file.originalname.split('.').pop();
  const fileName = `${folder}/${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;

  // Subimos el archivo a Supabase Storage
  const { data, error } = await supabase.storage
    .from('imagenes')
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: true
    });

  if (error) {
    console.error('Error al subir a Supabase Storage:', error);
    throw error;
  }

  // Obtenemos la URL pública
  const { data: publicData } = supabase.storage
    .from('imagenes')
    .getPublicUrl(fileName);

  return publicData.publicUrl;
};

module.exports = {
  upload,
  uploadToSupabase
};
