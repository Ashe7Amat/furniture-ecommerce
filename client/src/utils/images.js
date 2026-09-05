// Imagen de repuesto propia (antes se usaba via.placeholder.com, un servicio externo
// que dejó de funcionar y mostraba una imagen rota a los visitantes).
export const PLACEHOLDER_IMG = '/img/sin-imagen.svg';

// Devuelve la imagen en la posición pedida de un mueble/categoría, o el placeholder
// propio si no tiene ninguna. Centraliza esta lógica para no repetirla en cada componente.
export const getImagen = (imagenes, index = 0) => {
  if (Array.isArray(imagenes) && imagenes[index]) return imagenes[index];
  return PLACEHOLDER_IMG;
};
