// Mutantes del detalle que se abre al pulsar un día o una barra de los calendarios de «Reservas»
// (pages/admin/DetalleOcupacion.jsx; ver scripts/mutantes-panel.js). Los mata DetalleOcupacion.test.jsx.
export const TEST = 'src/pages/admin/DetalleOcupacion.test.jsx';

const ARCHIVO = 'src/pages/admin/DetalleOcupacion.jsx';

export const MUTANTES = [
  {
    nombre: 'al abrirse el detalle no se lleva el foco',
    archivo: ARCHIVO,
    buscar: '    raiz.current?.focus();\n',
    reemplazo: ''
  },
  {
    nombre: 'el detalle solo se lleva el foco al abrirse, no al cambiar de día',
    archivo: ARCHIVO,
    buscar: '  }, [clave]);',
    reemplazo: '  }, []);'
  },
  {
    nombre: 'cambiar de día con las mismas reservas no vuelve a llevar el foco',
    archivo: ARCHIVO,
    buscar: "const clave = `${dia ?? ''}|${reservas.map((r) => r.id).join(',')}`;",
    reemplazo: "const clave = `${reservas.map((r) => r.id).join(',')}`;"
  },
  {
    nombre: 'cambiar de reservas en el mismo día no vuelve a llevar el foco',
    archivo: ARCHIVO,
    buscar: "const clave = `${dia ?? ''}|${reservas.map((r) => r.id).join(',')}`;",
    reemplazo: "const clave = `${dia ?? ''}`;"
  },
  {
    nombre: 'el detalle no puede recibir el foco',
    archivo: ARCHIVO,
    buscar: '      tabIndex={-1}\n',
    reemplazo: ''
  },
  {
    nombre: 'el detalle de un día no dice qué día es',
    archivo: ARCHIVO,
    buscar: "aria-label={dia ? `Detalle del ${fechaLarga(dia)}` : 'Detalle de la reserva'}",
    reemplazo: "aria-label=\"Detalle de la reserva\""
  },
  {
    nombre: 'el detalle de una barra dice que es de un día',
    archivo: ARCHIVO,
    buscar: "aria-label={dia ? `Detalle del ${fechaLarga(dia)}` : 'Detalle de la reserva'}",
    reemplazo: 'aria-label={`Detalle del ${fechaLarga(dia)}`}'
  },
  {
    nombre: 'el detalle de un día no enseña el día',
    archivo: ARCHIVO,
    buscar: '{dia && <p className="ocupacion-detalle-dia">{fechaLarga(dia)}</p>}',
    reemplazo: ''
  },
  {
    nombre: 'el detalle de una barra enseña un día vacío',
    archivo: ARCHIVO,
    buscar: '{dia && <p className="ocupacion-detalle-dia">',
    reemplazo: '{true && <p className="ocupacion-detalle-dia">'
  },
  {
    nombre: '«Cerrar detalle» no cierra',
    archivo: ARCHIVO,
    buscar: 'onClick={onCerrar}>Cerrar detalle',
    reemplazo: 'onClick={() => {}}>Cerrar detalle'
  },
  {
    nombre: 'el detalle se dibuja con el color de un alquiler sea lo que sea',
    archivo: ARCHIVO,
    buscar: 'ocupacion-detalle--${claseDe(r)}`}',
    reemplazo: 'ocupacion-detalle--alquiler`}'
  },
  {
    nombre: 'una retrasada no se marca en el estado',
    archivo: ARCHIVO,
    buscar: "r.retrasada || r.en_conflicto ? ' is-aviso' : ''",
    reemplazo: "r.en_conflicto ? ' is-aviso' : ''"
  },
  {
    nombre: 'una reserva en conflicto no se marca en el estado',
    archivo: ARCHIVO,
    buscar: "r.retrasada || r.en_conflicto ? ' is-aviso' : ''",
    reemplazo: "r.retrasada ? ' is-aviso' : ''"
  },
  {
    nombre: 'el estado de la reserva no aparece',
    archivo: ARCHIVO,
    buscar: '              {r.etiqueta}\n',
    reemplazo: ''
  },
  {
    nombre: 'el tipo de reserva sale en minúsculas',
    archivo: ARCHIVO,
    buscar: '{TIPO[r.tipo] ?? r.tipo} {r.referencia}',
    reemplazo: '{r.tipo} {r.referencia}'
  },
  {
    nombre: 'no aparece la referencia de la reserva',
    archivo: ARCHIVO,
    buscar: '{TIPO[r.tipo] ?? r.tipo} {r.referencia}',
    reemplazo: '{TIPO[r.tipo] ?? r.tipo}'
  },
  {
    nombre: 'no aparece el nombre de la pieza',
    archivo: ARCHIVO,
    buscar: '            <strong>{r.pieza.nombre}</strong>\n',
    reemplazo: ''
  },
  {
    nombre: 'no aparece la referencia de la pieza',
    archivo: ARCHIVO,
    buscar: '            <ReferenciaProducto referencia={r.pieza.referencia} className="reserva-ref" />\n',
    reemplazo: ''
  },
  {
    nombre: 'el detalle no enseña ninguna fila',
    archivo: ARCHIVO,
    buscar: '{filasDeDetalle(r).map(',
    reemplazo: '{[].map('
  },
  {
    nombre: 'una retrasada no avisa de que la pieza sigue fuera',
    archivo: ARCHIVO,
    buscar: '          {r.retrasada && (',
    reemplazo: '          {false && ('
  },
  {
    nombre: 'cualquier reserva avisa de que la pieza sigue fuera',
    archivo: ARCHIVO,
    buscar: '          {r.retrasada && (',
    reemplazo: '          {true && ('
  },
  {
    nombre: 'aviso de retraso con la fecha de entrega y no la de recogida',
    archivo: ARCHIVO,
    buscar: 'estaba prevista el {fechaCorta(r.fecha_fin)}',
    reemplazo: 'estaba prevista el {fechaCorta(r.fecha_inicio)}'
  },
  {
    nombre: 'una reserva en conflicto no avisa de que no se pudo confirmar',
    archivo: ARCHIVO,
    buscar: '          {r.en_conflicto && (',
    reemplazo: '          {false && ('
  },
  {
    nombre: 'cualquier reserva avisa de que no se pudo confirmar',
    archivo: ARCHIVO,
    buscar: '          {r.en_conflicto && (',
    reemplazo: '          {true && ('
  },
  {
    nombre: '«Ver reserva» no dice qué reserva es',
    archivo: ARCHIVO,
    buscar: 'aria-label={`Ver reserva ${r.referencia} (${r.pieza.nombre}) en la lista`}',
    reemplazo: 'aria-label="Ver reserva"'
  },
  {
    nombre: '«Ver reserva» no pasa la reserva',
    archivo: ARCHIVO,
    buscar: 'onClick={() => onVer(r)}',
    reemplazo: 'onClick={() => onVer()}'
  },
  {
    nombre: '«Ver reserva» abre siempre la primera reserva',
    archivo: ARCHIVO,
    buscar: 'onClick={() => onVer(r)}',
    reemplazo: 'onClick={() => onVer(reservas[0])}'
  }
];
