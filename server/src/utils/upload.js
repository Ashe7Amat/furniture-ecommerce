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

// Miniatura para las tarjetas del catálogo (H61), que pintan las fotos a unos 300 px: sin ella, cada
// tarjeta descargaba la foto entera (200-500 KB). La foto con miniatura se llama <base>-full.webp y su
// miniatura, al lado, <base>-thumb.webp: el cliente (client/src/utils/images.js, miniatura) solo pide
// la miniatura de las fotos que terminan en -full.webp, porque las anteriores no tienen.
const ANCHO_MINIATURA = 400;
const SUFIJO_GRANDE = '-full.webp';
const SUFIJO_MINIATURA = '-thumb.webp';

const subirArchivo = async (fileName, buffer, contentType) => {
  const { error } = await supabase.storage.from('imagenes').upload(fileName, buffer, {
    contentType,
    upsert: true
  });

  if (error) {
    console.error('Error al subir a Supabase Storage:', error);
    throw error;
  }
};

/**
 * Sube un archivo en memoria al bucket público "imagenes" en Supabase, optimizándolo
 * antes (ver optimizarImagen). Retorna la URL pública o lanza un error.
 * Con { conMiniatura: true } (las fotos de muebles) sube también la miniatura de 400 px. Va antes
 * que la foto grande: cuando la URL de la grande llega a guardarse en el mueble, la miniatura ya
 * existe. Si no se puede crear o subir, la foto se guarda sin ella, con su nombre de siempre.
 */
const uploadToSupabase = async (file, folder = 'uploads', { conMiniatura = false } = {}) => {
  if (!file) return null;

  const { buffer, contentType, extension } = await optimizarImagen(file);
  const base = `${folder}/${Math.random().toString(36).substring(2)}-${Date.now()}`;
  let fileName = `${base}.${extension}`;

  if (conMiniatura && extension === 'webp') {
    try {
      const miniatura = await sharp(buffer)
        .resize({ width: ANCHO_MINIATURA, withoutEnlargement: true })
        .webp({ quality: CALIDAD_WEBP })
        .toBuffer();
      await subirArchivo(`${base}${SUFIJO_MINIATURA}`, miniatura, 'image/webp');
      fileName = `${base}${SUFIJO_GRANDE}`;
    } catch (error) {
      console.error('No se pudo guardar la miniatura; la foto se guarda sin ella:', error.message);
    }
  }

  await subirArchivo(fileName, buffer, contentType);

  // Obtenemos la URL pública
  const { data: publicData } = supabase.storage.from('imagenes').getPublicUrl(fileName);

  return publicData.publicUrl;
};

module.exports = {
  upload,
  uploadToSupabase,
  ANCHO_MINIATURA
};
