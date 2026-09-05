const multer = require('multer');
const sharp = require('sharp');
const supabase = require('../data/supabase');

// Configuración de Multer para almacenamiento en memoria
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // Límite de 5MB (del archivo original subido)
});

// Ancho máximo al que se redimensiona cada foto antes de guardarla. Las fotos de
// producto no necesitan más resolución que esta para verse nítidas en pantalla, y así
// se evita servir fotos de cámara/móvil a tamaño completo (varios MB) a cada visitante.
const ANCHO_MAXIMO = 1600;
const CALIDAD_WEBP = 78;

/**
 * Redimensiona (si hace falta) y comprime una imagen a WebP antes de subirla. Antes las
 * fotos se guardaban tal cual las subía el admin (a veces varios MB, directo de una
 * cámara o móvil) -- esto es probablemente lo que más pesa en la velocidad de carga del
 * catálogo. No falla nunca por sí sola: si por lo que sea no se puede procesar la
 * imagen, se sube el archivo original en vez de romper la subida completa.
 */
const optimizarImagen = async (file) => {
  try {
    const buffer = await sharp(file.buffer)
      .resize({ width: ANCHO_MAXIMO, withoutEnlargement: true })
      .webp({ quality: CALIDAD_WEBP })
      .toBuffer();
    return { buffer, contentType: 'image/webp', extension: 'webp' };
  } catch (error) {
    console.error('No se pudo optimizar la imagen, se sube el archivo original:', error.message);
    const fileExt = file.originalname.split('.').pop() || 'jpg';
    return { buffer: file.buffer, contentType: file.mimetype, extension: fileExt };
  }
};

/**
 * Sube un archivo en memoria al bucket público "imagenes" en Supabase, optimizándolo
 * antes (ver optimizarImagen). Retorna la URL pública o lanza un error.
 */
const uploadToSupabase = async (file, folder = 'uploads') => {
  if (!file) return null;

  const { buffer, contentType, extension } = await optimizarImagen(file);
  const fileName = `${folder}/${Math.random().toString(36).substring(2)}-${Date.now()}.${extension}`;

  // Subimos el archivo a Supabase Storage
  const { data, error } = await supabase.storage
    .from('imagenes')
    .upload(fileName, buffer, {
      contentType,
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
