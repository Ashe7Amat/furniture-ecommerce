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
    buscar: 'getReservasAdmin({ vista: vistaPedida, ...busquedaRef.current })',
    reemplazo: "getReservasAdmin({ vista: 'proximas', ...busquedaRef.current })"
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
  },
  // ── 20 oct 2026: descripciones de las vistas, números de aviso y aviso de lista movida ──
  {
    nombre: 'bajo los botones se enseña siempre la descripción de «Próximas», aunque se cambie de vista',
    archivo: ARCHIVO,
    buscar: 'VISTAS.find((v) => v.id === vista).descripcion',
    reemplazo: 'VISTAS[0].descripcion'
  },
  {
    nombre: 'el número de una vista de aviso sale también a cero',
    archivo: ARCHIVO,
    buscar: 'v.aviso && resumen?.[v.aviso] > 0 && (',
    reemplazo: 'v.aviso && resumen?.[v.aviso] >= 0 && ('
  },
  {
    nombre: 'el número sale en todas las vistas, no solo en las tres que piden atención',
    archivo: ARCHIVO,
    buscar: 'v.aviso && resumen?.[v.aviso] > 0 && (',
    reemplazo: 'resumen?.total > 0 && ('
  },
  {
    nombre: 'tras una acción no sale el aviso de que la lista se ha movido',
    archivo: ARCHIVO,
    buscar: '        setListaMovida(true);\n',
    reemplazo: ''
  },
  {
    nombre: 'el aviso de lista movida se queda después de actualizar la lista',
    archivo: ARCHIVO,
    buscar: '    setListaMovida(false);\n',
    reemplazo: ''
  },
  {
    nombre: 'una acción hecha no avisa al contenedor (la insignia del menú se queda con el número de antes)',
    archivo: ARCHIVO,
    buscar: '      avisarCambio();\n      if (resultado.data?.aviso)',
    reemplazo: '      if (resultado.data?.aviso)'
  },
  {
    nombre: 'una acción que deja el reembolso a medias no avisa al contenedor',
    archivo: ARCHIVO,
    buscar: "      avisarCambio();\n      // Su botón «Reintentar» está en esa vista: una búsqueda se deja.\n",
    reemplazo: "      // Su botón «Reintentar» está en esa vista: una búsqueda se deja.\n"
  },
  {
    nombre: 'un alta en el calendario no avisa al contenedor',
    archivo: ARCHIVO,
    buscar: '    cargar(vistaRef.current);\n    avisarCambio();\n  };',
    reemplazo: '    cargar(vistaRef.current);\n  };'
  },
  {
    nombre: '«Actualizar» recarga la lista pero no los números de aviso',
    archivo: ARCHIVO,
    buscar: '    cargar(vista);\n    avisarCambio();\n  };',
    reemplazo: '    cargar(vista);\n  };'
  },
  {
    nombre: 'el botón del aviso de lista movida no actualiza nada',
    archivo: ARCHIVO,
    buscar: '<button type="button" className="admin-btn-ghost" onClick={actualizar}>Actualizar la lista</button>',
    reemplazo: '<button type="button" className="admin-btn-ghost" onClick={() => {}}>Actualizar la lista</button>'
  },
  {
    nombre: 'al avisar de un cambio, el contenedor no se entera (la insignia del menú)',
    archivo: ARCHIVO,
    buscar: '    alCambiar?.();\n    recargarAgenda();\n    setVersion((v) => v + 1);\n  };',
    reemplazo: '    recargarAgenda();\n    setVersion((v) => v + 1);\n  };'
  },
  {
    nombre: 'al avisar de un cambio, la agenda de hoy y mañana no se vuelve a leer',
    archivo: ARCHIVO,
    buscar: '    alCambiar?.();\n    recargarAgenda();\n    setVersion((v) => v + 1);\n  };',
    reemplazo: '    alCambiar?.();\n    setVersion((v) => v + 1);\n  };'
  },
  {
    nombre: 'la agenda no se enseña (llega siempre vacía)',
    archivo: ARCHIVO,
    buscar: '<AgendaReservas datos={datosAgenda}',
    reemplazo: '<AgendaReservas datos={null}'
  },
  {
    nombre: 'si falla la lectura de la agenda, no se dice',
    archivo: ARCHIVO,
    buscar: 'error={errorAgenda}',
    reemplazo: "error=''"
  },
  {
    nombre: '«Volver a cargar la agenda» no la vuelve a leer',
    archivo: ARCHIVO,
    buscar: 'onRecargar={recargarAgenda}',
    reemplazo: 'onRecargar={() => {}}'
  },
  {
    nombre: 'la agenda sale debajo de las vistas, no encima',
    archivo: ARCHIVO,
    cambios: [
      {
        buscar: '      <AgendaReservas datos={datosAgenda} error={errorAgenda} onRecargar={recargarAgenda} onVer={verTrayecto} />\n\n',
        reemplazo: ''
      },
      {
        buscar: '      {!busqueda && <p className="reservas-vista-ayuda">',
        reemplazo: '      <AgendaReservas datos={datosAgenda} error={errorAgenda} onRecargar={recargarAgenda} onVer={verTrayecto} />\n      {!busqueda && <p className="reservas-vista-ayuda">'
      }
    ]
  },
  {
    nombre: '«Ver reserva» de una entrega lleva a las recogidas',
    archivo: ARCHIVO,
    buscar: "tipo === 'entrega' ? 'entregas' : 'recogidas'",
    reemplazo: "'recogidas'"
  },
  {
    nombre: '«Ver reserva» de una recogida lleva a las entregas',
    archivo: ARCHIVO,
    buscar: "tipo === 'entrega' ? 'entregas' : 'recogidas'",
    reemplazo: "'entregas'"
  },
  {
    nombre: '«Ver reserva» estando ya en esa vista no recarga la lista',
    archivo: ARCHIVO,
    buscar: '    if (vistaRef.current === destino) cargar(destino);\n    else setVista(destino);',
    reemplazo: '    if (vistaRef.current !== destino) setVista(destino);'
  },
  {
    nombre: '«Ver reserva» no pide enfocar la tarjeta',
    archivo: ARCHIVO,
    buscar: '    tarjetaPendiente.current = reserva.id;\n    dejarBusqueda();\n',
    reemplazo: '    dejarBusqueda();\n'
  },
  {
    nombre: 'elegir otra vista no cancela la tarjeta pendiente: el foco salta a ella más tarde',
    archivo: ARCHIVO,
    buscar: '  const elegirVista = (id) => {\n    tarjetaPendiente.current = null;\n',
    reemplazo: '  const elegirVista = (id) => {\n'
  },
  {
    nombre: 'al llegar la lista no se pide enfocar la tarjeta pendiente',
    archivo: ARCHIVO,
    buscar: '    if (tarjetaPendiente.current) {\n      setEnfocar(tarjetaPendiente.current);\n      tarjetaPendiente.current = null;\n    }\n',
    reemplazo: ''
  },
  {
    nombre: 'la tarjeta pendiente se queda pedida: cada carga le vuelve a quitar el foco al botón pulsado',
    archivo: ARCHIVO,
    buscar: '      setEnfocar(tarjetaPendiente.current);\n      tarjetaPendiente.current = null;',
    reemplazo: '      setEnfocar(tarjetaPendiente.current);'
  },
  {
    nombre: 'la tarjeta pedida desde la agenda no recibe el foco',
    archivo: ARCHIVO,
    buscar: '    tarjeta?.focus();\n    tarjeta?.scrollIntoView',
    reemplazo: '    tarjeta?.scrollIntoView'
  },
  {
    nombre: 'la tarjeta pedida desde la agenda no se desplaza a la vista',
    archivo: ARCHIVO,
    buscar: "    tarjeta?.scrollIntoView?.({ block: 'start' });\n",
    reemplazo: ''
  },
  {
    nombre: 'la misma tarjeta pedida dos veces no vuelve a recibir el foco',
    archivo: ARCHIVO,
    buscar: '    setEnfocar(null);\n  }, [enfocar]);',
    reemplazo: '  }, [enfocar]);'
  },
  {
    nombre: 'la búsqueda no se manda al servidor',
    archivo: ARCHIVO,
    buscar: 'getReservasAdmin({ vista: vistaPedida, ...busquedaRef.current })',
    reemplazo: 'getReservasAdmin({ vista: vistaPedida })'
  },
  {
    nombre: 'la lista de siempre se recarga con una búsqueda vieja (la ref no se vacía al dejarla)',
    archivo: ARCHIVO,
    buscar: '  const dejarBusqueda = () => {\n    busquedaRef.current = null;',
    reemplazo: '  const dejarBusqueda = () => {'
  },
  {
    nombre: 'dejar la búsqueda no cambia lo que se ve',
    archivo: ARCHIVO,
    buscar: '    busquedaRef.current = null;\n    setBusqueda(null);\n  };',
    reemplazo: '    busquedaRef.current = null;\n  };'
  },
  {
    nombre: 'buscar no recarga la lista',
    archivo: ARCHIVO,
    buscar: '    setBusqueda(filtros);\n    cargar(vistaRef.current);',
    reemplazo: '    setBusqueda(filtros);'
  },
  {
    nombre: 'buscar no guarda la búsqueda para las recargas de después',
    archivo: ARCHIVO,
    buscar: '    tarjetaPendiente.current = null;\n    busquedaRef.current = filtros;\n',
    reemplazo: '    tarjetaPendiente.current = null;\n'
  },
  {
    nombre: 'quitar la búsqueda recarga aunque no hubiera ninguna',
    archivo: ARCHIVO,
    buscar: '    if (!busquedaRef.current) return;\n    dejarBusqueda();\n    cargar(vistaRef.current);',
    reemplazo: '    dejarBusqueda();\n    cargar(vistaRef.current);'
  },
  {
    nombre: 'quitar la búsqueda no recarga la vista de antes',
    archivo: ARCHIVO,
    buscar: '    dejarBusqueda();\n    cargar(vistaRef.current);\n  };',
    reemplazo: '    dejarBusqueda();\n  };'
  },
  {
    nombre: 'elegir una vista no deja la búsqueda',
    archivo: ARCHIVO,
    buscar: '    if (busquedaRef.current) {\n      dejarBusqueda();\n      if (id === vistaRef.current) cargar(id);\n    }',
    reemplazo: '    if (busquedaRef.current) {\n      if (id === vistaRef.current) cargar(id);\n    }'
  },
  {
    nombre: 'elegir la vista que ya estaba elegida durante una búsqueda no recarga',
    archivo: ARCHIVO,
    buscar: '      if (id === vistaRef.current) cargar(id);\n',
    reemplazo: ''
  },
  {
    nombre: 'elegir una vista recarga siempre aunque no hubiera búsqueda',
    archivo: ARCHIVO,
    buscar: '    if (busquedaRef.current) {\n      dejarBusqueda();\n      if (id === vistaRef.current) cargar(id);\n    }\n    setVista(id);',
    reemplazo: '    dejarBusqueda();\n    if (id === vistaRef.current) cargar(id);\n    setVista(id);'
  },
  {
    nombre: '«Ver reserva» de la agenda no deja la búsqueda',
    archivo: ARCHIVO,
    buscar: '    tarjetaPendiente.current = reserva.id;\n    dejarBusqueda();\n',
    reemplazo: '    tarjetaPendiente.current = reserva.id;\n'
  },
  {
    nombre: 'un reembolso a medias no deja la búsqueda al llevar a «Reembolsos a medias»',
    archivo: ARCHIVO,
    buscar: "      // Su botón «Reintentar» está en esa vista: una búsqueda se deja.\n      dejarBusqueda();\n",
    reemplazo: ''
  },
  {
    nombre: 'buscar no cancela el foco pendiente de una tarjeta de la agenda',
    archivo: ARCHIVO,
    buscar: '  const buscar = (filtros) => {\n    tarjetaPendiente.current = null;\n',
    reemplazo: '  const buscar = (filtros) => {\n'
  },
  {
    nombre: 'durante una búsqueda sigue marcada una vista',
    archivo: ARCHIVO,
    buscar: 'aria-pressed={!busqueda && v.id === vista}',
    reemplazo: 'aria-pressed={v.id === vista}'
  },
  {
    nombre: 'una búsqueda deja marcadas todas las vistas',
    archivo: ARCHIVO,
    buscar: 'aria-pressed={!busqueda && v.id === vista}',
    reemplazo: 'aria-pressed={!busqueda}'
  },
  {
    nombre: 'durante una búsqueda sigue la descripción de la vista',
    archivo: ARCHIVO,
    buscar: '{!busqueda && <p className="reservas-vista-ayuda">',
    reemplazo: '{true && <p className="reservas-vista-ayuda">'
  },
  {
    nombre: 'el buscador no recibe la búsqueda hecha',
    archivo: ARCHIVO,
    buscar: '<BuscadorReservas activa={busqueda}',
    reemplazo: '<BuscadorReservas activa={null}'
  },
  {
    nombre: 'una búsqueda sin resultados usa el texto de la vista',
    archivo: ARCHIVO,
    buscar: '{busqueda ? textoResultados(busqueda, 0) : VISTAS.find((v) => v.id === vista).vacia}',
    reemplazo: '{VISTAS.find((v) => v.id === vista).vacia}'
  },
  {
    nombre: 'una búsqueda con resultados usa el recuento de la vista',
    archivo: ARCHIVO,
    buscar: '        {busqueda ? (\n          <p className="reservas-busqueda-resumen" role="status">',
    reemplazo: '        {false ? (\n          <p className="reservas-busqueda-resumen" role="status">'
  },
  {
    nombre: 'el resumen de la búsqueda no cuenta las reservas que hay',
    archivo: ARCHIVO,
    buscar: '{textoResultados(busqueda, reservas.length)}',
    reemplazo: '{textoResultados(busqueda, 2)}'
  },
  {
    nombre: 'el resumen de la búsqueda no se anuncia al lector de pantalla',
    archivo: ARCHIVO,
    buscar: '<p className="reservas-busqueda-resumen" role="status">',
    reemplazo: '<p className="reservas-busqueda-resumen">'
  },
  {
    nombre: 'el aviso de que hay más resultados sale siempre en una búsqueda',
    archivo: ARCHIVO,
    buscar: 'const avisoLimite = busqueda && limitada && (',
    reemplazo: 'const avisoLimite = busqueda && (',
  },
  {
    nombre: 'el aviso de que hay más resultados sale sin búsqueda',
    archivo: ARCHIVO,
    buscar: 'const avisoLimite = busqueda && limitada && (',
    reemplazo: 'const avisoLimite = limitada && (',
  },
  {
    nombre: 'el aviso de que hay más resultados no sale en una búsqueda',
    archivo: ARCHIVO,
    buscar: 'const avisoLimite = busqueda && limitada && (',
    reemplazo: 'const avisoLimite = false && (',
  },
  {
    nombre: 'el aviso de que hay más resultados no sale cuando no hay ninguno',
    archivo: ARCHIVO,
    buscar: '        </p>\n        {avisoLimite}\n      </>\n    );\n  } else {',
    reemplazo: '        </p>\n      </>\n    );\n  } else {'
  },
  {
    nombre: 'el aviso de que hay más resultados no sale cuando los hay',
    archivo: ARCHIVO,
    buscar: '        {avisoLimite}\n        {listaMovida && (',
    reemplazo: '        {listaMovida && ('
  },
  {
    nombre: 'el aviso de que hay más resultados no se anuncia',
    archivo: ARCHIVO,
    buscar: '<p className="reservas-busqueda-limite" role="status">',
    reemplazo: '<p className="reservas-busqueda-limite">'
  },
  {
    nombre: 'el aviso de que hay más resultados da otros números',
    archivo: ARCHIVO,
    buscar: 'const MAX_BUSQUEDA = 1000;',
    reemplazo: 'const MAX_BUSQUEDA = 500;'
  },
  {
    nombre: '`limitada` se toma por cierta con cualquier valor',
    archivo: ARCHIVO,
    buscar: 'limitada: data?.limitada === true',
    reemplazo: 'limitada: Boolean(data?.limitada ?? true)'
  },
  {
    nombre: 'el aviso de lista movida habla siempre de la vista',
    archivo: ARCHIVO,
    buscar: "{busqueda ? 'esta búsqueda' : 'esta vista'}",
    reemplazo: "{'esta vista'}"
  },
  {
    nombre: 'el aviso de lista movida habla siempre de la búsqueda',
    archivo: ARCHIVO,
    buscar: "{busqueda ? 'esta búsqueda' : 'esta vista'}",
    reemplazo: "{'esta búsqueda'}"
  },
  {
    nombre: '«las más recientes» sale en cualquier vista con 200 reservas, no solo en «Todas»',
    archivo: ARCHIVO,
    buscar: "{vista === 'todas' && reservas.length >= MAX_TODAS && ', las más recientes'}",
    reemplazo: "{reservas.length >= MAX_TODAS && ', las más recientes'}"
  }
];
