// "Mis reservas" en Mi cuenta (docs/reservas-diseno.md, 8.4): las reservas del cliente con sus fechas,
// su estado y su total, y la solicitud de cancelación. En la primera versión el cliente no cancela:
// pide que se cancele (con un motivo opcional) y el administrador decide el reembolso.
// Profile.jsx solo la pinta con el interruptor encendido y el email confirmado.
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMisReservas, retomarPagoReserva, solicitarCancelacionReserva } from '../../services/api';
import { eurosDeCentimos, fechaLarga, horaDeMadrid, textoDias } from '../../utils/reservas';
import { PLACEHOLDER_IMG } from '../../utils/images';
import { ESTADO_RESERVA, MODO_TRAYECTO, textoReembolso, TEXTO_NO_CONFIRMADA } from './textosReserva';
import '../../styles/Reservas.css';

const MAX_MOTIVO = 500;

const TarjetaReserva = ({ reserva, onActualizar, onPlazoTerminado }) => {
  const id = useId();
  const [formAbierto, setFormAbierto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  // Seguir con el pago de una reserva a medio pagar.
  const [pagando, setPagando] = useState(false);
  const [errorPago, setErrorPago] = useState('');
  // El foco va al motivo al abrir, vuelve al botón al cerrar sin enviar y, tras enviar, al mensaje
  // (el botón y el formulario desaparecen).
  const [foco, setFoco] = useState(null);
  const refs = { motivo: useRef(null), boton: useRef(null), mensaje: useRef(null) };
  useEffect(() => {
    if (foco) refs[foco].current.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foco]);

  const [etiqueta, clase] = ESTADO_RESERVA[reserva.estado] || [reserva.estado, 'badge-warning'];
  const { pieza } = reserva;

  const abrir = () => {
    setError('');
    setFormAbierto(true);
    setFoco('motivo');
  };
  const cerrar = () => {
    setFormAbierto(false);
    setFoco('boton');
  };
  // Lleva a la página de pago que la clienta cerró. Con 409 (o 404) ya no se puede pagar: se avisa arriba, donde
  // sigue después de recargar la lista, y esta tarjeta desaparece o cambia de estado.
  const seguirPago = async () => {
    setPagando(true);
    setErrorPago('');
    const { data, error: fallo, status } = await retomarPagoReserva(reserva.id);
    // A la página de pago. El botón sigue desactivado: no se pide otra mientras tanto.
    if (data?.url) {
      window.location.assign(data.url);
      return;
    }
    setPagando(false);
    if (status === 409 || status === 404) {
      onPlazoTerminado(fallo);
      return;
    }
    setErrorPago(fallo);
  };

  const enviar = async (event) => {
    event.preventDefault();
    setEnviando(true);
    setError('');
    const texto = motivo.trim();
    const { data, error: fallo } = await solicitarCancelacionReserva(reserva.id, texto || undefined);
    setEnviando(false);
    if (fallo) {
      setError(fallo);
      return;
    }
    setFormAbierto(false);
    setMensaje(data?.mensaje || 'Hemos recibido tu solicitud.');
    setFoco('mensaje');
    onActualizar({ ...reserva, cancelacion_solicitada: true, puede_solicitar_cancelacion: false });
  };

  return (
    <article className="reserva-item" aria-labelledby={`${id}-titulo`}>
      <div className="reserva-item-cabecera">
        <img src={pieza.imagen || PLACEHOLDER_IMG} alt="" className="reserva-item-foto" loading="lazy" decoding="async" />
        <div className="reserva-item-titulo">
          <h3 id={`${id}-titulo`}>
            <Link to={`/mueble/${pieza.id}`}>{pieza.nombre}</Link>
          </h3>
          <p className="reserva-item-ref">Reserva {reserva.referencia}</p>
        </div>
        <div className="reserva-item-estados">
          <span className={`order-status ${clase}`}>{etiqueta}</span>
          {reserva.cancelacion_solicitada && <span className="order-status badge-warning">Cancelación solicitada</span>}
        </div>
      </div>

      <dl className="reserva-item-datos">
        <div>
          <dt>Entrega</dt>
          <dd>
            {fechaLarga(reserva.fecha_inicio)}, a las {reserva.hora_entrega}, {MODO_TRAYECTO[reserva.modo_entrega]}
          </dd>
        </div>
        <div>
          <dt>Recogida</dt>
          <dd>
            {fechaLarga(reserva.fecha_fin)}, a las {reserva.hora_recogida}, {MODO_TRAYECTO[reserva.modo_devolucion]}
          </dd>
        </div>
        {reserva.direccion_entrega && (
          <div>
            <dt>Dirección</dt>
            <dd>{reserva.direccion_entrega}</dd>
          </div>
        )}
        <div>
          <dt>Total</dt>
          <dd>
            {eurosDeCentimos(reserva.importe_total_centimos)} ({textoDias(reserva.dias)})
          </dd>
        </div>
      </dl>

      {reserva.estado === 'esperando_pago' && (
        <div className="reserva-item-pago">
          <p className="reserva-item-ayuda">
            {reserva.pago_hasta
              ? `Tienes hasta las ${horaDeMadrid(reserva.pago_hasta)} para pagar; después se liberan las fechas.`
              : 'Aún no has pagado esta reserva. Cuando pase el plazo se liberan las fechas.'}
          </p>
          {errorPago && (
            <p className="reserva-cliente-error" role="alert">
              {errorPago}
            </p>
          )}
          <button type="button" className="reserva-boton" onClick={seguirPago} disabled={pagando}>
            {pagando ? 'Conectando con el pago...' : 'Seguir con el pago'}
          </button>
        </div>
      )}
      {reserva.estado === 'no_confirmada' && <p className="reserva-item-ayuda">{TEXTO_NO_CONFIRMADA}</p>}
      {reserva.estado === 'cancelada' && reserva.reembolso && (
        <p className="reserva-item-ayuda">{textoReembolso(reserva.reembolso)}</p>
      )}

      {mensaje && (
        <p className="reserva-item-mensaje" role="status" tabIndex={-1} ref={refs.mensaje}>
          {mensaje}
        </p>
      )}

      {reserva.puede_solicitar_cancelacion && !formAbierto && (
        <button type="button" className="reserva-enlace" ref={refs.boton} onClick={abrir}>
          Solicitar cancelación
        </button>
      )}

      {formAbierto && (
        <form className="reserva-item-cancelar" onSubmit={enviar}>
          <label htmlFor={`${id}-motivo`}>Motivo (opcional)</label>
          <textarea
            id={`${id}-motivo`}
            ref={refs.motivo}
            rows={3}
            maxLength={MAX_MOTIVO}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
          <p className="reserva-item-ayuda">
            Te escribiremos para confirmar la cancelación y, si corresponde, el reembolso.
          </p>
          {error && (
            <p className="reserva-cliente-error" role="alert">
              {error}
            </p>
          )}
          <div className="reserva-item-botones">
            <button type="submit" className="reserva-boton" disabled={enviando}>
              {enviando ? 'Enviando...' : 'Enviar solicitud'}
            </button>
            <button type="button" className="reserva-enlace" onClick={cerrar} disabled={enviando}>
              No, volver
            </button>
          </div>
        </form>
      )}
    </article>
  );
};

const MisReservas = () => {
  const [carga, setCarga] = useState({ estado: 'cargando' });
  // Lo que explica por qué cambió la lista (el plazo para pagar una reserva terminó mientras estaba abierta).
  const [aviso, setAviso] = useState('');
  // La última carga que sigue valiendo: una respuesta vieja (se recargó mientras tanto, o se cerró la
  // pestaña) no se pinta.
  const ultimaCarga = useRef(0);

  const cargar = useCallback(() => {
    const numero = ++ultimaCarga.current;
    setCarga({ estado: 'cargando' });
    getMisReservas().then(({ data, error, codigo }) => {
      if (numero !== ultimaCarga.current) return;
      // El 403 del email sin confirmar trae su código; el del alquiler cerrado, no (su mensaje se enseña).
      if (codigo === 'email_no_verificado') setCarga({ estado: 'sin-verificar' });
      else if (error) setCarga({ estado: 'error', error });
      else setCarga({ estado: 'lista', reservas: Array.isArray(data) ? data : [] });
    });
  }, []);

  useEffect(() => {
    cargar();
    return () => {
      ultimaCarga.current += 1;
    };
  }, [cargar]);

  const actualizar = (nueva) =>
    setCarga((actual) => ({
      ...actual,
      reservas: actual.reservas.map((r) => (r.id === nueva.id ? nueva : r))
    }));

  const plazoTerminado = (mensaje) => {
    setAviso(mensaje);
    cargar();
  };

  if (carga.estado === 'cargando') {
    return (
      <>
        {aviso && (
          <p className="reserva-cliente-error" role="alert">
            {aviso}
          </p>
        )}
        <p className="empty-tab-text">Cargando tus reservas...</p>
      </>
    );
  }
  if (carga.estado === 'sin-verificar') return <p className="empty-tab-text">Confirma tu email para ver tus reservas.</p>;
  if (carga.estado === 'error') {
    return (
      <div className="empty-tab-text" role="alert">
        <p>{carga.error}</p>
        <button type="button" className="reserva-enlace" onClick={cargar}>
          Volver a intentarlo
        </button>
      </div>
    );
  }
  const avisoLista = aviso && (
    <p className="reserva-cliente-error" role="alert">
      {aviso}
    </p>
  );
  if (carga.reservas.length === 0) {
    return (
      <div className="empty-tab empty-tab--reservas">
        {avisoLista}
        <p className="empty-tab-text">Todavía no tienes reservas.</p>
        <Link to="/catalogo" className="empty-tab-btn">
          Explorar catálogo
        </Link>
      </div>
    );
  }
  return (
    <>
      {avisoLista}
      <ul className="mis-reservas-lista">
        {carga.reservas.map((reserva) => (
          <li key={reserva.id}>
            <TarjetaReserva reserva={reserva} onActualizar={actualizar} onPlazoTerminado={plazoTerminado} />
          </li>
        ))}
      </ul>
    </>
  );
};

export default MisReservas;
