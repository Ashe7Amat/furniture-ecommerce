// "Alquilar por fechas" en la ficha de una pieza (docs/reservas-diseno.md, 6.2): el calendario, las
// horas y la forma de entrega y recogida, el precio en vivo que calcula el servidor y el botón que
// abre el paso de confirmación. Solo se pinta con el interruptor encendido y si la pieza se puede
// alquilar (lo decide ProductDetail con GET /api/muebles/:id/disponibilidad).
// Reservar exige una cuenta con el email confirmado (T8): sin sesión, el botón abre el inicio de
// sesión de la cesta; sin el email confirmado, se explica y se ofrece otro correo con el enlace.
import { lazy, Suspense, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { getPresupuestoReserva } from '../../services/api';
import { HORAS_TRAYECTO, eurosDeCentimos, textoDias } from '../../utils/reservas';
import CalendarioReserva from './CalendarioReserva';
import DesgloseReserva from './DesgloseReserva';
import ReservaModal from './ReservaModal';
import PedirEnlaceVerificacion from './PedirEnlaceVerificacion';
import { CONFIRMA_EMAIL_PARA_RESERVAR } from './textosReserva';
import '../../styles/Reservas.css';

const AuthModal = lazy(() => import('../AuthModal'));

const SIN_FECHAS = { inicio: null, fin: null };

// Hora y forma de un trayecto (la entrega o la recogida).
const Trayecto = ({ id, titulo, hora, onHora, modo, onModo }) => (
  <fieldset className="reserva-trayecto">
    <legend>{titulo}</legend>
    <label htmlFor={`${id}-hora`}>Hora de {titulo.toLowerCase()}</label>
    <select id={`${id}-hora`} value={hora} onChange={(e) => onHora(e.target.value)}>
      {HORAS_TRAYECTO.map((h) => (
        <option key={h} value={h}>
          {h}
        </option>
      ))}
    </select>
    <div className="reserva-trayecto-modos">
      {[
        ['domicilio', 'A domicilio'],
        ['tienda', 'En la tienda']
      ].map(([valor, texto]) => (
        <label key={valor} className="reserva-trayecto-modo">
          <input type="radio" name={`${id}-modo`} value={valor} checked={modo === valor} onChange={() => onModo(valor)} />
          {texto}
        </label>
      ))}
    </div>
  </fieldset>
);

const textoReglas = ({ duracion_min_dias: min, duracion_max_dias: max, tramos_descuento: tramos }) => {
  const descuentos = tramos
    .filter((t) => t.porcentaje > 0)
    .map((t) => `${t.porcentaje} % desde ${textoDias(t.desde_dias)}`);
  const duracion = `Mínimo ${textoDias(Math.max(1, min))}, máximo ${textoDias(max)}.`;
  return descuentos.length ? `${duracion} Descuento: ${descuentos.join(', ')}.` : duracion;
};

const PanelReserva = ({ mueble, disponibilidad, onRecargar }) => {
  const id = useId();
  const auth = useContext(AuthContext);
  const user = auth?.user ?? null;
  const verificado = user?.email_verificado === true;

  const [fechas, setFechas] = useState(SIN_FECHAS);
  const [horaEntrega, setHoraEntrega] = useState('10:00');
  const [horaRecogida, setHoraRecogida] = useState('10:00');
  const [entrega, setEntrega] = useState('domicilio');
  const [recogida, setRecogida] = useState('domicilio');
  const [presupuesto, setPresupuesto] = useState(null);
  const [aviso, setAviso] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [sesionAbierta, setSesionAbierta] = useState(false);
  const [sesionUsada, setSesionUsada] = useState(false);
  const [trasEntrar, setTrasEntrar] = useState(false);
  const avisoRef = useRef(null);

  // Lo que se reserva: las fechas, las horas y los trayectos. null hasta tener las dos fechas.
  const seleccion = useMemo(
    () =>
      fechas.inicio && fechas.fin
        ? {
            fecha_inicio: fechas.inicio,
            hora_entrega: horaEntrega,
            fecha_fin: fechas.fin,
            hora_recogida: horaRecogida,
            entrega,
            recogida
          }
        : null,
    [fechas, horaEntrega, horaRecogida, entrega, recogida]
  );

  // El precio de la selección, del servidor. Cada respuesta se guarda con la selección que la pidió:
  // si llega una vieja (se cambió la hora mientras tanto), no se enseña.
  useEffect(() => {
    if (!seleccion) return undefined;
    let vigente = true;
    getPresupuestoReserva(mueble.id, seleccion).then((resultado) => {
      if (vigente) setPresupuesto({ para: seleccion, ...resultado });
    });
    return () => {
      vigente = false;
    };
  }, [mueble.id, seleccion]);

  const actual = seleccion && presupuesto?.para === seleccion ? presupuesto : null;
  const listo = Boolean(actual?.data);

  // Tras iniciar sesión desde aquí, si ya había un precio, se sigue al paso de confirmación.
  // (login() y onSuccess llegan juntos, así que aquí ya está la cuenta nueva.)
  useEffect(() => {
    if (!trasEntrar) return;
    setTrasEntrar(false);
    if (verificado && listo) setConfirmando(true);
  }, [trasEntrar, verificado, listo]);

  // El aviso de un 409 se lleva el foco: el paso de confirmación se ha cerrado y el botón que lo abrió
  // está desactivado (ya no hay fechas), así que el foco no tendría a dónde volver.
  useEffect(() => {
    if (aviso) avisoRef.current.focus();
  }, [aviso]);

  const cambiarFechas = (nuevas) => {
    setAviso('');
    setFechas(nuevas);
  };

  const abrirSesion = () => {
    setConfirmando(false);
    setSesionUsada(true);
    setSesionAbierta(true);
  };

  const alPulsarReservar = () => {
    if (!user) abrirSesion();
    else setConfirmando(true);
  };

  // 409 al crear la reserva: esas fechas se acaban de ocupar. Se cierra el paso de confirmación, se
  // borra la selección y se vuelve a pedir el calendario.
  const alConflicto = (mensaje) => {
    setConfirmando(false);
    setFechas(SIN_FECHAS);
    setAviso(mensaje);
    onRecargar();
  };

  const idNota = `${id}-nota`;
  let nota = null;
  if (!user) nota = 'Para reservar necesitas una cuenta. Puedes crearla en un momento.';
  else if (!verificado) nota = CONFIRMA_EMAIL_PARA_RESERVAR;
  else if (!seleccion) nota = 'Elige en el calendario los días de entrega y de recogida.';

  return (
    <section className="reserva-panel" aria-labelledby={`${id}-titulo`}>
      <h2 id={`${id}-titulo`} className="reserva-panel-titulo">
        Alquilar por fechas
      </h2>
      <p className="reserva-panel-precio">
        <strong>{eurosDeCentimos(disponibilidad.precio_dia_centimos)}</strong> al día
      </p>
      <p className="reserva-panel-reglas">{textoReglas(disponibilidad.reglas)}</p>

      <CalendarioReserva
        disponibilidad={disponibilidad}
        inicio={fechas.inicio}
        fin={fechas.fin}
        onCambiar={cambiarFechas}
      />
      {aviso && (
        <p className="reserva-cliente-error" role="alert" tabIndex={-1} ref={avisoRef}>
          {aviso}
        </p>
      )}

      <div className="reserva-trayectos">
        <Trayecto
          id={`${id}-entrega`}
          titulo="Entrega"
          hora={horaEntrega}
          onHora={setHoraEntrega}
          modo={entrega}
          onModo={setEntrega}
        />
        <Trayecto
          id={`${id}-recogida`}
          titulo="Recogida"
          hora={horaRecogida}
          onHora={setHoraRecogida}
          modo={recogida}
          onModo={setRecogida}
        />
      </div>
      <p className="reserva-panel-ayuda">Cada día de alquiler son 24 horas desde la hora de entrega.</p>

      <div className="reserva-panel-precio-total" aria-live="polite">
        {seleccion && !actual && <p className="reserva-cargando">Calculando el precio...</p>}
        {actual?.error && (
          <p className="reserva-cliente-error" role="alert">
            {actual.error}
          </p>
        )}
        {listo && <DesgloseReserva presupuesto={actual.data} />}
      </div>

      <button
        type="button"
        className="pd-cta-btn reserva-cta"
        onClick={alPulsarReservar}
        disabled={Boolean(user) && !(verificado && listo)}
        aria-describedby={nota ? idNota : undefined}
      >
        {user ? 'Reservar' : 'Inicia sesión para reservar'}
      </button>
      {nota && (
        <p id={idNota} className="reserva-nota">
          {nota}
        </p>
      )}
      {user && !verificado && <PedirEnlaceVerificacion />}

      {confirmando && listo && (
        <ReservaModal
          mueble={mueble}
          seleccion={seleccion}
          presupuesto={actual.data}
          user={user}
          onClose={() => setConfirmando(false)}
          onConflicto={alConflicto}
          onPedirSesion={abrirSesion}
        />
      )}

      {sesionUsada && (
        <Suspense fallback={null}>
          <AuthModal
            descripcion="Entra en tu cuenta para reservar esta pieza."
            textoEntrar="Entrar y seguir con la reserva"
            isOpen={sesionAbierta}
            onClose={() => setSesionAbierta(false)}
            onSuccess={() => setTrasEntrar(true)}
          />
        </Suspense>
      )}
    </section>
  );
};

export default PanelReserva;
