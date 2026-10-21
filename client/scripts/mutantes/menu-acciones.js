// Mutantes del menú «⋮» de las filas del inventario (21 oct 2026; ver scripts/mutantes-panel.js).
export const TEST = 'src/pages/admin/menuAcciones.test.jsx';

const MENU = 'src/pages/admin/MenuAcciones.jsx';
const PESTANA = 'src/pages/admin/pestanas/InventarioTab.jsx';

export const MUTANTES = [
  {
    nombre: '«Eliminar» del menú borra otra pieza',
    archivo: PESTANA,
    buscar: 'onElegir: () => handleDeleteMueble(m.id) }',
    reemplazo: 'onElegir: () => handleDeleteMueble(muebles[0].id) }'
  },
  {
    nombre: '«Eliminar» no va en rojo',
    archivo: PESTANA,
    buscar: "icono: 'trash', peligro: true,",
    reemplazo: "icono: 'trash',"
  },
  {
    nombre: 'sin la línea antes de «Eliminar»',
    archivo: PESTANA,
    buscar: '                      null,\n',
    reemplazo: ''
  },
  {
    nombre: 'la cabecera «Acciones» no va a la derecha',
    archivo: PESTANA,
    buscar: '<span className="inv-actions-head">Acciones</span>',
    reemplazo: '<span>Acciones</span>'
  },
  {
    nombre: 'el menú no dice de qué pieza es',
    archivo: PESTANA,
    buscar: 'etiqueta={`Más acciones de ${m.nombre}`}',
    reemplazo: 'etiqueta="Más acciones"'
  },
  {
    nombre: 'al abrir, el foco no entra en el menú',
    archivo: MENU,
    buscar: '    opciones()[0]?.focus();\n',
    reemplazo: ''
  },
  {
    nombre: 'la flecha abajo no da la vuelta',
    archivo: MENU,
    buscar: 'lista[(i + lista.length) % lista.length].focus();',
    reemplazo: 'lista[Math.min(Math.max(i, 0), lista.length - 1)].focus();'
  },
  {
    nombre: 'la flecha abajo sube',
    archivo: MENU,
    buscar: "if (e.key === 'ArrowDown') ir(actual + 1);",
    reemplazo: "if (e.key === 'ArrowDown') ir(actual - 1);"
  },
  {
    nombre: 'la flecha arriba no hace nada',
    archivo: MENU,
    buscar: "else if (e.key === 'ArrowUp') ir(actual - 1);",
    reemplazo: ''
  },
  {
    nombre: 'Inicio no va a la primera',
    archivo: MENU,
    buscar: "else if (e.key === 'Home') ir(0);",
    reemplazo: ''
  },
  {
    nombre: 'Fin no va a la última',
    archivo: MENU,
    buscar: "else if (e.key === 'End') ir(lista.length - 1);",
    reemplazo: "else if (e.key === 'End') ir(lista.length - 2);"
  },
  {
    nombre: 'Escape no devuelve el foco al botón',
    archivo: MENU,
    buscar: "      e.stopPropagation();\n      cerrar(true);",
    reemplazo: "      e.stopPropagation();\n      cerrar(false);"
  },
  {
    nombre: 'Escape no cierra',
    archivo: MENU,
    buscar: "    else if (e.key === 'Escape') {\n      e.preventDefault();\n      e.stopPropagation();\n      cerrar(true);\n    }",
    reemplazo: "    else if (e.key === 'Escape') {\n      e.preventDefault();\n    }"
  },
  {
    nombre: 'Tab no cierra',
    archivo: MENU,
    buscar: "    } else if (e.key === 'Tab') {\n      e.preventDefault();\n      cerrar(true);\n    }",
    reemplazo: '    }'
  },
  {
    nombre: 'un clic fuera no cierra',
    archivo: MENU,
    buscar: "    document.addEventListener('mousedown', fuera);\n",
    reemplazo: ''
  },
  {
    nombre: 'un clic dentro también cierra',
    archivo: MENU,
    buscar: 'if (!menu.current?.contains(e.target) && !boton.current?.contains(e.target)) cerrar(false);',
    reemplazo: 'if (!boton.current?.contains(e.target)) cerrar(false);'
  },
  {
    nombre: 'desplazar la página no hace nada',
    archivo: MENU,
    buscar: "    window.addEventListener('scroll', alMover, true);\n",
    reemplazo: ''
  },
  {
    nombre: 'al desplazar, el menú no sigue al botón',
    archivo: MENU,
    buscar: '      else colocar();\n',
    reemplazo: ''
  },
  {
    nombre: 'al desplazar, se cierra siempre',
    archivo: MENU,
    buscar: 'if (caja.bottom < 0 || caja.top > window.innerHeight) cerrar(false);\n      else colocar();',
    reemplazo: 'cerrar(false);'
  },
  {
    nombre: 'si el botón sale por arriba, no se cierra',
    archivo: MENU,
    buscar: 'if (caja.bottom < 0 || ',
    reemplazo: 'if ('
  },
  {
    nombre: 'si el botón sale por abajo, no se cierra',
    archivo: MENU,
    buscar: ' || caja.top > window.innerHeight) cerrar(false);',
    reemplazo: ') cerrar(false);'
  },
  {
    nombre: 'se cierra con el botón justo en el borde de arriba',
    archivo: MENU,
    buscar: 'caja.bottom < 0 ||',
    reemplazo: 'caja.bottom <= 0 ||'
  },
  {
    nombre: 'se cierra con el botón justo en el borde de abajo',
    archivo: MENU,
    buscar: 'caja.top > window.innerHeight) cerrar',
    reemplazo: 'caja.top >= window.innerHeight) cerrar'
  },
  {
    nombre: 'cambiar el tamaño no hace nada',
    archivo: MENU,
    buscar: "    window.addEventListener('resize', alMover);\n",
    reemplazo: ''
  },
  {
    nombre: 'elegir una opción no cierra el menú',
    archivo: MENU,
    buscar: '  const elegir = (accion) => {\n    cerrar(true);\n',
    reemplazo: '  const elegir = (accion) => {\n'
  },
  {
    nombre: 'volver a pulsar el botón no cierra',
    archivo: MENU,
    buscar: 'onClick={() => (abierto ? cerrar(false) : setAbierto(true))}',
    reemplazo: 'onClick={() => setAbierto(true)}'
  },
  {
    nombre: 'aria-expanded no cambia',
    archivo: MENU,
    buscar: 'aria-expanded={abierto}',
    reemplazo: 'aria-expanded={false}'
  },
  {
    nombre: 'el botón no dice que abre un menú',
    archivo: MENU,
    buscar: 'aria-haspopup="menu"',
    reemplazo: ''
  },
  {
    nombre: 'el botón no apunta a su menú',
    archivo: MENU,
    buscar: 'aria-controls={abierto ? idMenu : undefined}',
    reemplazo: ''
  },
  {
    nombre: 'el menú no cuelga de <body>',
    archivo: MENU,
    buscar: '        </div>,\n        document.body\n      )}',
    reemplazo: '        </div>,\n        boton.current.parentElement\n      )}'
  },
  {
    nombre: 'nunca se abre hacia arriba',
    archivo: MENU,
    buscar: 'const haciaArriba = caja.bottom + MARGEN + alto > window.innerHeight && caja.top - MARGEN - alto >= 0;',
    reemplazo: 'const haciaArriba = false;'
  },
  {
    nombre: 'se abre hacia arriba aunque tampoco quepa',
    archivo: MENU,
    buscar: ' && caja.top - MARGEN - alto >= 0;',
    reemplazo: ';'
  },
  {
    nombre: 'se da la vuelta cabiendo justo debajo',
    archivo: MENU,
    buscar: 'caja.bottom + MARGEN + alto > window.innerHeight',
    reemplazo: 'caja.bottom + MARGEN + alto >= window.innerHeight'
  },
  {
    nombre: 'no se da la vuelta cabiendo justo arriba',
    archivo: MENU,
    buscar: 'caja.top - MARGEN - alto >= 0',
    reemplazo: 'caja.top - MARGEN - alto > 0'
  },
  {
    nombre: 'hacia arriba, se pinta encima del botón',
    archivo: MENU,
    buscar: 'top: haciaArriba ? caja.top - MARGEN - alto : caja.bottom + MARGEN,',
    reemplazo: 'top: haciaArriba ? caja.top - alto : caja.bottom + MARGEN,'
  },
  {
    nombre: 'debajo, sin separación del botón',
    archivo: MENU,
    buscar: ': caja.bottom + MARGEN,',
    reemplazo: ': caja.bottom,'
  },
  {
    nombre: 'no se pega al borde derecho del botón',
    archivo: MENU,
    buscar: 'right: window.innerWidth - caja.right',
    reemplazo: 'right: window.innerWidth - caja.left'
  },
  {
    nombre: 'sin la clase de hacia arriba',
    archivo: MENU,
    buscar: "${posicion?.haciaArriba ? 'hacia-arriba' : ''}",
    reemplazo: ''
  },
  {
    nombre: 'el separador no es un separador',
    archivo: MENU,
    buscar: 'role="separator"',
    reemplazo: ''
  },
  {
    nombre: 'una opción de peligro no se marca',
    archivo: MENU,
    buscar: "${accion.peligro ? 'peligro' : ''}",
    reemplazo: ''
  }
];
