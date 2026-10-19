import { useState } from 'react';
import DialogoReserva from './DialogoReserva';
import CampoReserva from './CampoReserva';
import { limitesRecogida, validarRecogida } from '../reservasAdmin';

// "Marcar recogida" (8.3): pide el día en que volvió la pieza, hoy por defecto. Si se marca tarde,
// se elige el día real, entre el de la entrega (la real, no la prevista) y hoy. Si la devolución choca con la reserva
// siguiente, el servidor responde 409 diciendo cuál, y el mensaje sale aquí tal cual; si solo tiene
// que recortar el margen para que quepa, la guarda y su aviso sale en la tarjeta.
const RecogerReservaModal = ({ reserva, hoy, enviando, error, onEnviar, onCerrar }) => {
  const limites = limitesRecogida(reserva, hoy);
  // Todavía no empezó (un alquiler ya entregado que se dio de alta con una fecha futura): no hay
  // día posible hasta entonces.
  const todavia = Boolean(hoy) && limites.minimo > hoy;
  const [fecha, setFecha] = useState(hoy ?? '');
  const [aviso, setAviso] = useState('');

  const enviar = (e) => {
    e.preventDefault();
    const problema = validarRecogida(fecha, limites);
    setAviso(problema);
    if (!problema) onEnviar({ fecha_recogida: fecha });
  };

  return (
    <DialogoReserva titulo="Marcar como recogida" onCerrar={onCerrar}>
      <form className="admin-form reservas-form" onSubmit={enviar} noValidate>
        <p className="reservas-dialogo-texto">
          ¿Ya has recogido {reserva.pieza.nombre} (reserva {reserva.referencia})?
        </p>
        <CampoReserva etiqueta="Día de la recogida" pista="Si volvió otro día, elígelo: desde el día de la entrega hasta hoy.">
          <input
            type="date"
            value={fecha}
            min={limites.minimo}
            max={limites.maximo}
            required
            onChange={(e) => setFecha(e.target.value)}
          />
        </CampoReserva>
        {todavia && <p className="reservas-error">{validarRecogida(fecha, limites)}</p>}
        {(aviso || error) && <p className="reservas-error" role="alert">{aviso || error}</p>}
        <div className="reservas-dialogo-botones">
          <button type="button" className="admin-btn-ghost" onClick={onCerrar}>Volver</button>
          <button type="submit" className="admin-btn" disabled={enviando || todavia}>{enviando ? 'Guardando…' : 'Marcar recogida'}</button>
        </div>
      </form>
    </DialogoReserva>
  );
};

export default RecogerReservaModal;
