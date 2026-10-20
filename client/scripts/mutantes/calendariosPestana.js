// Mutantes de las formas de ver «Reservas» (lista, calendario por pieza, vista general) en
// pages/admin/pestanas/ReservasTab.jsx; ver scripts/mutantes-panel.js. Los mata la parte «Reservas —
// calendarios» de ReservasTab.test.jsx.
export const TEST = 'src/pages/admin/pestanas/ReservasTab.test.jsx';

const ARCHIVO = 'src/pages/admin/pestanas/ReservasTab.jsx';

export const MUTANTES = [
  {
    nombre: 'al entrar se ve un calendario y no la lista',
    archivo: ARCHIVO,
    buscar: "const [modo, setModo] = useState('lista');",
    reemplazo: "const [modo, setModo] = useState('general');"
  },
  {
    nombre: 'los calendarios se montan al entrar, sin que nadie los abra',
    archivo: ARCHIVO,
    buscar: "useState(['lista']);",
    reemplazo: "useState(['lista', 'pieza', 'general']);"
  },
  {
    nombre: 'abrir un calendario por primera vez no lo monta',
    archivo: ARCHIVO,
    buscar: '    setAbiertos((a) => (a.includes(id) ? a : [...a, id]));\n',
    reemplazo: ''
  },
  {
    nombre: 'pulsar una forma de ver no la elige',
    archivo: ARCHIVO,
    buscar: '    setModo(id);\n  };\n\n  // «Ver reserva» de la agenda',
    reemplazo: '  };\n\n  // «Ver reserva» de la agenda'
  },
  {
    nombre: 'el calendario por pieza se desmonta al volver a la lista (pierde la pieza y el mes)',
    archivo: ARCHIVO,
    buscar: "{abiertos.includes('pieza') && (",
    reemplazo: "{modo === 'pieza' && ("
  },
  {
    nombre: 'la vista general se desmonta al volver a la lista (pierde los días y la reserva abierta)',
    archivo: ARCHIVO,
    buscar: "{abiertos.includes('general') && (",
    reemplazo: "{modo === 'general' && ("
  },
  {
    nombre: 'el calendario por pieza sigue a la vista con la lista abierta',
    archivo: ARCHIVO,
    buscar: "<div hidden={modo !== 'pieza'}>",
    reemplazo: '<div>'
  },
  {
    nombre: 'la vista general sigue a la vista con la lista abierta',
    archivo: ARCHIVO,
    buscar: "<div hidden={modo !== 'general'}>",
    reemplazo: '<div>'
  },
  {
    nombre: 'el calendario por pieza escondido sigue leyendo',
    archivo: ARCHIVO,
    buscar: "activo={modo === 'pieza'}",
    reemplazo: 'activo'
  },
  {
    nombre: 'la vista general escondida sigue leyendo',
    archivo: ARCHIVO,
    buscar: "activo={modo === 'general'}",
    reemplazo: 'activo'
  },
  {
    nombre: 'el calendario por pieza no se vuelve a leer tras un cambio',
    archivo: ARCHIVO,
    buscar: 'muebles={muebles} hoy={hoyInicial} version={version}',
    reemplazo: 'muebles={muebles} hoy={hoyInicial} version={0}'
  },
  {
    nombre: 'la vista general no se vuelve a leer tras un cambio',
    archivo: ARCHIVO,
    buscar: '<VistaGeneral hoy={hoyInicial} version={version}',
    reemplazo: '<VistaGeneral hoy={hoyInicial} version={0}'
  },
  {
    nombre: 'un cambio hecho no avisa a los calendarios',
    archivo: ARCHIVO,
    buscar: '    recargarAgenda();\n    setVersion((v) => v + 1);\n  };',
    reemplazo: '    recargarAgenda();\n  };'
  },
  {
    nombre: 'el calendario por pieza no recibe las piezas',
    archivo: ARCHIVO,
    buscar: '<CalendarioPieza muebles={muebles}',
    reemplazo: '<CalendarioPieza muebles={[]}'
  },
  {
    nombre: 'los calendarios no reciben el día de hoy',
    archivo: ARCHIVO,
    buscar: '<CalendarioPieza muebles={muebles} hoy={hoyInicial}',
    reemplazo: '<CalendarioPieza muebles={muebles} hoy={undefined}'
  },
  {
    nombre: 'la vista general no recibe el día de hoy',
    archivo: ARCHIVO,
    buscar: '<VistaGeneral hoy={hoyInicial}',
    reemplazo: '<VistaGeneral hoy={undefined}'
  },
  {
    nombre: '«Ver reserva» del calendario por pieza no hace nada',
    archivo: ARCHIVO,
    buscar: "activo={modo === 'pieza'} onVer={verEnLista}",
    reemplazo: "activo={modo === 'pieza'} onVer={() => {}}"
  },
  {
    nombre: '«Ver reserva» de la vista general no hace nada',
    archivo: ARCHIVO,
    buscar: "activo={modo === 'general'} onVer={verEnLista}",
    reemplazo: "activo={modo === 'general'} onVer={() => {}}"
  },
  {
    nombre: 'con un calendario abierto se sigue viendo la lista',
    archivo: ARCHIVO,
    buscar: "{modo === 'lista' && contenido}",
    reemplazo: '{contenido}'
  },
  {
    nombre: 'con un calendario abierto se siguen viendo las vistas y el buscador',
    archivo: ARCHIVO,
    buscar: "      <div hidden={modo !== 'lista'}>\n        <div className=\"reservas-vistas\"",
    reemplazo: "      <div>\n        <div className=\"reservas-vistas\""
  },
  {
    nombre: 'al volver de un calendario se pierde lo escrito en el buscador',
    archivo: ARCHIVO,
    buscar: '<BuscadorReservas activa={busqueda}',
    reemplazo: '<BuscadorReservas key={modo} activa={busqueda}'
  },
  {
    nombre: 'con un calendario abierto no están «Actualizar» ni las altas',
    archivo: ARCHIVO,
    buscar: '      <div className="admin-toolbar">\n        <button type="button" className="admin-btn-ghost" onClick={actualizar}>',
    reemplazo: '      <div className="admin-toolbar" hidden={modo !== \'lista\'}>\n        <button type="button" className="admin-btn-ghost" onClick={actualizar}>'
  },
  {
    nombre: 'la forma de ver elegida no se marca',
    archivo: ARCHIVO,
    buscar: 'aria-pressed={id === modo}',
    reemplazo: 'aria-pressed={id === "lista"}'
  },
  {
    nombre: '«Ver reserva» de un calendario no cambia a la lista',
    archivo: ARCHIVO,
    buscar: "    tarjetaPendiente.current = reserva.id;\n    setModo('lista');\n    cargar(vistaRef.current);",
    reemplazo: '    tarjetaPendiente.current = reserva.id;\n    cargar(vistaRef.current);'
  },
  {
    nombre: '«Ver reserva» de un calendario no busca su referencia',
    archivo: ARCHIVO,
    buscar: "const filtros = { q: reserva.referencia, desde: '', hasta: '' };",
    reemplazo: "const filtros = { q: reserva.id, desde: '', hasta: '' };"
  },
  {
    nombre: '«Ver reserva» de un calendario busca con fechas',
    archivo: ARCHIVO,
    buscar: "const filtros = { q: reserva.referencia, desde: '', hasta: '' };",
    reemplazo: "const filtros = { q: reserva.referencia, desde: '2026-01-01', hasta: '' };"
  },
  {
    nombre: '«Ver reserva» de un calendario no guarda la búsqueda para las recargas',
    archivo: ARCHIVO,
    buscar: '    busquedaRef.current = filtros;\n    setBusqueda(filtros);\n    tarjetaPendiente.current = reserva.id;',
    reemplazo: '    setBusqueda(filtros);\n    tarjetaPendiente.current = reserva.id;'
  },
  {
    nombre: '«Ver reserva» de un calendario no enseña la búsqueda en el buscador',
    archivo: ARCHIVO,
    buscar: '    busquedaRef.current = filtros;\n    setBusqueda(filtros);\n    tarjetaPendiente.current = reserva.id;',
    reemplazo: '    busquedaRef.current = filtros;\n    tarjetaPendiente.current = reserva.id;'
  },
  {
    nombre: '«Ver reserva» de un calendario no recarga la lista',
    archivo: ARCHIVO,
    buscar: "    setModo('lista');\n    cargar(vistaRef.current);\n  };",
    reemplazo: "    setModo('lista');\n  };"
  },
  {
    nombre: '«Ver reserva» de un calendario no pide enfocar la tarjeta',
    archivo: ARCHIVO,
    buscar: '    tarjetaPendiente.current = reserva.id;\n    setModo(\'lista\');',
    reemplazo: "    setModo('lista');"
  },
  {
    nombre: '«Ver reserva» de la agenda estando en un calendario no cambia a la lista',
    archivo: ARCHIVO,
    buscar: "    dejarBusqueda();\n    setModo('lista');\n    if (vistaRef.current === destino)",
    reemplazo: '    dejarBusqueda();\n    if (vistaRef.current === destino)'
  }
];
