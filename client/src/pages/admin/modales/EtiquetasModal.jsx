import VistaImpresion from '../VistaImpresion';
import CodigoQr from '../CodigoQr';
import { enHojas, urlFicha } from '../etiquetas';

// «Imprimir etiqueta(s)» del inventario: una etiqueta por pieza, 6 por hoja A4, con la referencia
// en grande y un QR que lleva a la ficha pública de la pieza. Las guías de corte son el borde
// punteado de cada etiqueta.
const Etiqueta = ({ mueble }) => {
  const url = urlFicha(mueble);
  return (
    <article className="etiqueta" aria-label={`Etiqueta de ${mueble.nombre}`}>
      <p className="etiqueta-marca">NAVE 5 BARCELONA</p>
      <p className={`etiqueta-ref ${mueble.referencia ? '' : 'sin-ref'}`}>{mueble.referencia || 'Sin referencia'}</p>
      <p className="etiqueta-nombre">{mueble.nombre}</p>
      <CodigoQr texto={url} etiqueta={`Código QR de la ficha de ${mueble.nombre}`} />
    </article>
  );
};

const EtiquetasModal = ({ piezas, onCerrar }) => {
  const hojas = enHojas(piezas);
  const titulo = piezas.length === 1
    ? 'Etiqueta de 1 pieza'
    : `Etiquetas de ${piezas.length} piezas (${hojas.length === 1 ? '1 hoja' : `${hojas.length} hojas`})`;
  return (
    <VistaImpresion titulo={titulo} onCerrar={onCerrar}>
      {hojas.map((hoja, i) => (
        <section key={hoja[0].id} className="hoja-a4 hoja-etiquetas" aria-label={`Hoja ${i + 1} de ${hojas.length}`}>
          {hoja.map((m) => <Etiqueta key={m.id} mueble={m} />)}
        </section>
      ))}
    </VistaImpresion>
  );
};

export default EtiquetasModal;
