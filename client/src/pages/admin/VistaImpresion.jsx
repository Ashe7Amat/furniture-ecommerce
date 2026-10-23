import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import useDialogoModal from '../../utils/useDialogoModal';

// La vista previa de algo que se imprime desde el panel (las etiquetas, el albarán): un diálogo a
// pantalla completa con «Imprimir» y «Cerrar», y debajo las hojas A4 tal como saldrán.
// Se monta directamente en <body> y, mientras está abierta, <body> lleva la clase `con-impresion`:
// la hoja de impresión de Admin.css esconde entonces todo lo demás (menú, panel, avisos) y solo
// imprime las hojas, sin la barra de botones.
const VistaImpresion = ({ titulo, children, onCerrar }) => {
  const ref = useRef(null);
  const idTitulo = useId();
  useDialogoModal(true, ref, onCerrar);

  useEffect(() => {
    document.body.classList.add('con-impresion');
    return () => document.body.classList.remove('con-impresion');
  }, []);

  return createPortal(
    <div className="zona-impresion">
      <div ref={ref} className="impresion-dialogo" role="dialog" aria-modal="true" aria-labelledby={idTitulo} tabIndex={-1}>
        <div className="impresion-barra">
          <h3 id={idTitulo}>{titulo}</h3>
          <div className="impresion-botones">
            <button type="button" className="admin-btn" onClick={() => window.print()}>Imprimir</button>
            <button type="button" className="admin-btn-ghost" onClick={onCerrar}>Cerrar</button>
          </div>
        </div>
        <div className="impresion-hojas">{children}</div>
      </div>
    </div>,
    document.body
  );
};

export default VistaImpresion;
