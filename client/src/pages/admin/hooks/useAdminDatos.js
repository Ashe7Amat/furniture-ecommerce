import { useState, useEffect, useRef } from 'react';
import { getMuebles, getCategorias, getPedidos, getMensajes } from '../../../services/api';

// Los listados del panel y cómo se recargan. Viven en el contenedor (Admin.jsx) porque los usan
// varias pestañas y las insignias de la barra lateral (pedidos pendientes, mensajes sin leer).
// H37: los pedidos llegan por páginas, ya filtrados por estado en el servidor. `infoPedidos` guarda
// lo que no está en la página: el total de ese filtro, la página y los pendientes de toda la
// historia (la insignia y el Resumen no pueden contarlos solo con la página que se ve).
const SIN_PEDIDOS = { total: 0, pagina: 1, totalPaginas: 1, pendientes: 0 };

const useAdminDatos = (user, filtroEstadoPedido = '') => {
  const [muebles, setMuebles] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [infoPedidos, setInfoPedidos] = useState(SIN_PEDIDOS);
  const paginaPedidos = useRef(1);
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

  // Sin página (el botón "Actualizar" pasa el evento del clic), vuelve a pedir la que se ve.
  const cargarPedidos = async (opciones) => {
    const pagina = Number.isInteger(opciones?.pagina) ? opciones.pagina : paginaPedidos.current;
    const data = await getPedidos({ pagina, estado: filtroEstadoPedido });
    setPedidos(Array.isArray(data?.pedidos) ? data.pedidos : []);
    paginaPedidos.current = data?.pagina || pagina;
    setInfoPedidos(data && Array.isArray(data.pedidos) ? {
      total: data.total ?? 0,
      pagina: data.pagina || pagina,
      totalPaginas: data.totalPaginas || 1,
      pendientes: data.pendientes ?? 0
    } : SIN_PEDIDOS);
  };

  // Tras cambiar el estado de un pedido sin recargar (PedidosTab): los pendientes suben o bajan
  // uno, y con un filtro puesto, un pedido que sale de ese estado deja de contar en el total.
  const ajustarTrasCambioDeEstado = (antes, despues) => {
    setInfoPedidos(info => ({
      ...info,
      pendientes: Math.max(0, info.pendientes + (despues === 'procesando' ? 1 : 0) - (antes === 'procesando' ? 1 : 0)),
      total: filtroEstadoPedido && antes === filtroEstadoPedido && despues !== filtroEstadoPedido
        ? Math.max(0, info.total - 1)
        : info.total
    }));
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
      cargarMensajes();
    }
  }, [user]);

  // Los pedidos, también al cambiar el filtro de estado: se vuelve a la primera página. Como arriba,
  // lo que se vigila es el usuario y el filtro; cargarPedidos se redefine en cada render.
  useEffect(() => {
    if (user) cargarPedidos({ pagina: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, filtroEstadoPedido]);

  return {
    muebles, categorias, pedidos, setPedidos, cargarMuebles, cargarCategorias, cargarPedidos,
    infoPedidos, ajustarTrasCambioDeEstado,
    mensajes, setMensajes, errorMensajes, cargarMensajes
  };
};

export default useAdminDatos;
