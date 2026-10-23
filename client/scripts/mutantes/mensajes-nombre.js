// Mutantes de las piezas encontradas por su nombre y del buscador manual de "Mensajes" (21 oct 2026;
// ver scripts/mutantes-panel.js). Las de referencia están en mensajes-piezas.js.
export const TEST = 'src/pages/admin/mensajesNombre.test.jsx';

const PESTANA = 'src/pages/admin/pestanas/MensajesTab.jsx';
const AYUDANTES = 'src/pages/admin/mensajes.js';

export const MUTANTES = [
  {
    nombre: 'los acentos cuentan',
    archivo: AYUDANTES,
    buscar: "    .replace(/[\\u0300-\\u036f]/g, '')\n",
    reemplazo: ''
  },
  {
    nombre: 'las mayúsculas cuentan',
    archivo: AYUDANTES,
    buscar: '    .toLowerCase()\n',
    reemplazo: ''
  },
  {
    nombre: 'los espacios no se juntan',
    archivo: AYUDANTES,
    buscar: "    .replace(/\\s+/g, ' ')\n",
    reemplazo: ''
  },
  {
    nombre: 'un texto vacío rompe la comparación',
    archivo: AYUDANTES,
    buscar: "  String(texto ?? '')\n    .normalize",
    reemplazo: '  String(texto)\n    .normalize'
  },
  {
    nombre: 'cualquier nombre cuenta, aunque sea corto',
    archivo: AYUDANTES,
    buscar: "const nombreBuscable = (nombre) => nombre.length >= 10 || nombre.split(' ').length >= 3;",
    reemplazo: 'const nombreBuscable = () => true;'
  },
  {
    nombre: 'hacen falta 11 letras',
    archivo: AYUDANTES,
    buscar: 'nombre.length >= 10 ||',
    reemplazo: 'nombre.length > 10 ||'
  },
  {
    nombre: 'tres palabras no bastan',
    archivo: AYUDANTES,
    buscar: "nombre.split(' ').length >= 3",
    reemplazo: "nombre.split(' ').length > 3"
  },
  {
    nombre: 'hacen falta las dos condiciones',
    archivo: AYUDANTES,
    buscar: "nombre.length >= 10 || nombre.split(' ').length >= 3",
    reemplazo: "nombre.length >= 10 && nombre.split(' ').length >= 3"
  },
  {
    nombre: 'una pieza de referencia sale también por nombre',
    archivo: AYUDANTES,
    buscar: ' && !yaDetectadas.has(mueble.id)',
    reemplazo: ''
  },
  {
    nombre: 'el nombre no se busca en el texto',
    archivo: AYUDANTES,
    buscar: ' && texto.includes(nombre));',
    reemplazo: ');'
  },
  {
    nombre: 'el mensaje no se normaliza',
    archivo: AYUDANTES,
    buscar: 'const texto = normalizar(mensaje?.mensaje);',
    reemplazo: "const texto = String(mensaje?.mensaje ?? '');"
  },
  {
    nombre: 'un nombre dentro de otro cuenta también',
    archivo: AYUDANTES,
    buscar: '    .filter((c) => !candidatas.some((otra) => otra.nombre.length > c.nombre.length && otra.nombre.includes(c.nombre)))\n',
    reemplazo: ''
  },
  {
    nombre: 'se queda el nombre más corto',
    archivo: AYUDANTES,
    buscar: 'otra.nombre.length > c.nombre.length && otra.nombre.includes(c.nombre)',
    reemplazo: 'otra.nombre.length < c.nombre.length && c.nombre.includes(otra.nombre)'
  },
  {
    nombre: 'los nombres salen en el orden del inventario',
    archivo: AYUDANTES,
    buscar: '    .sort((a, b) => texto.indexOf(a.nombre) - texto.indexOf(b.nombre))\n',
    reemplazo: ''
  },
  {
    nombre: 'una pieza sin referencia lleva undefined',
    archivo: AYUDANTES,
    buscar: 'referencia: mueble.referencia ?? null, mueble',
    reemplazo: 'referencia: mueble.referencia, mueble'
  },
  {
    nombre: 'el buscador no mira la referencia',
    archivo: AYUDANTES,
    buscar: ' || normalizar(m.referencia).includes(buscado)',
    reemplazo: ''
  },
  {
    nombre: 'sin nada escrito, el buscador enseña todo',
    archivo: AYUDANTES,
    buscar: '  if (!buscado) return [];\n',
    reemplazo: ''
  },
  {
    nombre: 'el buscador no normaliza lo escrito',
    archivo: AYUDANTES,
    buscar: 'const buscado = normalizar(busqueda);',
    reemplazo: 'const buscado = busqueda.trim();'
  },
  {
    nombre: 'todas las tarjetas dicen «por referencia»',
    archivo: PESTANA,
    buscar: "...porNombre.map((p) => ({ ...p, origen: 'nombre' }))",
    reemplazo: "...porNombre.map((p) => ({ ...p, origen: 'referencia' }))"
  },
  {
    nombre: 'las de nombre no salen',
    archivo: PESTANA,
    buscar: "  ...porNombre.map((p) => ({ ...p, origen: 'nombre' }))\n",
    reemplazo: ''
  },
  {
    nombre: 'las de nombre salen antes que las de referencia',
    archivo: PESTANA,
    buscar: "  ...porReferencia.map((p) => ({ ...p, origen: 'referencia' })),\n  ...porNombre.map((p) => ({ ...p, origen: 'nombre' }))",
    reemplazo: "  ...porNombre.map((p) => ({ ...p, origen: 'nombre' })),\n  ...porReferencia.map((p) => ({ ...p, origen: 'referencia' }))"
  },
  {
    nombre: 'el indicador de origen no lleva su clase',
    archivo: PESTANA,
    buscar: 'className={`mensaje-pieza-origen ${origen}`}',
    reemplazo: 'className="mensaje-pieza-origen"'
  },
  {
    nombre: 'una pieza sin referencia enseña la referencia vacía',
    archivo: PESTANA,
    buscar: '        {referencia && <span className="mensaje-pieza-ref">{referencia}</span>}',
    reemplazo: '        <span className="mensaje-pieza-ref">{referencia}</span>'
  },
  {
    nombre: '«Buscar pieza relacionada» sale siempre',
    archivo: PESTANA,
    buscar: '{!piezas.some((p) => p.mueble) && (',
    reemplazo: '{true && ('
  },
  {
    nombre: '«Buscar pieza relacionada» no sale con una referencia que no está',
    archivo: PESTANA,
    buscar: '{!piezas.some((p) => p.mueble) && (',
    reemplazo: '{piezas.length === 0 && ('
  },
  {
    nombre: 'el botón no abre el buscador',
    archivo: PESTANA,
    buscar: 'onBuscar={() => setBuscando(true)}',
    reemplazo: 'onBuscar={() => {}}'
  },
  {
    nombre: 'el buscador no avisa de que no guarda nada',
    archivo: PESTANA,
    buscar: '        Esto no guarda la relación en la base de datos: solo ayuda a encontrar la pieza mientras respondes.\n',
    reemplazo: ''
  },
  {
    nombre: 'el foco no va al campo de búsqueda',
    archivo: PESTANA,
    buscar: '    campo.current.focus();\n',
    reemplazo: ''
  },
  {
    nombre: 'sin coincidencias no dice nada',
    archivo: PESTANA,
    buscar: "<p className=\"admin-empty-note\">Ninguna pieza coincide.</p>",
    reemplazo: 'null'
  },
  {
    nombre: 'no hay tope de resultados',
    archivo: PESTANA,
    buscar: 'encontradas.slice(0, MAX_RESULTADOS).map',
    reemplazo: 'encontradas.map'
  },
  {
    nombre: 'no dice cuántas faltan',
    archivo: PESTANA,
    buscar: '{resto > 0 && (',
    reemplazo: '{resto > 99 && ('
  },
  {
    nombre: 'con una que falta, el plural',
    archivo: PESTANA,
    buscar: "resto === 1 ? 'Hay 1 pieza más'",
    reemplazo: "resto === 0 ? 'Hay 1 pieza más'"
  },
  {
    nombre: 'elegir un resultado no abre su editor',
    archivo: PESTANA,
    buscar: 'onClick={() => onElegir(m)}',
    reemplazo: 'onClick={() => onElegir(muebles[0])}'
  },
  {
    nombre: 'elegir deja el buscador abierto',
    archivo: PESTANA,
    buscar: '  const editarPieza = (mueble) => {\n    setBuscando(false);\n',
    reemplazo: '  const editarPieza = (mueble) => {\n'
  },
  {
    nombre: '«Volver al mensaje» cierra también el mensaje',
    archivo: PESTANA,
    buscar: 'onCerrar={() => setBuscando(false)} />',
    reemplazo: 'onCerrar={() => { setBuscando(false); setAbierto(null); }} />'
  }
];
