// Mutantes de la agenda de hoy y mañana de «Reservas» (pages/admin/AgendaReservas.jsx; ver
// scripts/mutantes-panel.js). Los mata AgendaReservas.test.jsx.
export const TEST = 'src/pages/admin/AgendaReservas.test.jsx';

const ARCHIVO = 'src/pages/admin/AgendaReservas.jsx';

export const MUTANTES = [
  {
    nombre: 'sin agenda y sin error se pinta una región vacía',
    archivo: ARCHIVO,
    buscar: '  if (!datos && !error) return null;\n',
    reemplazo: ''
  },
  {
    nombre: 'una entrega sin hora enseña «null»',
    archivo: ARCHIVO,
    buscar: "{hora ? horaCorta(hora) : 'Sin hora'}",
    reemplazo: '{horaCorta(hora)}'
  },
  {
    nombre: 'todas las horas salen como «Sin hora»',
    archivo: ARCHIVO,
    buscar: "{hora ? horaCorta(hora) : 'Sin hora'}",
    reemplazo: "{'Sin hora'}"
  },
  {
    nombre: 'entrega y recogida con el nombre cambiado',
    archivo: ARCHIVO,
    buscar: "const TIPO = { entrega: 'Entrega', recogida: 'Recogida' };",
    reemplazo: "const TIPO = { entrega: 'Recogida', recogida: 'Entrega' };"
  },
  {
    nombre: 'el modo sale tal cual lo guarda el servidor («domicilio»)',
    archivo: ARCHIVO,
    buscar: '{MODO[modo] && <span className="agenda-modo">{MODO[modo]}</span>}',
    reemplazo: '{modo && <span className="agenda-modo">{modo}</span>}'
  },
  {
    nombre: 'toda entrega dice que está atrasada',
    archivo: ARCHIVO,
    buscar: '          {atrasada && (',
    reemplazo: '          {true && ('
  },
  {
    nombre: 'una entrega atrasada dice el día de hoy en vez del que tenía previsto',
    archivo: ARCHIVO,
    buscar: 'fechaCorta(prevista)',
    reemplazo: 'fechaCorta(trayecto.dia)'
  },
  {
    nombre: 'sin datos del cliente, se rompe',
    archivo: ARCHIVO,
    buscar: '        {cliente && (',
    reemplazo: '        {true && ('
  },
  {
    nombre: 'sin teléfono sale un enlace «tel:null»',
    archivo: ARCHIVO,
    buscar: '            {cliente.telefono && (',
    reemplazo: '            {true && ('
  },
  {
    nombre: 'el teléfono no se puede pulsar para llamar',
    archivo: ARCHIVO,
    buscar: '<a href={`tel:${cliente.telefono}`}>{cliente.telefono}</a>',
    reemplazo: '<span>{cliente.telefono}</span>'
  },
  {
    nombre: 'sin dirección sale un párrafo vacío',
    archivo: ARCHIVO,
    buscar: '{direccion && <p className="agenda-direccion">{direccion}</p>}',
    reemplazo: '<p className="agenda-direccion">{direccion}</p>'
  },
  {
    nombre: '«Ver reserva» no dice de qué reserva es',
    archivo: ARCHIVO,
    buscar: 'aria-label={`Ver reserva ${reserva.referencia} (${pieza.nombre})`}',
    reemplazo: 'aria-label="Ver reserva"'
  },
  {
    nombre: '«Ver reserva» avisa con la reserva en vez de con el trayecto',
    archivo: ARCHIVO,
    buscar: 'onClick={() => onVer(trayecto)}',
    reemplazo: 'onClick={() => onVer(reserva)}'
  },
  {
    nombre: '«Ver reserva» no hace nada',
    archivo: ARCHIVO,
    buscar: 'onClick={() => onVer(trayecto)}',
    reemplazo: 'onClick={() => {}}'
  },
  {
    nombre: 'el resumen no se escribe',
    archivo: ARCHIVO,
    buscar: '{textoTrayectos(datos.trayectos)}',
    reemplazo: "{''}"
  },
  {
    nombre: 'cada día enseña los trayectos de los dos',
    archivo: ARCHIVO,
    buscar: 'datos.trayectos.filter((t) => t.dia === dia)',
    reemplazo: 'datos.trayectos'
  },
  {
    nombre: 'hoy y mañana con las fechas cambiadas',
    archivo: ARCHIVO,
    buscar: "        ['Hoy', datos.hoy],\n        ['Mañana', datos.manana]",
    reemplazo: "        ['Hoy', datos.manana],\n        ['Mañana', datos.hoy]"
  },
  {
    nombre: 'un día sin nada no lo dice',
    archivo: ARCHIVO,
    buscar: "<p className=\"agenda-vacio\">Nada que entregar ni recoger.</p>",
    reemplazo: '<p className="agenda-vacio" />'
  },
  {
    nombre: 'la fecha del día sale corta, sin el día de la semana',
    archivo: ARCHIVO,
    buscar: '{nombre} <span>{fechaLarga(dia)}</span>',
    reemplazo: '{nombre} <span>{dia}</span>'
  },
  {
    nombre: 'el aviso de que falla la agenda no es un aviso para el lector de pantalla',
    archivo: ARCHIVO,
    buscar: '<div className="reservas-agenda-error" role="status">',
    reemplazo: '<div className="reservas-agenda-error">'
  },
  {
    nombre: 'el aviso de que falla la agenda no tiene botón',
    archivo: ARCHIVO,
    buscar: 'onClick={onRecargar}',
    reemplazo: 'onClick={() => {}}'
  },
  {
    nombre: 'con una agenda de antes y un error, el error no se dice',
    archivo: ARCHIVO,
    buscar: '      {error && (\n        <div className="reservas-agenda-error"',
    reemplazo: '      {!datos && error && (\n        <div className="reservas-agenda-error"'
  }
];
