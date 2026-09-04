const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Cabecera de sesión: se añade sola en cuanto hay un usuario logueado con token
const authHeaders = () => {
  const token = localStorage.getItem('kaveToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const getMuebles = async () => {
  try {
    const response = await fetch(`${API_URL}/muebles`);
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
    const headers = { ...authHeaders(), ...(isFormData ? {} : { 'Content-Type': 'application/json' }) };
    const body = isFormData ? muebleData : JSON.stringify(muebleData);

    const response = await fetch(`${API_URL}/muebles`, {
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
    const headers = { ...authHeaders(), ...(isFormData ? {} : { 'Content-Type': 'application/json' }) };
    const body = isFormData ? muebleData : JSON.stringify(muebleData);

    const response = await fetch(`${API_URL}/muebles/${id}`, {
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
    const response = await fetch(`${API_URL}/muebles/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    if (!response.ok) throw new Error('Error al eliminar mueble');
    return await response.json();
  } catch (error) {
    console.error('Error en deleteMueble:', error);
    return null;
  }
};

export const getCategorias = async () => {
  try {
    const response = await fetch(`${API_URL}/categorias`);
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
    const headers = { ...authHeaders(), ...(isFormData ? {} : { 'Content-Type': 'application/json' }) };
    const body = isFormData ? categoriaData : JSON.stringify(categoriaData);

    const response = await fetch(`${API_URL}/categorias`, {
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
    const headers = { ...authHeaders(), ...(isFormData ? {} : { 'Content-Type': 'application/json' }) };
    const body = isFormData ? categoriaData : JSON.stringify(categoriaData);

    const response = await fetch(`${API_URL}/categorias/${id}`, {
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
    const response = await fetch(`${API_URL}/categorias/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
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
    const response = await fetch(`${API_URL}/auth/perfil-update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
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

// Compra "de respaldo" (sin pasarela real) — se mantiene por compatibilidad, pero el
// checkout ahora usa crearSesionPago() más abajo.
export const checkoutCart = async (checkoutData) => {
  try {
    const response = await fetch(`${API_URL}/muebles/comprar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(checkoutData)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Error al procesar el pago');
    return data;
  } catch (error) {
    console.error('Error en checkoutCart:', error);
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
    const response = await fetch(`${API_URL}/pedidos/mios`, { headers: authHeaders() });
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
    const response = await fetch(`${API_URL}/pedidos`, { headers: authHeaders() });
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
    const response = await fetch(`${API_URL}/pedidos/${id}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ estado })
    });
    if (!response.ok) throw new Error('Error al actualizar el estado del pedido');
    return await response.json();
  } catch (error) {
    console.error('Error en actualizarEstadoPedido:', error);
    return null;
  }
};
