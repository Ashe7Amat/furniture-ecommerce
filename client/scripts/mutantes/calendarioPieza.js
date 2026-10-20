// Mutantes del calendario de una pieza de «Reservas» (pages/admin/CalendarioPieza.jsx; ver
// scripts/mutantes-panel.js). Los mata CalendarioPieza.test.jsx.
export const TEST = 'src/pages/admin/CalendarioPieza.test.jsx';

const ARCHIVO = 'src/pages/admin/CalendarioPieza.jsx';

export const MUTANTES = [
  // ─── la pieza ───
  {
    nombre: 'las piezas salen en el orden en que llegan, no por nombre',
    archivo: ARCHIVO,
    buscar: "() => [...muebles].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),",
    reemplazo: '() => [...muebles],'
  },
  {
    nombre: 'sin elegir pieza se enseña la primera',
    archivo: ARCHIVO,
    buscar: 'm.id === muebleId) ?? null;',
    reemplazo: 'm.id === muebleId) ?? piezas[0] ?? null;'
  },
  {
    nombre: 'una pieza sin referencia sale con paréntesis vacíos',
    archivo: ARCHIVO,
    buscar: '{m.referencia ? `${m.nombre} (${m.referencia})` : m.nombre}',
    reemplazo: '{`${m.nombre} (${m.referencia})`}'
  },
  {
    nombre: 'las piezas salen sin su referencia',
    archivo: ARCHIVO,
    buscar: '{m.referencia ? `${m.nombre} (${m.referencia})` : m.nombre}',
    reemplazo: '{m.nombre}'
  },
  {
    nombre: 'sin pieza elegida no hay ninguna pista de qué hacer',
    archivo: ARCHIVO,
    buscar: '<p className="admin-empty-note">Elige una pieza para ver sus reservas mes a mes.</p>',
    reemplazo: '<p className="admin-empty-note" />'
  },
  {
    nombre: 'cambiar de pieza deja abierto el detalle de la anterior',
    archivo: ARCHIVO,
    buscar: '    setMuebleId(evento.target.value);\n    setSeleccion(null);',
    reemplazo: '    setMuebleId(evento.target.value);'
  },
  // ─── qué se lee ───
  {
    nombre: 'el calendario se abre en el mes del día de hoy equivocado',
    archivo: ARCHIVO,
    buscar: 'useState(() => mesDe(hoy))',
    reemplazo: "useState(() => mesDe('2020-01-15'))"
  },
  {
    nombre: 'se lee hasta el primer día del mes siguiente',
    archivo: ARCHIVO,
    buscar: 'primerDiaDe(sumarMeses(mes, 1)), -1);',
    reemplazo: 'primerDiaDe(sumarMeses(mes, 1)), 0);'
  },
  {
    nombre: 'se lee solo hasta el penúltimo día del mes',
    archivo: ARCHIVO,
    buscar: 'primerDiaDe(sumarMeses(mes, 1)), -1);',
    reemplazo: 'primerDiaDe(sumarMeses(mes, 1)), -2);'
  },
  {
    nombre: 'se lee desde el día de hoy y no desde el primero del mes',
    archivo: ARCHIVO,
    buscar: 'const desde = primerDiaDe(mes);',
    reemplazo: 'const desde = hoy;'
  },
  {
    nombre: 'se leen las reservas de todas las piezas',
    archivo: ARCHIVO,
    buscar: '    hasta,\n    muebleId,\n    version:',
    reemplazo: '    hasta,\n    version:'
  },
  {
    nombre: '«Reintentar» no vuelve a leer',
    archivo: ARCHIVO,
    buscar: 'version: `${version}.${intento}`,',
    reemplazo: 'version,'
  },
  {
    nombre: 'un cambio en la pestaña no vuelve a leer el calendario',
    archivo: ARCHIVO,
    buscar: 'version: `${version}.${intento}`,',
    reemplazo: 'version: intento,'
  },
  {
    nombre: 'se lee sin haber elegido pieza',
    archivo: ARCHIVO,
    buscar: 'activo: activo && Boolean(pieza)',
    reemplazo: 'activo'
  },
  {
    nombre: 'se lee con el calendario escondido',
    archivo: ARCHIVO,
    buscar: 'activo: activo && Boolean(pieza)',
    reemplazo: 'activo: Boolean(pieza)'
  },
  {
    nombre: 'el día de hoy es el del reloj aunque el servidor diga otro',
    archivo: ARCHIVO,
    buscar: 'const hoyReal = datos?.hoy ?? hoy;',
    reemplazo: 'const hoyReal = hoy;'
  },
  {
    nombre: 'se dibujan reservas de otras piezas',
    archivo: ARCHIVO,
    buscar: '(datos?.reservas ?? []).filter((r) => r.pieza.id === muebleId),',
    reemplazo: '(datos?.reservas ?? []),'
  },
  // ─── el mes ───
  {
    nombre: '«Mes anterior» va al mes siguiente',
    archivo: ARCHIVO,
    buscar: 'onClick={() => irAlMes(sumarMeses(mes, -1))}',
    reemplazo: 'onClick={() => irAlMes(sumarMeses(mes, 1))}'
  },
  {
    nombre: '«Mes siguiente» va al mes anterior',
    archivo: ARCHIVO,
    buscar: 'onClick={() => irAlMes(sumarMeses(mes, 1))}',
    reemplazo: 'onClick={() => irAlMes(sumarMeses(mes, -1))}'
  },
  {
    nombre: 'cambiar de mes deja abierto el detalle',
    archivo: ARCHIVO,
    buscar: '    setMes(nuevo);\n    setSeleccion(null);',
    reemplazo: '    setMes(nuevo);'
  },
  {
    nombre: '«Este mes» no hace nada',
    archivo: ARCHIVO,
    buscar: 'onClick={() => irAlMes(mesDe(hoyReal))}',
    reemplazo: 'onClick={() => irAlMes(mes)}'
  },
  {
    nombre: '«Este mes» sigue activo estando en este mes',
    archivo: ARCHIVO,
    buscar: 'disabled={mes === mesDe(hoyReal)}',
    reemplazo: 'disabled={false}'
  },
  {
    nombre: '«Este mes» está desactivado estando en otro mes',
    archivo: ARCHIVO,
    buscar: 'disabled={mes === mesDe(hoyReal)}',
    reemplazo: 'disabled'
  },
  {
    nombre: 'el título no dice qué mes es',
    archivo: ARCHIVO,
    buscar: '<h3 className="ocupacion-titulo" aria-live="polite">{nombreDelMes(mes)}</h3>',
    reemplazo: '<h3 className="ocupacion-titulo" aria-live="polite" />'
  },
  // ─── mientras se lee ───
  {
    nombre: 'un fallo al leer no se enseña',
    archivo: ARCHIVO,
    buscar: '          {error && (',
    reemplazo: '          {false && ('
  },
  {
    nombre: '«Reintentar» no hace nada',
    archivo: ARCHIVO,
    buscar: 'onClick={() => setIntento((n) => n + 1)}',
    reemplazo: 'onClick={() => {}}'
  },
  {
    nombre: 'mientras se lee no se avisa',
    archivo: ARCHIVO,
    buscar: '{!datos && cargando && <p',
    reemplazo: '{false && <p'
  },
  {
    nombre: 'con un fallo se sigue diciendo que está cargando',
    archivo: ARCHIVO,
    buscar: '{!datos && cargando && <p',
    reemplazo: '{!datos && <p'
  },
  {
    nombre: 'al volver a leer se vuelve a decir que está cargando aunque se vea el calendario',
    archivo: ARCHIVO,
    buscar: '{!datos && cargando && <p',
    reemplazo: '{cargando && <p'
  },
  {
    nombre: 'el calendario no avisa de que se está volviendo a leer',
    archivo: ARCHIVO,
    buscar: '<table className="ocupacion-mes" aria-busy={cargando}>',
    reemplazo: '<table className="ocupacion-mes">'
  },
  // ─── el resumen y los avisos ───
  {
    nombre: 'el resumen cuenta las reservas con el mes entero en vez del mes que se ve',
    archivo: ARCHIVO,
    buscar: 'textoReservasDelMes(enElMes.size, mes)',
    reemplazo: 'textoReservasDelMes(reservas.length, mes)'
  },
  {
    nombre: 'el resumen no cuenta las reservas',
    archivo: ARCHIVO,
    buscar: '    if (reserva) enElMes.add(reserva.id);\n',
    reemplazo: ''
  },
  {
    nombre: 'el resumen no cuenta las retrasadas que tienen la pieza fuera',
    archivo: ARCHIVO,
    buscar: '    if (retraso) enElMes.add(retraso.id);\n',
    reemplazo: ''
  },
  {
    nombre: 'el resumen cuenta cada día de la reserva en vez de cada reserva',
    archivo: ARCHIVO,
    buscar: "const enElMes = new Set();",
    reemplazo: "const enElMes = { size: 0, add() { this.size += 1; } };"
  },
  {
    nombre: 'no avisa de que faltan reservas por el límite',
    archivo: ARCHIVO,
    buscar: '{datos.limitada && (',
    reemplazo: '{false && ('
  },
  {
    nombre: 'avisa de que faltan reservas aunque no falten',
    archivo: ARCHIVO,
    buscar: '{datos.limitada && (',
    reemplazo: '{true && ('
  },
  // ─── la tabla ───
  {
    nombre: 'la tabla no dice de qué pieza y mes es',
    archivo: ARCHIVO,
    buscar: 'Calendario de {pieza.nombre}, {nombreDelMes(mes)}',
    reemplazo: 'Calendario'
  },
  {
    nombre: 'los días de la semana no se leen enteros',
    archivo: ARCHIVO,
    buscar: '<th key={corto} scope="col" abbr={largo}>{corto}</th>',
    reemplazo: '<th key={corto} scope="col">{corto}</th>'
  },
  {
    nombre: 'los huecos de antes y después del mes se dibujan como días',
    archivo: ARCHIVO,
    buscar: '<td key={`hueco-${i}`} className="ocupacion-dia ocupacion-dia--fuera" />',
    reemplazo: '<td key={`hueco-${i}`} className="ocupacion-dia" />'
  },
  {
    nombre: 'hoy se marca en el día del reloj y no en el del servidor',
    archivo: ARCHIVO,
    buscar: 'esHoy={dia === hoyReal}',
    reemplazo: 'esHoy={dia === hoy}'
  },
  {
    nombre: 'ningún día se marca como elegido',
    archivo: ARCHIVO,
    buscar: 'elegido={dia === seleccion}',
    reemplazo: 'elegido={false}'
  },
  // ─── un día ───
  {
    nombre: 'un día ocupado no tiene el color de su reserva',
    archivo: ARCHIVO,
    buscar: 'ocupado && `ocupacion-dia--${reserva ? claseDe(reserva) : \'retrasada\'}`,',
    reemplazo: "ocupado && 'ocupacion-dia--alquiler',"
  },
  {
    nombre: 'un día con solo retraso no tiene el color de retraso',
    archivo: ARCHIVO,
    buscar: "reserva ? claseDe(reserva) : 'retrasada'}",
    reemplazo: "reserva ? claseDe(reserva) : 'alquiler'}"
  },
  {
    nombre: 'un día de margen no se marca como margen',
    archivo: ARCHIVO,
    buscar: "parte === 'margen' && 'ocupacion-dia--margen',",
    reemplazo: ''
  },
  {
    nombre: 'un día de reserva se marca como margen',
    archivo: ARCHIVO,
    buscar: "parte === 'margen' && 'ocupacion-dia--margen',",
    reemplazo: "parte === 'reserva' && 'ocupacion-dia--margen',"
  },
  {
    nombre: 'un día con reserva y retraso a la vez no se marca',
    archivo: ARCHIVO,
    buscar: "reserva && retraso && 'ocupacion-dia--con-retraso',",
    reemplazo: ''
  },
  {
    nombre: 'hoy no se marca',
    archivo: ARCHIVO,
    buscar: "esHoy && 'ocupacion-dia--hoy',",
    reemplazo: ''
  },
  {
    nombre: 'el día elegido no se marca',
    archivo: ARCHIVO,
    buscar: "elegido && 'is-seleccionado'",
    reemplazo: 'false'
  },
  {
    nombre: 'el número del día sale mal',
    archivo: ARCHIVO,
    buscar: 'const numero = Number(dia.slice(8));',
    reemplazo: 'const numero = Number(dia.slice(5, 7));'
  },
  {
    nombre: 'hoy no se lee como hoy',
    archivo: ARCHIVO,
    buscar: "${esHoy ? ' (hoy)' : ''}`;",
    reemplazo: '`;'
  },
  {
    nombre: 'un día ocupado no es un botón',
    archivo: ARCHIVO,
    buscar: 'const ocupado = Boolean(reserva || retraso);',
    reemplazo: 'const ocupado = Boolean(reserva);'
  },
  {
    nombre: 'un día libre es un botón',
    archivo: ARCHIVO,
    buscar: 'const ocupado = Boolean(reserva || retraso);',
    reemplazo: 'const ocupado = true;'
  },
  {
    nombre: 'el botón del día no dice si está pulsado',
    archivo: ARCHIVO,
    buscar: '          aria-pressed={elegido}\n',
    reemplazo: ''
  },
  {
    nombre: 'el botón del día no dice qué hay ese día',
    archivo: ARCHIVO,
    buscar: '          aria-label={texto}\n',
    reemplazo: ''
  },
  {
    nombre: 'la marca de reserva y retraso no está',
    archivo: ARCHIVO,
    buscar: '{reserva && retraso && <span className="ocupacion-marca" aria-hidden="true">!</span>}',
    reemplazo: ''
  },
  {
    nombre: 'un día libre no dice que está libre',
    archivo: ARCHIVO,
    buscar: '<span className="ocupacion-solo-lector">{texto}</span>',
    reemplazo: '<span className="ocupacion-solo-lector" />'
  },
  // ─── el detalle ───
  {
    nombre: 'pulsar un día no lo elige',
    archivo: ARCHIVO,
    buscar: '    setSeleccion(dia === seleccion ? null : dia);',
    reemplazo: '    setSeleccion(null);'
  },
  {
    nombre: 'volver a pulsar el día elegido no cierra el detalle',
    archivo: ARCHIVO,
    buscar: 'setSeleccion(dia === seleccion ? null : dia);',
    reemplazo: 'setSeleccion(dia);'
  },
  {
    nombre: 'al cerrar el detalle el foco no vuelve al día',
    archivo: ARCHIVO,
    buscar: '    disparador.current?.focus();\n',
    reemplazo: ''
  },
  {
    nombre: 'el foco no sabe a qué día volver',
    archivo: ARCHIVO,
    buscar: '    disparador.current = boton;\n',
    reemplazo: ''
  },
  {
    nombre: '«Cerrar detalle» no cierra',
    archivo: ARCHIVO,
    buscar: '    setSeleccion(null);\n    disparador.current?.focus();',
    reemplazo: '    disparador.current?.focus();'
  },
  {
    nombre: 'el detalle de un día con retraso no enseña la retrasada',
    archivo: ARCHIVO,
    buscar: '[detalle.reserva, detalle.retraso].filter(Boolean)',
    reemplazo: '[detalle.reserva].filter(Boolean)'
  },
  {
    nombre: 'el detalle de un día con retraso no enseña la reserva',
    archivo: ARCHIVO,
    buscar: '[detalle.reserva, detalle.retraso].filter(Boolean)',
    reemplazo: '[detalle.retraso].filter(Boolean)'
  },
  {
    nombre: 'el detalle no enseña el día',
    archivo: ARCHIVO,
    buscar: '<DetalleOcupacion reservas={delDetalle} dia={seleccion}',
    reemplazo: '<DetalleOcupacion reservas={delDetalle}'
  },
  {
    nombre: '«Ver reserva» del detalle no hace nada',
    archivo: ARCHIVO,
    buscar: 'onVer={onVer} onCerrar={cerrarDetalle}',
    reemplazo: 'onVer={() => {}} onCerrar={cerrarDetalle}'
  }
];
