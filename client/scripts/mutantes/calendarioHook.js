// Mutantes de la lectura de los calendarios de «Reservas» (pages/admin/hooks/useCalendarioReservas.js;
// ver scripts/mutantes-panel.js). Los mata useCalendarioReservas.test.js.
export const TEST = 'src/pages/admin/hooks/useCalendarioReservas.test.js';

const ARCHIVO = 'src/pages/admin/hooks/useCalendarioReservas.js';

export const MUTANTES = [
  {
    nombre: 'con el calendario apagado se lee igualmente',
    archivo: ARCHIVO,
    buscar: '    if (!activo) return undefined;\n',
    reemplazo: ''
  },
  {
    nombre: 'una respuesta tardía de un rango anterior pisa la del actual',
    archivo: ARCHIVO,
    buscar: '      if (numero !== ultima.current) return;\n',
    reemplazo: ''
  },
  {
    nombre: 'al volver a leer el mismo rango no se dice que está cargando',
    archivo: ARCHIVO,
    buscar: '    setEstado((e) => ({ ...e, cargando: true }));\n',
    reemplazo: ''
  },
  {
    nombre: 'sin pieza se manda una pieza vacía en vez de ninguna',
    archivo: ARCHIVO,
    buscar: 'muebleId: muebleId || undefined }',
    reemplazo: 'muebleId }'
  },
  {
    nombre: 'una lectura que no devuelve nada revienta en vez de dar error',
    archivo: ARCHIVO,
    buscar: 'const { data, error } = resultado ?? {};',
    reemplazo: 'const { data, error } = resultado;'
  },
  {
    nombre: 'una respuesta sin lista de reservas se toma por buena',
    archivo: ARCHIVO,
    buscar: 'if (data && Array.isArray(data.reservas)) {',
    reemplazo: 'if (data) {'
  },
  {
    nombre: 'una respuesta buena no borra el error de antes',
    archivo: ARCHIVO,
    buscar: "setEstado({ clave, datos: data, errorDe: null, error: '', cargando: false });",
    reemplazo: 'setEstado((e) => ({ ...e, clave, datos: data, cargando: false }));'
  },
  {
    nombre: 'una respuesta buena no guarda para qué rango era',
    archivo: ARCHIVO,
    buscar: "setEstado({ clave, datos: data,",
    reemplazo: "setEstado({ clave: null, datos: data,"
  },
  {
    nombre: 'un error sin texto no dice nada',
    archivo: ARCHIVO,
    buscar: 'error: error || SIN_RESPUESTA,',
    reemplazo: 'error: error ?? "",'
  },
  {
    nombre: 'un error de un rango anterior se sigue enseñando en el rango nuevo',
    archivo: ARCHIVO,
    buscar: "const error = estado.errorDe === clave ? estado.error : '';",
    reemplazo: 'const error = estado.error;'
  },
  {
    nombre: 'un error no se guarda para qué rango era',
    archivo: ARCHIVO,
    buscar: 'errorDe: clave, error: error || SIN_RESPUESTA',
    reemplazo: 'errorDe: null, error: error || SIN_RESPUESTA'
  },
  {
    nombre: 'los datos de un rango anterior se enseñan en el rango nuevo',
    archivo: ARCHIVO,
    buscar: 'const datos = estado.clave === clave ? estado.datos : null;',
    reemplazo: 'const datos = estado.datos;'
  },
  {
    nombre: 'los datos de otra pieza se enseñan al cambiar de pieza',
    archivo: ARCHIVO,
    buscar: 'const clave = `${desde}|${hasta}|${muebleId}`;',
    reemplazo: 'const clave = `${desde}|${hasta}`;'
  },
  {
    nombre: 'sin datos ni error no se dice que está cargando',
    archivo: ARCHIVO,
    buscar: 'cargando: estado.cargando || (!datos && !error) }',
    reemplazo: 'cargando: estado.cargando }'
  },
  {
    nombre: 'un error de lectura borra los datos que ya se tenían del mismo rango',
    archivo: ARCHIVO,
    buscar: 'setEstado((e) => ({ ...e, errorDe: clave,',
    reemplazo: 'setEstado((e) => ({ ...e, datos: null, errorDe: clave,'
  },
  {
    nombre: 'cuando sube la versión no se vuelve a leer',
    archivo: ARCHIVO,
    buscar: '[activo, clave, version, desde, hasta, muebleId]',
    reemplazo: '[activo, clave, desde, hasta, muebleId]'
  },
  {
    nombre: 'al encender el calendario no se lee',
    archivo: ARCHIVO,
    buscar: '[activo, clave, version, desde, hasta, muebleId]',
    reemplazo: '[clave, version, desde, hasta, muebleId]'
  }
];
