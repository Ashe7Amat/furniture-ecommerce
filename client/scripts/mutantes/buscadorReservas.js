// Mutantes del buscador de «Reservas» (pages/admin/BuscadorReservas.jsx; ver scripts/mutantes-panel.js).
// Los mata BuscadorReservas.test.jsx.
export const TEST = 'src/pages/admin/BuscadorReservas.test.jsx';

const ARCHIVO = 'src/pages/admin/BuscadorReservas.jsx';

export const MUTANTES = [
  {
    nombre: 'el texto se manda con los espacios de los lados',
    archivo: ARCHIVO,
    buscar: 'q: borrador.q.trim(),',
    reemplazo: 'q: borrador.q,'
  },
  {
    nombre: 'solo espacios cuenta como un texto',
    archivo: ARCHIVO,
    buscar: '!filtros.q && !filtros.desde',
    reemplazo: '!borrador.q && !filtros.desde'
  },
  {
    nombre: 'un envío vacío manda la búsqueda igualmente',
    archivo: ARCHIVO,
    buscar: '    if (!filtros.q && !filtros.desde && !filtros.hasta) {',
    reemplazo: '    if (false) {'
  },
  {
    nombre: 'un envío vacío no avisa de qué falta',
    archivo: ARCHIVO,
    buscar: "      else setError('Escribe qué buscar o elige unas fechas.');",
    reemplazo: '      else setError(\'\');'
  },
  {
    nombre: 'un envío vacío con una búsqueda hecha no la quita',
    archivo: ARCHIVO,
    buscar: '      if (activa) quitar();\n',
    reemplazo: '      if (activa) setError(\'\');\n'
  },
  {
    nombre: 'un envío vacío con una búsqueda hecha avisa de que falta algo',
    archivo: ARCHIVO,
    buscar: '      if (activa) quitar();\n      else',
    reemplazo: '      if (false) quitar();\n      else'
  },
  {
    nombre: 'la fecha final anterior a la inicial se manda',
    archivo: ARCHIVO,
    buscar: '    if (filtros.desde && filtros.hasta && filtros.hasta < filtros.desde) {',
    reemplazo: '    if (false) {'
  },
  {
    nombre: 'un solo día (desde y hasta iguales) se rechaza',
    archivo: ARCHIVO,
    buscar: 'filtros.hasta < filtros.desde',
    reemplazo: 'filtros.hasta <= filtros.desde'
  },
  {
    nombre: 'con solo «hasta» se rechaza (compara con una fecha que no hay)',
    archivo: ARCHIVO,
    buscar: 'if (filtros.desde && filtros.hasta && filtros.hasta < filtros.desde)',
    reemplazo: 'if (filtros.hasta < filtros.desde)'
  },
  {
    nombre: 'el aviso de fechas no dice por qué',
    archivo: ARCHIVO,
    buscar: "'La fecha final no puede ser anterior a la inicial.'",
    reemplazo: "'Fechas no válidas.'"
  },
  {
    nombre: 'el aviso de un envío anterior se queda tras una búsqueda buena',
    archivo: ARCHIVO,
    buscar: "    setError('');\n    onBuscar(filtros);",
    reemplazo: '    onBuscar(filtros);'
  },
  {
    nombre: 'escribir en el texto no quita el aviso',
    archivo: ARCHIVO,
    buscar: "    setBorrador((b) => ({ ...b, [campo]: evento.target.value }));\n    setError('');",
    reemplazo: '    setBorrador((b) => ({ ...b, [campo]: evento.target.value }));'
  },
  {
    nombre: 'todos los campos escriben en el texto',
    archivo: ARCHIVO,
    buscar: '({ ...b, [campo]: evento.target.value })',
    reemplazo: "({ ...b, q: evento.target.value })"
  },
  {
    nombre: '«Limpiar búsqueda» no vacía los campos',
    archivo: ARCHIVO,
    buscar: '  const quitar = () => {\n    setBorrador(VACIO);',
    reemplazo: '  const quitar = () => {\n    setBorrador(borrador);'
  },
  {
    nombre: '«Limpiar búsqueda» no quita el aviso',
    archivo: ARCHIVO,
    buscar: "    setBorrador(VACIO);\n    setError('');\n    onQuitar();",
    reemplazo: '    setBorrador(VACIO);\n    onQuitar();'
  },
  {
    nombre: '«Limpiar búsqueda» no avisa a la pestaña',
    archivo: ARCHIVO,
    buscar: '    onQuitar();\n    entrada.current?.focus();',
    reemplazo: '    entrada.current?.focus();'
  },
  {
    nombre: '«Limpiar búsqueda» deja el foco en el aire',
    archivo: ARCHIVO,
    buscar: '    entrada.current?.focus();\n',
    reemplazo: ''
  },
  {
    nombre: '«Limpiar búsqueda» no sale con solo texto escrito',
    archivo: ARCHIVO,
    buscar: 'const hayAlgo = activa || borrador.q || borrador.desde || borrador.hasta;',
    reemplazo: 'const hayAlgo = activa || borrador.desde || borrador.hasta;'
  },
  {
    nombre: '«Limpiar búsqueda» no sale con solo la fecha inicial',
    archivo: ARCHIVO,
    buscar: 'const hayAlgo = activa || borrador.q || borrador.desde || borrador.hasta;',
    reemplazo: 'const hayAlgo = activa || borrador.q || borrador.hasta;'
  },
  {
    nombre: '«Limpiar búsqueda» no sale con solo la fecha final',
    archivo: ARCHIVO,
    buscar: 'const hayAlgo = activa || borrador.q || borrador.desde || borrador.hasta;',
    reemplazo: 'const hayAlgo = activa || borrador.q || borrador.desde;'
  },
  {
    nombre: '«Limpiar búsqueda» no sale con una búsqueda hecha y los campos vacíos',
    archivo: ARCHIVO,
    buscar: 'const hayAlgo = activa || borrador.q',
    reemplazo: 'const hayAlgo = borrador.q'
  },
  {
    nombre: 'los campos no enseñan la búsqueda que ya se hizo',
    archivo: ARCHIVO,
    buscar: 'useState(activa ?? VACIO)',
    reemplazo: 'useState(VACIO)'
  },
  {
    nombre: 'si la búsqueda se quita desde fuera, los campos se quedan',
    archivo: ARCHIVO,
    buscar: '    if (!activa) {\n      setBorrador(VACIO);\n      setError(\'\');\n    }',
    reemplazo: '    if (!activa) {\n      setError(\'\');\n    }'
  },
  {
    nombre: 'si la búsqueda se quita desde fuera, el aviso se queda',
    archivo: ARCHIVO,
    buscar: "      setBorrador(VACIO);\n      setError('');\n    }\n  }",
    reemplazo: '      setBorrador(VACIO);\n    }\n  }'
  },
  {
    nombre: 'cualquier búsqueda nueva vacía los campos (se pierde lo que se estaba escribiendo)',
    archivo: ARCHIVO,
    buscar: '    if (!activa) {\n      setBorrador(VACIO);',
    reemplazo: '    {\n      setBorrador(VACIO);'
  },
  {
    nombre: '«Hasta el día» no limita su mínimo a «Desde el día»',
    archivo: ARCHIVO,
    buscar: 'min={borrador.desde || undefined} ',
    reemplazo: ''
  },
  {
    nombre: 'el texto no tiene límite de largo',
    archivo: ARCHIVO,
    buscar: '          maxLength={MAX_TEXTO}\n',
    reemplazo: ''
  },
  {
    nombre: 'el límite del texto es otro',
    archivo: ARCHIVO,
    buscar: 'const MAX_TEXTO = 100;',
    reemplazo: 'const MAX_TEXTO = 120;'
  },
  {
    nombre: 'el formulario no es una búsqueda para el lector de pantalla',
    archivo: ARCHIVO,
    buscar: ' role="search" aria-label="Buscar reservas"',
    reemplazo: ''
  },
  {
    nombre: 'el botón «Buscar» no envía el formulario',
    archivo: ARCHIVO,
    buscar: '<button type="submit" className="admin-btn">Buscar</button>',
    reemplazo: '<button type="button" className="admin-btn">Buscar</button>'
  },
  {
    nombre: 'el campo de texto es de texto corriente, sin su función de búsqueda',
    archivo: ARCHIVO,
    buscar: '          type="search"\n',
    reemplazo: '          type="text"\n'
  },
  {
    nombre: 'el campo de la fecha inicial no es un calendario',
    archivo: ARCHIVO,
    buscar: '<input type="date" value={borrador.desde}',
    reemplazo: '<input type="text" value={borrador.desde}'
  },
  {
    nombre: 'el campo de la fecha final no es un calendario',
    archivo: ARCHIVO,
    buscar: '<input type="date" value={borrador.hasta}',
    reemplazo: '<input type="text" value={borrador.hasta}'
  },
  {
    nombre: 'el campo de texto pierde su ayuda',
    archivo: ARCHIVO,
    buscar: 'placeholder="Nombre, teléfono, email, pieza o referencia de la reserva"',
    reemplazo: 'placeholder=""'
  },
  {
    nombre: 'los campos de fecha mandan la fecha del otro',
    archivo: ARCHIVO,
    buscar: 'value={borrador.hasta} min',
    reemplazo: 'value={borrador.desde} min'
  }
];
