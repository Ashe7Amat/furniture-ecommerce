import qrcode from 'qrcode-generator';

// Etiquetas con QR para las piezas del inventario (21 oct 2026). El QR se genera en el navegador con
// qrcode-generator (sin dependencias, unos 5 KB comprimido) y se pinta como SVG, que se imprime nítido
// a cualquier tamaño.

// La web pública. Es la de sitemap.xml y robots.txt: el QR tiene que llevar a la ficha aunque la
// etiqueta se imprima desde una preview o desde local.
export const WEB_PUBLICA = 'https://www.nave5barcelona.com';

export const urlFicha = (mueble) => `${WEB_PUBLICA}/mueble/${encodeURIComponent(mueble.id)}`;

// Etiquetas por hoja A4: 2 columnas y 3 filas.
export const ETIQUETAS_POR_HOJA = 6;

export const enHojas = (piezas, porHoja = ETIQUETAS_POR_HOJA) => {
  const hojas = [];
  for (let i = 0; i < piezas.length; i += porHoja) hojas.push(piezas.slice(i, i + porHoja));
  return hojas;
};

// El QR de un texto como un único trazado SVG: un cuadrado de 1 × 1 por cada módulo oscuro, en una
// rejilla de `tamano` × `tamano`. Corrección de errores M (aguanta un 15 % de etiqueta sucia o rayada);
// el tipo 0 deja que la librería elija el tamaño más pequeño en el que cabe el texto.
export const trazadoQr = (texto) => {
  const qr = qrcode(0, 'M');
  qr.addData(texto);
  qr.make();
  const tamano = qr.getModuleCount();
  let d = '';
  for (let fila = 0; fila < tamano; fila += 1) {
    for (let col = 0; col < tamano; col += 1) {
      if (qr.isDark(fila, col)) d += `M${col} ${fila}h1v1h-1z`;
    }
  }
  return { tamano, d };
};
