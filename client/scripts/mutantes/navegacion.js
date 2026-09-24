// Mutantes de lo que se conserva al cambiar de pestaña (ver scripts/mutantes-panel.js). Simulan lo
// que haría un refactor que moviera ese estado a cada pestaña: se perdería al salir de ella.
export const TEST = 'src/pages/Admin.navegacion.test.jsx';

export const MUTANTES = [
  {
    nombre: 'caso B: la recarga de categorías pisa la que había elegido el usuario',
    archivo: 'src/pages/Admin.jsx',
    buscar: 'if (especifica && !formData.categoria) {',
    reemplazo: 'if (especifica) {'
  },
  {
    nombre: 'caso C: tras crear un mueble, las recargas ya no vuelven a preseleccionar',
    archivo: 'src/pages/Admin.jsx',
    buscar: 'if (especifica && !formData.categoria) {',
    reemplazo: 'if (false) {'
  },
  {
    nombre: 'volver al inventario borra la búsqueda',
    archivo: 'src/pages/Admin.jsx',
    buscar: 'onClick={() => setVistaActiva(pestana.id)}>',
    reemplazo: "onClick={() => { setVistaActiva(pestana.id); if (pestana.id === 'inventario') vista.setBusqueda(''); }}>"
  },
  {
    nombre: 'volver al inventario vuelve a la página 1',
    archivo: 'src/pages/Admin.jsx',
    buscar: 'onClick={() => setVistaActiva(pestana.id)}>',
    reemplazo: "onClick={() => { setVistaActiva(pestana.id); if (pestana.id === 'inventario') vista.setPagina(1); }}>"
  },
  {
    nombre: 'ir al resumen vacía la selección del inventario',
    archivo: 'src/pages/Admin.jsx',
    buscar: 'onClick={() => setVistaActiva(pestana.id)}>',
    reemplazo: "onClick={() => { setVistaActiva(pestana.id); if (pestana.id === 'resumen') vista.setSeleccionados([]); }}>"
  },
  {
    nombre: 'volver a "Añadir mueble" vacía el nombre',
    archivo: 'src/pages/Admin.jsx',
    buscar: 'onClick={() => setVistaActiva(pestana.id)}>',
    reemplazo: "onClick={() => { setVistaActiva(pestana.id); if (pestana.id === 'crear') setFormData(f => ({ ...f, nombre: '' })); }}>"
  },
  {
    nombre: 'volver a "Añadir mueble" olvida las fotos elegidas',
    archivo: 'src/pages/Admin.jsx',
    buscar: 'onClick={() => setVistaActiva(pestana.id)}>',
    reemplazo: "onClick={() => { setVistaActiva(pestana.id); if (pestana.id === 'crear') setFiles([]); }}>"
  },
  {
    nombre: 'volver a categorías vacía el nombre de la nueva',
    archivo: 'src/pages/Admin.jsx',
    buscar: 'onClick={() => setVistaActiva(pestana.id)}>',
    reemplazo: "onClick={() => { setVistaActiva(pestana.id); if (pestana.id === 'categorias') setNuevaCat(''); }}>"
  },
  {
    nombre: 'volver a pedidos quita el filtro',
    archivo: 'src/pages/Admin.jsx',
    buscar: 'onClick={() => setVistaActiva(pestana.id)}>',
    reemplazo: "onClick={() => { setVistaActiva(pestana.id); if (pestana.id === 'pedidos') setFiltroEstadoPedido(''); }}>"
  },
  {
    nombre: 'el botón de pedidos no se marca como activo',
    archivo: 'src/pages/Admin.jsx',
    buscar: "className={`sidebar-btn ${vistaActiva === pestana.id ? 'active' : ''}`}",
    reemplazo: "className={`sidebar-btn ${vistaActiva === pestana.id && pestana.id !== 'pedidos' ? 'active' : ''}`}"
  },
  // Desde el refactor, la barra lateral sale de la lista PESTANAS: un id mal puesto o dos entradas
  // cambiadas de sitio son fallos que antes no se podían cometer.
  {
    nombre: 'el botón "Pedidos" abre la pestaña de categorías',
    archivo: 'src/pages/Admin.jsx',
    buscar: "{ id: 'pedidos', etiqueta: 'Pedidos', icono: 'box' },",
    reemplazo: "{ id: 'categorias', etiqueta: 'Pedidos', icono: 'box' },"
  },
  {
    nombre: '"Pedidos" y "Gestionar Inventario" cambian de sitio en la barra lateral',
    archivo: 'src/pages/Admin.jsx',
    buscar: "  { id: 'inventario', etiqueta: 'Gestionar Inventario', icono: 'inventory' },\n  { id: 'pedidos', etiqueta: 'Pedidos', icono: 'box' },",
    reemplazo: "  { id: 'pedidos', etiqueta: 'Pedidos', icono: 'box' },\n  { id: 'inventario', etiqueta: 'Gestionar Inventario', icono: 'inventory' },",
    sobreviveAqui: 'ningún test de caracterización fija el orden de la barra lateral, y desde el refactor están congelados: queda anotado en el cierre de la tarea 4'
  },
  {
    nombre: 'H14: un fallo del modal limpia el mensaje de estado',
    archivo: 'src/pages/admin/modales/EditarMuebleModal.jsx',
    buscar: "      setStatus('Error al actualizar.');\n      showToast('Error al actualizar el producto', 'error');",
    reemplazo: "      setStatus('');\n      showToast('Error al actualizar el producto', 'error');"
  }
];
