import { useState, useEffect } from 'react';
import { getMuebles, getCategorias, getPedidos } from '../../../services/api';

// Los tres listados del panel y cómo se recargan. Viven en el contenedor (Admin.jsx) porque los
// usan varias pestañas y la insignia de pedidos pendientes de la barra lateral.
const useAdminDatos = (user) => {
  const [muebles, setMuebles] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [pedidos, setPedidos] = useState([]);

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

  // Solo debe recargarse cuando cambia el usuario (login/logout), no en cada render --
  // las tres funciones se redefinen en cada render pero no son las que queremos vigilar.
  useEffect(() => {
    if (user) {
      cargarCategorias();
      cargarMuebles();
      cargarPedidos();
    }
  }, [user]);

  return { muebles, categorias, pedidos, setPedidos, cargarMuebles, cargarCategorias, cargarPedidos };
};

export default useAdminDatos;
