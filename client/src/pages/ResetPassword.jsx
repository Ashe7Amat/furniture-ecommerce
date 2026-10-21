import { useState, useContext } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { ToastContext } from '../context/ToastContext';
import { restablecerPassword } from '../services/api';
import { EyeIcon, EyeOffIcon } from '../components/EyeIcons';
import '../styles/Login.css';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { showToast } = useContext(ToastContext);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [mostrarConfirmPassword, setMostrarConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!token) {
      return setError('Falta el token de recuperación.');
    }

    if (newPassword.length < 8) {
      return setError('La contraseña debe tener al menos 8 caracteres.');
    }

    if (newPassword !== confirmPassword) {
      return setError('Las contraseñas no coinciden.');
    }

    setLoading(true);
    const res = await restablecerPassword(token, newPassword);
    setLoading(false);

    if (res?.error) {
      setError(res.error);
    } else {
      showToast('Contraseña actualizada correctamente. Ya puedes entrar con tu nueva clave.', 'success');
      navigate('/login');
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>Restablecer contraseña</h1>
        <p>Introduce tu nueva contraseña para acceder a tu cuenta.</p>

        {!token ? (
          <div className="reset-password-missing-token">
            <p className="error-msg">El enlace de recuperación no es válido o no incluye ningún token.</p>
            <div className="login-toggle-link">
              <Link to="/login" className="text-btn">
                Volver al inicio de sesión
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="input-group password-group">
              <input
                type={mostrarPassword ? 'text' : 'password'}
                placeholder="Nueva contraseña"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="toggle-password-btn"
                onClick={() => setMostrarPassword((prev) => !prev)}
                aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                tabIndex={0}
              >
                {mostrarPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>

            <div className="input-group password-group">
              <input
                type={mostrarConfirmPassword ? 'text' : 'password'}
                placeholder="Confirmar nueva contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="toggle-password-btn"
                onClick={() => setMostrarConfirmPassword((prev) => !prev)}
                aria-label={mostrarConfirmPassword ? 'Ocultar confirmación de contraseña' : 'Mostrar confirmación de contraseña'}
                tabIndex={0}
              >
                {mostrarConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>

            {error && <p className="error-msg">{error}</p>}

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? 'Guardando...' : 'Restablecer contraseña'}
            </button>

            <div className="login-toggle-link">
              <Link to="/login" className="text-btn">
                Cancelar y volver al inicio de sesión
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
