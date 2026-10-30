import { useState, useContext, useRef, useId } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import { loginUser, registerUser } from '../services/api';
import useDialogoModal from '../utils/useDialogoModal';
import { EyeIcon, EyeOffIcon } from './EyeIcons';
import '../styles/AuthModal.css';
import { BRAND } from '../theme/brand.config';

// `descripcion` y `textoEntrar` son los textos del acceso, para quien no viene de la cesta (la reserva por
// fechas): sin ellos, los de siempre.
const DESCRIPCION_ACCESO = 'Accede a tu perfil para finalizar la compra de tus piezas únicas.';
const TEXTO_ENTRAR = 'Entrar y continuar pedido';

const AuthModal = ({ isOpen, onClose, onSuccess, descripcion = DESCRIPCION_ACCESO, textoEntrar = TEXTO_ENTRAR }) => {
  const { login } = useContext(AuthContext);
  const { showToast } = useContext(ToastContext);
  // H53: cada etiqueta va unida a su campo. useId, porque el modal puede convivir con otros formularios.
  const idCampos = useId();

  const [isRegister, setIsRegister] = useState(false);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const dialogoRef = useRef(null);
  // H55: foco dentro al abrir, Tab no se sale, Escape cierra y el foco vuelve al botón que lo abrió.
  useDialogoModal(isOpen, dialogoRef, () => handleClose());

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password) {
      return setError('Por favor, completa todos los campos.');
    }

    setLoading(true);
    try {
      if (isRegister) {
        if (!nombre) {
          setLoading(false);
          return setError('El nombre es obligatorio para registrarse.');
        }
        const res = await registerUser({ nombre, email, password });
        if (res.success) {
          login(res.user, res.token, res.refreshToken);
          showToast(`¡Bienvenido a la comunidad, ${res.user.nombre}!`, 'success');
          onSuccess();
          handleClose();
        } else {
          setError(res.error || 'Error al crear la cuenta.');
        }
      } else {
        const res = await loginUser(email, password);
        if (res.success) {
          login(res.user, res.token, res.refreshToken);
          showToast(`¡Hola de nuevo, ${res.user.nombre}!`, 'success');
          onSuccess();
          handleClose();
        } else {
          setError(res.error || 'Credenciales de acceso incorrectas.');
        }
      }
    } catch (err) {
      console.error(err);
      setError('Error en la comunicación con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    // Restablecer estados con un delay de transición
    setTimeout(() => {
      setIsRegister(false);
      setNombre('');
      setEmail('');
      setPassword('');
      setMostrarPassword(false);
      setError('');
    }, 300);
  };

  const toggleMode = () => {
    setIsRegister(!isRegister);
    setError('');
    setNombre('');
    setEmail('');
    setPassword('');
    setMostrarPassword(false);
  };

  return (
    <div className="auth-overlay">
      {/* H55: se anuncia como diálogo modal, con el título visible ("Iniciar Sesión" o "Crear Cuenta") como nombre. */}
      <div
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-titulo"
        tabIndex={-1}
        ref={dialogoRef}
      >
        <button className="auth-close-btn" onClick={handleClose} aria-label="Cerrar">✕</button>
        
        <div className="auth-content">
          <div className="auth-logo-brand">
            <h2>{BRAND.nombre}</h2>
            <p className="auth-tagline">{BRAND.eslogan}</p>
          </div>

          <h3 id="auth-titulo">{isRegister ? 'Crear Cuenta' : 'Iniciar Sesión'}</h3>
          <p className="auth-sub-desc">
            {isRegister 
              ? 'Únete a nuestra comunidad de diseño slow y piezas con historia.' 
              : descripcion}
          </p>

          <form onSubmit={handleSubmit} className="auth-form">
            {isRegister && (
              <div className="auth-input-group">
                <label htmlFor={`${idCampos}-nombre`}>Nombre Completo</label>
                <input
                  id={`${idCampos}-nombre`}
                  type="text" 
                  placeholder="Ej. Ana Martínez" 
                  value={nombre} 
                  onChange={(e) => setNombre(e.target.value)} 
                  required
                />
              </div>
            )}

            <div className="auth-input-group">
              <label htmlFor={`${idCampos}-email`}>Correo Electrónico</label>
              <input
                id={`${idCampos}-email`}
                type="email" 
                placeholder="tu@correo.com" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required
              />
            </div>

            <div className="auth-input-group">
              <label htmlFor={`${idCampos}-password`}>Contraseña</label>
              <div className="auth-password-wrapper">
                <input
                  id={`${idCampos}-password`}
                  type={mostrarPassword ? 'text' : 'password'} 
                  placeholder="••••••••" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required
                />
                <button
                  type="button"
                  className="auth-toggle-password-btn"
                  onClick={() => setMostrarPassword((prev) => !prev)}
                  aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  tabIndex={0}
                >
                  {mostrarPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            {error && <span className="auth-error-msg">{error}</span>}

            <button 
              type="submit" 
              className="auth-submit-btn" 
              disabled={loading}
            >
              {loading 
                ? 'Conectando...' 
                : isRegister 
                  ? 'Crear mi cuenta' 
                  : textoEntrar}
            </button>
          </form>

          <div className="auth-toggle-link">
            <button type="button" onClick={toggleMode} className="auth-toggle-btn">
              {isRegister 
                ? '¿Ya tienes una cuenta? Inicia sesión aquí' 
                : '¿Aún no eres miembro? Regístrate aquí'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
