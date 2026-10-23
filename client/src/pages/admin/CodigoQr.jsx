import { useMemo } from 'react';
import { trazadoQr } from './etiquetas';

// Un código QR en SVG, con el margen blanco de 4 módulos que pide la norma para que se lea bien.
// `data-qr` lleva el texto codificado (los tests lo miran).
const MARGEN = 4;

const CodigoQr = ({ texto, tamano = 100, etiqueta }) => {
  const { tamano: modulos, d } = useMemo(() => trazadoQr(texto), [texto]);
  const lado = modulos + MARGEN * 2;
  return (
    <svg
      className="codigo-qr"
      width={tamano}
      height={tamano}
      viewBox={`${-MARGEN} ${-MARGEN} ${lado} ${lado}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={etiqueta}
      data-qr={texto}
    >
      <rect x={-MARGEN} y={-MARGEN} width={lado} height={lado} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
};

export default CodigoQr;
