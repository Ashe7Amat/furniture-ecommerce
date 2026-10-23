// Paso de confirmación de una reserva (docs/reservas-diseno.md, 6.2 y 6.3): el resumen y el desglose,
// los datos de contacto, la aceptación de las condiciones y el paso al pago. Crea la reserva
// provisional con POST /api/reservas/sesion-pago y lleva a la página de pago de Stripe. Con el mismo
// comportamiento de teclado que los demás modales (utils/useDialogoModal.js).
import { useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { crearSesionPagoReserva } from '../../services/api';
import { eurosDeCentimos, fechaLarga } from '../../utils/reservas';
import useDialogoModal from '../../utils/useDialogoModal';
import DesgloseReserva from './DesgloseReserva';
import PedirEnlaceVerificacion from './PedirEnlaceVerificacion';
import { CONFIRMA_EMAIL_PARA_RESERVAR, MODO_TRAYECTO, SESION_CADUCADA } from './textosReserva';

const SIN_PAGO = 'No se pudo iniciar el pago.';

// Los mismos límites que el servidor.
const MAX = { nombre: 100, telefono: 30, direccion: 500, notas: 500 };
const ORDEN_CAMPOS = ['nombre', 'telefono', 'direccion', 'acepta'];

const etiquetaDireccion = (entrega, recogida) => {
  if (entrega === 'domicilio' && recogida === 'domicilio') return 'Dirección de entrega y recogida';
  return entrega === 'domicilio' ? 'Dirección de entrega' : 'Dirección de recogida';
};

const ReservaModal = ({ mueble, seleccion, presupuesto, user, onClose, onConflicto, onPedirSesion }) => {
  const id = useId();
  // Un inicializador perezoso y sin dar por hecho que hay usuario: si la sesión caduca durante el pago, el
  // contexto la quita antes de que llegue el 401 y este modal sigue abierto para decirlo.
  const [nombre, setNombre] = useState(() => user?.nombre || '');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [notas, setNotas] = useState('');
  const [acepta, setAcepta] = useState(false);
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState(null);
  const dialogoRef = useRef(null);
  const refs = { nombre: useRef(null), telefono: useRef(null), direccion: useRef(null), acepta: useRef(null) };

  // Mientras se crea la reserva no se cierra: la respuesta llegaría con el modal ya cerrado.
  useDialogoModal(true, dialogoRef, () => {
    if (!enviando) onClose();
  });

  const conDireccion = seleccion.entrega === 'domicilio' || seleccion.recogida === 'domicilio';

  // El aviso rojo de un campo se quita en cuanto el campo se arregla, sin esperar a pulsar Pagar otra vez.
  const quitarError = (campo, arreglado) => {
    if (arreglado) setErrores((e) => (e[campo] ? { ...e, [campo]: undefined } : e));
  };

  const validar = () => {
    const nuevos = {};
    if (!nombre.trim()) nuevos.nombre = 'Escribe tu nombre.';
    if (!telefono.trim()) nuevos.telefono = 'Escribe un teléfono de contacto.';
    if (conDireccion && !direccion.trim()) nuevos.direccion = 'Escribe la dirección.';
    if (!acepta) nuevos.acepta = 'Tienes que aceptar las condiciones del alquiler.';
    return nuevos;
  };

  const enviar = async (event) => {
    event.preventDefault();
    if (enviando) return;
    const nuevos = validar();
    setErrores(nuevos);
    const primero = ORDEN_CAMPOS.find((campo) => nuevos[campo]);
    if (primero) {
      refs[primero].current.focus();
      return;
    }

    setEnviando(true);
    setFallo(null);
    const contacto = { nombre: nombre.trim(), telefono: telefono.trim() };
    if (conDireccion) contacto.direccion = direccion.trim();
    if (notas.trim()) contacto.notas = notas.trim();
    const { data, error, status, codigo } = await crearSesionPagoReserva({
      mueble_id: mueble.id,
      ...seleccion,
      contacto,
      acepta_condiciones: true
    });

    // A la página de pago. El botón sigue desactivado: no se puede pedir otra sesión mientras tanto.
    if (data?.url) {
      window.location.assign(data.url);
      return;
    }
    setEnviando(false);
    if (status === 409) {
      // Las fechas se acaban de ocupar (o hay otra reserva sin pagar): la ficha recarga el calendario.
      onConflicto(error, codigo);
      return;
    }
    if (status === 401) {
      setFallo({ mensaje: SESION_CADUCADA, sesion: true });
      return;
    }
    // La cuenta no tiene el email confirmado (aunque esta pestaña creyera que sí): se dice y se ofrece
    // otro correo con el enlace, como en la ficha.
    if (status === 403 && codigo === 'email_no_verificado') {
      setFallo({ mensaje: CONFIRMA_EMAIL_PARA_RESERVAR, verificar: true });
      return;
    }
    // Lo demás (una regla, el alquiler cerrado, un 503...), con el motivo que da el servidor.
    setFallo({ mensaje: error || SIN_PAGO });
  };

  const campo = (nombreCampo, etiqueta, entrada) => {
    const idCampo = `${id}-${nombreCampo}`;
    const idError = `${idCampo}-error`;
    return (
      <div className="reserva-campo">
        <label htmlFor={idCampo}>{etiqueta}</label>
        {entrada({
          id: idCampo,
          ref: refs[nombreCampo],
          'aria-invalid': errores[nombreCampo] ? true : undefined,
          'aria-describedby': errores[nombreCampo] ? idError : undefined
        })}
        {errores[nombreCampo] && (
          <span id={idError} className="reserva-campo-error">
            {errores[nombreCampo]}
          </span>
        )}
      </div>
    );
  };

  const errorAcepta = errores.acepta ? `${id}-acepta-error` : undefined;

  return (
    <div className="reserva-modal-fondo">
      <div
        className="reserva-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-titulo`}
        tabIndex={-1}
        ref={dialogoRef}
      >
        <div className="reserva-modal-cabecera">
          <h2 id={`${id}-titulo`}>Confirma tu reserva</h2>
          <button type="button" className="reserva-modal-cerrar" onClick={onClose} disabled={enviando} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <div className="reserva-modal-cuerpo">
          <section className="reserva-modal-resumen" aria-label="Resumen de la reserva">
            <p className="reserva-modal-pieza">{mueble.nombre}</p>
            <dl className="reserva-modal-fechas">
              <div>
                <dt>Entrega</dt>
                <dd>
                  {fechaLarga(seleccion.fecha_inicio)}, a las {seleccion.hora_entrega}, {MODO_TRAYECTO[seleccion.entrega]}
                </dd>
              </div>
              <div>
                <dt>Recogida</dt>
                <dd>
                  {fechaLarga(seleccion.fecha_fin)}, a las {seleccion.hora_recogida}, {MODO_TRAYECTO[seleccion.recogida]}
                </dd>
              </div>
            </dl>
            <DesgloseReserva presupuesto={presupuesto} />
          </section>

          <form className="reserva-modal-form" onSubmit={enviar} noValidate>
            <h3>Tus datos</h3>
            {campo('nombre', 'Nombre y apellidos', (props) => (
              <input
                {...props}
                type="text"
                autoComplete="name"
                maxLength={MAX.nombre}
                value={nombre}
                onChange={(e) => {
                  setNombre(e.target.value);
                  quitarError('nombre', e.target.value.trim());
                }}
              />
            ))}
            {campo('telefono', 'Teléfono', (props) => (
              <input
                {...props}
                type="tel"
                autoComplete="tel"
                maxLength={MAX.telefono}
                value={telefono}
                onChange={(e) => {
                  setTelefono(e.target.value);
                  quitarError('telefono', e.target.value.trim());
                }}
              />
            ))}
            {conDireccion &&
              campo('direccion', etiquetaDireccion(seleccion.entrega, seleccion.recogida), (props) => (
                <textarea
                  {...props}
                  rows={2}
                  autoComplete="street-address"
                  maxLength={MAX.direccion}
                  value={direccion}
                  onChange={(e) => {
                    setDireccion(e.target.value);
                    quitarError('direccion', e.target.value.trim());
                  }}
                />
              ))}
            <div className="reserva-campo">
              <label htmlFor={`${id}-notas`}>Notas (opcional)</label>
              <textarea
                id={`${id}-notas`}
                rows={2}
                maxLength={MAX.notas}
                placeholder="Piso, ascensor, horario preferido..."
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
              />
            </div>

            <div className="reserva-acepta">
              <input
                id={`${id}-acepta`}
                type="checkbox"
                ref={refs.acepta}
                checked={acepta}
                onChange={(e) => {
                  setAcepta(e.target.checked);
                  quitarError('acepta', e.target.checked);
                }}
                aria-invalid={errores.acepta ? true : undefined}
                aria-describedby={errorAcepta}
              />
              <label htmlFor={`${id}-acepta`}>
                He leído y acepto las{' '}
                <Link to="/terminos" target="_blank" rel="noopener noreferrer">
                  condiciones del alquiler
                </Link>
              </label>
            </div>
            {errores.acepta && (
              <span id={errorAcepta} className="reserva-campo-error">
                {errores.acepta}
              </span>
            )}

            {fallo && (
              <div className="reserva-cliente-error" role="alert">
                <p>{fallo.mensaje}</p>
                {fallo.sesion && (
                  <button type="button" className="reserva-enlace" onClick={onPedirSesion}>
                    Iniciar sesión
                  </button>
                )}
              </div>
            )}
            {fallo?.verificar && <PedirEnlaceVerificacion />}

            <button type="submit" className="reserva-modal-pagar" disabled={enviando}>
              {enviando ? 'Conectando con el pago...' : `Pagar ${eurosDeCentimos(presupuesto.importe_total_centimos)}`}
            </button>
            <p className="reserva-modal-nota">
              Te llevamos a la página de pago segura de Stripe. Las fechas quedan apartadas mientras pagas.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ReservaModal;
