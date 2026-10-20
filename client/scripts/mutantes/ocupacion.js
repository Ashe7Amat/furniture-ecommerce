// Mutantes del cálculo de ocupación de los calendarios de «Reservas» (pages/admin/ocupacion.js; ver
// scripts/mutantes-panel.js). Los mata ocupacion.test.js.
export const TEST = 'src/pages/admin/ocupacion.test.js';

const ARCHIVO = 'src/pages/admin/ocupacion.js';

export const MUTANTES = [
  // ─── claseDe ───
  {
    nombre: 'una venta se dibuja como un alquiler',
    archivo: ARCHIVO,
    buscar: "  if (reserva.tipo === 'venta') return 'venta';\n",
    reemplazo: ''
  },
  {
    nombre: 'un bloqueo se dibuja como un alquiler',
    archivo: ARCHIVO,
    buscar: "  if (reserva.tipo === 'bloqueo') return 'bloqueo';\n",
    reemplazo: ''
  },
  {
    nombre: 'una retrasada se dibuja como un alquiler',
    archivo: ARCHIVO,
    buscar: "  if (reserva.retrasada) return 'retrasada';\n",
    reemplazo: ''
  },
  {
    nombre: 'una reserva esperando el pago se dibuja como confirmada',
    archivo: ARCHIVO,
    buscar: "  if (reserva.estado === 'pendiente') return 'pendiente';\n",
    reemplazo: ''
  },
  // ─── parteDelDia ───
  {
    nombre: 'el día anterior al inicio ya cuenta como reserva',
    archivo: ARCHIVO,
    buscar: 'if (dia < reserva.fecha_inicio) return null;',
    reemplazo: 'if (false) return null;'
  },
  {
    nombre: 'el primer día de la reserva no cuenta como reserva',
    archivo: ARCHIVO,
    buscar: 'if (dia < reserva.fecha_inicio) return null;',
    reemplazo: 'if (dia <= reserva.fecha_inicio) return null;'
  },
  {
    nombre: 'el primer día libre después del margen todavía cuenta como margen',
    archivo: ARCHIVO,
    buscar: 'dia >= reserva.ocupada_hasta) return null;',
    reemplazo: 'dia > reserva.ocupada_hasta) return null;'
  },
  {
    nombre: 'el margen no se acaba nunca (solo se mira sin fin)',
    archivo: ARCHIVO,
    buscar: 'if (reserva.ocupada_hasta !== null && dia >= reserva.ocupada_hasta) return null;',
    reemplazo: 'if (reserva.ocupada_hasta === null && dia >= reserva.ocupada_hasta) return null;'
  },
  {
    nombre: 'el día en que vuelve la pieza todavía es de reserva, no de margen',
    archivo: ARCHIVO,
    buscar: 'dia >= fin) return',
    reemplazo: 'dia > fin) return'
  },
  {
    nombre: 'una reserva sin fin se mira como si tuviera margen',
    archivo: ARCHIVO,
    buscar: "if (fin !== null && dia >= fin) return 'margen';",
    reemplazo: "if (fin === null || dia >= fin) return 'margen';"
  },
  {
    nombre: 'el margen se pinta como reserva',
    archivo: ARCHIVO,
    buscar: "dia >= fin) return 'margen';",
    reemplazo: "dia >= fin) return 'reserva';"
  },
  // ─── finDeLaReserva: el margen de una retrasada ya no es descanso ───
  {
    nombre: 'sin hoy, el cálculo de la retrasada revienta',
    archivo: ARCHIVO,
    buscar: 'if (!hoy || !reserva.retrasada || reserva.fin_ocupacion === null) return reserva.fin_ocupacion;',
    reemplazo: 'if (!reserva.retrasada || reserva.fin_ocupacion === null) return reserva.fin_ocupacion;'
  },
  {
    nombre: 'una reserva que no está retrasada también tiene la pieza fuera en su margen',
    archivo: ARCHIVO,
    buscar: 'if (!hoy || !reserva.retrasada || reserva.fin_ocupacion === null) return reserva.fin_ocupacion;',
    reemplazo: 'if (!hoy || reserva.fin_ocupacion === null) return reserva.fin_ocupacion;'
  },
  {
    nombre: 'una retrasada sin fin (no existe) tiene el fin de hoy',
    archivo: ARCHIVO,
    buscar: 'if (!hoy || !reserva.retrasada || reserva.fin_ocupacion === null) return reserva.fin_ocupacion;',
    reemplazo: 'if (!hoy || !reserva.retrasada) return reserva.fin_ocupacion;'
  },
  {
    nombre: 'el margen de una retrasada sigue siendo descanso hasta hoy (no se alarga a mañana)',
    archivo: ARCHIVO,
    buscar: 'const hastaHoy = sumarDias(hoy, 1);',
    reemplazo: 'const hastaHoy = hoy;'
  },
  {
    nombre: 'una ocupación que ya llega más allá de hoy se acorta hasta hoy',
    archivo: ARCHIVO,
    buscar: 'const fin = reserva.fin_ocupacion > hastaHoy ? reserva.fin_ocupacion : hastaHoy;',
    reemplazo: 'const fin = hastaHoy;'
  },
  {
    nombre: 'una ocupación acabada hace tiempo no se alarga hasta hoy',
    archivo: ARCHIVO,
    buscar: 'const fin = reserva.fin_ocupacion > hastaHoy ? reserva.fin_ocupacion : hastaHoy;',
    reemplazo: 'const fin = reserva.fin_ocupacion;'
  },
  {
    nombre: 'una retrasada que ya no ocupa nada se dibuja reservada más allá de su ocupación',
    archivo: ARCHIVO,
    buscar: 'return reserva.ocupada_hasta < fin ? reserva.ocupada_hasta : fin;',
    reemplazo: 'return fin;'
  },
  {
    nombre: 'una retrasada se dibuja reservada hasta el final de su margen aunque este aún no haya llegado',
    archivo: ARCHIVO,
    buscar: 'return reserva.ocupada_hasta < fin ? reserva.ocupada_hasta : fin;',
    reemplazo: 'return reserva.ocupada_hasta;'
  },
  {
    nombre: 'los tramos de la reserva no tienen en cuenta que la pieza sigue fuera',
    archivo: ARCHIVO,
    buscar: 'const fin = finDeLaReserva(reserva, hoy);\n  return {',
    reemplazo: 'const fin = reserva.fin_ocupacion;\n  return {'
  },
  {
    nombre: 'los días reservados de una retrasada acaban donde su ocupación, no donde la pieza vuelve',
    archivo: ARCHIVO,
    buscar: 'reservado: recorte(reserva.fecha_inicio, fin, inicio, nDias),',
    reemplazo: 'reservado: recorte(reserva.fecha_inicio, reserva.fin_ocupacion, inicio, nDias),'
  },
  // ─── tramoDeRetraso ───
  {
    nombre: 'una reserva que no está retrasada tiene franja de retraso',
    archivo: ARCHIVO,
    buscar: '  reserva.retrasada && reserva.ocupada_hasta !== null',
    reemplazo: '  reserva.ocupada_hasta !== null'
  },
  {
    nombre: 'la retrasada cuya ocupación acaba hoy no tiene franja de retraso',
    archivo: ARCHIVO,
    buscar: 'reserva.ocupada_hasta <= hoy',
    reemplazo: 'reserva.ocupada_hasta < hoy'
  },
  {
    nombre: 'la franja de retraso no incluye hoy',
    archivo: ARCHIVO,
    buscar: 'hasta: sumarDias(hoy, 1) }',
    reemplazo: 'hasta: hoy }'
  },
  {
    nombre: 'la franja de retraso empieza en la fecha de recogida y no al acabar la ocupación',
    archivo: ARCHIVO,
    buscar: '{ desde: reserva.ocupada_hasta, hasta',
    reemplazo: '{ desde: reserva.fecha_fin, hasta'
  },
  // ─── diaDeLaPieza ───
  {
    nombre: 'el primer día de la franja de retraso no cuenta',
    archivo: ARCHIVO,
    buscar: 'dia >= tramo.desde &&',
    reemplazo: 'dia > tramo.desde &&'
  },
  {
    nombre: 'hoy no cuenta como día de retraso',
    archivo: ARCHIVO,
    buscar: 'dia < tramo.hasta;',
    reemplazo: 'dia < tramo.hasta - 1;'
  },
  {
    nombre: 'el día siguiente a hoy también cuenta como retraso',
    archivo: ARCHIVO,
    buscar: 'dia < tramo.hasta;',
    reemplazo: 'dia <= tramo.hasta;'
  },
  {
    nombre: 'un día sin reserva dice que es de reserva',
    archivo: ARCHIVO,
    buscar: 'parte: reserva ? parteDelDia(reserva, dia, hoy) : null,',
    reemplazo: "parte: reserva ? 'reserva' : null,"
  },
  {
    nombre: 'un día sin reserva sigue diciendo que hay reserva',
    archivo: ARCHIVO,
    buscar: 'const reserva = reservas.find((r) => parteDelDia(r, dia, hoy) !== null) ?? null;',
    reemplazo: 'const reserva = reservas[0] ?? null;'
  },
  // ─── describirReserva y los textos del lector de pantalla ───
  {
    nombre: 'el nombre del cliente no aparece en la descripción',
    archivo: ARCHIVO,
    buscar: "const quien = r.cliente ? ` de ${r.cliente}` : '';",
    reemplazo: "const quien = '';"
  },
  {
    nombre: 'un alquiler sin cliente dice «de null»',
    archivo: ARCHIVO,
    buscar: "const quien = r.cliente ? ` de ${r.cliente}` : '';",
    reemplazo: 'const quien = ` de ${r.cliente}`;'
  },
  {
    nombre: 'un bloqueo se describe con su estado, como un alquiler',
    archivo: ARCHIVO,
    buscar: "if (r.tipo === 'alquiler') return `${base}${quien}, ${r.etiqueta.toLowerCase()}`;",
    reemplazo: 'return `${base}${quien}, ${r.etiqueta.toLowerCase()}`;'
  },
  {
    nombre: 'el estado de un alquiler no aparece en la descripción',
    archivo: ARCHIVO,
    buscar: "if (r.tipo === 'alquiler') return `${base}${quien}, ${r.etiqueta.toLowerCase()}`;",
    reemplazo: "if (r.tipo === 'alquiler') return `${base}${quien}`;"
  },
  {
    nombre: 'el estado de un alquiler sale con mayúscula',
    archivo: ARCHIVO,
    buscar: '${r.etiqueta.toLowerCase()}`;',
    reemplazo: '${r.etiqueta}`;'
  },
  {
    nombre: 'el motivo de un bloqueo no aparece',
    archivo: ARCHIVO,
    buscar: 'return r.motivo ? `${base} (${r.motivo})` : base;',
    reemplazo: 'return base;'
  },
  {
    nombre: 'un bloqueo sin motivo sale con paréntesis vacíos',
    archivo: ARCHIVO,
    buscar: 'return r.motivo ? `${base} (${r.motivo})` : base;',
    reemplazo: 'return `${base} (${r.motivo})`;'
  },
  {
    nombre: 'un día libre con retraso no dice que la pieza sigue fuera',
    archivo: ARCHIVO,
    buscar: 'return retraso\n      ? `${fecha}: libre en el calendario',
    reemplazo: 'return false\n      ? `${fecha}: libre en el calendario'
  },
  {
    nombre: 'un día libre sin retraso dice que la pieza sigue fuera',
    archivo: ARCHIVO,
    buscar: 'return retraso\n      ? `${fecha}: libre en el calendario',
    reemplazo: 'return true\n      ? `${fecha}: libre en el calendario'
  },
  {
    nombre: 'el día de margen se lee como un día de reserva',
    archivo: ARCHIVO,
    buscar: "const texto = parte === 'margen' ? `margen después de ${describirReserva(reserva)}` : describirReserva(reserva);",
    reemplazo: 'const texto = describirReserva(reserva);'
  },
  {
    nombre: 'el día de reserva se lee como un día de margen',
    archivo: ARCHIVO,
    buscar: "const texto = parte === 'margen' ?",
    reemplazo: "const texto = parte !== 'margen' ?"
  },
  {
    nombre: 'un día de reserva con retraso no dice que la pieza sigue fuera',
    archivo: ARCHIVO,
    buscar: 'return retraso\n    ? `${fecha}: ${texto}; la pieza sigue fuera',
    reemplazo: 'return false\n    ? `${fecha}: ${texto}; la pieza sigue fuera'
  },
  {
    nombre: 'la barra de una reserva sin fin dice que acaba',
    archivo: ARCHIVO,
    buscar: 'if (r.fin_ocupacion === null) return `${base}, desde el',
    reemplazo: 'if (r.fin_ocupacion !== null) return `${base}, desde el'
  },
  {
    nombre: 'la barra de una reserva con margen no dice cuántos días',
    archivo: ARCHIVO,
    buscar: "const margen = r.dias_margen > 0 ? `, con ${textoDias(r.dias_margen)} de margen` : '';",
    reemplazo: "const margen = '';"
  },
  {
    nombre: 'la barra de una reserva sin margen dice «con 0 días de margen»',
    archivo: ARCHIVO,
    buscar: 'const margen = r.dias_margen > 0 ?',
    reemplazo: 'const margen = r.dias_margen >= 0 ?'
  },
  {
    nombre: 'la barra dice que acaba el día de la recogida y no cuando vuelve la pieza',
    archivo: ARCHIVO,
    buscar: 'al ${fechaCorta(r.fin_ocupacion)}${margen}',
    reemplazo: 'al ${fechaCorta(r.fecha_fin)}${margen}'
  },
  {
    nombre: 'la franja de retraso da la fecha de entrega y no la de recogida prevista',
    archivo: ARCHIVO,
    buscar: 'estaba prevista el ${fechaCorta(r.fecha_fin)}',
    reemplazo: 'estaba prevista el ${fechaCorta(r.fecha_inicio)}'
  },
  // ─── filasDeDetalle ───
  {
    nombre: 'el detalle de un bloqueo enseña las filas de un alquiler',
    archivo: ARCHIVO,
    buscar: "(r.tipo === 'alquiler'\n    ? [",
    reemplazo: '(true\n    ? ['
  },
  {
    nombre: 'el detalle de un alquiler enseña las filas de un bloqueo',
    archivo: ARCHIVO,
    buscar: "(r.tipo === 'alquiler'\n    ? [",
    reemplazo: '(false\n    ? ['
  },
  {
    nombre: 'una devuelta dice que su ocupación se amplió',
    archivo: ARCHIVO,
    buscar: "r.estado !== 'devuelta' && r.fin_ocupacion",
    reemplazo: 'r.fin_ocupacion'
  },
  {
    nombre: 'una ocupación que acaba el día de la recogida se dice ampliada',
    archivo: ARCHIVO,
    buscar: ' && r.fin_ocupacion !== r.fecha_fin && fechaCorta',
    reemplazo: ' && fechaCorta'
  },
  {
    nombre: 'una reserva sin margen enseña la fila «Margen»',
    archivo: ARCHIVO,
    buscar: "['Margen', r.dias_margen > 0 &&",
    reemplazo: "['Margen', r.dias_margen >= 0 &&"
  },
  {
    nombre: 'el margen se cuenta desde la entrega y no desde la recogida',
    archivo: ARCHIVO,
    buscar: 'después de la recogida`],',
    reemplazo: 'después de la entrega`],'
  },
  {
    nombre: 'el detalle enseña las filas vacías',
    archivo: ARCHIVO,
    buscar: '.filter(([, valor]) => valor);',
    reemplazo: ';'
  },
  {
    nombre: 'un alquiler sin cliente no enseña ninguna fila de cliente aunque lo tenga',
    archivo: ARCHIVO,
    buscar: "['Cliente', r.cliente],",
    reemplazo: "['Cliente', null],"
  },
  {
    nombre: 'la fila «Recogida» de un alquiler sin fecha de recogida revienta',
    archivo: ARCHIVO,
    buscar: "['Recogida', r.fecha_fin && momento(r.fecha_fin, r.hora_recogida)],",
    reemplazo: "['Recogida', momento(r.fecha_fin, r.hora_recogida)],"
  },
  {
    nombre: 'la entrega se enseña sin su hora',
    archivo: ARCHIVO,
    buscar: "['Entrega', momento(r.fecha_inicio, r.hora_entrega)],",
    reemplazo: "['Entrega', momento(r.fecha_inicio, null)],"
  },
  {
    nombre: 'la recogida se enseña sin su hora',
    archivo: ARCHIVO,
    buscar: 'momento(r.fecha_fin, r.hora_recogida)],',
    reemplazo: 'momento(r.fecha_fin, null)],'
  },
  {
    nombre: 'un alquiler no dice cuándo vuelve a estar libre',
    archivo: ARCHIVO,
    buscar: "['Libre de nuevo el', r.ocupada_hasta && fechaCorta(r.ocupada_hasta)]",
    reemplazo: "['Libre de nuevo el', null]"
  },
  {
    nombre: 'un bloqueo sin fin dice que vuelve a estar libre',
    archivo: ARCHIVO,
    buscar: "['Libre de nuevo el', r.fecha_fin && fechaCorta(r.fecha_fin)],",
    reemplazo: "['Libre de nuevo el', fechaCorta(r.fecha_fin)],"
  },
  {
    nombre: 'un bloqueo no dice desde cuándo',
    archivo: ARCHIVO,
    buscar: "['Desde', fechaCorta(r.fecha_inicio)],",
    reemplazo: "['Desde', null],"
  },
  {
    nombre: 'un bloqueo no dice su motivo',
    archivo: ARCHIVO,
    buscar: "['Motivo', r.motivo]",
    reemplazo: "['Motivo', null]"
  },
  // ─── textos de los resúmenes ───
  {
    nombre: 'un mes sin reservas dice «0 reservas»',
    archivo: ARCHIVO,
    buscar: 'if (n === 0) return `Ninguna reserva en',
    reemplazo: 'if (n === -1) return `Ninguna reserva en'
  },
  {
    nombre: 'una sola reserva en el mes dice «1 reservas»',
    archivo: ARCHIVO,
    buscar: "return `${n === 1 ? '1 reserva' :",
    reemplazo: "return `${n === -1 ? '1 reserva' :"
  },
  {
    nombre: 'una reserva en el mes dice «Ninguna reserva»',
    archivo: ARCHIVO,
    buscar: 'if (n === 0) return `Ninguna reserva en',
    reemplazo: 'if (n <= 1) return `Ninguna reserva en'
  },
  {
    nombre: 'ninguna pieza con reservas dice «0 piezas tienen»',
    archivo: ARCHIVO,
    buscar: 'if (n === 0) return `Ninguna pieza tiene',
    reemplazo: 'if (n === -1) return `Ninguna pieza tiene'
  },
  {
    nombre: 'una sola pieza con reservas dice «1 piezas tienen»',
    archivo: ARCHIVO,
    buscar: "return `${n === 1 ? '1 pieza tiene' :",
    reemplazo: "return `${n === -1 ? '1 pieza tiene' :"
  },
  {
    nombre: 'el resumen de la vista general no dice cuántos días se ven',
    archivo: ARCHIVO,
    buscar: 'reservas en los ${dias} días que se ven.`;\n};',
    reemplazo: 'reservas en los 30 días que se ven.`;\n};'
  },
  // ─── recorte y tramosDeLaReserva ───
  {
    nombre: 'una reserva que empieza antes de la ventana se dibuja desde antes de la primera columna',
    archivo: ARCHIVO,
    buscar: 'const primera = Math.max(diasEntre(inicio, desde), 0);',
    reemplazo: 'const primera = diasEntre(inicio, desde);'
  },
  {
    nombre: 'una reserva que empieza antes de la ventana se dibuja desde la segunda columna',
    archivo: ARCHIVO,
    buscar: 'const primera = Math.max(diasEntre(inicio, desde), 0);',
    reemplazo: 'const primera = Math.max(diasEntre(inicio, desde), 1);'
  },
  {
    nombre: 'una reserva que acaba después de la ventana se dibuja más allá de la última columna',
    archivo: ARCHIVO,
    buscar: 'hastaExclusivo === null ? nDias : diasEntre(inicio, hastaExclusivo), nDias);',
    reemplazo: 'hastaExclusivo === null ? nDias : diasEntre(inicio, hastaExclusivo), nDias + 1);'
  },
  {
    nombre: 'una reserva sin fin se dibuja sin llegar a la última columna',
    archivo: ARCHIVO,
    buscar: 'Math.min(hastaExclusivo === null ? nDias :',
    reemplazo: 'Math.min(hastaExclusivo === null ? nDias - 1 :'
  },
  {
    nombre: 'una reserva con fin se dibuja hasta el final de la ventana',
    archivo: ARCHIVO,
    buscar: 'Math.min(hastaExclusivo === null ? nDias : diasEntre(inicio, hastaExclusivo), nDias);',
    reemplazo: 'nDias;'
  },
  {
    nombre: 'un tramo vacío (margen de 0 días) se dibuja',
    archivo: ARCHIVO,
    buscar: 'return fin > primera ? [primera, fin] : null;',
    reemplazo: 'return fin >= primera ? [primera, fin] : null;'
  },
  {
    nombre: 'un tramo fuera de la ventana se dibuja',
    archivo: ARCHIVO,
    buscar: 'return fin > primera ? [primera, fin] : null;',
    reemplazo: 'return [primera, fin];'
  },
  {
    nombre: 'una reserva sin fin tiene franja de margen',
    archivo: ARCHIVO,
    buscar: 'margen: fin === null ? null : recorte(',
    reemplazo: 'margen: fin !== null ? null : recorte('
  },
  {
    nombre: 'el margen se dibuja desde el inicio de la reserva',
    archivo: ARCHIVO,
    buscar: 'margen: fin === null ? null : recorte(fin, reserva.ocupada_hasta, inicio, nDias),',
    reemplazo: 'margen: fin === null ? null : recorte(reserva.fecha_inicio, reserva.ocupada_hasta, inicio, nDias),'
  },
  {
    nombre: 'una reserva que empieza el primer día de la ventana se dice cortada por la izquierda',
    archivo: ARCHIVO,
    buscar: 'cortaIzq: reserva.fecha_inicio < inicio,',
    reemplazo: 'cortaIzq: reserva.fecha_inicio <= inicio,'
  },
  {
    nombre: 'una reserva que ya había empezado no se dice cortada por la izquierda',
    archivo: ARCHIVO,
    buscar: 'cortaIzq: reserva.fecha_inicio < inicio,',
    reemplazo: 'cortaIzq: false,'
  },
  {
    nombre: 'una reserva que acaba justo al final de la ventana se dice cortada por la derecha',
    archivo: ARCHIVO,
    buscar: 'reserva.ocupada_hasta > ultimoDia',
    reemplazo: 'reserva.ocupada_hasta >= ultimoDia'
  },
  {
    nombre: 'una reserva sin fin no se dice cortada por la derecha',
    archivo: ARCHIVO,
    buscar: 'cortaDer: reserva.ocupada_hasta === null || ',
    reemplazo: 'cortaDer: '
  },
  {
    nombre: 'el final de la ventana se cuenta un día antes',
    archivo: ARCHIVO,
    buscar: 'const ultimoDia = sumarDias(inicio, nDias);',
    reemplazo: 'const ultimoDia = sumarDias(inicio, nDias - 1);'
  },
  {
    nombre: 'una reserva retrasada no tiene franja de retraso en la rejilla',
    archivo: ARCHIVO,
    buscar: 'retraso: retraso ? recorte(retraso.desde, retraso.hasta, inicio, nDias) : null,',
    reemplazo: 'retraso: null,'
  },
  // ─── filasDeOcupacion ───
  {
    nombre: 'una pieza vendida antes de la ventana sale en la vista general',
    archivo: ARCHIVO,
    buscar: "    if (reserva.tipo === 'venta' && reserva.fecha_inicio < inicio) continue;\n",
    reemplazo: ''
  },
  {
    nombre: 'una pieza vendida el primer día de la ventana no sale',
    archivo: ARCHIVO,
    buscar: "reserva.tipo === 'venta' && reserva.fecha_inicio < inicio",
    reemplazo: "reserva.tipo === 'venta' && reserva.fecha_inicio <= inicio"
  },
  {
    nombre: 'un alquiler anterior a la ventana tampoco sale',
    archivo: ARCHIVO,
    buscar: "reserva.tipo === 'venta' && reserva.fecha_inicio < inicio",
    reemplazo: 'reserva.fecha_inicio < inicio'
  },
  {
    nombre: 'una pieza vendida dentro de la ventana no sale',
    archivo: ARCHIVO,
    buscar: "reserva.tipo === 'venta' && reserva.fecha_inicio < inicio",
    reemplazo: "reserva.tipo === 'venta'"
  },
  {
    nombre: 'una pieza sin nada en la ventana tiene fila',
    archivo: ARCHIVO,
    buscar: 'if (!tramos.reservado && !tramos.margen && !tramos.retraso) continue;',
    reemplazo: ''
  },
  {
    nombre: 'una pieza con solo margen en la ventana no tiene fila',
    archivo: ARCHIVO,
    buscar: 'if (!tramos.reservado && !tramos.margen && !tramos.retraso) continue;',
    reemplazo: 'if (!tramos.reservado && !tramos.retraso) continue;'
  },
  {
    nombre: 'una pieza con solo un retraso en la ventana no tiene fila',
    archivo: ARCHIVO,
    buscar: 'if (!tramos.reservado && !tramos.margen && !tramos.retraso) continue;',
    reemplazo: 'if (!tramos.reservado && !tramos.margen) continue;'
  },
  {
    nombre: 'una pieza con varias reservas solo enseña la última',
    archivo: ARCHIVO,
    buscar: 'if (!piezas.has(reserva.pieza.id)) piezas.set(',
    reemplazo: 'piezas.set('
  },
  {
    nombre: 'las filas salen en el orden en que llegan, no por nombre',
    archivo: ARCHIVO,
    buscar: ".sort((a, b) => a.pieza.nombre.localeCompare(b.pieza.nombre, 'es'));",
    reemplazo: ';'
  },
  {
    nombre: 'las filas salen por nombre al revés',
    archivo: ARCHIVO,
    buscar: 'a.pieza.nombre.localeCompare(b.pieza.nombre, ',
    reemplazo: 'b.pieza.nombre.localeCompare(a.pieza.nombre, '
  },
  {
    nombre: 'las barras de una fila pierden los tramos',
    archivo: ARCHIVO,
    buscar: 'barras.push({ reserva, ...tramos });',
    reemplazo: 'barras.push({ reserva });'
  },
  // ─── avisos ───
  {
    nombre: 'los avisos salen del más lejano al más cercano',
    archivo: ARCHIVO,
    buscar: '  return a < b ? -1 : 1;',
    reemplazo: '  return a < b ? 1 : -1;'
  },
  {
    nombre: 'una reserva que empezó hace días dice «empieza hoy»',
    archivo: ARCHIVO,
    buscar: 'if (dias < 0) return `tenía que empezar',
    reemplazo: 'if (dias < -1) return `tenía que empezar'
  },
  {
    nombre: 'una reserva que empezó ayer no dice que tenía que empezar',
    archivo: ARCHIVO,
    buscar: 'if (dias < 0) return `tenía que empezar',
    reemplazo: 'if (dias <= 0) return `tenía que empezar'
  },
  {
    nombre: 'una reserva que empieza hoy dice «empieza mañana»',
    archivo: ARCHIVO,
    buscar: "if (dias === 0) return 'empieza hoy';",
    reemplazo: "if (dias === 0) return 'empieza mañana';"
  },
  {
    nombre: 'una reserva que empieza mañana no lo dice',
    archivo: ARCHIVO,
    buscar: "if (dias === 1) return 'empieza mañana';",
    reemplazo: 'if (dias === 1) return `empieza dentro de ${textoDias(dias)} (el ${fechaCorta(fecha)})`;'
  },
  {
    nombre: 'una reserva lejana no dice la fecha en que empieza',
    archivo: ARCHIVO,
    buscar: 'return `empieza dentro de ${textoDias(dias)} (el ${fechaCorta(fecha)})`;\n};',
    reemplazo: 'return `empieza dentro de ${textoDias(dias)}`;\n};'
  },
  {
    nombre: 'el aviso de retraso sale aunque ninguna reserva esté retrasada',
    archivo: ARCHIVO,
    buscar: 'for (const retrasada of reservas.filter((r) => r.retrasada)) {',
    reemplazo: 'for (const retrasada of reservas) {'
  },
  {
    nombre: 'el aviso de retraso mira reservas de otras piezas',
    archivo: ARCHIVO,
    buscar: '          r.pieza.id === retrasada.pieza.id &&\n          r.id !== retrasada.id &&',
    reemplazo: '          r.id !== retrasada.id &&'
  },
  {
    nombre: 'la siguiente de una retrasada puede ser ella misma',
    archivo: ARCHIVO,
    buscar: '          r.id !== retrasada.id &&\n',
    reemplazo: ''
  },
  {
    nombre: 'la siguiente de una retrasada puede ser una anterior',
    archivo: ARCHIVO,
    buscar: 'r.fecha_inicio >= retrasada.fecha_inicio',
    reemplazo: 'r.fecha_inicio <= retrasada.fecha_inicio'
  },
  {
    nombre: 'la siguiente de una retrasada es la última de la pieza y no la primera',
    archivo: ARCHIVO,
    buscar: '.sort((a, b) => porDia(a.fecha_inicio, b.fecha_inicio))[0];',
    reemplazo: '.sort((a, b) => porDia(b.fecha_inicio, a.fecha_inicio))[0];'
  },
  {
    nombre: 'una retrasada sin reserva a continuación da un aviso igualmente',
    archivo: ARCHIVO,
    buscar: '    if (!siguiente) continue;\n    avisos.push({\n      clave: `${retrasada.id}:${siguiente.id}`,',
    reemplazo: '    avisos.push({\n      clave: `${retrasada.id}:${siguiente?.id}`,'
  },
  {
    nombre: 'el aviso de retraso se coloca el día de la retrasada y no el de la siguiente',
    archivo: ARCHIVO,
    buscar: '      tipo: \'retraso\',\n      dia: siguiente.fecha_inicio,',
    reemplazo: '      tipo: \'retraso\',\n      dia: retrasada.fecha_inicio,'
  },
  {
    nombre: 'el aviso de retraso cuenta los días al revés',
    archivo: ARCHIVO,
    buscar: 'cuando(diasEntre(hoy, siguiente.fecha_inicio), siguiente.fecha_inicio)',
    reemplazo: 'cuando(diasEntre(siguiente.fecha_inicio, hoy), siguiente.fecha_inicio)'
  },
  {
    nombre: 'el aviso de retraso nombra la reserva retrasada con la referencia de la siguiente',
    archivo: ARCHIVO,
    buscar: 'la reserva ${retrasada.referencia} está retrasada',
    reemplazo: 'la reserva ${siguiente.referencia} está retrasada'
  },
  {
    nombre: 'el aviso de márgenes justos incluye bloqueos',
    archivo: ARCHIVO,
    buscar: "reservas.filter((x) => x.tipo === 'alquiler')) {\n    if (!porPieza",
    reemplazo: 'reservas) {\n    if (!porPieza'
  },
  {
    nombre: 'el aviso de márgenes justos mezcla las reservas de dos piezas',
    archivo: ARCHIVO,
    buscar: "    if (!porPieza.has(r.pieza.id)) porPieza.set(r.pieza.id, []);\n    porPieza.get(r.pieza.id).push(r);",
    reemplazo: "    if (!porPieza.has('todas')) porPieza.set('todas', []);\n    porPieza.get('todas').push(r);"
  },
  {
    nombre: 'el aviso de márgenes justos olvida las reservas anteriores de la misma pieza',
    archivo: ARCHIVO,
    buscar: '    if (!porPieza.has(r.pieza.id)) porPieza.set(',
    reemplazo: '    porPieza.set('
  },
  {
    nombre: 'el aviso de márgenes justos mira las reservas sin ordenar',
    archivo: ARCHIVO,
    buscar: '    delaPieza.sort((a, b) => porDia(a.fecha_inicio, b.fecha_inicio));\n',
    reemplazo: ''
  },
  {
    nombre: 'el aviso de márgenes justos se sale por el final de la lista',
    archivo: ARCHIVO,
    buscar: 'for (let i = 0; i + 1 < delaPieza.length; i += 1) {',
    reemplazo: 'for (let i = 0; i < delaPieza.length; i += 1) {'
  },
  {
    nombre: 'el aviso de márgenes justos se salta la última pareja',
    archivo: ARCHIVO,
    buscar: 'for (let i = 0; i + 1 < delaPieza.length; i += 1) {',
    reemplazo: 'for (let i = 0; i + 2 < delaPieza.length; i += 1) {'
  },
  {
    nombre: 'un alquiler retrasado da también el aviso de márgenes justos',
    archivo: ARCHIVO,
    buscar: "if (antes.retrasada || antes.estado === 'devuelta' || despues.fecha_inicio < hoy) continue;",
    reemplazo: "if (antes.estado === 'devuelta' || despues.fecha_inicio < hoy) continue;"
  },
  {
    nombre: 'un alquiler devuelto da aviso de márgenes justos',
    archivo: ARCHIVO,
    buscar: "if (antes.retrasada || antes.estado === 'devuelta' || despues.fecha_inicio < hoy) continue;",
    reemplazo: 'if (antes.retrasada || despues.fecha_inicio < hoy) continue;'
  },
  {
    nombre: 'unos alquileres seguidos que ya empezaron dan aviso de márgenes justos',
    archivo: ARCHIVO,
    buscar: "|| despues.fecha_inicio < hoy) continue;",
    reemplazo: '|| false) continue;'
  },
  {
    nombre: 'el aviso de márgenes justos no avisa el día en que empieza la segunda reserva (hoy)',
    archivo: ARCHIVO,
    buscar: "|| despues.fecha_inicio < hoy) continue;",
    reemplazo: '|| despues.fecha_inicio <= hoy) continue;'
  },
  {
    nombre: 'dos alquileres con un día de sobra dan aviso de márgenes justos',
    archivo: ARCHIVO,
    buscar: 'if (antes.ocupada_hasta !== despues.fecha_inicio) continue;',
    reemplazo: ''
  },
  {
    nombre: 'dos alquileres seguidos no dan aviso de márgenes justos',
    archivo: ARCHIVO,
    buscar: 'if (antes.ocupada_hasta !== despues.fecha_inicio) continue;',
    reemplazo: 'if (antes.ocupada_hasta === despues.fecha_inicio) continue;'
  },
  {
    nombre: 'el aviso de márgenes justos se coloca el día de la primera reserva',
    archivo: ARCHIVO,
    buscar: "tipo: 'justo',\n        dia: despues.fecha_inicio,",
    reemplazo: "tipo: 'justo',\n        dia: antes.fecha_inicio,"
  },
  {
    nombre: 'un alquiler pendiente de pago da aviso de que no tiene hora de entrega',
    archivo: ARCHIVO,
    buscar: "if (r.estado === 'confirmada' && !r.hora_entrega",
    reemplazo: "if (r.estado !== 'devuelta' && !r.hora_entrega"
  },
  {
    nombre: 'un alquiler confirmado sin hora de entrega no da aviso',
    archivo: ARCHIVO,
    buscar: "if (r.estado === 'confirmada' && !r.hora_entrega",
    reemplazo: "if (r.estado !== 'confirmada' && !r.hora_entrega"
  },
  {
    nombre: 'un alquiler con hora de entrega da aviso de que no la tiene',
    archivo: ARCHIVO,
    buscar: "r.estado === 'confirmada' && !r.hora_entrega",
    reemplazo: "r.estado === 'confirmada' && r.hora_entrega"
  },
  {
    nombre: 'una entrega ya pasada da aviso de que no tiene hora',
    archivo: ARCHIVO,
    buscar: '!r.hora_entrega && r.fecha_inicio >= hoy',
    reemplazo: '!r.hora_entrega'
  },
  {
    nombre: 'una entrega de hoy no da aviso de que no tiene hora',
    archivo: ARCHIVO,
    buscar: '!r.hora_entrega && r.fecha_inicio >= hoy',
    reemplazo: '!r.hora_entrega && r.fecha_inicio > hoy'
  },
  {
    nombre: 'el aviso de entrega sin hora se coloca el día de la recogida',
    archivo: ARCHIVO,
    buscar: "tipo: 'sin_hora',\n        dia: r.fecha_inicio,",
    reemplazo: "tipo: 'sin_hora',\n        dia: r.fecha_fin,"
  },
  {
    nombre: 'un bloqueo sin hora da aviso de falta de hora',
    archivo: ARCHIVO,
    buscar: "x.tipo === 'alquiler' && !x.retrasada)",
    reemplazo: 'x.tipo !== \'venta\' && !x.retrasada)'
  },
  {
    nombre: 'un alquiler en curso sin hora de recogida no da aviso',
    archivo: ARCHIVO,
    buscar: "['confirmada', 'en_curso'].includes(r.estado)",
    reemplazo: "['confirmada'].includes(r.estado)"
  },
  {
    nombre: 'un alquiler devuelto sin hora de recogida da aviso',
    archivo: ARCHIVO,
    buscar: "['confirmada', 'en_curso'].includes(r.estado)",
    reemplazo: "['confirmada', 'en_curso', 'devuelta'].includes(r.estado)"
  },
  {
    nombre: 'un alquiler con hora de recogida da aviso de que no la tiene',
    archivo: ARCHIVO,
    buscar: 'r.fecha_fin && !r.hora_recogida && r.fecha_fin >= hoy',
    reemplazo: 'r.fecha_fin && r.hora_recogida && r.fecha_fin >= hoy'
  },
  {
    nombre: 'una recogida ya pasada da aviso de que no tiene hora',
    archivo: ARCHIVO,
    buscar: '!r.hora_recogida && r.fecha_fin >= hoy',
    reemplazo: '!r.hora_recogida'
  },
  {
    nombre: 'una recogida de hoy no da aviso de que no tiene hora',
    archivo: ARCHIVO,
    buscar: '!r.hora_recogida && r.fecha_fin >= hoy',
    reemplazo: '!r.hora_recogida && r.fecha_fin > hoy'
  },
  {
    nombre: 'el aviso de recogida sin hora se coloca el día de la entrega',
    archivo: ARCHIVO,
    buscar: "tipo: 'sin_hora',\n        dia: r.fecha_fin,",
    reemplazo: "tipo: 'sin_hora',\n        dia: r.fecha_inicio,"
  },
  {
    nombre: 'los avisos salen sin ordenar por día',
    archivo: ARCHIVO,
    buscar: '...avisosSinHora(reservas, hoy)].sort(\n    (a, b) => porDia(a.dia, b.dia)\n  );',
    reemplazo: '...avisosSinHora(reservas, hoy)];'
  },
  {
    nombre: 'los avisos de márgenes justos no se incluyen',
    archivo: ARCHIVO,
    buscar: '...avisosDeMargenJusto(reservas, hoy), ',
    reemplazo: ''
  },
  {
    nombre: 'los avisos de retraso no se incluyen',
    archivo: ARCHIVO,
    buscar: '[...avisosDeRetraso(reservas, hoy), ',
    reemplazo: '['
  },
  {
    nombre: 'los avisos de falta de hora no se incluyen',
    archivo: ARCHIVO,
    buscar: ', ...avisosSinHora(reservas, hoy)]',
    reemplazo: ']'
  }
];
