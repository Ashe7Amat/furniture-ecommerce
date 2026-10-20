import { useRef, useState } from 'react';
import CampoReserva from './modales/CampoReserva';

const VACIO = { q: '', desde: '', hasta: '' };
// Lo mismo que MAX_BUSQUEDA_TEXTO del servidor (schemas/adminReservas.js).
const MAX_TEXTO = 100;

// Buscar entre todas las reservas, sea cual sea la vista: por cliente, pieza o referencia, y por las
// fechas en que la reserva tenía algo (docs/reservas-diseno.md, 8.1: «tabla filtrable por estado y
// fechas»). Los campos se quedan como están hasta pulsar «Buscar»; `activa` es la búsqueda que ya se
// hizo: si cambia desde fuera (se eligió una vista, o «Ver reserva» busca por referencia) los campos pasan a
// ser los de esa búsqueda, o se vacían si ya no la hay.
const BuscadorReservas = ({ activa, onBuscar, onQuitar }) => {
  const [borrador, setBorrador] = useState(activa ?? VACIO);
  const [error, setError] = useState('');
  const [anterior, setAnterior] = useState(activa);
  const entrada = useRef(null);

  if (anterior !== activa) {
    setAnterior(activa);
    setBorrador(activa ?? VACIO);
    setError('');
  }

  const cambiar = (campo) => (evento) => {
    setBorrador((b) => ({ ...b, [campo]: evento.target.value }));
    setError('');
  };

  const quitar = () => {
    setBorrador(VACIO);
    setError('');
    onQuitar();
    entrada.current?.focus();
  };

  const enviar = (evento) => {
    evento.preventDefault();
    const filtros = { q: borrador.q.trim(), desde: borrador.desde, hasta: borrador.hasta };
    if (!filtros.q && !filtros.desde && !filtros.hasta) {
      if (activa) quitar();
      else setError('Escribe qué buscar o elige unas fechas.');
      return;
    }
    if (filtros.desde && filtros.hasta && filtros.hasta < filtros.desde) {
      setError('La fecha final no puede ser anterior a la inicial.');
      return;
    }
    onBuscar(filtros);
  };

  const hayAlgo = activa || borrador.q || borrador.desde || borrador.hasta;

  return (
    <form className="admin-form reservas-buscador" role="search" aria-label="Buscar reservas" onSubmit={enviar} noValidate>
      <CampoReserva etiqueta="Cliente, pieza o referencia">
        <input
          ref={entrada}
          type="search"
          value={borrador.q}
          maxLength={MAX_TEXTO}
          autoComplete="off"
          placeholder="Nombre, teléfono, email, pieza o referencia de la reserva"
          onChange={cambiar('q')}
        />
      </CampoReserva>
      <div className="reservas-buscador-fechas">
        <CampoReserva etiqueta="Desde el día">
          <input type="date" value={borrador.desde} onChange={cambiar('desde')} />
        </CampoReserva>
        <CampoReserva etiqueta="Hasta el día">
          <input type="date" value={borrador.hasta} min={borrador.desde || undefined} onChange={cambiar('hasta')} />
        </CampoReserva>
      </div>
      <div className="reservas-buscador-botones">
        <button type="submit" className="admin-btn">Buscar</button>
        {hayAlgo && (
          <button type="button" className="admin-btn-ghost" onClick={quitar}>
            Limpiar búsqueda
          </button>
        )}
      </div>
      {error && <p className="reservas-error" role="alert">{error}</p>}
    </form>
  );
};

export default BuscadorReservas;
