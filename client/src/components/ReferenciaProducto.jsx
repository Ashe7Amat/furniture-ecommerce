// A6: la referencia de un mueble (NAV-SIL-001), pequeña y bajo el nombre, en la tarjeta del
// catálogo, la lista, la vista rápida y la ficha. Los muebles anteriores a A4 no tienen: entonces
// no se pinta nada (ni un hueco vacío). Va con "Ref." delante para que se entienda qué es, también
// con un lector de pantalla.
const ReferenciaProducto = ({ referencia, className = '' }) => {
  if (!referencia) return null;
  return <p className={`ref-producto ${className}`.trim()}>Ref. {referencia}</p>;
};

export default ReferenciaProducto;
