import { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading, reconectando, reintentarSesion, logout } = useContext(AuthContext);
  const location = useLocation();

  // Mientras se confirma la sesión (el refresh silencioso al cargar), no se pinta nada: sin access
  // token, las lecturas del panel saldrían sin la cabecera Authorization (ver AuthContext).
  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando...</div>;
  }

  // No se ha podido confirmar la sesión por un fallo de red o del servidor. No se cierra (puede ser
  // una sesión válida): se ofrece reintentar, y mientras tanto tampoco se pinta el contenido.
  if (reconectando) {
    return (
      <div role="alert" style={{ padding: '40px', textAlign: 'center' }}>
        <p>No hemos podido comprobar tu sesión. Revisa tu conexión e inténtalo de nuevo.</p>
        <button type="button" onClick={reintentarSesion}>
          Reintentar
        </button>{' '}
        <button type="button" onClick={logout}>
          Cerrar sesión
        </button>
      </div>
    );
  }

  // REGLA 1: Si no está logueado nadie, todos van al Login. La ruta pedida (con su ?tab=...) viaja en
  // el state, no en la URL, para volver a ella tras iniciar sesión (H45; Login la valida).
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  // REGLA 2: Si la ruta pide SER ADMIN y el usuario es un cliente normal, fuera a la portada
  if (adminOnly && user.rol !== 'admin') {
    return <Navigate to="/" replace />;
  }

  // Si pasa los filtros, adelante
  return children;
}
