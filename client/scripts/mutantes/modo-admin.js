// Mutantes de la barra de modo admin de la ficha pública (21 oct 2026; ver scripts/mutantes-panel.js).
export const TEST = 'src/components/barraAdmin.test.jsx';

const BARRA = 'src/components/BarraAdmin.jsx';
const FICHA = 'src/pages/ProductDetail.jsx';
const MENU = 'src/pages/admin/MenuAcciones.jsx';

export const MUTANTES = [
  {
    nombre: 'la ve cualquiera con sesión',
    archivo: FICHA,
    buscar: "const esAdmin = useContext(AuthContext)?.user?.rol === 'admin';",
    reemplazo: 'const esAdmin = Boolean(useContext(AuthContext)?.user);'
  },
  {
    nombre: 'la ve también un cliente',
    archivo: FICHA,
    buscar: "?.user?.rol === 'admin';",
    reemplazo: "?.user?.rol !== 'invitado';"
  },
  {
    nombre: 'sin el contexto de la sesión, la ficha se rompe',
    archivo: FICHA,
    buscar: 'useContext(AuthContext)?.user?.rol',
    reemplazo: 'useContext(AuthContext).user?.rol'
  },
  {
    nombre: 'la ficha no deja sitio a la barra',
    archivo: FICHA,
    buscar: "${esAdmin ? 'con-barra-admin' : ''}",
    reemplazo: ''
  },
  {
    nombre: 'tras cambiar el estado, la ficha no se pinta con él',
    archivo: FICHA,
    buscar: 'setMueble((actual) => ({ ...actual, estado }));',
    reemplazo: ''
  },
  {
    nombre: 'la barra no dice que es el modo admin',
    archivo: BARRA,
    buscar: '<strong>Modo admin:</strong>',
    reemplazo: '<strong>Admin:</strong>'
  },
  {
    nombre: 'la barra no dice qué pieza es',
    archivo: BARRA,
    buscar: '<span className="barra-admin-nombre">{mueble.nombre}</span>',
    reemplazo: '<span className="barra-admin-nombre" />'
  },
  {
    nombre: 'la barra no es una región con nombre',
    archivo: BARRA,
    buscar: 'role="region" aria-label="Modo admin"',
    reemplazo: ''
  },
  {
    nombre: 'el estado de la barra es el valor en bruto',
    archivo: BARRA,
    buscar: '<span className="barra-admin-estado">{textoEstado}</span>',
    reemplazo: '<span className="barra-admin-estado">{estado}</span>'
  },
  {
    nombre: 'un estado desconocido sale en blanco',
    archivo: BARRA,
    buscar: '?.texto ?? estado;',
    reemplazo: '?.texto;'
  },
  {
    nombre: 'sin estado no cuenta como disponible',
    archivo: BARRA,
    buscar: "const estado = mueble.estado || 'disponible';",
    reemplazo: 'const estado = mueble.estado;'
  },
  {
    nombre: '«Editar en panel» va al panel sin la pieza',
    archivo: BARRA,
    buscar: 'to={`/admin?editar=${encodeURIComponent(mueble.id)}`}',
    reemplazo: 'to="/admin"'
  },
  {
    nombre: 'el id va sin codificar en el enlace',
    archivo: BARRA,
    buscar: '?editar=${encodeURIComponent(mueble.id)}',
    reemplazo: '?editar=${mueble.id}'
  },
  {
    nombre: 'el parámetro se llama de otra forma',
    archivo: BARRA,
    buscar: 'to={`/admin?editar=',
    reemplazo: 'to={`/admin?pieza='
  },
  {
    nombre: 'falta un estado en el menú',
    archivo: BARRA,
    buscar: "  { valor: 'alquilado', texto: 'Alquilado' }\n",
    reemplazo: ''
  },
  {
    nombre: 'el estado actual no se marca',
    archivo: BARRA,
    buscar: 'marcada: e.valor === estado,',
    reemplazo: 'marcada: false,'
  },
  {
    nombre: 'se guarda otro estado que el elegido',
    archivo: BARRA,
    buscar: 'onElegir: () => cambiarEstado(e.valor)',
    reemplazo: "onElegir: () => cambiarEstado('vendido')"
  },
  {
    nombre: 'se guarda en la API con otro campo',
    archivo: BARRA,
    buscar: 'await updateMueble(mueble.id, { estado: nuevo });',
    reemplazo: 'await updateMueble(mueble.id, { estado: nuevo, nombre: mueble.nombre });'
  },
  {
    nombre: 'elegir el mismo estado llama a la API',
    archivo: BARRA,
    buscar: 'if (nuevo === estado || guardando) return;',
    reemplazo: 'if (guardando) return;'
  },
  {
    nombre: 'mientras se guarda, se puede mandar otra petición',
    archivo: BARRA,
    buscar: 'if (nuevo === estado || guardando) return;',
    reemplazo: 'if (nuevo === estado) return;'
  },
  {
    nombre: 'si la API falla, la ficha cambia igual',
    archivo: BARRA,
    buscar: '    if (res) {\n      onEstadoCambiado(nuevo);',
    reemplazo: '    onEstadoCambiado(nuevo);\n    if (res) {'
  },
  {
    nombre: 'sin aviso al guardar',
    archivo: BARRA,
    buscar: "showToast('Estado actualizado', 'success');",
    reemplazo: ''
  },
  {
    nombre: 'sin aviso si falla',
    archivo: BARRA,
    buscar: "showToast('Error al cambiar estado', 'error');",
    reemplazo: ''
  },
  {
    nombre: 'el botón del menú no dice de qué pieza es',
    archivo: BARRA,
    buscar: 'etiqueta={`Cambiar estado de ${mueble.nombre}`}',
    reemplazo: "etiqueta=\"Cambiar estado\""
  },
  {
    nombre: 'el botón del menú no dice «Cambiar estado»',
    archivo: BARRA,
    buscar: '        >\n          Cambiar estado\n        </MenuAcciones>',
    reemplazo: '        />'
  },
  {
    nombre: 'las opciones marcables son opciones normales',
    archivo: MENU,
    buscar: "role={accion.marcada === undefined ? 'menuitem' : 'menuitemradio'}",
    reemplazo: "role=\"menuitem\""
  },
  {
    nombre: 'la opción marcada no lo dice',
    archivo: MENU,
    buscar: 'aria-checked={accion.marcada}',
    reemplazo: ''
  },
  {
    nombre: 'la marca ✓ sale en todas',
    archivo: MENU,
    buscar: '{accion.marcada && <Icon name="check" />}',
    reemplazo: '<Icon name="check" />'
  },
  {
    nombre: 'el menú no encuentra las opciones marcables',
    archivo: MENU,
    buscar: "querySelectorAll('[role^=\"menuitem\"]')",
    reemplazo: "querySelectorAll('[role=\"menuitem\"]')"
  },
  {
    nombre: 'el botón del menú no lleva su propio texto',
    archivo: MENU,
    buscar: '        {children}\n      </button>',
    reemplazo: '        <Icon name="more" />\n      </button>'
  },
  {
    nombre: 'no deja su alto para el botón de la música',
    archivo: BARRA,
    buscar: '    medir();\n',
    reemplazo: ''
  },
  {
    nombre: 'deja su alto sin la separación',
    archivo: BARRA,
    buscar: '${nodo.offsetHeight + 8}px',
    reemplazo: '${nodo.offsetHeight}px'
  },
  {
    nombre: 'al salir de la ficha, el alto se queda',
    archivo: BARRA,
    buscar: "      raiz.removeProperty('--alto-barra-admin');\n",
    reemplazo: ''
  },
  {
    nombre: 'no sigue los cambios de alto',
    archivo: BARRA,
    buscar: '    observador?.observe(nodo);\n',
    reemplazo: ''
  },
  {
    nombre: 'no deja de observar al salir',
    archivo: BARRA,
    buscar: '      observador?.disconnect();\n',
    reemplazo: ''
  }
];
