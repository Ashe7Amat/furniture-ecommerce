// Mutantes del hook de la agenda de hoy y mañana (pages/admin/hooks/useAgendaReservas.js; ver
// scripts/mutantes-panel.js). Los mata useAgendaReservas.test.js.
export const TEST = 'src/pages/admin/hooks/useAgendaReservas.test.js';

const ARCHIVO = 'src/pages/admin/hooks/useAgendaReservas.js';

export const MUTANTES = [
  {
    nombre: 'no se lee la agenda al entrar',
    archivo: ARCHIVO,
    buscar: '  useEffect(() => {\n    recargar();\n  }, [recargar]);',
    reemplazo: '  useEffect(() => {}, [recargar]);'
  },
  {
    nombre: 'la respuesta lenta de una lectura anterior pisa la más reciente',
    archivo: ARCHIVO,
    buscar: '    if (numero !== ultima.current) return;\n',
    reemplazo: ''
  },
  {
    nombre: 'una respuesta sin lista de trayectos se toma por una agenda',
    archivo: ARCHIVO,
    buscar: 'if (data && Array.isArray(data.trayectos)) {',
    reemplazo: 'if (data) {'
  },
  {
    nombre: 'una lectura que falla borra la última agenda que se tenía',
    archivo: ARCHIVO,
    buscar: 'datos: anterior.datos',
    reemplazo: 'datos: null'
  },
  {
    nombre: 'una lectura buena no quita el error de la anterior',
    archivo: ARCHIVO,
    buscar: "setEstado({ cargando: false, error: '', datos: data });",
    reemplazo: 'setEstado((anterior) => ({ ...anterior, cargando: false, datos: data }));'
  },
  {
    nombre: 'un fallo sin mensaje deja el error sin definir en vez de vacío',
    archivo: ARCHIVO,
    buscar: "error: error ?? ''",
    reemplazo: 'error'
  },
  {
    nombre: 'sin respuesta alguna se rompe',
    archivo: ARCHIVO,
    buscar: 'const { data, error } = resultado ?? {};',
    reemplazo: 'const { data, error } = resultado;'
  },
  {
    nombre: 'al empezar no está «cargando»',
    archivo: ARCHIVO,
    buscar: 'useState({ cargando: true,',
    reemplazo: 'useState({ cargando: false,'
  },
  {
    nombre: 'una lectura terminada sigue «cargando»',
    archivo: ARCHIVO,
    buscar: "setEstado({ cargando: false, error: '', datos: data });",
    reemplazo: "setEstado({ cargando: true, error: '', datos: data });"
  },
  {
    nombre: '`recargar` no vuelve a leer',
    archivo: ARCHIVO,
    buscar: '    const numero = ++ultima.current;\n    const resultado = await getAgendaReservasAdmin();',
    reemplazo: '    const numero = ++ultima.current;\n    const resultado = ultima.current > 1 ? undefined : await getAgendaReservasAdmin();'
  }
];
