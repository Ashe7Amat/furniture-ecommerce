import {
  tokenParaCabecera,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
  limpiarTokens,
  avisarCierreDeSesion
} from '../utils/authToken';
import { peticion, comoContratoA } from './peticion';

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

// H18: la renovación trae también la cuenta tal como está ahora (`user`), p. ej. con el email ya
// confirmado desde otra pestaña o dispositivo. AuthContext se apunta aquí para recibirla.
let avisoUsuarioRenovado = null;
export const alRenovarUsuarioAvisar = (funcion) => {
  avisoUsuarioRenovado = funcion;
};

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
    if (par.user && avisoUsuarioRenovado) avisoUsuarioRenovado(par.user);
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

// Las escrituras del panel (contrato A de H12): pasan por el núcleo común (services/peticion.js)
// y devuelven lo de siempre: el cuerpo si va bien, null si falla. El motivo del error se anota en la
// consola, y el panel podrá enseñarlo cuando se migre al formato { data, error, status }.
const escrituraContratoA = async (nombre, url, opciones, mensajeError) => {
  const resultado = await peticion(apiFetch, url, opciones, mensajeError);
  if (resultado.error) console.error(`Error en ${nombre}:`, resultado.error);
  return comoContratoA(resultado);
};

// Cuerpo de una escritura: un FormData (con fotos) va tal cual; lo demás, como JSON.
const cuerpoDe = (datos) =>
  datos instanceof FormData
    ? { headers: {}, body: datos }
    : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) };

export const createMueble = (muebleData) =>
  escrituraContratoA('createMueble', `${API_URL}/muebles`, { method: 'POST', ...cuerpoDe(muebleData) }, 'Error al crear el mueble');

export const updateMueble = (id, muebleData) =>
  escrituraContratoA('updateMueble', `${API_URL}/muebles/${id}`, { method: 'PUT', ...cuerpoDe(muebleData) }, 'Error al actualizar el mueble');

export const deleteMueble = (id) =>
  escrituraContratoA('deleteMueble', `${API_URL}/muebles/${id}`, { method: 'DELETE' }, 'Error al eliminar mueble');

// Duplicar una pieza desde el inventario (POST /api/muebles/:id/duplicar, con sesión de
// administrador). Ya con el formato de peticion.js, { data, error, status }, para que el panel
// pueda enseñar el motivo del servidor (p. ej. el 409 de la referencia): la pieza nueva viene en
// data.data[0].
export const duplicarMueble = (id) =>
  peticion(apiFetch, `${API_URL}/muebles/${id}/duplicar`, { method: 'POST' }, 'No se pudo duplicar la pieza.');

// Un CSV del panel, para Excel (GET a una ruta de /api/admin, con sesión de administrador).
// Devuelve { blob, nombreArchivo } y lanza si el servidor responde con error. El nombre lo pone el
// servidor (<prefijo>-AAAA-MM-DD.csv), pero entre dominios distintos el navegador no deja leer esa
// cabecera si el servidor no la expone por CORS: entonces se arma aquí con el mismo formato.
const pedirCsvDelPanel = async (ruta, prefijo) => {
  const response = await apiFetch(`${API_URL}${ruta}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Error al pedir ${ruta}`);
  const disposicion = response.headers.get('Content-Disposition') || '';
  const nombreArchivo =
    /filename="([^"]+)"/.exec(disposicion)?.[1] ||
    `${prefijo}-${new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date())}.csv`;
  return { blob: await response.blob(), nombreArchivo };
};

// El catálogo entero en CSV (GET /api/admin/muebles/export). { blob, nombreArchivo }, o null si falla.
export const exportarCatalogoCsv = async () => {
  try {
    return await pedirCsvDelPanel('/admin/muebles/export', 'catalogo-nave5');
  } catch (error) {
    console.error('Error en exportarCatalogoCsv:', error);
    return null;
  }
};

// Las cuentas de clientes en CSV (GET /api/admin/clientes/export): id, email, nombre, rol y fecha
// de alta. { blob, nombreArchivo }, o null si falla.
export const exportarClientesCsv = async () => {
  try {
    return await pedirCsvDelPanel('/admin/clientes/export', 'clientes-nave5');
  } catch (error) {
    console.error('Error en exportarClientesCsv:', error);
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

export const createCategoria = (categoriaData) =>
  escrituraContratoA('createCategoria', `${API_URL}/categorias`, { method: 'POST', ...cuerpoDe(categoriaData) }, 'Error al crear categoría');

export const updateCategoria = (id, categoriaData) =>
  escrituraContratoA('updateCategoria', `${API_URL}/categorias/${id}`, { method: 'PUT', ...cuerpoDe(categoriaData) }, 'Error al actualizar categoría');

export const deleteCategoria = (id) =>
  escrituraContratoA('deleteCategoria', `${API_URL}/categorias/${id}`, { method: 'DELETE' }, 'Error al eliminar categoría');

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

// H18: confirma el email con el token del enlace del correo (POST /api/auth/verificar-email). No
// pide sesión: el enlace se puede abrir en cualquier navegador. Devuelve la respuesta del servidor
// ({ success, motivo, user, sesionCerrada }) o { error }.
export const verificarEmail = async (token) => {
  try {
    const response = await fetch(`${API_URL}/auth/verificar-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'El enlace no es válido o ha caducado.');
    return data;
  } catch (error) {
    console.error('Error en verificarEmail:', error);
    return { error: error.message };
  }
};

// H18: pide otro correo para confirmar el email (o el email pendiente de un cambio). Con sesión.
export const reenviarVerificacion = async () => {
  try {
    const response = await apiFetch(`${API_URL}/auth/reenviar-verificacion`, { method: 'POST' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se ha podido enviar el correo.');
    return data;
  } catch (error) {
    console.error('Error en reenviarVerificacion:', error);
    return { error: error.message };
  }
};

export const solicitarRecuperacionPassword = async (email) => {
  try {
    const response = await fetch(`${API_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Error al solicitar recuperación de contraseña.');
    return data;
  } catch (error) {
    console.error('Error en solicitarRecuperacionPassword:', error);
    return { error: error.message };
  }
};

export const restablecerPassword = async (token, newPassword) => {
  try {
    const response = await fetch(`${API_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Error al restablecer contraseña.');
    return data;
  } catch (error) {
    console.error('Error en restablecerPassword:', error);
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

// Lista los pedidos del cliente logueado (para su Historial de Pedidos en Mi Cuenta). H18: si la
// cuenta no ha confirmado su email, el servidor responde 403 y aquí se devuelve
// { sinVerificar: true } para que la página enseñe el aviso en vez de la lista.
export const getMisPedidos = async () => {
  try {
    const response = await apiFetch(`${API_URL}/pedidos/mios`);
    if (response.status === 403) {
      const data = await response.json().catch(() => ({}));
      if (data.codigo === 'email_no_verificado') return { sinVerificar: true };
    }
    if (!response.ok) throw new Error('Error al obtener tus pedidos');
    return await response.json();
  } catch (error) {
    console.error('Error en getMisPedidos:', error);
    return [];
  }
};

// Una página de pedidos para el panel de administración (nombre, dirección, teléfono, productos y
// total de cada venta, para poder prepararla y enviarla). H37: antes traía toda la historia de
// golpe. Devuelve { pedidos, total, pagina, porPagina, totalPaginas, pendientes }, con `total` el
// de ese filtro y `pendientes` los "procesando" de toda la historia; o null si falla.
export const getPedidos = async ({ pagina = 1, estado = '' } = {}) => {
  try {
    const params = new URLSearchParams({ page: String(pagina) });
    if (estado) params.set('estado', estado);
    const response = await apiFetch(`${API_URL}/pedidos?${params}`);
    if (!response.ok) throw new Error('Error al obtener los pedidos');
    return await response.json();
  } catch (error) {
    console.error('Error en getPedidos:', error);
    return null;
  }
};

// Cambia el estado de un pedido (procesando / enviado / entregado / cancelado)
export const actualizarEstadoPedido = (id, estado) =>
  escrituraContratoA(
    'actualizarEstadoPedido',
    `${API_URL}/pedidos/${id}/estado`,
    { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado }) },
    'Error al actualizar el estado del pedido'
  );

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

// ─── Reservas por fechas (docs/reservas-diseno.md) ──────────────────────────────────────────────
// Todas devuelven { data, error, status } (services/peticion.js) y nunca lanzan: quien llama enseña
// el motivo que da el servidor (una regla del alquiler, unas fechas que se acaban de ocupar...) y
// distingue por `status` un 409 (volver a cargar el calendario). Las del cliente con sesión añaden
// `codigo` cuando el error lo trae: un 403 'email_no_verificado' no es el 403 del alquiler cerrado.
// Las públicas van con fetch, sin sesión; el servidor responde no-store, así que nada se cachea.
const publica = (url, opciones) => fetch(url, opciones);
// Con sesión, como peticion() con apiFetch, más el `codigo` del error si viene. Se lee del mismo
// cuerpo que luego lee peticion(): la respuesta se le pasa con ese cuerpo ya leído.
const conCodigo = async (url, opciones, mensajeError) => {
  let codigo = null;
  const transporte = async (u, o) => {
    const response = await apiFetch(u, o);
    if (response.ok) return response;
    const cuerpo = await response.json().catch(() => null);
    if (typeof cuerpo?.codigo === 'string' && cuerpo.codigo) codigo = cuerpo.codigo;
    return { ok: false, status: response.status, json: async () => cuerpo };
  };
  const resultado = await peticion(transporte, url, opciones, mensajeError);
  return codigo ? { ...resultado, codigo } : resultado;
};
const jsonPost = (datos) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(datos ?? {})
});
const consulta = (parametros) => {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(parametros)) {
    if (valor !== undefined && valor !== null && valor !== '') params.set(clave, valor);
  }
  const texto = params.toString();
  return texto ? `?${texto}` : '';
};

// Calendario de una pieza: lo ocupado, las reglas y si se puede comprar (GET /api/muebles/:id/disponibilidad).
export const getDisponibilidad = (muebleId, { desde, hasta } = {}) =>
  peticion(
    publica,
    `${API_URL}/muebles/${encodeURIComponent(muebleId)}/disponibilidad${consulta({ desde, hasta })}`,
    { cache: 'no-store' },
    'No se ha podido consultar la disponibilidad.'
  );

// Precio de unas fechas, calculado por el servidor (GET /api/muebles/:id/presupuesto).
export const getPresupuestoReserva = (muebleId, seleccion) =>
  peticion(
    publica,
    `${API_URL}/muebles/${encodeURIComponent(muebleId)}/presupuesto${consulta({
      fecha_inicio: seleccion.fecha_inicio,
      hora_entrega: seleccion.hora_entrega,
      fecha_fin: seleccion.fecha_fin,
      hora_recogida: seleccion.hora_recogida,
      entrega: seleccion.entrega,
      recogida: seleccion.recogida
    })}`,
    { cache: 'no-store' },
    'No se ha podido calcular el precio.'
  );

// Crea la reserva provisional y devuelve { url } de la página de pago de Stripe (con sesión).
export const crearSesionPagoReserva = (datos) =>
  conCodigo(`${API_URL}/reservas/sesion-pago`, jsonPost(datos), 'No se pudo iniciar el pago.');

// Sigue con el pago de una reserva a medio pagar: la URL de la página de pago que ya tenía abierta (con
// sesión y el email confirmado). Con 409 ya no se puede pagar (plazo terminado o pago recibido).
export const retomarPagoReserva = (id) =>
  conCodigo(
    `${API_URL}/reservas/${encodeURIComponent(id)}/retomar-pago`,
    jsonPost({}),
    'No se pudo retomar el pago.'
  );

// Las reservas del cliente, para "Mis reservas" (con sesión y el email confirmado).
export const getMisReservas = () =>
  conCodigo(`${API_URL}/reservas/mias`, { cache: 'no-store' }, 'No se han podido cargar tus reservas.');

// Pide al administrador que cancele una reserva (no la cancela: en la primera versión cancela él).
export const solicitarCancelacionReserva = (id, motivo) =>
  conCodigo(
    `${API_URL}/reservas/${encodeURIComponent(id)}/solicitar-cancelacion`,
    jsonPost({ motivo }),
    'No se ha podido enviar la solicitud.'
  );

// Panel: la lista de reservas de una vista (proximas, entregas, recogidas, retrasadas, conflicto,
// legacy o todas), con los datos de contacto que hacen falta para entregar y recoger. Con `q` (cliente,
// pieza o referencia) o con `desde` y `hasta` (AAAA-MM-DD) es una búsqueda en todas las reservas, y la
// vista no cuenta.
export const getReservasAdmin = ({ vista = 'proximas', muebleId, q, desde, hasta } = {}) =>
  peticion(
    apiFetch,
    `${API_URL}/admin/reservas${consulta({ vista, mueble_id: muebleId, q, desde, hasta })}`,
    { cache: 'no-store' },
    'No se han podido cargar las reservas.'
  );

// Panel: cuántas reservas piden atención (retrasadas, pagadas sin confirmar y reembolsos a medias),
// para la insignia del menú: { hoy, total, retrasadas, en_conflicto, reembolsos_a_medias }.
export const getResumenReservasAdmin = () =>
  peticion(
    apiFetch,
    `${API_URL}/admin/reservas/resumen`,
    { cache: 'no-store' },
    'No se han podido cargar los avisos de reservas.'
  );

// Panel: las entregas y recogidas de hoy y mañana en una sola lista por día y hora, para organizar la
// ruta y llamar sin abrir cada reserva: { hoy, manana, trayectos }.
export const getAgendaReservasAdmin = () =>
  peticion(
    apiFetch,
    `${API_URL}/admin/reservas/agenda`,
    { cache: 'no-store' },
    'No se ha podido cargar la agenda de hoy y mañana.'
  );

// Panel: lo que ocupa las piezas entre dos días (AAAA-MM-DD, los dos incluidos, hasta 100 días), con el
// margen, y las retrasadas, para el calendario de una pieza y la vista general:
// { hoy, desde, hasta, reservas, limitada }.
export const getCalendarioReservasAdmin = ({ desde, hasta, muebleId } = {}) =>
  peticion(
    apiFetch,
    `${API_URL}/admin/reservas/calendario${consulta({ desde, hasta, mueble_id: muebleId })}`,
    { cache: 'no-store' },
    'No se ha podido cargar el calendario de reservas.'
  );

// Panel: una acción sobre una reserva (entregar, recoger, ampliar, cancelar, reintentar-reembolso,
// dar-por-reembolsado, levantar-bloqueo), con sus datos. Con `codigo` si el error lo trae: un 409
// 'entrega_anticipada' o 'reembolso_no_consta' pide confirmar, cualquier otro 409 es una lista que ya
// no está al día, y un 502 'reembolso_a_medias' es una acción hecha cuyo reembolso quedó a medias.
export const accionReservaAdmin = (id, accion, datos) =>
  conCodigo(
    `${API_URL}/admin/reservas/${encodeURIComponent(id)}/${accion}`,
    jsonPost(datos),
    'No se ha podido completar la acción.'
  );

// Panel: altas en el calendario sin pago web: un bloqueo, un alquiler pactado fuera de la web o una
// venta fuera de la web (o con entrega diferida).
export const crearEnCalendarioAdmin = (tipo, datos) =>
  peticion(
    apiFetch,
    `${API_URL}/admin/reservas/${{ bloqueo: 'bloqueos', alquiler: 'alquileres', venta: 'ventas' }[tipo]}`,
    jsonPost(datos),
    'No se ha podido guardar en el calendario.'
  );

// Panel: consulta del registro de actividad (audit log) con filtros y paginación
export const getAuditLogs = async ({ entidad = '', accion = '', admin_email = '', fecha = '', page = 1, limit = 50 } = {}) => {
  try {
    const params = new URLSearchParams();
    if (entidad) params.set('entidad', entidad);
    if (accion) params.set('accion', accion);
    if (admin_email) params.set('admin_email', admin_email);
    if (fecha) params.set('fecha', fecha);
    if (page) params.set('page', String(page));
    if (limit) params.set('limit', String(limit));
    const qs = params.toString() ? `?${params.toString()}` : '';
    const response = await apiFetch(`${API_URL}/admin/audit-log${qs}`);
    if (!response.ok) throw new Error('Error al obtener registro de actividad');
    return await response.json();
  } catch (error) {
    console.error('Error en getAuditLogs:', error);
    return null;
  }
};

// Panel: las métricas del dashboard (GET /api/admin/dashboard/metricas): ticket medio, ventas de los
// últimos 6 meses, top de categorías y clientes. El objeto del servidor, o null si falla.
export const getMetricasDashboard = async () => {
  try {
    const response = await apiFetch(`${API_URL}/admin/dashboard/metricas`);
    if (!response.ok) throw new Error('Error al obtener las métricas del dashboard');
    return await response.json();
  } catch (error) {
    console.error('Error en getMetricasDashboard:', error);
    return null;
  }
};

// Ajustes de portada (Hero y Destacados)
export const getAjustesHome = async () => {
  try {
    const response = await fetch(`${API_URL}/ajustes/home`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Error al obtener ajustes de portada');
    return await response.json();
  } catch (error) {
    console.error('Error en getAjustesHome:', error);
    return null;
  }
};

export const actualizarAjustesHome = async (datos) => {
  try {
    const response = await apiFetch(`${API_URL}/admin/ajustes/home`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Error al actualizar ajustes de portada');
    }
    return await response.json();
  } catch (error) {
    console.error('Error en actualizarAjustesHome:', error);
    return null;
  }
};

export const subirImagenHero = async (file) => {
  try {
    const formData = new FormData();
    formData.append('imagen', file);
    const response = await apiFetch(`${API_URL}/admin/ajustes/home/imagen`, {
      method: 'POST',
      body: formData
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Error al subir imagen de portada');
    }
    const data = await response.json();
    return typeof data?.url === 'string' ? data.url : (data || null);
  } catch (error) {
    console.error('Error en subirImagenHero:', error);
    return null;
  }
};


