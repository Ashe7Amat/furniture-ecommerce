import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import { loginUser, registerUser } from '../services/api';
import '../styles/Login.css';

const Login = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  
  const { login } = useContext(AuthContext);
  const { showToast } = useContext(ToastContext);
  const navigate = useNavigate();

  useEffect(() => {
    let timer;
    if (googleLoading) {
      timer = setTimeout(() => {
        login({ email: 'cliente@gmail.com', nombre: 'Carlos (Demo)', rol: 'cliente' });
        showToast('¡Sesión iniciada con Google correctamente!', 'success');
        navigate('/');
      }, 1500);
    }
    return () => clearTimeout(timer);
  }, [googleLoading, login, navigate, showToast]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password) return setError('Por favor, completa todos los campos.');

    if (isRegister) {
      if (!nombre) return setError('El nombre es obligatorio para registrarse.');
      const res = await registerUser({ nombre, email, password });
      if (res.success) {
        login(res.user);
        showToast(`¡Cuenta creada con éxito! Bienvenido, ${res.user.nombre}`, 'success');
        navigate('/');
      } else {
        setError(res.error || 'Error al crear la cuenta.');
      }
    } else {
      const res = await loginUser(email, password);
      if (res.success) {
        login(res.user);
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

        <button 
          className="google-btn" 
          onClick={(e) => {
            e.preventDefault();
            setGoogleLoading(true);
          }} 
          disabled={googleLoading}
        >
          {googleLoading ? (
            <span className="google-loading-text">Conectando con Google...</span>
          ) : (
            <>
              <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
                <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                  <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/>
                  <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/>
                  <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/>
                  <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/>
                </g>
              </svg>
              <span>Continuar con Google</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default Login;
