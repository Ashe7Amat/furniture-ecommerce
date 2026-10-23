// Mutantes de las piezas en "Mensajes" (21 oct 2026; ver scripts/mutantes-panel.js): las tarjetas
// de las piezas que un mensaje nombra por su referencia, y sus botones.
export const TEST = 'src/pages/admin/mensajesPiezas.test.jsx';

const PESTANA = 'src/pages/admin/pestanas/MensajesTab.jsx';
const AYUDANTES = 'src/pages/admin/mensajes.js';
const ALTA = 'src/pages/admin/modales/AltaCalendarioModal.jsx';
const PANEL = 'src/pages/Admin.jsx';

export const MUTANTES = [
  {
    nombre: 'solo se busca la primera referencia del mensaje',
    archivo: AYUDANTES,
    buscar: 'const REFERENCIA = /NAV-[A-Z]{3}-\\d{3}/g;',
    reemplazo: 'const REFERENCIA = /NAV-[A-Z]{3}-\\d{3}/;'
  },
  {
    nombre: 'una referencia repetida da dos tarjetas',
    archivo: AYUDANTES,
    buscar: '[...new Set(String(texto).match(REFERENCIA) ?? [])]',
    reemplazo: '[...(String(texto).match(REFERENCIA) ?? [])]'
  },
  {
    nombre: 'la referencia acepta cualquier número de cifras',
    archivo: AYUDANTES,
    buscar: 'const REFERENCIA = /NAV-[A-Z]{3}-\\d{3}/g;',
    reemplazo: 'const REFERENCIA = /NAV-[A-Z]{3}-\\d+/g;'
  },
  {
    nombre: 'la referencia no distingue mayúsculas',
    archivo: AYUDANTES,
    buscar: 'const REFERENCIA = /NAV-[A-Z]{3}-\\d{3}/g;',
    reemplazo: 'const REFERENCIA = /NAV-[A-Z]{3}-\\d{3}/gi;'
  },
  {
    nombre: 'una referencia que no está se enlaza con la primera pieza',
    archivo: AYUDANTES,
    buscar: 'muebles.find((m) => m.referencia === referencia) ?? null',
    reemplazo: 'muebles.find((m) => m.referencia === referencia) ?? muebles[0]'
  },
  {
    nombre: 'cada referencia se enlaza con cualquier pieza',
    archivo: AYUDANTES,
    buscar: 'muebles.find((m) => m.referencia === referencia)',
    reemplazo: 'muebles.find((m) => m.referencia !== referencia)'
  },
  {
    nombre: 'sin estado no cuenta como disponible',
    archivo: AYUDANTES,
    buscar: "ESTADOS[estado || 'disponible'] ?? estado",
    reemplazo: 'ESTADOS[estado] ?? estado'
  },
  {
    nombre: 'una pieza vendida sale como alquilada',
    archivo: AYUDANTES,
    buscar: "vendido: 'Vendido'",
    reemplazo: "vendido: 'Alquilado'"
  },
  {
    nombre: 'un estado desconocido sale vacío',
    archivo: AYUDANTES,
    buscar: "ESTADOS[estado || 'disponible'] ?? estado",
    reemplazo: "ESTADOS[estado || 'disponible'] ?? ''"
  },
  {
    nombre: 'una referencia que no está sale como tarjeta con botones',
    archivo: PESTANA,
    buscar: "  if (!mueble) {\n    return <li className=\"mensaje-pieza no-encontrada\">Pieza no encontrada ({referencia})</li>;\n  }\n",
    reemplazo: "  if (!mueble) mueble = { nombre: referencia };\n"
  },
  {
    nombre: 'la pieza que no está no dice cuál es',
    archivo: PESTANA,
    buscar: 'Pieza no encontrada ({referencia})',
    reemplazo: 'Pieza no encontrada'
  },
  {
    nombre: 'la miniatura es la última foto',
    archivo: PESTANA,
    buscar: 'const foto = mueble.imagenes?.[0];',
    reemplazo: 'const foto = mueble.imagenes?.at(-1);'
  },
  {
    nombre: 'la miniatura no es de 60 x 60',
    archivo: PESTANA,
    buscar: 'width="60" height="60"',
    reemplazo: 'width="120" height="120"'
  },
  {
    nombre: 'sin fotos no hay hueco',
    archivo: PESTANA,
    buscar: '<span className="mensaje-pieza-foto sin-foto" aria-hidden="true" />',
    reemplazo: 'null'
  },
  {
    nombre: 'la tarjeta no enseña la referencia',
    archivo: PESTANA,
    buscar: '<span className="mensaje-pieza-ref">{referencia}</span>',
    reemplazo: '<span className="mensaje-pieza-ref" />'
  },
  {
    nombre: 'la insignia de estado no lleva el color de su estado',
    archivo: PESTANA,
    buscar: "className={`status-pill ${mueble.estado || 'disponible'}`}",
    reemplazo: 'className="status-pill"'
  },
  {
    nombre: 'el título no cambia con dos piezas',
    archivo: PESTANA,
    buscar: "piezas.length === 1 ? 'Pieza del mensaje' : 'Piezas del mensaje'",
    reemplazo: "'Pieza del mensaje'"
  },
  {
    nombre: 'la sección de piezas sale también sin piezas',
    archivo: PESTANA,
    buscar: '{piezas.length > 0 && (',
    reemplazo: '{piezas.length >= 0 && ('
  },
  {
    nombre: '«Ver/Editar pieza» abre el editor de otra pieza',
    archivo: PESTANA,
    buscar: 'onClick={() => onEditar(mueble)}',
    reemplazo: 'onClick={() => onEditar(null)}'
  },
  {
    nombre: '«Ver/Editar pieza» deja el mensaje abierto debajo del editor',
    archivo: PESTANA,
    buscar: '    setAbierto(null);\n    abrirEditorMueble(mueble);',
    reemplazo: '    abrirEditorMueble(mueble);'
  },
  {
    nombre: 'el panel no pasa el editor a la pestaña',
    archivo: PANEL,
    buscar: '            abrirEditorMueble={setMuebleAEditar}\n          />\n        )}\n\n        {vistaActiva === \'categorias\'',
    reemplazo: '            abrirEditorMueble={() => {}}\n          />\n        )}\n\n        {vistaActiva === \'categorias\''
  },
  {
    nombre: '«Crear reserva» sale con las reservas apagadas',
    archivo: PESTANA,
    buscar: 'onReservar={reservasActivas() ? reservarPieza : null}',
    reemplazo: 'onReservar={reservarPieza}'
  },
  {
    nombre: '«Crear reserva» no sale nunca',
    archivo: PESTANA,
    buscar: 'onReservar={reservasActivas() ? reservarPieza : null}',
    reemplazo: 'onReservar={null}'
  },
  {
    nombre: 'el alta no lleva la pieza del mensaje',
    archivo: PESTANA,
    buscar: 'inicial: { mueble_id: mueble.id, nombre: abierto.nombre, email: abierto.email }',
    reemplazo: 'inicial: { nombre: abierto.nombre, email: abierto.email }'
  },
  {
    nombre: 'el alta no lleva el nombre del cliente',
    archivo: PESTANA,
    buscar: 'inicial: { mueble_id: mueble.id, nombre: abierto.nombre, email: abierto.email }',
    reemplazo: 'inicial: { mueble_id: mueble.id, email: abierto.email }'
  },
  {
    nombre: 'el alta no lleva el email del cliente',
    archivo: PESTANA,
    buscar: 'inicial: { mueble_id: mueble.id, nombre: abierto.nombre, email: abierto.email }',
    reemplazo: 'inicial: { mueble_id: mueble.id, nombre: abierto.nombre }'
  },
  {
    nombre: 'el diálogo del alta no usa lo que trae',
    archivo: ALTA,
    buscar: 'useState(() => ({ ...camposAlta(hoy), ...inicial }))',
    reemplazo: 'useState(() => camposAlta(hoy))'
  },
  {
    nombre: 'el alta se guarda como bloqueo',
    archivo: PESTANA,
    buscar: "crearEnCalendarioAdmin('alquiler', datos)",
    reemplazo: "crearEnCalendarioAdmin('bloqueo', datos)"
  },
  {
    nombre: 'un alta rechazada se da por buena',
    archivo: PESTANA,
    buscar: '    if (error) {\n      setErrorAlta(error);\n      return;\n    }\n',
    reemplazo: ''
  },
  {
    nombre: 'un alta rechazada no dice por qué',
    archivo: PESTANA,
    buscar: '      setErrorAlta(error);\n',
    reemplazo: ''
  },
  {
    nombre: 'un alta guardada no avisa',
    archivo: PESTANA,
    buscar: "    showToast('Alquiler registrado', 'success');\n",
    reemplazo: ''
  },
  {
    nombre: 'un alta guardada deja el diálogo abierto',
    archivo: PESTANA,
    buscar: '    setAlta(null);\n    showToast',
    reemplazo: '    showToast'
  },
  {
    nombre: 'sin la guarda, un segundo envío registra otro alquiler',
    archivo: PESTANA,
    buscar: '    if (guardando.current) return;\n',
    reemplazo: ''
  }
];
