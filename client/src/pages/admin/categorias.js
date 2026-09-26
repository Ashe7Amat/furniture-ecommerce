// Funciones puras sobre la lista de categorías tal como llega de getCategorias(). La jerarquía
// tiene dos niveles: las generales (sin categoria_padre_id) y las específicas, que cuelgan de una
// general. Un mueble solo puede pertenecer a una específica.

export const generales = (categorias) => categorias.filter(c => !c.categoria_padre_id);

export const especificasDe = (categorias, general) =>
  categorias.filter(esp => esp.categoria_padre_id === general.id);

// La que se preselecciona en "Añadir mueble": la primera específica en el ORDEN DE LA API (por
// nombre), aunque en el desplegable salga en otro grupo (ver H15 en docs/mejoras-tecnicas.md).
export const primeraEspecifica = (categorias) => categorias.find(c => c.categoria_padre_id);

// Migración A (ver docs/tarea3-diseno.md): el selector guarda el NOMBRE de la categoría, pero al
// servidor también se le manda su id (doble escritura de categoria_id).
export const idDeCategoria = (categorias, nombreCategoria) =>
  categorias.find(c => c.nombre === nombreCategoria)?.id;
