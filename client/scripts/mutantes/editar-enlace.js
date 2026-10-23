// Mutantes de /admin?editar={id} (21 oct 2026; ver scripts/mutantes-panel.js).
export const TEST = 'src/pages/admin/editarDesdeEnlace.test.jsx';

const RUTA = 'src/pages/AdminRuta.jsx';
const DATOS = 'src/pages/admin/hooks/useAdminDatos.js';

export const MUTANTES = [
  {
    nombre: 'la ruta no pasa el id al panel',
    archivo: RUTA,
    buscar: "idEditar={params.get('editar')}",
    reemplazo: 'idEditar={null}'
  },
  {
    nombre: 'al usarse, el parámetro no sale de la URL',
    archivo: RUTA,
    buscar: "      actuales.delete('editar');\n",
    reemplazo: ''
  },
  {
    nombre: 'quitar el parámetro deja otra entrada en el historial',
    archivo: RUTA,
    buscar: '}, { replace: true });',
    reemplazo: '});'
  },
  {
    nombre: 'quitar el parámetro se lleva también los demás',
    archivo: RUTA,
    buscar: "      actuales.delete('editar');\n      return actuales;",
    reemplazo: '      return {};'
  },
  {
    nombre: 'no espera a que llegue el inventario',
    buscar: 'if (!idEditar || !mueblesCargados) return;',
    reemplazo: 'if (!idEditar) return;'
  },
  {
    nombre: 'la carga del inventario no se marca',
    archivo: DATOS,
    buscar: '    setMueblesCargados(true);\n',
    reemplazo: ''
  },
  {
    nombre: 'abre otra pieza',
    buscar: 'const pieza = muebles.find(m => String(m.id) === idEditar);',
    reemplazo: 'const pieza = muebles[0];'
  },
  {
    nombre: 'no cambia a "Gestionar Inventario"',
    buscar: "      setVistaActiva('inventario');\n",
    reemplazo: ''
  },
  {
    nombre: 'no abre el editor',
    buscar: '      setMuebleAEditar(pieza);\n',
    reemplazo: ''
  },
  {
    nombre: 'si no está, no avisa',
    buscar: "      showToast('No se ha encontrado la pieza que querías editar', 'error');\n",
    reemplazo: ''
  },
  {
    nombre: 'si no está, el parámetro se queda en la URL',
    buscar: "      showToast('No se ha encontrado la pieza que querías editar', 'error');\n      onEnlaceUsado();\n",
    reemplazo: "      showToast('No se ha encontrado la pieza que querías editar', 'error');\n"
  },
  {
    nombre: 'cerrar el editor no quita el parámetro',
    buscar: '    if (idEditar) onEnlaceUsado();\n',
    reemplazo: ''
  },
  {
    nombre: 'cerrar el editor no lo cierra',
    buscar: '  const cerrarEditorMueble = () => {\n    setMuebleAEditar(null);\n',
    reemplazo: '  const cerrarEditorMueble = () => {\n'
  },
  {
    nombre: 'el editor se cierra sin pasar por cerrarEditorMueble',
    buscar: 'onCerrar={cerrarEditorMueble}',
    reemplazo: 'onCerrar={() => setMuebleAEditar(null)}'
  }
];
