// Extracción y formato de medidas de piezas restauradas para fichas y detalles de producto
export const extraerMedidas = (texto) => {
  if (!texto) return 'Medidas bajo consulta';
  const patronCompuesto = /(\d+(?:[.,]\d+)?\s*(?:x|×|\*)\s*\d+(?:[.,]\d+)?(?:\s*(?:x|×|\*)\s*\d+(?:[.,]\d+)?)?\s*cm)/i;
  const match = texto.match(patronCompuesto);
  if (match) return match[1];
  const patronSimple = /(\d+\s*cm)/i;
  const matchSimple = texto.match(patronSimple);
  if (matchSimple) return matchSimple[1];
  return 'Medidas bajo consulta';
};
