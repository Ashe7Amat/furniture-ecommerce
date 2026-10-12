// Núcleo común de errores de api.js (H12, en docs/mejoras-tecnicas.md). Nunca lanza: siempre
// devuelve { data, error, status }, para que quien llama distinga "falló" de "no hay datos" y
// pueda enseñar el motivo que da el servidor.
//   éxito (2xx):            data es el cuerpo JSON (null si no hay cuerpo, p. ej. un 204) y error null
//   error con { error }:    el mensaje del servidor, tal cual
//   error sin JSON:         `mensajeError` (p. ej. la página de Vercel de un 504 o un 413)
//   fallo de red:           status 0 y SIN_CONEXION
// `transporte` es apiFetch para las peticiones con sesión y fetch para las públicas: así este
// módulo no depende de api.js, y la caché de la CDN y el 401 de una contraseña incorrecta siguen
// como hasta ahora.
export const SIN_CONEXION = 'No se pudo conectar con el servidor. Revisa tu conexión.';

export const peticion = async (transporte, url, opciones, mensajeError) => {
  let response;
  try {
    response = await transporte(url, opciones);
  } catch {
    return { data: null, error: SIN_CONEXION, status: 0 };
  }
  const cuerpo = await response.json().catch(() => null);
  if (response.ok) return { data: cuerpo, error: null, status: response.status };
  const mensaje = typeof cuerpo?.error === 'string' && cuerpo.error ? cuerpo.error : mensajeError;
  return { data: null, error: mensaje, status: response.status };
};

// Adaptador al contrato A de siempre (el cuerpo si va bien, null si falla), para las funciones de
// api.js que aún no se han migrado.
export const comoContratoA = ({ data, error }) => (error ? null : data);
