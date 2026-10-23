import { useEffect, useState, useContext, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { confirmarSesionPago } from '../services/api';
import { CartContext } from '../context/CartContext';
import { reservasActivas } from '../utils/reservas';
import '../styles/CheckoutResultado.css';

// Vuelta del pago de una reserva por fechas (docs/reservas-diseno.md, 6.4): confirmar-sesion responde
// con `tipo: 'reserva'` y el estado en que ha quedado. El texto de cada caso lo da el servidor; estos
// son los de respaldo si no llega.
const RESERVA = {
  confirmada: {
    icono: 'ok',
    titulo: 'Reserva confirmada',
    respaldo: 'Te llegará un email con las fechas y el desglose.'
  },
  conflicto: {
    icono: 'error',
    titulo: 'Esas fechas ya no estaban libres',
    respaldo: 'Se ocuparon mientras pagabas. Te devolveremos el importe y te escribiremos por email.'
  },
  procesando: {
    icono: 'ok',
    titulo: 'Pago recibido',
    respaldo: 'Estamos confirmando tu reserva. Te escribiremos por email en cuanto esté lista.'
  },
  // El administrador la canceló después del pago (8.4): el servidor explica qué pasa con el importe.
  cancelada: {
    icono: 'error',
    titulo: 'Reserva cancelada',
    respaldo: 'Esta reserva se ha cancelado. Te escribiremos por email con los detalles.'
  }
};

const CheckoutExito = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const { emptyCart } = useContext(CartContext);
  const [estado, setEstado] = useState('confirmando'); // confirmando, ok, reserva, error
  const [mensajeError, setMensajeError] = useState('');
  const [reserva, setReserva] = useState(null);
  const yaConfirmado = useRef(false);
  const tituloReserva = useRef(null);

  useEffect(() => {
    if (!sessionId) {
      setEstado('error');
      setMensajeError('No encontramos los datos de tu pago en esta dirección.');
      return;
    }
    if (yaConfirmado.current) return; // evita doble llamada en StrictMode
    yaConfirmado.current = true;

    confirmarSesionPago(sessionId).then((res) => {
      if (res && res.success && res.tipo === 'reserva') {
        // Una reserva no pasa por la cesta (6.1): la cesta se queda como estaba.
        setReserva({ ...(RESERVA[res.estado] || RESERVA.procesando), mensaje: res.message });
        setEstado('reserva');
      } else if (res && res.success) {
        emptyCart();
        setEstado('ok');
      } else {
        setEstado('error');
        setMensajeError(res?.error || 'No se pudo confirmar el pago.');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // El resultado de una reserva sustituye a "Confirmando tu pago...": el foco pasa al título para que un
  // lector de pantalla lo lea. La compra normal se queda como estaba.
  useEffect(() => {
    if (estado === 'reserva') tituloReserva.current?.focus();
  }, [estado]);

  return (
    <div className="checkout-resultado-page">
      <div className="checkout-resultado-box">
        {estado === 'confirmando' && (
          <>
            <div className="classic-spinner" style={{ margin: '0 auto 24px' }}></div>
            <h1>Confirmando tu pago...</h1>
            <p>Estamos verificando el pago con Stripe, un momento.</p>
          </>
        )}

        {estado === 'ok' && (
          <>
            <div className="success-icon">✓</div>
            <h1>¡Pedido confirmado con éxito!</h1>
            <p className="success-msg">
              Hemos registrado tu compra en Nave 5 Barcelona y actualizado el catálogo.
              En breve recibirás la confirmación por correo.
            </p>
            <Link to="/catalogo" className="checkout-btn-solid">Volver a la tienda</Link>
          </>
        )}

        {estado === 'reserva' && (
          <>
            {reserva.icono === 'ok' ? <div className="success-icon">✓</div> : <div className="error-icon">!</div>}
            <h1 ref={tituloReserva} tabIndex={-1} className="checkout-resultado-titulo-reserva">
              {reserva.titulo}
            </h1>
            <p className="success-msg">{reserva.mensaje || reserva.respaldo}</p>
            <div className="checkout-resultado-acciones">
              {reservasActivas() && (
                <Link to="/cuenta?tab=reservas" className="checkout-btn-solid">Ver mis reservas</Link>
              )}
              <Link to="/catalogo" className="checkout-btn-solid">Volver a la tienda</Link>
            </div>
          </>
        )}

        {estado === 'error' && (
          <>
            <div className="error-icon">!</div>
            <h1>No hemos podido confirmar el pago</h1>
            <p className="success-msg">{mensajeError}</p>
            <p className="success-msg">Si ya has pagado, no lo repitas: escríbenos y lo revisamos.</p>
            <div className="checkout-resultado-acciones">
              {reservasActivas() && (
                <Link to="/cuenta?tab=reservas" className="checkout-btn-solid">Ver mis reservas</Link>
              )}
              <Link to="/contacto" className="checkout-btn-solid">Escríbenos</Link>
              <Link to="/catalogo" className="checkout-btn-solid">Volver a la tienda</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CheckoutExito;
