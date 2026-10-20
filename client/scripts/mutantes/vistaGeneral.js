// Mutantes de la vista general de «Reservas» (pages/admin/VistaGeneral.jsx; ver
// scripts/mutantes-panel.js). Los mata VistaGeneral.test.jsx.
export const TEST = 'src/pages/admin/VistaGeneral.test.jsx';

const ARCHIVO = 'src/pages/admin/VistaGeneral.jsx';

export const MUTANTES = [
  // ─── qué se lee ───
  {
    nombre: 'la vista empieza en un día que no es hoy',
    archivo: ARCHIVO,
    buscar: 'useState(hoy)',
    reemplazo: "useState('2020-01-01')"
  },
  {
    nombre: 'la vista empieza viendo 60 días',
    archivo: ARCHIVO,
    buscar: 'useState(LARGOS[0])',
    reemplazo: 'useState(LARGOS[1])'
  },
  {
    nombre: 'se lee un día de más',
    archivo: ARCHIVO,
    buscar: 'sumarDias(inicio, nDias - 1);',
    reemplazo: 'sumarDias(inicio, nDias);'
  },
  {
    nombre: 'se lee un día de menos',
    archivo: ARCHIVO,
    buscar: 'sumarDias(inicio, nDias - 1);',
    reemplazo: 'sumarDias(inicio, nDias - 2);'
  },
  {
    nombre: 'se lee desde hoy aunque se haya movido la vista',
    archivo: ARCHIVO,
    buscar: '    desde: inicio,\n',
    reemplazo: '    desde: hoy,\n'
  },
  {
    nombre: '«Reintentar» no vuelve a leer',
    archivo: ARCHIVO,
    buscar: 'version: `${version}.${intento}`,',
    reemplazo: 'version,'
  },
  {
    nombre: 'un cambio en la pestaña no vuelve a leer la vista',
    archivo: ARCHIVO,
    buscar: 'version: `${version}.${intento}`,',
    reemplazo: 'version: intento,'
  },
  {
    nombre: 'se lee con la vista escondida',
    archivo: ARCHIVO,
    buscar: '    version: `${version}.${intento}`,\n    activo\n',
    reemplazo: '    version: `${version}.${intento}`\n'
  },
  {
    nombre: 'el día de hoy es el del reloj aunque el servidor diga otro',
    archivo: ARCHIVO,
    buscar: 'const hoyReal = datos?.hoy ?? hoy;',
    reemplazo: 'const hoyReal = hoy;'
  },
  // ─── navegación ───
  {
    nombre: '«Semana anterior» va a la semana siguiente',
    archivo: ARCHIVO,
    buscar: 'onClick={() => mover(-SEMANA)}',
    reemplazo: 'onClick={() => mover(SEMANA)}'
  },
  {
    nombre: '«Semana siguiente» mueve menos de una semana',
    archivo: ARCHIVO,
    buscar: 'onClick={() => mover(SEMANA)}',
    reemplazo: 'onClick={() => mover(1)}'
  },
  {
    nombre: 'moverse deja abierto el detalle',
    archivo: ARCHIVO,
    buscar: '    setInicio((i) => sumarDias(i, n));\n    setSeleccion(null);',
    reemplazo: '    setInicio((i) => sumarDias(i, n));'
  },
  {
    nombre: 'el título no dice desde qué día',
    archivo: ARCHIVO,
    buscar: 'Del {fechaCorta(inicio)} al {fechaCorta(hasta)}',
    reemplazo: 'Del {fechaCorta(hoy)} al {fechaCorta(hasta)}'
  },
  {
    nombre: 'el título no dice hasta qué día',
    archivo: ARCHIVO,
    buscar: 'Del {fechaCorta(inicio)} al {fechaCorta(hasta)}',
    reemplazo: 'Del {fechaCorta(inicio)} al {fechaCorta(inicio)}'
  },
  {
    nombre: '«Hoy» sigue activo estando ya en hoy',
    archivo: ARCHIVO,
    buscar: 'disabled={inicio === hoyReal}',
    reemplazo: 'disabled={false}'
  },
  {
    nombre: '«Hoy» está desactivado fuera de hoy',
    archivo: ARCHIVO,
    buscar: 'disabled={inicio === hoyReal}',
    reemplazo: 'disabled'
  },
  {
    nombre: '«Hoy» no vuelve a hoy',
    archivo: ARCHIVO,
    buscar: '            setInicio(hoyReal);\n',
    reemplazo: ''
  },
  {
    nombre: '«Hoy» vuelve a hoy pero deja abierto el detalle',
    archivo: ARCHIVO,
    buscar: '            setInicio(hoyReal);\n            setSeleccion(null);',
    reemplazo: '            setInicio(hoyReal);'
  },
  {
    nombre: '«Hoy» vuelve al día de hoy del reloj y no al del servidor',
    archivo: ARCHIVO,
    buscar: 'setInicio(hoyReal);',
    reemplazo: 'setInicio(hoy);'
  },
  {
    nombre: 'los botones de 30 y 60 días no cambian los días',
    archivo: ARCHIVO,
    buscar: 'onClick={() => setNDias(n)}',
    reemplazo: 'onClick={() => {}}'
  },
  {
    nombre: 'los botones de 30 y 60 días no marcan el elegido',
    archivo: ARCHIVO,
    buscar: 'aria-pressed={n === nDias}',
    reemplazo: 'aria-pressed={n === 30}'
  },
  {
    nombre: 'solo se puede ver 30 días',
    archivo: ARCHIVO,
    buscar: 'const LARGOS = [30, 60];',
    reemplazo: 'const LARGOS = [30];'
  },
  // ─── mientras se lee ───
  {
    nombre: 'un fallo al leer no se enseña',
    archivo: ARCHIVO,
    buscar: '      {error && (',
    reemplazo: '      {false && ('
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
    nombre: 'al volver a leer se vuelve a decir que está cargando aunque se vea la vista',
    archivo: ARCHIVO,
    buscar: '{!datos && cargando && <p',
    reemplazo: '{cargando && <p'
  },
  {
    nombre: 'la rejilla no avisa de que se está volviendo a leer',
    archivo: ARCHIVO,
    buscar: '              aria-busy={cargando}\n',
    reemplazo: ''
  },
  // ─── resumen y avisos ───
  {
    nombre: 'el resumen cuenta reservas y no piezas',
    archivo: ARCHIVO,
    buscar: 'textoPiezasConReservas(filas.length, nDias)',
    reemplazo: 'textoPiezasConReservas(reservas.length, nDias)'
  },
  {
    nombre: 'el resumen no dice cuántos días se ven',
    archivo: ARCHIVO,
    buscar: 'textoPiezasConReservas(filas.length, nDias)',
    reemplazo: 'textoPiezasConReservas(filas.length, 30)'
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
  {
    nombre: 'la sección «A vigilar» sale sin avisos',
    archivo: ARCHIVO,
    buscar: '{avisos.length > 0 && (',
    reemplazo: '{true && ('
  },
  {
    nombre: 'la sección «A vigilar» no sale con avisos',
    archivo: ARCHIVO,
    buscar: '{avisos.length > 0 && (',
    reemplazo: '{false && ('
  },
  {
    nombre: 'los avisos no se calculan con el día del servidor',
    archivo: ARCHIVO,
    buscar: 'avisosDeOcupacion(reservas, hoyReal), [reservas, hoyReal]',
    reemplazo: 'avisosDeOcupacion(reservas, hoy), [reservas, hoy]'
  },
  {
    nombre: 'las filas no se calculan con el día del servidor',
    archivo: ARCHIVO,
    buscar: 'filasDeOcupacion(reservas, inicio, nDias, hoyReal)',
    reemplazo: 'filasDeOcupacion(reservas, inicio, nDias, hoy)'
  },
  {
    nombre: 'cada aviso sale sin su texto',
    archivo: ARCHIVO,
    buscar: '<li key={aviso.clave}>{aviso.texto}</li>',
    reemplazo: '<li key={aviso.clave} />'
  },
  // ─── la rejilla ───
  {
    nombre: 'la rejilla sale vacía cuando ninguna pieza tiene reservas',
    archivo: ARCHIVO,
    buscar: '{filas.length > 0 && (\n            <div\n              className="ocupacion-rejilla"',
    reemplazo: '{true && (\n            <div\n              className="ocupacion-rejilla"'
  },
  {
    nombre: 'la rejilla no sale cuando hay piezas con reservas',
    archivo: ARCHIVO,
    buscar: '{filas.length > 0 && (\n            <div\n              className="ocupacion-rejilla"',
    reemplazo: '{false && (\n            <div\n              className="ocupacion-rejilla"'
  },
  {
    nombre: 'la rejilla no sabe cuántos días tiene',
    archivo: ARCHIVO,
    buscar: "style={{ '--dias': nDias }}",
    reemplazo: "style={{ '--dias': 30 }}"
  },
  {
    nombre: 'la rejilla no dice que se desplaza',
    archivo: ARCHIVO,
    buscar: 'aria-label="Rejilla de reservas por pieza y día; se desplaza hacia los lados"',
    reemplazo: 'aria-label="Rejilla de reservas"'
  },
  {
    nombre: 'la cabecera de la rejilla se lee en voz alta',
    archivo: ARCHIVO,
    buscar: '<div className="ocupacion-cabecera" aria-hidden="true">',
    reemplazo: '<div className="ocupacion-cabecera">'
  },
  {
    nombre: 'los meses de la cabecera no ocupan sus columnas',
    archivo: ARCHIVO,
    buscar: 'style={{ gridColumn: columnas([m.desde, m.hasta]) }}',
    reemplazo: 'style={{ gridColumn: columnas([0, 1]) }}'
  },
  {
    nombre: 'los meses de la cabecera sin nombre',
    archivo: ARCHIVO,
    buscar: '                          {nombreDelMes(m.mes)}\n',
    reemplazo: ''
  },
  {
    nombre: 'los fines de semana no se marcan',
    archivo: ARCHIVO,
    buscar: "diaDeLaSemana(dia) >= 5 && 'es-finde',",
    reemplazo: ''
  },
  {
    nombre: 'el viernes se marca como fin de semana',
    archivo: ARCHIVO,
    buscar: 'diaDeLaSemana(dia) >= 5',
    reemplazo: 'diaDeLaSemana(dia) >= 4'
  },
  {
    nombre: 'el domingo no se marca como fin de semana',
    archivo: ARCHIVO,
    buscar: 'diaDeLaSemana(dia) >= 5',
    reemplazo: 'diaDeLaSemana(dia) === 5'
  },
  {
    nombre: 'hoy no se marca en la cabecera',
    archivo: ARCHIVO,
    buscar: "dia === hoyReal && 'es-hoy'",
    reemplazo: 'false'
  },
  {
    nombre: 'el número del día sale mal',
    archivo: ARCHIVO,
    buscar: '{Number(dia.slice(8))}',
    reemplazo: '{Number(dia.slice(5, 7))}'
  },
  {
    nombre: 'la fila no dice el nombre de la pieza',
    archivo: ARCHIVO,
    buscar: '                        <strong>{pieza.nombre}</strong>\n',
    reemplazo: ''
  },
  {
    nombre: 'la fila no dice la referencia de la pieza',
    archivo: ARCHIVO,
    buscar: '                        <ReferenciaProducto referencia={pieza.referencia} className="reserva-ref" />\n',
    reemplazo: ''
  },
  {
    nombre: 'las barras de una pieza no se agrupan con su nombre',
    archivo: ARCHIVO,
    buscar: 'aria-label={`Reservas de ${pieza.nombre}`}',
    reemplazo: 'aria-label="Reservas"'
  },
  {
    nombre: 'la marca de hoy sale aunque hoy no esté en la ventana (antes)',
    archivo: ARCHIVO,
    buscar: '{columnaDeHoy >= 0 && columnaDeHoy < nDias && (',
    reemplazo: '{columnaDeHoy < nDias && ('
  },
  {
    nombre: 'la marca de hoy sale aunque hoy no esté en la ventana (después)',
    archivo: ARCHIVO,
    buscar: '{columnaDeHoy >= 0 && columnaDeHoy < nDias && (',
    reemplazo: '{columnaDeHoy >= 0 && ('
  },
  {
    nombre: 'la marca de hoy no sale el primer día de la ventana',
    archivo: ARCHIVO,
    buscar: '{columnaDeHoy >= 0 && columnaDeHoy',
    reemplazo: '{columnaDeHoy > 0 && columnaDeHoy'
  },
  {
    nombre: 'la marca de hoy no sale el último día de la ventana',
    archivo: ARCHIVO,
    buscar: 'columnaDeHoy < nDias && (',
    reemplazo: 'columnaDeHoy < nDias - 1 && ('
  },
  {
    nombre: 'la marca de hoy se coloca en la columna anterior',
    archivo: ARCHIVO,
    buscar: 'gridColumn: `${columnaDeHoy + 1} / ${columnaDeHoy + 2}`',
    reemplazo: 'gridColumn: `${columnaDeHoy} / ${columnaDeHoy + 1}`'
  },
  // ─── una barra ───
  {
    nombre: 'una reserva sin días en la ventana (solo retraso) dibuja barra',
    archivo: ARCHIVO,
    buscar: '{tramos.length > 0 && (',
    reemplazo: '{true && ('
  },
  {
    nombre: 'una reserva con días en la ventana no dibuja barra',
    archivo: ARCHIVO,
    buscar: '{tramos.length > 0 && (',
    reemplazo: '{false && ('
  },
  {
    nombre: 'la barra no tiene el color de su reserva',
    archivo: ARCHIVO,
    buscar: '`ocupacion-barra--${claseDe(reserva)}`,',
    reemplazo: "'ocupacion-barra--alquiler',"
  },
  {
    nombre: 'la barra cortada por la izquierda no lo dice',
    archivo: ARCHIVO,
    buscar: "cortaIzq && 'es-cortada-izq',",
    reemplazo: ''
  },
  {
    nombre: 'la barra cortada por la derecha no lo dice',
    archivo: ARCHIVO,
    buscar: "cortaDer && 'es-cortada-der',",
    reemplazo: ''
  },
  {
    nombre: 'la barra elegida no se marca',
    archivo: ARCHIVO,
    buscar: "elegida && 'is-seleccionado'\n          ]",
    reemplazo: 'false\n          ]'
  },
  {
    nombre: 'la barra empieza en la columna del primer tramo equivocada (usa la última)',
    archivo: ARCHIVO,
    buscar: 'columnas([Math.min(...tramos.map((t) => t[0])), Math.max(...tramos.map((t) => t[1]))])',
    reemplazo: 'columnas([Math.max(...tramos.map((t) => t[0])), Math.max(...tramos.map((t) => t[1]))])'
  },
  {
    nombre: 'la barra acaba en el final del primer tramo y no en el del margen',
    archivo: ARCHIVO,
    buscar: 'columnas([Math.min(...tramos.map((t) => t[0])), Math.max(...tramos.map((t) => t[1]))])',
    reemplazo: 'columnas([Math.min(...tramos.map((t) => t[0])), Math.min(...tramos.map((t) => t[1]))])'
  },
  {
    nombre: 'la barra no reparte su ancho entre reserva y margen',
    archivo: ARCHIVO,
    buscar: 'gridTemplateColumns: `${dias(reservado)}fr ${dias(margen)}fr`',
    reemplazo: 'gridTemplateColumns: `1fr 1fr`'
  },
  {
    nombre: 'la barra da al margen el ancho de la reserva',
    archivo: ARCHIVO,
    buscar: 'gridTemplateColumns: `${dias(reservado)}fr ${dias(margen)}fr`',
    reemplazo: 'gridTemplateColumns: `${dias(margen)}fr ${dias(reservado)}fr`'
  },
  {
    nombre: 'una barra sin margen cuenta un día de margen',
    archivo: ARCHIVO,
    buscar: 'const dias = (tramo) => (tramo ? tramo[1] - tramo[0] : 0);',
    reemplazo: 'const dias = (tramo) => (tramo ? tramo[1] - tramo[0] : 1);'
  },
  {
    nombre: 'una barra cuenta un día de más',
    archivo: ARCHIVO,
    buscar: 'const dias = (tramo) => (tramo ? tramo[1] - tramo[0] : 0);',
    reemplazo: 'const dias = (tramo) => (tramo ? tramo[1] - tramo[0] + 1 : 0);'
  },
  {
    nombre: 'la barra no dice si está pulsada',
    archivo: ARCHIVO,
    buscar: '          aria-pressed={elegida}\n          aria-label={textoDeBarra(reserva)}',
    reemplazo: '          aria-label={textoDeBarra(reserva)}'
  },
  {
    nombre: 'la barra no dice qué reserva es',
    archivo: ARCHIVO,
    buscar: 'aria-label={textoDeBarra(reserva)}',
    reemplazo: 'aria-label=""'
  },
  {
    nombre: 'la barra no escribe la referencia de la reserva',
    archivo: ARCHIVO,
    buscar: "{reservado ? reserva.referencia : ''}",
    reemplazo: "{''}"
  },
  {
    nombre: 'una barra de solo margen escribe la referencia',
    archivo: ARCHIVO,
    buscar: "{reservado ? reserva.referencia : ''}",
    reemplazo: '{reserva.referencia}'
  },
  {
    nombre: 'pulsar una barra no la elige',
    archivo: ARCHIVO,
    buscar: '    setSeleccion(reserva.id === seleccion ? null : reserva.id);',
    reemplazo: '    setSeleccion(null);'
  },
  {
    nombre: 'volver a pulsar la barra elegida no cierra el detalle',
    archivo: ARCHIVO,
    buscar: 'setSeleccion(reserva.id === seleccion ? null : reserva.id);',
    reemplazo: 'setSeleccion(reserva.id);'
  },
  {
    nombre: 'la barra pulsada no se lleva su botón para devolver el foco',
    archivo: ARCHIVO,
    buscar: '    disparador.current = boton;\n',
    reemplazo: ''
  },
  {
    nombre: 'al cerrar el detalle el foco no vuelve a la barra',
    archivo: ARCHIVO,
    buscar: '    disparador.current?.focus();\n',
    reemplazo: ''
  },
  {
    nombre: '«Cerrar detalle» no cierra',
    archivo: ARCHIVO,
    buscar: '    setSeleccion(null);\n    disparador.current?.focus();',
    reemplazo: '    disparador.current?.focus();'
  },
  // ─── el retraso ───
  {
    nombre: 'una retrasada no dibuja su franja «Fuera»',
    archivo: ARCHIVO,
    buscar: '      {retraso && (\n        <button',
    reemplazo: '      {false && (\n        <button'
  },
  {
    nombre: 'la franja «Fuera» ocupa las columnas de la barra',
    archivo: ARCHIVO,
    buscar: 'style={{ gridColumn: columnas(retraso) }}',
    reemplazo: 'style={{ gridColumn: columnas([0, 1]) }}'
  },
  {
    nombre: 'la franja «Fuera» no marca la reserva elegida',
    archivo: ARCHIVO,
    buscar: "`ocupacion-fuera${elegida ? ' is-seleccionado' : ''}`",
    reemplazo: "'ocupacion-fuera'"
  },
  {
    nombre: 'la franja «Fuera» no dice si está pulsada',
    archivo: ARCHIVO,
    buscar: '          aria-pressed={elegida}\n          aria-label={textoDeRetraso(reserva)}',
    reemplazo: '          aria-label={textoDeRetraso(reserva)}'
  },
  {
    nombre: 'la franja «Fuera» se lee como la barra',
    archivo: ARCHIVO,
    buscar: 'aria-label={textoDeRetraso(reserva)}',
    reemplazo: 'aria-label={textoDeBarra(reserva)}'
  },
  {
    nombre: 'la franja «Fuera» no hace nada al pulsarla',
    archivo: ARCHIVO,
    buscar: '          onClick={(evento) => onElegir(reserva, evento.currentTarget)}\n        >\n          <span aria-hidden="true">Fuera</span>',
    reemplazo: '          onClick={() => {}}\n        >\n          <span aria-hidden="true">Fuera</span>'
  },
  // ─── el detalle ───
  {
    nombre: 'el detalle no sale al elegir una reserva',
    archivo: ARCHIVO,
    buscar: '{elegida && <DetalleOcupacion',
    reemplazo: '{false && <DetalleOcupacion'
  },
  {
    nombre: 'el detalle sale sin una reserva elegida',
    archivo: ARCHIVO,
    buscar: "const elegida = reservas.find((r) => r.id === seleccion) ?? null;",
    reemplazo: 'const elegida = reservas.find((r) => r.id === seleccion) ?? reservas[0] ?? null;'
  },
  {
    nombre: '«Ver reserva» del detalle no hace nada',
    archivo: ARCHIVO,
    buscar: 'onVer={onVer} onCerrar={cerrarDetalle}',
    reemplazo: 'onVer={() => {}} onCerrar={cerrarDetalle}'
  }
];
