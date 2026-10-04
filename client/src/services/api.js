import {
  tokenParaCabecera,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
  limpiarTokens,
  avisarCierreDeSesion
} from '../utils/authToken';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Cabecera de sesión: el access token en memoria (o el antiguo de 7 días mientras dure; ver
// utils/authToken.js)
const authHeaders = () => {
  const token = tokenParaCabecera();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Renueva la sesión con el refresh token (POST /api/auth/refresh). Si ya hay una renovación en
// curso, devuelve esa misma promesa: dos peticiones que reciben un 401 a la vez no gastan dos
// refresh tokens (el segundo llegaría ya revocado y se comería el margen de gracia).
// Resultado:
//   'renovada'     par nuevo guardado: access en memoria, refresh en localStorage.
//   'rechazada'    el servidor dice que la sesión ya no vale (401), o no hay refresh token: se
//                  borran los tokens y se avisa a AuthContext para que cierre la sesión.
//   'sin-conexion' fallo de red o 5xx: NO se toca nada. Puede ser una sesión válida con mala
//                  conexión, o el servidor reiniciándose tras un despliegue.
let renovacionEnCurso = null;

const pedirRenovacion = async () => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    limpiarTokens();
    avisarCierreDeSesion();
    return 'rechazada';
  }
  let response;
  try {
    response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });
  } catch {
    return 'sin-conexion';
  }
  if (response.status === 401) {
    limpiarTokens();
    avisarCierreDeSesion();
    return 'rechazada';
  }
  if (!response.ok) return 'sin-conexion';
  try {
    const par = await response.json();
    setAccessToken(par.accessToken);
    setRefreshToken(par.refreshToken);
    return 'renovada';
  } catch {
    return 'sin-conexion';
  }
};

export const renovarSesion = () => {
  if (!renovacionEnCurso) {
    renovacionEnCurso = pedirRenovacion().finally(() => {
      renovacionEnCurso = null;
    });
  }
  return renovacionEnCurso;
};

// Peticiones con sesión. Añade la cabecera Authorization y, si el servidor responde 401 (el
// access token de 1 hora ha caducado), renueva la sesión y repite la petición UNA sola vez
// (`reintentada`): lo que responda esa repetición, aunque sea otro 401, se devuelve tal cual. Si
// la renovación no sale bien, se devuelve el 401 original: quien llamó lo trata como siempre.
// Solo lo usan las peticiones que llevan sesión: las públicas siguen con fetch sin cabecera, para
// que la CDN pueda cachearlas y para que un 401 de "contraseña incorrecta" no intente renovar nada.
export const apiFetch = async (url, opciones = {}, { reintentada = false } = {}) => {
  const response = await fetch(url, {
    ...opciones,
    headers: { ...(opciones.headers || {}), ...authHeaders() }
  });
  if (response.status !== 401 || reintentada) return response;
  const resultado = await renovarSesion();
  if (resultado !== 'renovada') return response;
  return apiFetch(url, opciones, { reintentada: true });
};

// Cierre de sesión en el servidor: revoca la sesión entera (la familia del refresh token). No
// espera más de 5 segundos: perder la conexión no debe impedir cerrar la sesión en el navegador.
export const cerrarSesionEnServidor = async (refreshToken) => {
  const control = new AbortController();
  const limite = setTimeout(() => control.abort(), 5000);
  try {
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      signal: control.signal
    });
  } catch {
    // El servidor no se enterará hasta que el token caduque solo, pero la sesión local se cierra.
  } finally {
    clearTimeout(limite);
  }
};

// Sin opciones: la lectura pública del catálogo. El servidor la deja cachear: el navegador la
// guarda hasta 1 minuto y la CDN de Vercel unos minutos más. `limit` pide solo los N más recientes.
// `fresco` es la del panel (la única que lo usa): desde A5 va a GET /api/admin/muebles, con sesión
// de administrador, que trae además la referencia de cada mueble y siempre los precios reales. Esa
// ruta no se guarda en ninguna caché (el panel tiene que ver al momento lo que acaba de guardar),
// y apiFetch añade la sesión y la renueva si ha caducado. Con `fresco`, `limit` no se usa: el panel
// lee siempre el inventario entero. Mismo patrón que getCategorias.
export const getMuebles = async (opciones = {}) => {
  try {
    let response;
    if (opciones.fresco) {
      response = await apiFetch(`${API_URL}/admin/muebles`, { cache: 'no-store' });
    } else {
      const params = new URLSearchParams();
      if (opciones.limit) params.set('limit', opciones.limit);
      const query = params.toString() ? `?${params.toString()}` : '';
      response = await fetch(`${API_URL}/muebles${query}`);
    }
    if (!response.ok) {
      throw new Error('Error al obtener los muebles');
    }
    return await response.json();
  } catch (error) {
    console.error('Error en getMuebles:', error);
    return [];
  }
};

export const getMuebleById = async (id) => {
  try {
    const response = await fetch(`${API_URL}/muebles/${id}`);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Error al obtener el mueble');
    }
    return await response.json();
  } catch (error) {
    console.error('Error en getMuebleById:', error);
    return null;
  }
};

export const loginUser = async (email, password) => {
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Error al iniciar sesión');
    return data;
  } catch (error) {
    console.error('Error en loginUser:', error);
    return { error: error.message };
  }
};

export const registerUser = async (userData) => {
  try {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Error al registrar cuenta');
    return data;
  } catch (error) {
    console.error('Error en registerUser:', error);
    return { error: error.message };
  }
};

export const createMueble = async (muebleData) => {
  try {
    const isFormData = muebleData instanceof FormData;
    const headers = isFormData ? {} : { 'Content-Type': 'application/json' };
    const body = isFormData ? muebleData : JSON.stringify(muebleData);

    const response = await apiFetch(`${API_URL}/muebles`, {
      method: 'POST',
      headers,
      body
    });
    if (!response.ok) throw new Error('Error al crear el mueble');
    return await response.json();
  } catch (error) {
    console.error('Error en createMueble:', error);
    return null;
  }
};

export const updateMueble = async (id, muebleData) => {
  try {
    const isFormData = muebleData instanceof FormData;
    const headers = isFormData ? {} : { 'Content-Type': 'application/json' };
    const body = isFormData ? muebleData : JSON.stringify(muebleData);

    const response = await apiFetch(`${API_URL}/muebles/${id}`, {
      method: 'PUT',
      headers,
      body
    });
    if (!response.ok) throw new Error('Error al actualizar el mueble');
    return await response.json();
  } catch (error) {
    console.error('Error en updateMueble:', error);
    return null;
  }
};

export const deleteMueble = async (id) => {
  try {
    const response = await apiFetch(`${API_URL}/muebles/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Error al eliminar mueble');
    return await response.json();
  } catch (error) {
    console.error('Error en deleteMueble:', error);
    return null;
  }
};

// El catálogo entero en CSV, para Excel (GET /api/admin/muebles/export, con sesión de
// administrador). Devuelve { blob, nombreArchivo }, o null si falla. El nombre lo pone el servidor
// (catalogo-nave5-AAAA-MM-DD.csv), pero entre dominios distintos el navegador no deja leer esa
// cabecera si el servidor no la expone por CORS: entonces se arma aquí con el mismo formato.
export const exportarCatalogoCsv = async () => {
  try {
    const response = await apiFetch(`${API_URL}/admin/muebles/export`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Error al exportar el catálogo');
    const disposicion = response.headers.get('Content-Disposition') || '';
    const nombreArchivo =
      /filename="([^"]+)"/.exec(disposicion)?.[1] ||
      `catalogo-nave5-${new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date())}.csv`;
    return { blob: await response.blob(), nombreArchivo };
  } catch (error) {
    console.error('Error en exportarCatalogoCsv:', error);
    return null;
  }
};

// Importar el catálogo desde un CSV (POST /api/admin/muebles/import, con sesión de administrador).
// `modo` es 'preview' (solo comprueba) o 'apply' (da de alta las filas válidas). Devuelve
// { datos } con la respuesta del servidor, o { error } con un mensaje para enseñar tal cual.
export const importarCatalogoCsv = async (archivo, modo) => {
  try {
    const formulario = new FormData();
    formulario.append('modo', modo);
    formulario.append('archivo', archivo);
    const response = await apiFetch(`${API_URL}/admin/muebles/import`, {
      method: 'POST',
      body: formulario
    });
    const cuerpo = await response.json().catch(() => ({}));
    if (!response.ok) return { error: cuerpo.error || 'No se pudo importar el catálogo.' };
    return { datos: cuerpo };
  } catch (error) {
    console.error('Error en importarCatalogoCsv:', error);
    return { error: 'No se pudo conectar con el servidor. Inténtalo de nuevo.' };
  }
};

// Sin opciones: la lectura pública, cacheable, sin estadísticas.
// `fresco` es la del panel (la única que lo usa): va a GET /api/admin/categorias/con-stats, con
// sesión de administrador, que es la única que trae las estadísticas de cada categoría (H26). Esa
// ruta no se guarda en ninguna caché, y apiFetch añade la sesión y la renueva si ha caducado.
export const getCategorias = async (opciones = {}) => {
  try {
    const response = opciones.fresco
      ? await apiFetch(`${API_URL}/admin/categorias/con-stats`, { cache: 'no-store' })
      : await fetch(`${API_URL}/categorias`);
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error('Error en getCategorias:', error);
    return [];
  }
};

export const createCategoria = async (categoriaData) => {
  try {
    const isFormData = categoriaData instanceof FormData;
    const headers = isFormData ? {} : { 'Content-Type': 'application/json' };
    const body = isFormData ? categoriaData : JSON.stringify(categoriaData);

    const response = await apiFetch(`${API_URL}/categorias`, {
      method: 'POST',
      headers,
      body
    });
    if (!response.ok) throw new Error('Error al crear categoría');
    return await response.json();
  } catch (error) {
    console.error('Error en createCategoria:', error);
    return null;
  }
};

export const updateCategoria = async (id, categoriaData) => {
  try {
    const isFormData = categoriaData instanceof FormData;
    const headers = isFormData ? {} : { 'Content-Type': 'application/json' };
    const body = isFormData ? categoriaData : JSON.stringify(categoriaData);

    const response = await apiFetch(`${API_URL}/categorias/${id}`, {
      method: 'PUT',
      headers,
      body
    });
    if (!response.ok) throw new Error('Error al actualizar categoría');
    return await response.json();
  } catch (error) {
    console.error('Error en updateCategoria:', error);
    return null;
  }
};

export const deleteCategoria = async (id) => {
  try {
    const response = await apiFetch(`${API_URL}/categorias/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Error al eliminar categoría');
    return await response.json();
  } catch (error) {
    console.error('Error en deleteCategoria:', error);
    return null;
  }
};

export const buscarMuebles = async (q) => {
  try {
    const response = await fetch(`${API_URL}/muebles/buscar?q=${encodeURIComponent(q)}`);
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error('Error en buscarMuebles:', error);
    return [];
  }
};

// Login real con Google: manda el token verificado que devuelve el botón de Google
// para que el servidor compruebe la firma y abra (o cree) la sesión del cliente.
export const loginConGoogle = async (credential) => {
  try {
    const response = await fetch(`${API_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se pudo iniciar sesión con Google.');
    return data;
  } catch (error) {
    console.error('Error en loginConGoogle:', error);
    return { error: error.message };
  }
};

export const updateProfile = async (profileData) => {
  try {
    const response = await apiFetch(`${API_URL}/auth/perfil-update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profileData)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Error al actualizar perfil');
    return data;
  } catch (error) {
    console.error('Error en updateProfile:', error);
    return { error: error.message };
  }
};

// Crea una sesión de pago real de Stripe (modo test o real, según la clave del servidor)
// y devuelve la URL a la que hay que redirigir al comprador.
export const crearSesionPago = async ({ items, clienteInfo }) => {
  try {
    const response = await fetch(`${API_URL}/muebles/crear-sesion-pago`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, clienteInfo })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se pudo iniciar el pago.');
    return data;
  } catch (error) {
    console.error('Error en crearSesionPago:', error);
    return { error: error.message };
  }
};

// Confirma una sesión de Stripe tras volver del pago (se llama desde la página de éxito)
export const confirmarSesionPago = async (sessionId) => {
  try {
    const response = await fetch(`${API_URL}/muebles/confirmar-sesion?session_id=${encodeURIComponent(sessionId)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se pudo confirmar el pago.');
    return data;
  } catch (error) {
    console.error('Error en confirmarSesionPago:', error);
    return { error: error.message };
  }
};

// Lista los pedidos del cliente logueado (para su Historial de Pedidos en Mi Cuenta)
export const getMisPedidos = async () => {
  try {
    const response = await apiFetch(`${API_URL}/pedidos/mios`);
    if (!response.ok) throw new Error('Error al obtener tus pedidos');
    return await response.json();
  } catch (error) {
    console.error('Error en getMisPedidos:', error);
    return [];
  }
};

// Lista todos los pedidos para el panel de administración (nombre, dirección, teléfono,
// productos y total de cada venta, para poder prepararla y enviarla)
export const getPedidos = async () => {
  try {
    const response = await apiFetch(`${API_URL}/pedidos`);
    if (!response.ok) throw new Error('Error al obtener los pedidos');
    return await response.json();
  } catch (error) {
    console.error('Error en getPedidos:', error);
    return [];
  }
};

// Cambia el estado de un pedido (procesando / enviado / entregado / cancelado)
export const actualizarEstadoPedido = async (id, estado) => {
  try {
    const response = await apiFetch(`${API_URL}/pedidos/${id}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado })
    });
    if (!response.ok) throw new Error('Error al actualizar el estado del pedido');
    return await response.json();
  } catch (error) {
    console.error('Error en actualizarEstadoPedido:', error);
    return null;
  }
};

// Envía el formulario de "Contacto". "web" es un campo honeypot (ver contactoController).
export const enviarContacto = async ({ nombre, email, mensaje, web }) => {
  try {
    const response = await fetch(`${API_URL}/contacto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, email, mensaje, web })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se pudo enviar el mensaje.');
    return { success: true };
  } catch (error) {
    console.error('Error en enviarContacto:', error);
    return { error: error.message };
  }
};

// Mensajes del formulario de contacto, para el panel (GET /api/admin/mensajes, con sesión de
// administrador). Devuelve la lista, o null si falla (p. ej. mientras no esté creada la tabla
// mensajes_contacto en la base de datos): el panel lo distingue de "no hay ningún mensaje".
export const getMensajes = async () => {
  try {
    const response = await apiFetch(`${API_URL}/admin/mensajes`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Error al obtener los mensajes');
    return await response.json();
  } catch (error) {
    console.error('Error en getMensajes:', error);
    return null;
  }
};

// Marca un mensaje como leído (PATCH /api/admin/mensajes/:id/leido). Devuelve el mensaje
// actualizado, o null si falla.
export const marcarMensajeLeido = async (id) => {
  try {
    const response = await apiFetch(`${API_URL}/admin/mensajes/${encodeURIComponent(id)}/leido`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leido: true })
    });
    if (!response.ok) throw new Error('Error al marcar el mensaje como leído');
    return await response.json();
  } catch (error) {
    console.error('Error en marcarMensajeLeido:', error);
    return null;
  }
};
