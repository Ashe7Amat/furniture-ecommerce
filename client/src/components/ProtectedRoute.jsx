import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useContext(AuthContext);

  // Mientras comprueba si hay sesión activa, mostramos una transición limpia
  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando...</div>;
  }

  // REGLA 1: Si no está logueado nadie, todos van al Login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // REGLA 2: Si la ruta pide SER ADMIN y el usuario es un cliente normal, fuera a la portada
  if (adminOnly && user.rol !== 'admin') {
    return <Navigate to="/" replace />;
  }

  // Si pasa los filtros, adelante
  return children;
}