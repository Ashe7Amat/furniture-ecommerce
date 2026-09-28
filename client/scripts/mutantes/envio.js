// Mutantes del arreglo de H14: cada formulario del panel con su propio estado de envío (ver
// scripts/mutantes-panel.js y hooks/useEstadoEnvio.js). Simulan que el arreglo se pierda a medias.
export const TEST = 'src/pages/Admin.envio.test.jsx';

const GUARDA = '    if (envio.enviando) return; // ya hay un envío en curso (p. ej. un doble clic o Intro)\n';

export const MUTANTES = [
  {
    nombre: '"Añadir mueble": sin la guarda, un segundo envío mientras guarda crea otro mueble',
    archivo: 'src/pages/admin/pestanas/CrearMuebleTab.jsx',
    buscar: GUARDA,
    reemplazo: ''
  },
  {
    nombre: 'modal de mueble: sin la guarda, un segundo envío mientras guarda se manda',
    archivo: 'src/pages/admin/modales/EditarMuebleModal.jsx',
    buscar: GUARDA,
    reemplazo: ''
  },
  {
    nombre: 'modal de categoría: sin la guarda, un segundo envío mientras guarda se manda',
    archivo: 'src/pages/admin/modales/EditarCategoriaModal.jsx',
    buscar: GUARDA,
    reemplazo: ''
  },
  {
    nombre: 'modal de categoría: "Guardar Cambios" no se desactiva mientras guarda',
    archivo: 'src/pages/admin/modales/EditarCategoriaModal.jsx',
    buscar: '<button type="submit" className="admin-btn" disabled={envio.enviando}>',
    reemplazo: '<button type="submit" className="admin-btn" disabled={false}>'
  },
  {
    nombre: 'modal de categoría: el error no se enseña en el modal',
    archivo: 'src/pages/admin/modales/EditarCategoriaModal.jsx',
    buscar: "envio.acabarMal('Error al actualizar.');",
    reemplazo: 'envio.acabarMal();'
  },
  {
    nombre: 'modal de mueble: no enseña el progreso mientras guarda',
    archivo: 'src/pages/admin/modales/EditarMuebleModal.jsx',
    buscar: "envio.empezar('Actualizando producto...');",
    reemplazo: 'envio.empezar();'
  },
  {
    nombre: 'si el envío falla, el botón se queda desactivado',
    archivo: 'src/pages/admin/hooks/useEstadoEnvio.js',
    buscar: '    setEnviando(false);\n    setMensaje(texto);',
    reemplazo: '    setMensaje(texto);'
  }
];
