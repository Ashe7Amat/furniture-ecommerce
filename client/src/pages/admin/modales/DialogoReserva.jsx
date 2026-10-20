import { useId, useRef } from 'react';
import useDialogoModal from '../../../utils/useDialogoModal';
import Icon from '../Icon';

// La caja común de los diálogos de la pestaña "Reservas" (confirmar, ampliar, cancelar y las altas).
// Con el teclado se porta como CheckoutModal (H55): el foco entra al abrir, Tab no se sale, Escape
// cierra y, al cerrar, el foco vuelve al botón que lo abrió.
const DialogoReserva = ({ titulo, onCerrar, children }) => {
  const ref = useRef(null);
  const idTitulo = useId();
  useDialogoModal(true, ref, onCerrar);

  return (
    <div className="admin-modal-overlay">
      <div
        ref={ref}
        className="admin-modal-content reservas-dialogo"
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
      >
        <div className="admin-modal-header">
          <h3 id={idTitulo}>{titulo}</h3>
          <button type="button" className="admin-modal-close" onClick={onCerrar} aria-label="Cerrar">
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

export default DialogoReserva;
