// Tokens de sesión del cliente (docs/tarea3-diseno.md, sección 2, "Migración del frontend").
//
// - Access token (1 hora): SOLO en memoria, en este módulo. Una XSS no puede robar de
//   localStorage un token que ya no está ahí. Al recargar la página se pierde y AuthContext pide
//   uno nuevo con el refresh token.
// - Refresh token (7 días): en localStorage ('kaveRefreshToken'), para sobrevivir a recargas y al
//   cierre de la pestaña, con una copia en memoria que es la que usa services/api.js. Cuando otra
//   pestaña lo rota, AuthContext actualiza esa copia con el evento `storage`.
// - 'kaveToken': el token de 7 días de antes del bloque 3b. Se sigue usando hasta que caduque
//   (opción 1 del diseño: sin expulsar a nadie), pero ya no se escribe nunca.
const CLAVE_REFRESH = 'kaveRefreshToken';
const CLAVE_ANTIGUA = 'kaveToken';

let accessToken = null;
let refreshToken = null;
let alCerrarSesion = null;

const guardar = (clave, valor) => {
  try {
    if (valor) localStorage.setItem(clave, valor);
    else localStorage.removeItem(clave);
  } catch {
    // Sin localStorage (modo privado estricto): la sesión dura lo que la pestaña.
  }
};

export const CLAVE_REFRESH_TOKEN = CLAVE_REFRESH;

export const getAccessToken = () => accessToken;
export const setAccessToken = (token) => {
  accessToken = token || null;
};

// El token de antes del bloque 3b, si todavía hay uno guardado.
export const getTokenAntiguo = () => {
  try {
    return localStorage.getItem(CLAVE_ANTIGUA);
  } catch {
    return null;
  }
};

// El que va en la cabecera Authorization: el access token, o el antiguo mientras dure.
export const tokenParaCabecera = () => accessToken || getTokenAntiguo();

export const getRefreshToken = () => refreshToken;

// Guarda el refresh token en memoria y en localStorage. Escribir en localStorage es lo que avisa a
// las demás pestañas (les llega un evento `storage`; a esta no).
export const setRefreshToken = (token) => {
  refreshToken = token || null;
  guardar(CLAVE_REFRESH, refreshToken);
};

// Solo la copia en memoria: para el evento `storage`, cuando otra pestaña ya lo ha guardado.
export const actualizarRefreshEnMemoria = (token) => {
  refreshToken = token || null;
};

// Al arrancar la aplicación: la copia en memoria sale de lo guardado.
export const cargarRefreshGuardado = () => {
  try {
    refreshToken = localStorage.getItem(CLAVE_REFRESH);
  } catch {
    refreshToken = null;
  }
  return refreshToken;
};

// Olvida todos los tokens, en memoria y guardados (también el antiguo).
export const limpiarTokens = () => {
  accessToken = null;
  refreshToken = null;
  guardar(CLAVE_REFRESH, null);
  guardar(CLAVE_ANTIGUA, null);
};

// services/api.js no puede importar AuthContext: cuando una renovación responde 401 (la sesión ya
// no vale), avisa por aquí y AuthContext cierra la sesión en pantalla.
export const alCerrarSesionAvisar = (funcion) => {
  alCerrarSesion = funcion;
};
export const avisarCierreDeSesion = () => {
  if (alCerrarSesion) alCerrarSesion();
};
