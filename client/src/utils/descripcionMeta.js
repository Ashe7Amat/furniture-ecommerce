import { BRAND } from '../theme/brand.config';

// Descripción de la ficha de una pieza para <meta name="description"> y las de Open Graph y Twitter
// (useDocumentMeta): el principio de su descripción, hasta 150 caracteres, cortado en un espacio y
// con "…" si sigue.
// SEO del catálogo (28 oct 2026): una descripción corta (menos de 80 caracteres, como «Colgante en
// forma de cruz») no dice qué es la pieza ni dónde está, así que va precedida del nombre y seguida
// de la tienda. Sin descripción (o con una sin letras, como «.»), una frase con el nombre de la
// pieza y qué es Nave 5.
export const MAX_DESCRIPCION_META = 150;
export const MIN_DESCRIPCION_SOLA = 80;

const TIENDA = 'almacén de muebles y atrezo vintage en Barcelona';

const cortar = (texto) => {
  if (texto.length <= MAX_DESCRIPCION_META) return texto;
  // Un carácter menos para que, con los puntos suspensivos, no pase de 150.
  const corte = texto.slice(0, MAX_DESCRIPCION_META - 1);
  const ultimoEspacio = corte.lastIndexOf(' ');
  const resumen = ultimoEspacio > 0 ? corte.slice(0, ultimoEspacio) : corte;
  return `${resumen.replace(/[\s.,;:—-]+$/, '')}…`;
};

const conPunto = (texto) => (/[.!?…]$/.test(texto) ? texto : `${texto}.`);

export const descripcionParaMeta = ({ nombre, descripcion } = {}) => {
  const limpio = (descripcion || '').replace(/\s+/g, ' ').trim();
  const texto = /\p{L}/u.test(limpio) ? limpio : '';
  if (!texto) {
    return nombre
      ? cortar(`${nombre} — pieza única en ${BRAND.nombre}, ${TIENDA}.`)
      : `Pieza única en ${BRAND.nombre}, ${TIENDA}.`;
  }
  if (texto.length < MIN_DESCRIPCION_SOLA && nombre) {
    return cortar(`${conPunto(nombre)} ${conPunto(texto)} Pieza única en ${BRAND.nombre}.`);
  }
  return cortar(texto);
};
