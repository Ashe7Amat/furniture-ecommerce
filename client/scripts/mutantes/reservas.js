// Mutantes de la pestaña Reservas (reservas por fechas, bloque R-d; ver scripts/mutantes-panel.js).
// Los mata src/pages/admin/pestanas/ReservasTab.test.jsx, que monta la pestaña sola.
export const TEST = 'src/pages/admin/pestanas/ReservasTab.test.jsx';

const ARCHIVO = 'src/pages/admin/pestanas/ReservasTab.jsx';
const RECOGER = 'src/pages/admin/modales/RecogerReservaModal.jsx';
const TARJETA = 'src/pages/admin/TarjetaReserva.jsx';
const AYUDANTES = 'src/pages/admin/reservasAdmin.js';

export const MUTANTES = [
  {
    nombre: 'cada vista pide siempre "Próximas"',
    archivo: ARCHIVO,
    buscar: 'getReservasAdmin({ vista: vistaPedida })',
    reemplazo: "getReservasAdmin({ vista: 'proximas' })"
  },
  {
    nombre: 'la respuesta de una vista anterior que llega tarde pisa la lista',
    archivo: ARCHIVO,
    buscar: '    if (numero !== ultimaCarga.current) return;\n',
    reemplazo: ''
  },
  {
    nombre: 'sin la guarda, un segundo envío mientras guarda se manda',
    archivo: ARCHIVO,
    buscar: '    if (enviandoRef.current) return null;\n',
    reemplazo: ''
  },
  {
    nombre: 'tras una acción, la tarjeta no se actualiza con la reserva que devuelve el servidor',
    archivo: ARCHIVO,
    buscar: '(r.id === nueva.id ? nueva : r)',
    reemplazo: 'r'
  },
  {
    nombre: '"Marcar recogida" se manda sin pedir confirmación',
    archivo: ARCHIVO,
    buscar: "['ampliar', 'cancelar', 'recoger'].includes(accion)",
    reemplazo: "['ampliar', 'cancelar'].includes(accion)"
  },
  {
    nombre: '"Marcar recogida" no manda el día elegido (el servidor guardaría hoy)',
    archivo: RECOGER,
    buscar: 'onEnviar({ fecha_recogida: fecha })',
    reemplazo: 'onEnviar({})'
  },
  {
    nombre: 'el aviso que trae la respuesta (el margen recortado al recoger) no se enseña',
    archivo: ARCHIVO,
    buscar: '      if (resultado.data?.aviso) setAvisos((a) => ({ ...a, [reserva.id]: resultado.data.aviso }));\n',
    reemplazo: ''
  },
  {
    nombre: '"Dar por reembolsado" se manda sin pedir confirmación',
    archivo: ARCHIVO,
    buscar: "    if (accion === 'dar-por-reembolsado') {",
    reemplazo: "    if (accion === 'dar_por_reembolsado') {"
  },
  {
    nombre: 'entregar antes de la fecha: al confirmar, se reenvía sin antes_de_tiempo',
    archivo: ARCHIVO,
    buscar: 'datos: { antes_de_tiempo: true },',
    reemplazo: 'datos: {},'
  },
  {
    nombre: 'cualquier 409 al entregar se toma por una entrega anticipada (aunque no lleve el código)',
    archivo: ARCHIVO,
    buscar: "resultado.codigo === 'entrega_anticipada'",
    reemplazo: 'resultado.status === 409'
  },
  {
    nombre: 'el error de una acción directa no se enseña en la tarjeta',
    archivo: ARCHIVO,
    buscar: 'setErrores((e) => ({ ...e, [reserva.id]: resultado.error }));',
    reemplazo: "setErrores((e) => ({ ...e, [reserva.id]: '' }));"
  },
  {
    nombre: 'un diálogo se cierra aunque el servidor diga que no (y su mensaje se pierde)',
    archivo: ARCHIVO,
    buscar:
      '    if (resultado.error && !esReembolsoAMedias(resultado)) {\n      errorDeDialogo(resultado.error, dialogo.reserva);\n    } else {\n      setDialogo(null);\n    }',
    reemplazo: '    setDialogo(null);'
  },
  {
    nombre: 'un alta que va bien no vuelve a cargar la lista',
    archivo: ARCHIVO,
    buscar: "    showToast(EXITO_ALTA[tipo], 'success');\n    cargar(vistaRef.current);\n",
    reemplazo: "    showToast(EXITO_ALTA[tipo], 'success');\n"
  },
  {
    nombre: 'un 502 (reembolso a medias) no lleva a «Reembolsos a medias»',
    archivo: ARCHIVO,
    buscar: "      else setVista('reembolsos');",
    reemplazo: ''
  },
  {
    nombre: 'un 502 estando ya en «Reembolsos a medias» no recarga la vista',
    archivo: ARCHIVO,
    buscar: "      if (vistaRef.current === 'reembolsos') cargar('reembolsos');\n",
    reemplazo: ''
  },
  {
    nombre: '«Reintentar reembolso» se manda sin pedir confirmación (sin decir cuánto se devuelve)',
    archivo: ARCHIVO,
    buscar: "    if (accion === 'reintentar-reembolso') {",
    reemplazo: "    if (accion === 'reintentar_reembolso') {"
  },
  {
    nombre: 'un 409 de una lista que ya no está al día no la recarga',
    archivo: ARCHIVO,
    buscar: '      cargar(vistaRef.current, true).then(() => setFoco(reserva.id));\n',
    reemplazo: ''
  },
  {
    nombre: 'tras recargar una lista desfasada, el motivo no sale en un aviso',
    archivo: ARCHIVO,
    buscar: "    if (resultado.obsoleta) showToast(resultado.error, 'error');",
    reemplazo: ''
  },
  {
    nombre: 'un error sin respuesta del servidor no avisa de que la acción pudo guardarse',
    archivo: ARCHIVO,
    buscar: 'if (resultado.error && !aMedias && (resultado.status === 0 || resultado.status >= 500)) {',
    reemplazo: 'if (false) {'
  },
  {
    nombre: 'al acabar una acción cuyo botón desaparece, el foco no pasa a la tarjeta',
    archivo: ARCHIVO,
    buscar: '        setFoco(nueva.id);\n',
    reemplazo: ''
  },
  {
    nombre: 'el aviso de arriba de un reembolso a medias no se quita al resolverlo',
    archivo: ARCHIVO,
    buscar: "      if (accion === 'reintentar-reembolso' || accion === 'dar-por-reembolsado') setAvisoGeneral('');\n",
    reemplazo: ''
  },
  {
    nombre: 'un 409 «el reembolso no consta en Stripe» no abre el segundo paso',
    archivo: ARCHIVO,
    buscar: "if (resultado.codigo === 'reembolso_no_consta' && dialogoAbierto.current) {",
    reemplazo: 'if (false) {'
  },
  {
    nombre: 'el segundo paso reenvía sin aunque_no_conste (volvería a dar el mismo 409)',
    archivo: ARCHIVO,
    buscar: 'datos: { aunque_no_conste: true },',
    reemplazo: 'datos: {},'
  },
  {
    nombre: 'un 409 con código de confirmación se toma por una lista desfasada y recarga',
    archivo: ARCHIVO,
    buscar: "const CODIGOS_CON_CONFIRMACION = ['entrega_anticipada', 'reembolso_no_consta'];",
    reemplazo: "const CODIGOS_CON_CONFIRMACION = ['entrega_anticipada'];"
  },
  {
    nombre: 'un diálogo abierto en una pestaña de ayer usa el día de la lista y no el del reloj',
    archivo: ARCHIVO,
    buscar: 'hoy: hoyMasReciente(lista.hoy)',
    reemplazo: 'hoy: lista.hoy'
  },
  {
    nombre: '«Marcar recogida» deja elegir un día anterior a la entrega real (solo mira la prevista)',
    archivo: AYUDANTES,
    buscar: 'minimo: entrega > reserva.fecha_inicio ? entrega : reserva.fecha_inicio,',
    reemplazo: 'minimo: reserva.fecha_inicio,'
  },
  {
    nombre: 'un alquiler ya entregado que empieza después de hoy se deja registrar',
    archivo: AYUDANTES,
    buscar: 'if (c.ya_entregado && hoy && c.fecha_inicio > hoy) {',
    reemplazo: 'if (false) {'
  },
  {
    nombre: 'una reserva en conflicto sin botones no dice qué hacer',
    archivo: TARJETA,
    buscar: '{reserva.en_conflicto && !reserva.reembolso_a_medias && (',
    reemplazo: '{false && ('
  },
  {
    nombre: 'el aviso de un reembolso a medias ofrece «Dar por reembolsado» aunque el servidor no lo permita',
    archivo: TARJETA,
    buscar: "{acciones.includes('dar-por-reembolsado') &&",
    reemplazo: '{true &&'
  },
  {
    nombre: 'un 502 sin el código del reembolso a medias (la pasarela) se toma por un reembolso a medias',
    archivo: ARCHIVO,
    buscar: "({ status, codigo }) => status === 502 && codigo === CODIGO_A_MEDIAS;",
    reemplazo: '({ status }) => status === 502;'
  },
  {
    nombre: 'tras recargar una lista desfasada con un diálogo abierto, el foco no pasa a la tarjeta',
    archivo: ARCHIVO,
    buscar: 'cargar(vistaRef.current, true).then(() => setFoco(reserva.id));',
    reemplazo: 'cargar(vistaRef.current, true);'
  },
  {
    nombre: 'el error de un diálogo ya cerrado solo sale en un toast, no bajo la tarjeta',
    archivo: ARCHIVO,
    buscar: 'if (reserva) setErrores((e) => ({ ...e, [reserva.id]: error }));',
    reemplazo: 'if (reserva) void 0;'
  },
  {
    nombre: 'el error de un alta cuyo diálogo ya se cerró solo sale en un toast, no arriba',
    archivo: ARCHIVO,
    buscar: 'else setAvisoAlta(`${nombreAlta}: ${error}`);',
    reemplazo: 'else void 0;'
  },
  {
    nombre: 'el error de un diálogo ya cerrado no sale en un toast (se pierde si la tarjeta ya no está a la vista)',
    archivo: ARCHIVO,
    buscar: "    showToast(error, 'error');\n    if (reserva) setErrores((e) => ({ ...e, [reserva.id]: error }));",
    reemplazo: '    if (reserva) setErrores((e) => ({ ...e, [reserva.id]: error }));'
  },
  {
    nombre: 'el aviso de un alta cerrada pisa el de un reembolso a medias (comparten el mismo hueco)',
    archivo: ARCHIVO,
    buscar: 'else setAvisoAlta(`${nombreAlta}: ${error}`);',
    reemplazo: 'else setAvisoGeneral(`${nombreAlta}: ${error}`);'
  },
  {
    nombre: 'abrir otra alta no quita el aviso de la anterior',
    archivo: ARCHIVO,
    buscar: "    if (nuevo.tipo === 'alta') setAvisoAlta('');\n",
    reemplazo: ''
  },
  {
    nombre: 'la recarga de una lista desfasada borra el mensaje de la tarjeta si tarda en llegar (no conserva)',
    archivo: ARCHIVO,
    buscar: 'cargar(vistaRef.current, true).then(() => setFoco(reserva.id));',
    reemplazo: 'cargar(vistaRef.current).then(() => setFoco(reserva.id));'
  },
  {
    nombre: 'el error de un diálogo cerrado con «Volver» reaparece al abrir otra acción',
    archivo: ARCHIVO,
    buscar: "    setErrorDialogo('');\n    if (nuevo.tipo === 'alta') setAvisoAlta('');",
    reemplazo: "    if (nuevo.tipo === 'alta') setAvisoAlta('');"
  },
  {
    nombre: 'un alta que falla sin respuesta del servidor no avisa de que pudo guardarse',
    archivo: ARCHIVO,
    buscar: 'const pudoGuardarse = resultado.status === 0 || resultado.status >= 500;',
    reemplazo: 'const pudoGuardarse = false;'
  }
];
