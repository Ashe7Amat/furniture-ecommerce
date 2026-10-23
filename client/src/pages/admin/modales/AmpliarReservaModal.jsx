import { useState } from 'react';
import DialogoReserva from './DialogoReserva';
import CampoReserva from './CampoReserva';
import { esFecha, fechaCorta, sumarDias } from '../../../utils/reservas';

// "Ampliar": un retraso en la devolución. Pide la nueva fecha de recogida prevista (el nuevo
// `fin_ocupacion`, exclusivo como el actual). Si alcanza a la reserva siguiente, el servidor
// responde 409 diciendo cuál, y el mensaje sale aquí tal cual.
// Solo amplía: el primer día posible es el siguiente al fin actual, y nunca antes de hoy (el
// servidor no acepta una fecha pasada). Para acortarla basta con marcarla recogida cuando vuelva.
const posterior = (a, b) => (a > b ? a : b);

const AmpliarReservaModal = ({ reserva, hoy, enviando, error, onEnviar, onCerrar }) => {
  const fin = reserva.fin_ocupacion ?? reserva.fecha_fin;
  const minimo = hoy ? posterior(sumarDias(fin, 1), hoy) : sumarDias(fin, 1);
  // Por defecto, mañana (lo que haría la tarea diaria, 8.5), o el primer día posible si es después.
  const [fecha, setFecha] = useState(hoy ? posterior(sumarDias(hoy, 1), minimo) : minimo);
  const [aviso, setAviso] = useState('');

  const enviar = (e) => {
    e.preventDefault();
    if (!esFecha(fecha) || fecha < minimo) {
      setAviso(`Elige el ${fechaCorta(minimo)} o un día posterior.`);
      return;
    }
    setAviso('');
    onEnviar({ fin_ocupacion: fecha });
  };

  return (
    <DialogoReserva titulo="Ampliar la ocupación" onCerrar={onCerrar}>
      <form className="admin-form reservas-form" onSubmit={enviar} noValidate>
        <p className="reservas-dialogo-texto">
          Reserva {reserva.referencia} ({reserva.pieza.nombre}). Ahora la pieza tiene que volver el{' '}
          {fechaCorta(fin)}.
        </p>
        <CampoReserva
          etiqueta="Nueva fecha de recogida"
          pista="No se cobra nada: solo mantiene la pieza ocupada. Si llega a la reserva siguiente, no se guarda y se te dice cuál es."
        >
          <input type="date" value={fecha} min={minimo} required onChange={(e) => setFecha(e.target.value)} />
        </CampoReserva>
        {(aviso || error) && <p className="reservas-error" role="alert">{aviso || error}</p>}
        <div className="reservas-dialogo-botones">
          <button type="button" className="admin-btn-ghost" onClick={onCerrar}>Volver</button>
          <button type="submit" className="admin-btn" disabled={enviando}>{enviando ? 'Guardando…' : 'Ampliar'}</button>
        </div>
      </form>
    </DialogoReserva>
  );
};

export default AmpliarReservaModal;
