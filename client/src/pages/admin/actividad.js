// Funciones auxiliares para la pestaña de Actividad (Audit Log)

export const obtenerResumenDetalle = (log) => {
  if (!log) return '—';
  const { accion, entidad, datos_anteriores: ant, datos_nuevos: nue, entidad_id } = log;

  if (accion === 'cambio_estado') {
    const estadoNuevo = nue?.estado || 'desconocido';
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
      const claves = Object.keys(nue);
      if (claves.includes('precio_venta') && claves.length === 1) {
        return 'Precio cambiado';
      }
      if (claves.includes('precio_venta')) {
        return 'Precio cambiado';
      }
      if (claves.includes('nombre') && claves.length === 1) {
        return `Nombre cambiado a "${nue.nombre}"`;
      }
      const ref = ant?.referencia || nue?.referencia;
      if (ref) return `Mueble ${ref}`;
      return `Campos modificados: ${claves.join(', ')}`;
    }
    return `Edición en ${entidad} #${entidad_id}`;
  }

  return `${accion} en ${entidad} #${entidad_id}`;
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
  auth: 'Auth'
};
