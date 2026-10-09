// client/src/utils/ordenarPorReferencia.js
//
// Ordenar las piezas por su referencia (NAV-SIL-002, NAV-MES-010...). Una sola función para los
// dos sitios que lo ofrecen, el catálogo público (Catalog.jsx) y la pestaña Inventario del panel
// (useInventarioVista), para que "Referencia A-Z" ordene igual en los dos.
//
// - Orden natural: los números se comparan como números, no letra a letra. Así NAV-SIL-002 va
//   antes que NAV-SIL-010 aunque algún día una referencia llegue sin el relleno de ceros
//   (NAV-SIL-2 antes que NAV-SIL-10, que comparando texto saldría al revés).
// - Sin distinguir mayúsculas ni acentos (sensitivity: 'base'): "nav-sil-001" y "NAV-SIL-001"
//   empatan, y los empates conservan el orden en que llegaron (Array.prototype.sort es estable).
// - Las piezas sin referencia (null, undefined o texto vacío) van SIEMPRE al final, también en
//   el orden descendente: si no, al pedir Z-A saldrían primero un montón de filas sin referencia,
//   que es justo lo que no se busca al ordenar por referencia. Entre ellas no se reordenan.

export const SENTIDO_ASC = 'asc';
export const SENTIDO_DESC = 'desc';

// La referencia como texto limpio; '' si no tiene. Con trim, una referencia hecha solo de espacios
// (un error al importar el Excel, por ejemplo) cuenta como sin referencia.
const referenciaDe = (mueble) => String(mueble?.referencia ?? '').trim();

// Comparador para Array.prototype.sort: (a, b) => número. `sentido` es 'asc' (por defecto) o
// 'desc'; cualquier otro valor se trata como 'asc'.
export const compararPorReferencia = (a, b, sentido = SENTIDO_ASC) => {
  const refA = referenciaDe(a);
  const refB = referenciaDe(b);

  // Sin referencia, al final en los dos sentidos (por eso esto va antes de aplicar el sentido).
  if (!refA && !refB) return 0;
  if (!refA) return 1;
  if (!refB) return -1;

  const comparacion = refA.localeCompare(refB, 'es', { numeric: true, sensitivity: 'base' });
  // El empate se devuelve como 0 y no como -0 (lo que saldría de negar un 0 en el sentido 'desc').
  if (comparacion === 0) return 0;
  return sentido === SENTIDO_DESC ? -comparacion : comparacion;
};

// Devuelve una lista NUEVA ordenada por referencia; no toca la que recibe (en Catalog.jsx y en el
// panel, la lista de entrada es el estado de React, que no se debe mutar).
export const ordenarPorReferencia = (muebles, sentido = SENTIDO_ASC) =>
  [...(muebles || [])].sort((a, b) => compararPorReferencia(a, b, sentido));

export default ordenarPorReferencia;
