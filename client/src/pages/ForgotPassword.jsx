import { useState } from 'react';
import { Link } from 'react-router-dom';
import { solicitarRecuperacionPassword } from '../services/api';
import '../styles/Login.css';
import { useDocumentMeta } from '../utils/useDocumentMeta';

const ForgotPassword = () => {
  // Página privada o de paso: fuera de los buscadores (SEO del catálogo, 28 oct 2026).
  useDocumentMeta({ title: 'Recuperar contraseña', noindex: true });
  const [email, setEmail] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMensaje('');

    if (!email) {
      return setError('Por favor, introduce tu correo electrónico.');
    }

    setLoading(true);
    const res = await solicitarRecuperacionPassword(email);
    setLoading(false);

    if (res?.error) {
      setError(res.error);
    } else {
      setMensaje(res?.message || 'Si el correo está registrado, recibirás un enlace.');
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>Recuperar contraseña</h1>
        <p>Introduce tu correo electrónico para recibir un enlace de recuperación.</p>

        {mensaje ? (
          <div className="forgot-password-success">
            <p className="success-msg">{mensaje}</p>
            <div className="login-toggle-link">
              <Link to="/login" className="text-btn">
                Volver a iniciar sesión
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {error && <p className="error-msg">{error}</p>}

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar enlace'}
            </button>

            <div className="login-toggle-link">
              <Link to="/login" className="text-btn">
                Volver a iniciar sesión
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
