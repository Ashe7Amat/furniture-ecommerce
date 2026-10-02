export const formatPrice = (value) => {
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return n.toLocaleString('es-ES', { maximumFractionDigits: 0 });
};

// Fase C (C2): el texto de precio de una pieza en el catálogo, igual en todos los sitios: el de venta
// si lo tiene; si no, el de alquiler por día; si no tiene ninguno, "Consultar precio". Sin precios
// también llegan las piezas cuando el servidor los oculta (MOSTRAR_PRECIOS, ver
// server/src/utils/precios.js).
export const TEXTO_SIN_PRECIO = 'Consultar precio';

export const tienePrecio = (mueble) => Boolean(mueble?.precio_venta || mueble?.precio_alquiler_dia);

export const textoPrecio = (mueble) => {
  if (mueble?.precio_venta) return `${formatPrice(mueble.precio_venta)} €`;
  if (mueble?.precio_alquiler_dia) return `${formatPrice(mueble.precio_alquiler_dia)} €/día`;
  return TEXTO_SIN_PRECIO;
};
