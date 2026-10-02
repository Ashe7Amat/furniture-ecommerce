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

// A5: el código de 3 letras de una categoría (SIL, MES...), con el que el servidor forma las
// referencias de sus muebles (NAV-SIL-001). Mientras se escribe, solo se dejan letras de la A a la
// Z, en mayúsculas y como mucho tres: lo mismo que acepta el servidor (schemas/categorias.js).
export const normalizarCodigo = (texto) => (texto || '').replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 3);

// El error que impide guardar el código, o null si se puede guardar. Vacío vale: la categoría se
// queda sin código, y sus muebles nuevos, sin referencia. Que no lo use otra categoría lo comprueba
// también el servidor (índice único), pero aquí sale antes y con el nombre de la otra categoría.
export const errorDeCodigo = (codigo, categorias, idPropio) => {
  if (!codigo) return null;
  if (!/^[A-Z]{3}$/.test(codigo)) return 'El código tiene que ser de 3 letras (A-Z), por ejemplo SIL.';
  const otra = categorias.find(c => c.codigo === codigo && c.id !== idPropio);
  return otra ? `Ese código ya lo usa la categoría "${otra.nombre}".` : null;
};
