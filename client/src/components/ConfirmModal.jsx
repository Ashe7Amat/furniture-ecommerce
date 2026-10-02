import '../styles/ConfirmModal.css';

// `textoConfirmar`: el botón de aceptar. Por defecto "Eliminar", porque casi todos los avisos del panel son de
// borrado; uno que no borra nada (p. ej. cambiar el código de una categoría) pasa el suyo.
const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, textoConfirmar = 'Eliminar' }) => {
  if (!isOpen) return null;

  return (
    <div className="confirm-overlay">
      <div className="confirm-box">
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="confirm-actions">
          <button className="confirm-btn cancel" onClick={onCancel}>Cancelar</button>
          <button className="confirm-btn danger" onClick={onConfirm}>{textoConfirmar}</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
