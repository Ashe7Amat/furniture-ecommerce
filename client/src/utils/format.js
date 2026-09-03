export const formatPrice = (value) => {
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return n.toLocaleString('es-ES', { maximumFractionDigits: 0 });
};
