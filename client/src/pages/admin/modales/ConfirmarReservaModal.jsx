import DialogoReserva from './DialogoReserva';

// Confirmación de una acción sobre una reserva (entregar antes de la fecha, "Dar por reembolsado").
// Se queda abierto mientras se guarda; si el servidor responde con un error, lo enseña aquí.
const ConfirmarReservaModal = ({ titulo, mensaje, textoConfirmar, enviando, error, onConfirmar, onCerrar }) => (
  <DialogoReserva titulo={titulo} onCerrar={onCerrar}>
    <p className="reservas-dialogo-texto">{mensaje}</p>
    {error && <p className="reservas-error" role="alert">{error}</p>}
    <div className="reservas-dialogo-botones">
      <button type="button" className="admin-btn-ghost" onClick={onCerrar}>Volver</button>
      <button type="button" className="admin-btn" onClick={onConfirmar} disabled={enviando}>
        {enviando ? 'Guardando…' : textoConfirmar}
      </button>
    </div>
  </DialogoReserva>
);

export default ConfirmarReservaModal;
