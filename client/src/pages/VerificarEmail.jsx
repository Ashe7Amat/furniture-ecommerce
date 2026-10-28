import { useContext, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import { verificarEmail, reenviarVerificacion } from '../services/api';
import '../styles/CheckoutResultado.css';
import { useDocumentMeta } from '../utils/useDocumentMeta';

// H18 (docs/verificacion-email-diseno.md, partes 6 y 7): a esta página lleva el enlace del correo.
// El token NO se manda al cargar: hace falta pulsar el botón. Algunos filtros de correo abren los
// enlaces para analizarlos y, si la página confirmara sola, gastarían el enlace antes que la persona.
const NO_VALIDO = 'El enlace no es válido o ha caducado.';

export default function VerificarEmail() {
  // Página privada o de paso: fuera de los buscadores (SEO del catálogo, 28 oct 2026).
  useDocumentMeta({ title: 'Confirmar email', noindex: true });
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { user, actualizarUsuario, logout } = useContext(AuthContext);
  const { showToast } = useContext(ToastContext);
  const [estado, setEstado] = useState(token ? 'pendiente' : 'error'); // pendiente, enviando, ok, error
  const [mensajeError, setMensajeError] = useState(NO_VALIDO);
  const [resultado, setResultado] = useState(null);
  const [reenviando, setReenviando] = useState(false);

  const confirmar = async () => {
    setEstado('enviando');
    const res = await verificarEmail(token);
    if (res.error) {
      setMensajeError(res.error);
      setEstado('error');
      return;
    }
    setResultado(res);
    setEstado('ok');
    if (res.sesionCerrada) {
      // Tras un cambio de email, el servidor ha cerrado todas las sesiones de la cuenta (H21).
      if (user) await logout();
    } else if (user && res.user && user.email === res.user.email) {
      actualizarUsuario(res.user);
    }
  };

  const pedirOtro = async () => {
    setReenviando(true);
    const res = await reenviarVerificacion();
    setReenviando(false);
    if (res.error) showToast(res.error, 'error');
    else showToast('Te hemos enviado otro correo.', 'success');
  };

  return (
    <div className="checkout-resultado-page">
      <div className="checkout-resultado-box">
        {(estado === 'pendiente' || estado === 'enviando') && (
          <>
            <h1>Confirma tu email</h1>
            <p className="success-msg">
              Pulsa el botón para confirmar que este email es tuyo.
            </p>
            <button
              type="button"
              className="checkout-btn-solid"
              onClick={confirmar}
              disabled={estado === 'enviando'}
            >
              {estado === 'enviando' ? 'Confirmando...' : 'Confirmar mi email'}
            </button>
          </>
        )}

        {estado === 'ok' && resultado?.sesionCerrada && (
          <>
            <div className="success-icon">✓</div>
            <h1>Tu email ya está cambiado</h1>
            <p className="success-msg">
              A partir de ahora, tu cuenta usa {resultado.user.email}. Por seguridad hemos cerrado
              todas las sesiones: entra de nuevo con tu email nuevo.
            </p>
            <Link to="/login" className="checkout-btn-solid">Iniciar sesión</Link>
          </>
        )}

        {estado === 'ok' && !resultado?.sesionCerrada && (
          <>
            <div className="success-icon">✓</div>
            <h1>Tu cuenta ya está activa</h1>
            <p className="success-msg">
              Ya puedes ver tu historial de compras en Mi cuenta, guardar tus piezas favoritas y
              comprar en un momento.
            </p>
            <Link to={user ? '/cuenta?tab=pedidos' : '/login'} className="checkout-btn-solid">
              {user ? 'Ir a Mi cuenta' : 'Iniciar sesión'}
            </Link>
          </>
        )}

        {estado === 'error' && (
          <>
            <div className="error-icon">!</div>
            <h1>No hemos podido confirmar tu email</h1>
            <p className="success-msg">{mensajeError}</p>
            {user ? (
              <button
                type="button"
                className="checkout-btn-solid"
                onClick={pedirOtro}
                disabled={reenviando}
              >
                {reenviando ? 'Enviando...' : 'Enviar otro enlace'}
              </button>
            ) : (
              <p className="success-msg">Inicia sesión para pedir otro enlace.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
