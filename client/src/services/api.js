const API_URL = 'http://localhost:5000/api';

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
    const response = await fetch(`${API_URL}/muebles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(muebleData)
    });
    if (!response.ok) throw new Error('Error al crear el mueble');
    return await response.json();
  } catch (error) {
    console.error('Error en createMueble:', error);
    return null;
  }
};

export const deleteMueble = async (id) => {
  try {
    const response = await fetch(`${API_URL}/muebles/${id}`, {
      method: 'DELETE'
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
    const response = await fetch(`${API_URL}/categorias`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(categoriaData)
    });
    if (!response.ok) throw new Error('Error al crear categoría');
    return await response.json();
  } catch (error) {
    console.error('Error en createCategoria:', error);
    return null;
  }
};

export const deleteCategoria = async (id) => {
  try {
    const response = await fetch(`${API_URL}/categorias/${id}`, {
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

export const updateProfile = async (profileData) => {
  try {
    const response = await fetch(`${API_URL}/auth/perfil-update`, {
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
