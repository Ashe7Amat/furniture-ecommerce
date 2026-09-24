// Mutantes de lo que se conserva al cambiar de pestaña (ver scripts/mutantes-panel.js). Simulan lo
// que haría un refactor que moviera ese estado a cada pestaña: se perdería al salir de ella.
export const TEST = 'src/pages/Admin.navegacion.test.jsx';

export const MUTANTES = [
  {
    nombre: 'caso B: la recarga de categorías pisa la que había elegido el usuario',
    buscar: 'if (especificas.length > 0 && !formData.categoria) {',
    reemplazo: 'if (especificas.length > 0) {'
  },
  {
    nombre: 'caso C: tras crear un mueble, las recargas ya no vuelven a preseleccionar',
    buscar: 'if (especificas.length > 0 && !formData.categoria) {',
    reemplazo: 'if (false) {'
  },
  {
    nombre: 'volver al inventario borra la búsqueda',
    buscar: "onClick={() => setVistaActiva('inventario')}>",
    reemplazo: "onClick={() => { setVistaActiva('inventario'); setBusqueda(''); }}>"
  },
  {
    nombre: 'volver al inventario vuelve a la página 1',
    buscar: "onClick={() => setVistaActiva('inventario')}>",
    reemplazo: "onClick={() => { setVistaActiva('inventario'); setPagina(1); }}>"
  },
  {
    nombre: 'ir al resumen vacía la selección del inventario',
    buscar: "onClick={() => setVistaActiva('resumen')}>",
    reemplazo: "onClick={() => { setVistaActiva('resumen'); setSeleccionados([]); }}>"
  },
  {
    nombre: 'volver a "Añadir mueble" vacía el nombre',
    buscar: "onClick={() => setVistaActiva('crear')}>",
    reemplazo: "onClick={() => { setVistaActiva('crear'); setFormData(f => ({ ...f, nombre: '' })); }}>"
  },
  {
    nombre: 'volver a "Añadir mueble" olvida las fotos elegidas',
    buscar: "onClick={() => setVistaActiva('crear')}>",
    reemplazo: "onClick={() => { setVistaActiva('crear'); setFiles([]); }}>"
  },
  {
    nombre: 'volver a categorías vacía el nombre de la nueva',
    buscar: "onClick={() => setVistaActiva('categorias')}>",
    reemplazo: "onClick={() => { setVistaActiva('categorias'); setNuevaCat(''); }}>"
  },
  {
    nombre: 'volver a pedidos quita el filtro',
    buscar: "onClick={() => setVistaActiva('pedidos')}>",
    reemplazo: "onClick={() => { setVistaActiva('pedidos'); setFiltroEstadoPedido(''); }}>"
  },
  {
    nombre: 'el botón de pedidos no se marca como activo',
    buscar: "className={`sidebar-btn ${vistaActiva === 'pedidos' ? 'active' : ''}`}",
    reemplazo: 'className="sidebar-btn"'
  },
  {
    nombre: 'H14: un fallo del modal limpia el mensaje de estado',
    buscar: "      setStatus('Error al actualizar.');\n      showToast('Error al actualizar el producto', 'error');",
    reemplazo: "      setStatus('');\n      showToast('Error al actualizar el producto', 'error');"
  }
];
