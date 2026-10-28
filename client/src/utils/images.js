// Imagen de repuesto propia (antes se usaba via.placeholder.com, un servicio externo
// que dejó de funcionar y mostraba una imagen rota a los visitantes).
export const PLACEHOLDER_IMG = '/img/sin-imagen.svg';

// Devuelve la imagen en la posición pedida de un mueble/categoría, o el placeholder
// propio si no tiene ninguna. Centraliza esta lógica para no repetirla en cada componente.
export const getImagen = (imagenes, index = 0) => {
  if (Array.isArray(imagenes) && imagenes[index]) return imagenes[index];
  return PLACEHOLDER_IMG;
};

// Miniatura de una foto del catálogo, para las tarjetas (H61), que la pintan a unos 300 px. Las
// fotos de muebles subidas desde el panel llevan al lado una miniatura de 400 px: la grande termina
// en -full.webp y la miniatura, en -thumb.webp (server/src/utils/upload.js). Las fotos anteriores
// no tienen miniatura y se devuelven tal cual, igual que cualquier otra URL.
const FOTO_CON_MINIATURA = /-full\.webp$/;
export const miniatura = (url) =>
  typeof url === 'string' && FOTO_CON_MINIATURA.test(url)
    ? url.replace(FOTO_CON_MINIATURA, '-thumb.webp')
    : url;

/**
 * Devuelve las variantes optimizadas WebP (400w, 800w, 1200w) y el srcset correspondiente.
 * Si la URL no es procesable (ej. placeholder SVG), devuelve null para usar el fallback simple.
 */
export const obtenerVariantesWebp = (url) => {
  if (!url || typeof url !== 'string' || url.endsWith('.svg') || url.startsWith('data:')) {
    return null;
  }
  const base = url
    .replace(/-(full|thumb|400|800|1200)\.webp$/i, '')
    .replace(/\.(jpe?g|png|webp|avif)$/i, '');

  return {
    w400: `${base}-400.webp`,
    w800: `${base}-800.webp`,
    w1200: `${base}-1200.webp`,
    srcset: `${base}-400.webp 400w, ${base}-800.webp 800w, ${base}-1200.webp 1200w`,
  };
};
