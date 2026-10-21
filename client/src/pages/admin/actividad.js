// Funciones auxiliares para la pestaña de Actividad (Audit Log)

export const CAMPOS_IGNORADOS = new Set([
  'id',
  'created_at',
  'updated_at',
  'categoria_id',
  'disponible',
  'stripe_session_id',
  'pedido_id'
]);

export const DICCIONARIO_CAMPOS = {
  nombre: 'Nombre',
  referencia: 'Referencia',
  categoria: 'Categoría',
  descripcion: 'Descripción',
  estado: 'Estado',
  precio_venta: 'Precio de venta',
  precio_alquiler_dia: 'Precio alquiler/día',
  precio_alquiler: 'Precio alquiler/día',
  imagenes: 'Fotografías',
  fotos: 'Fotografías',
  email: 'Email',
  rol: 'Rol',
  total: 'Total',
  items: 'Artículos',
  codigo: 'Código',
  imagen_url: 'Fotografía',
  cliente_info: 'Datos del cliente',
  direccion_envio: 'Dirección de envío',
  mensaje: 'Mensaje'
};

export const traducirCampo = (campo) => {
  if (DICCIONARIO_CAMPOS[campo]) return DICCIONARIO_CAMPOS[campo];
  return campo.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
};

export const ETIQUETAS_ACCION = {
  crear: 'Crear',
  editar: 'Editar',
  eliminar: 'Eliminar',
  duplicar: 'Duplicar',
  cambio_estado: 'Cambio de estado',
  login: 'Inicio de sesión'
};

export const ETIQUETAS_ENTIDAD = {
  muebles: 'Mueble',
  mueble: 'Mueble',
  categorias: 'Categoría',
  categoria: 'Categoría',
  pedidos: 'Pedido',
  pedido: 'Pedido',
  auth: 'Autenticación'
};

export const formatearValor = (campo, valor, esDatoNuevo = false, accion = '') => {
  if (accion === 'eliminar' && esDatoNuevo) {
    return 'Eliminado';
  }
  if (valor === null || valor === undefined || valor === '') {
    return '—';
  }
  if (typeof valor === 'boolean') {
    return valor ? 'Sí' : 'No';
  }
  if (Array.isArray(valor)) {
    if (valor.length === 0) return 'Ninguna';
    if (campo === 'imagenes' || campo === 'fotos') {
      return `${valor.length} ${valor.length === 1 ? 'foto' : 'fotos'}`;
    }
    return `${valor.length} ${valor.length === 1 ? 'elemento' : 'elementos'}`;
  }
  if (
    campo === 'precio_venta' ||
    campo === 'precio_alquiler_dia' ||
    campo === 'precio_alquiler' ||
    campo === 'total'
  ) {
    const num = Number(valor);
    if (!isNaN(num)) {
      return `${num} €`;
    }
  }
  if (campo === 'estado' && typeof valor === 'string') {
    const ESTADOS = {
      disponible: 'Disponible',
      vendido: 'Vendido',
      alquilado: 'Alquilado',
      procesando: 'Procesando',
      enviado: 'Enviado',
      entregado: 'Entregado',
      cancelado: 'Cancelado'
    };
    if (ESTADOS[valor.toLowerCase()]) return ESTADOS[valor.toLowerCase()];
  }
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/.test(valor)) {
    const fecha = new Date(valor);
    if (!isNaN(fecha.getTime())) {
      return fecha.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    }
  }
  if (typeof valor === 'object') {
    try {
      return JSON.stringify(valor);
    } catch {
      return String(valor);
    }
  }
  return String(valor);
};

export const construirMensajeBorrado = (log) => {
  if (!log) return '';
  const email = log.admin_email || 'Sistema';
  const entidadTexto = ETIQUETAS_ENTIDAD[log.entidad] || log.entidad;
  const ant = log.datos_anteriores || {};
  const nombre = ant.nombre || log.entidad_id || '—';
  const ref = ant.referencia;

  if (ref) {
    return `El administrador ${email} eliminó ${entidadTexto} con nombre: ${nombre} y referencia ${ref}.`;
  }
  return `El administrador ${email} eliminó ${entidadTexto} con nombre: ${nombre}.`;
};

export const hayCambiosRelevantes = (log) => {
  if (!log) return false;
  if (log.accion === 'eliminar') return true;
  const ant = log.datos_anteriores;
  const nue = log.datos_nuevos;
  const claves = Array.from(
    new Set([...(ant ? Object.keys(ant) : []), ...(nue ? Object.keys(nue) : [])])
  ).filter((c) => !CAMPOS_IGNORADOS.has(c));
  return claves.length > 0;
};

export const obtenerResumenDetalle = (log) => {
  if (!log) return '—';
  const { accion, entidad, datos_anteriores: ant, datos_nuevos: nue, entidad_id } = log;

  if (accion === 'cambio_estado') {
    const estadoNuevo = formatearValor('estado', nue?.estado || 'desconocido');
    return `Estado cambiado a ${estadoNuevo}`;
  }

  if (accion === 'login') {
    return `Inicio de sesión (${nue?.email || log.admin_email || 'usuario'})`;
  }

  if (accion === 'crear') {
    const ref = nue?.referencia ? ` ${nue.referencia}` : '';
    const nom = nue?.nombre ? ` "${nue.nombre}"` : '';
    if (entidad === 'muebles' || entidad === 'mueble') return `Mueble${ref || nom || ` #${entidad_id}`}`;
    if (entidad === 'categorias' || entidad === 'categoria') return `Categoría${nom || ` #${entidad_id}`}`;
    return `Elemento creado #${entidad_id}`;
  }

  if (accion === 'duplicar') {
    const nom = nue?.nombre ? ` "${nue.nombre}"` : '';
    return `Mueble duplicado${nom || ` #${entidad_id}`}`;
  }

  if (accion === 'eliminar') {
    const ref = ant?.referencia ? ` ${ant.referencia}` : '';
    const nom = ant?.nombre ? ` "${ant.nombre}"` : '';
    if (entidad === 'muebles' || entidad === 'mueble') return `Mueble eliminado${ref || nom || ` #${entidad_id}`}`;
    if (entidad === 'categorias' || entidad === 'categoria') return `Categoría eliminada${nom || ` #${entidad_id}`}`;
    return `Elemento eliminado #${entidad_id}`;
  }

  if (accion === 'editar') {
    if (nue) {
      const claves = Object.keys(nue).filter((c) => !CAMPOS_IGNORADOS.has(c));
      if (claves.length === 0) {
        return `Edición en ${entidad} #${entidad_id}`;
      }
      if (claves.includes('precio_venta')) {
        const pAnt = ant?.precio_venta !== undefined ? `${ant.precio_venta} €` : '—';
        const pNue = `${nue.precio_venta} €`;
        return `Precio de venta: ${pAnt} -> ${pNue}`;
      }
      if (claves.includes('nombre') && claves.length === 1) {
        return `Nombre cambiado a "${nue.nombre}"`;
      }
      const ref = ant?.referencia || nue?.referencia;
      if (ref) return `Mueble ${ref}`;
      return `Campos modificados: ${claves.map(traducirCampo).join(', ')}`;
    }
    return `Edición en ${entidad} #${entidad_id}`;
  }

  return `${accion} en ${entidad} #${entidad_id}`;
};
