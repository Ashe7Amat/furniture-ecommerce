import { createContext, useState, useEffect, useCallback } from 'react';
import {
  CLAVE_REFRESH_TOKEN,
  setAccessToken,
  getRefreshToken,
  setRefreshToken,
  actualizarRefreshEnMemoria,
  cargarRefreshGuardado,
  limpiarTokens,
  alCerrarSesionAvisar
} from '../utils/authToken';
import { renovarSesion, cerrarSesionEnServidor } from '../services/api';

export const AuthContext = createContext();

// Sesión con access token en memoria y refresh token en localStorage (docs/tarea3-diseno.md,
// sección 2; los tokens viven en utils/authToken.js).
//
// Al cargar la aplicación, si hay un refresh token guardado, se pide un access token nuevo antes de
// dar la sesión por lista: `loading` sigue en true hasta entonces y ProtectedRoute no pinta nada.
// Así el panel no hace lecturas sin la cabecera Authorization, que es lo que salta la caché de la
// CDN (H16). Si esa renovación:
//   - responde 401: la sesión ya no vale y se cierra;
//   - falla por la red o por un 5xx: NO se cierra. Se pasa a `reconectando`, y ProtectedRoute
//     ofrece reintentar o cerrar sesión. Las páginas públicas no esperan a nada.
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reconectando, setReconectando] = useState(false);

  // Cierre de sesión solo en este navegador (sin avisar al servidor).
  const cerrarLocal = useCallback(() => {
    limpiarTokens();
    localStorage.removeItem('kaveUser');
    setUser(null);
    setReconectando(false);
  }, []);

  const confirmarSesion = useCallback(async () => {
    setReconectando(false);
    setLoading(true);
    const resultado = await renovarSesion();
    if (resultado === 'sin-conexion') setReconectando(true);
    // 'rechazada' ya ha cerrado la sesión (api.js avisa a cerrarLocal)
    setLoading(false);
  }, []);

  useEffect(() => {
    alCerrarSesionAvisar(cerrarLocal);

    let guardado = null;
    try {
      guardado = JSON.parse(localStorage.getItem('kaveUser'));
    } catch {
      guardado = null;
    }
    if (!guardado) {
      setLoading(false);
      return () => alCerrarSesionAvisar(null);
    }
    setUser(guardado);
    // Sin refresh token es una sesión de antes del bloque 3b (o de un inicio de sesión sin él): se
    // sigue usando su token de 7 días hasta que caduque, sin renovar nada.
    if (cargarRefreshGuardado()) confirmarSesion();
    else setLoading(false);
    return () => alCerrarSesionAvisar(null);
  }, [cerrarLocal, confirmarSesion]);

  // Otra pestaña ha rotado el refresh token (se actualiza la copia en memoria, para no presentar
  // uno ya revocado) o ha cerrado la sesión (lo borró: se cierra también aquí). El evento `storage`
  // solo llega a las demás pestañas, nunca a la que escribió.
  useEffect(() => {
    const alCambiarStorage = (event) => {
      if (event.key !== CLAVE_REFRESH_TOKEN) return;
      if (event.newValue) {
        actualizarRefreshEnMemoria(event.newValue);
      } else {
        actualizarRefreshEnMemoria(null);
        setAccessToken(null);
        setUser(null);
        setReconectando(false);
      }
    };
    window.addEventListener('storage', alCambiarStorage);
    return () => window.removeEventListener('storage', alCambiarStorage);
  }, []);

  // `token` es el access token (1 hora), solo en memoria. `refreshToken`: el que devuelva el
  // servidor; si no viene (undefined, p. ej. al cambiar solo el nombre del perfil), se conserva el
  // que había.
  const login = (userData, token, refreshToken) => {
    setUser(userData);
    localStorage.setItem('kaveUser', JSON.stringify(userData));
    setAccessToken(token);
    localStorage.removeItem('kaveToken'); // el formato de antes del bloque 3b ya no se escribe
    if (refreshToken !== undefined) setRefreshToken(refreshToken);
    setReconectando(false);
  };

  // Primero se revoca la sesión en el servidor y después se borra la local, aunque el servidor no
  // responda (cerrarSesionEnServidor no espera más de 5 s ni lanza errores).
  const logout = async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) await cerrarSesionEnServidor(refreshToken);
    cerrarLocal();
  };

  return (
    <AuthContext.Provider
      value={{ user, login, logout, loading, reconectando, reintentarSesion: confirmarSesion }}
    >
      {children}
    </AuthContext.Provider>
  );
};
