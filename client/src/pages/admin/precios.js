// Precios en "Gestionar Inventario": la edición rápida en la fila y la acción en lote "Asignar
// precio de alquiler". Los precios van en euros, como en la base de datos (columnas numeric).

// Un precio para enseñar en la tabla: sin decimales si es entero ("1250", "12.500"), y con dos si
// no ("12,50"). Es formatPrice (utils/format.js) más los céntimos: aquí hacen falta porque el
// redondeo a 0,50 € da precios con decimales, y el panel tiene que enseñarlos tal cual.
export const formatoPrecio = (valor) => {
  const n = Number(valor);
  const decimales = Number.isInteger(n) ? 0 : 2;
  return n.toLocaleString('es-ES', { minimumFractionDigits: decimales, maximumFractionDigits: 2 });
};

// Lo que se escribe en la celda: vacío es "sin precio" (null); si no, un número de 0 en adelante,
// con dos decimales como mucho. Devuelve { valor } o { error }.
export const leerPrecio = (texto) => {
  const limpio = String(texto ?? '').trim().replace(',', '.');
  if (limpio === '') return { valor: null };
  const n = Number(limpio);
  if (!Number.isFinite(n) || n < 0) return { error: 'Precio no válido' };
  return { valor: Math.round(n * 100) / 100 };
};

// El precio de una pieza como número, o null si no tiene (null, vacío o 0, como en el resto del
// panel: un precio 0 se enseña como "sin precio").
export const precioDe = (valor) => (Number(valor) > 0 ? Number(valor) : null);

// Redondeo del porcentaje: a euros enteros o a múltiplos de 0,50 €.
export const redondear = (valor, redondeo) => (redondeo === 'medio' ? Math.round(valor * 2) / 2 : Math.round(valor));

// El precio de alquiler por día que le toca a una pieza con la opción elegida en el modal, o null si
// no se le puede calcular (sin precio de venta, o un porcentaje que redondeado se queda en 0).
//   { modo: 'fijo', fijo }                         -> el mismo para todas
//   { modo: 'porcentaje', porcentaje, redondeo }   -> ese % de su precio de venta, redondeado
export const precioAlquilerPara = (mueble, opcion) => {
  if (opcion.modo === 'fijo') return opcion.fijo;
  const venta = precioDe(mueble.precio_venta);
  if (venta === null) return null;
  const precio = redondear((venta * opcion.porcentaje) / 100, opcion.redondeo);
  return precio > 0 ? precio : null;
};

const piezas = (n) => `${n} pieza${n === 1 ? '' : 's'}`;

// "3 de 4 piezas actualizadas", "1 de 1 pieza actualizada".
export const textoResultadoAlquiler = (hechos, total) =>
  `${hechos} de ${piezas(total)} actualizada${total === 1 ? '' : 's'}`;

export { piezas as textoPiezas };
