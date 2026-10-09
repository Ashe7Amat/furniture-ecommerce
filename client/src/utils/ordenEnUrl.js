// El orden del catálogo va en la URL (?orden=referencia_asc, ver pages/Catalog.jsx). Los enlaces
// que cambian de categoría construyen una URL nueva (/catalogo?categoria=X): sin esto, el orden que
// había elegido el visitante se perdía al pulsar otra categoría en el carrusel o en el menú de la
// cabecera, y el selector volvía a "Recomendados". Fuera del catálogo no hay ?orden= y la ruta no cambia.
// El valor se pasa tal cual: si no es un orden válido, el catálogo lo trata como "recomendados".
export const conOrdenDeLaUrl = (ruta, searchParams) => {
  const orden = searchParams?.get('orden');
  if (!orden) return ruta;
  return `${ruta}${ruta.includes('?') ? '&' : '?'}orden=${encodeURIComponent(orden)}`;
};
