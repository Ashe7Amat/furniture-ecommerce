import { useState, useEffect } from 'react';
import { getMuebles, getCategorias, getPedidos, getMensajes } from '../../../services/api';

// Los listados del panel y cómo se recargan. Viven en el contenedor (Admin.jsx) porque los usan
// varias pestañas y las insignias de la barra lateral (pedidos pendientes, mensajes sin leer).
const useAdminDatos = (user) => {
  const [muebles, setMuebles] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [mensajes, setMensajes] = useState([]);
  // true si la última carga de mensajes falló (p. ej. sin la tabla mensajes_contacto): la pestaña
  // lo dice en vez de enseñar una lista vacía como si no hubiera ninguno.
  const [errorMensajes, setErrorMensajes] = useState(false);

  // `fresco`: el panel tiene que ver al momento lo que acaba de guardar, sin las cachés que sí
  // usa el catálogo público (ver getMuebles en services/api.js).
  const cargarMuebles = async () => {
    const data = await getMuebles({ fresco: true });
    setMuebles(data);
  };

  const cargarCategorias = async () => {
    const data = await getCategorias({ fresco: true });
    setCategorias(data);
  };

  const cargarPedidos = async () => {
    const data = await getPedidos();
    setPedidos(Array.isArray(data) ? data : []);
  };

  const cargarMensajes = async () => {
    const data = await getMensajes();
    setErrorMensajes(!Array.isArray(data));
    setMensajes(Array.isArray(data) ? data : []);
  };

  // Solo debe recargarse cuando cambia el usuario (login/logout), no en cada render --
  // las funciones se redefinen en cada render pero no son las que queremos vigilar.
  useEffect(() => {
    if (user) {
      cargarCategorias();
      cargarMuebles();
      cargarPedidos();
      cargarMensajes();
    }
  }, [user]);

  return {
    muebles, categorias, pedidos, setPedidos, cargarMuebles, cargarCategorias, cargarPedidos,
    mensajes, setMensajes, errorMensajes, cargarMensajes
  };
};

export default useAdminDatos;
