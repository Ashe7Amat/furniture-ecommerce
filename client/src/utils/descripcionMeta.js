import { BRAND } from '../theme/brand.config';

// Descripción de la ficha de una pieza para <meta name="description"> y las de Open Graph y Twitter
// (useDocumentMeta): el principio de su descripción, hasta 150 caracteres, cortado en un espacio y
// con "…" si sigue. Sin descripción, una frase con el nombre de la pieza.
export const MAX_DESCRIPCION_META = 150;

export const descripcionParaMeta = ({ nombre, descripcion } = {}) => {
  const texto = (descripcion || '').replace(/\s+/g, ' ').trim();
  if (!texto) {
    return nombre
      ? `${nombre} — pieza única disponible en ${BRAND.nombre}.`
      : `Pieza única disponible en ${BRAND.nombre}.`;
  }
  if (texto.length <= MAX_DESCRIPCION_META) return texto;

  // Un carácter menos para que, con los puntos suspensivos, no pase de 150.
  const corte = texto.slice(0, MAX_DESCRIPCION_META - 1);
  const ultimoEspacio = corte.lastIndexOf(' ');
  const resumen = ultimoEspacio > 0 ? corte.slice(0, ultimoEspacio) : corte;
  return `${resumen.replace(/[\s.,;:—-]+$/, '')}…`;
};
