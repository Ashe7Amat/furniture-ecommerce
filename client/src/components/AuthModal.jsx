// client/src/components/AuthModal.jsx
import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import { loginUser, registerUser } from '../services/api';
import '../styles/AuthModal.css';

const AuthModal = ({ isOpen, onClose, onSuccess }) => {
  const { login } = useContext(AuthContext);
  const { showToast } = useContext(ToastContext);

  const [isRegister, setIsRegister] = useState(false);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
          login(res.user);
          showToast(`¡Bienvenido a la comunidad, ${res.user.nombre}!`, 'success');
          onSuccess();
          handleClose();
        } else {
          setError(res.error || 'Error al crear la cuenta.');
        }
      } else {
        const res = await loginUser(email, password);
        if (res.success) {
          login(res.user);
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
      setError('');
    }, 300);
  };

  const toggleMode = () => {
    setIsRegister(!isRegister);
    setError('');
    setNombre('');
    setEmail('');
    setPassword('');
  };

  return (
    <div className="auth-overlay">
      <div className="auth-modal">
        <button className="auth-close-btn" onClick={handleClose}>✕</button>
        
        <div className="auth-content">
          <div className="auth-logo-brand">
            <h2>Nave 5 Barcelona</h2>
            <p className="auth-tagline">Almacén de ideas</p>
          </div>

          <h3>{isRegister ? 'Crear Cuenta' : 'Iniciar Sesión'}</h3>
          <p className="auth-sub-desc">
            {isRegister 
              ? 'Únete a nuestra comunidad de diseño slow y piezas con historia.' 
              : 'Accede a tu perfil para finalizar la compra de tus piezas únicas.'}
          </p>

          <form onSubmit={handleSubmit} className="auth-form">
            {isRegister && (
              <div className="auth-input-group">
                <label>Nombre Completo</label>
                <input 
                  type="text" 
                  placeholder="Ej. Ana Martínez" 
                  value={nombre} 
                  onChange={(e) => setNombre(e.target.value)} 
                  required
                />
              </div>
            )}

            <div className="auth-input-group">
              <label>Correo Electrónico</label>
              <input 
                type="email" 
                placeholder="tu@correo.com" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required
              />
            </div>

            <div className="auth-input-group">
              <label>Contraseña</label>
              <input 
                type="password" 
                placeholder="••••••••" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required
              />
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
                  : 'Entrar y continuar pedido'}
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
