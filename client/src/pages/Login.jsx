import { useState, useContext, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import { loginUser, registerUser, loginConGoogle } from '../services/api';
import '../styles/Login.css';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const Login = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const googleBtnRef = useRef(null);

  const { login } = useContext(AuthContext);
  const { showToast } = useContext(ToastContext);
  const navigate = useNavigate();

  // Login real con Google: recibe el token verificado que devuelve el botón oficial
  // de Google y lo manda al servidor para que compruebe la firma y abra la sesión.
  const handleGoogleCredential = async (response) => {
    setGoogleLoading(true);
    const res = await loginConGoogle(response.credential);
    setGoogleLoading(false);

    if (res?.success) {
      login(res.user, res.token);
      showToast(`¡Hola, ${res.user.nombre}!`, 'success');
      navigate('/');
    } else {
      showToast(res?.error || 'No se pudo iniciar sesión con Google.', 'error');
    }
  };

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleBtnRef.current) return;

    // El script de Google Identity Services se carga una sola vez para toda la app.
    const cargarBotonGoogle = () => {
      if (!window.google?.accounts?.id || !googleBtnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
      });
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        shape: 'rectangular',
        text: 'continue_with',
        logo_alignment: 'left',
        locale: 'es',
        width: Math.min(googleBtnRef.current.offsetWidth || 380, 400),
      });
    };

    const scriptExistente = document.getElementById('google-identity-script');
    if (scriptExistente && window.google?.accounts?.id) {
      cargarBotonGoogle();
      return;
    }

    const script = scriptExistente || document.createElement('script');
    script.id = 'google-identity-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = cargarBotonGoogle;
    if (!scriptExistente) document.body.appendChild(script);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password) return setError('Por favor, completa todos los campos.');

    if (isRegister) {
      if (!nombre) return setError('El nombre es obligatorio para registrarse.');
      const res = await registerUser({ nombre, email, password });
      if (res.success) {
        login(res.user, res.token);
        showToast(`¡Cuenta creada con éxito! Bienvenido, ${res.user.nombre}`, 'success');
        navigate('/');
      } else {
        setError(res.error || 'Error al crear la cuenta.');
      }
    } else {
      const res = await loginUser(email, password);
      if (res.success) {
        login(res.user, res.token);
        showToast(`¡Hola de nuevo, ${res.user.nombre}!`, 'success');
        navigate('/');
      } else {
        setError(res.error || 'Credenciales incorrectas.');
      }
    }
  };

  const toggleView = () => {
    setIsRegister(!isRegister);
    setError('');
    setEmail('');
    setPassword('');
    setNombre('');
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>{isRegister ? 'Crear una cuenta' : 'Acceder a mi cuenta'}</h2>
        <p>{isRegister ? 'Rellena tus datos para unirte.' : 'Introduce tu email y contraseña para entrar.'}</p>
        <form onSubmit={handleSubmit}>
          {isRegister && (
            <div className="input-group">
              <input 
                type="text" 
                placeholder="Nombre completo" 
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </div>
          )}
          <div className="input-group">
            <input 
              type="email" 
              placeholder="Email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="input-group">
            <input 
              type="password" 
              placeholder="Contraseña" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" className="login-btn">
            {isRegister ? 'Registrarme' : 'Continuar'}
          </button>
        </form>

        <div className="login-toggle-link">
          <button type="button" onClick={toggleView} className="text-btn">
            {isRegister ? '¿Ya tienes cuenta? Inicia sesión aquí' : '¿No tienes cuenta? Regístrate aquí'}
          </button>
        </div>

        <div className="login-divider">
          <span>o</span>
        </div>

        {GOOGLE_CLIENT_ID ? (
          <div className="google-btn-wrap">
            {googleLoading && <p className="google-loading-text">Conectando con Google...</p>}
            <div ref={googleBtnRef} className="google-btn-real" style={{ display: googleLoading ? 'none' : 'flex' }} />
          </div>
        ) : (
          <button className="google-btn" disabled>
            <span>Continuar con Google (no configurado)</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default Login;
