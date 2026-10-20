import { useState } from 'react';
import DialogoReserva from './DialogoReserva';
import CampoReserva from './CampoReserva';
import { eurosDeCentimos } from '../../../utils/reservas';
import { maximoReembolso, textoDeCentimos, validarCancelacion } from '../reservasAdmin';

// "Cancelar reserva" (8.4, política 'manual'): el administrador escribe el motivo y decide cuánto se
// reembolsa, como mucho lo pagado en la web (por defecto, todo). Mueve dinero, así que hay un
// segundo paso que lo repite antes de mandarlo (y mientras se guarda no se puede volver al primero,
// donde no se vería la respuesta). Una venta se cancela igual, pero sin reembolso.
const CancelarReservaModal = ({ reserva, enviando, error, onEnviar, onBorrarError, onCerrar }) => {
  const maximo = maximoReembolso(reserva);
  const [motivo, setMotivo] = useState('');
  const [reembolso, setReembolso] = useState(textoDeCentimos(maximo));
  const [aviso, setAviso] = useState('');
  // Céntimos que se van a reembolsar, ya comprobados: con un número, se ve el paso de confirmación.
  const [revisado, setRevisado] = useState(null);

  // Al volver al formulario, el error de la respuesta anterior ya no vale: no se vuelve a enseñar.
  const volver = () => {
    onBorrarError();
    setRevisado(null);
  };

  const revisar = (e) => {
    e.preventDefault();
    const resultado = validarCancelacion({ motivo, reembolso }, maximo);
    setAviso(resultado.error ?? '');
    if (!resultado.error) setRevisado(resultado.centimos);
  };

  const esVenta = reserva.tipo === 'venta';
  const nombre = esVenta ? 'venta' : 'reserva';
  const cual = `la ${nombre} ${reserva.referencia} (${reserva.pieza.nombre})`;
  const sinPago = esVenta
    ? 'Aquí se cancela sin reembolso: una compra se reembolsa desde el Dashboard de Stripe.'
    : 'No hay ningún pago en la web: no se reembolsa nada.';

  // Cada paso es un diálogo nuevo (key): el foco entra en él, y al cerrar vuelve al botón de la tarjeta.
  if (revisado !== null) {
    return (
      <DialogoReserva key="confirmar" titulo={`¿Cancelar la ${nombre}?`} onCerrar={onCerrar}>
        <p className="reservas-dialogo-texto">
          {revisado > 0
            ? `Vas a cancelar ${cual} y a reembolsar ${eurosDeCentimos(revisado)} al cliente. El reembolso se hace en Stripe y no se puede deshacer.`
            : `Vas a cancelar ${cual}, sin reembolso.`}
        </p>
        {error && <p className="reservas-error" role="alert">{error}</p>}
        <div className="reservas-dialogo-botones">
          <button type="button" className="admin-btn-ghost" disabled={enviando} onClick={volver}>
            Volver
          </button>
          <button
            type="button"
            className="admin-btn reservas-btn-peligro"
            disabled={enviando}
            onClick={() => onEnviar({ motivo: motivo.trim(), reembolso_centimos: revisado })}
          >
            {enviando ? 'Guardando…' : `Cancelar la ${nombre}`}
          </button>
        </div>
      </DialogoReserva>
    );
  }

  return (
    <DialogoReserva key="formulario" titulo={`Cancelar la ${nombre}`} onCerrar={onCerrar}>
      <form className="admin-form reservas-form" onSubmit={revisar} noValidate>
        <p className="reservas-dialogo-texto">
          {esVenta ? 'Venta' : 'Reserva'} {reserva.referencia} ({reserva.pieza.nombre}).
        </p>
        <CampoReserva etiqueta="Motivo de la cancelación" pista={`Queda guardado en la ${nombre}.`}>
          <textarea value={motivo} maxLength={500} required onChange={(e) => setMotivo(e.target.value)} />
        </CampoReserva>
        {maximo > 0 ? (
          <CampoReserva
            etiqueta="Reembolso (€)"
            pista={`Pagado en la web: ${eurosDeCentimos(maximo)}. Puedes reembolsar desde 0 hasta esa cantidad.`}
          >
            <input type="text" inputMode="decimal" value={reembolso} onChange={(e) => setReembolso(e.target.value)} />
          </CampoReserva>
        ) : (
          <p className="field-hint">{sinPago}</p>
        )}
        {aviso && <p className="reservas-error" role="alert">{aviso}</p>}
        <div className="reservas-dialogo-botones">
          <button type="button" className="admin-btn-ghost" onClick={onCerrar}>Volver</button>
          <button type="submit" className="admin-btn">Revisar</button>
        </div>
      </form>
    </DialogoReserva>
  );
};

export default CancelarReservaModal;
