// Mutantes de la edición rápida de precios y de "Asignar precio de alquiler" en "Gestionar
// Inventario" (21 oct 2026; ver scripts/mutantes-panel.js). Los cálculos de admin/precios.js tienen
// su propia lista: precios-calculo.js.
export const TEST = 'src/pages/admin/preciosInventario.test.jsx';

const CELDA = 'src/pages/admin/PrecioEditable.jsx';
const PESTANA = 'src/pages/admin/pestanas/InventarioTab.jsx';
const MODAL = 'src/pages/admin/modales/AsignarAlquilerModal.jsx';

export const MUTANTES = [
  // Celda editable
  {
    nombre: 'Escape guarda en vez de cancelar',
    archivo: CELDA,
    buscar: "          } else if (e.key === 'Escape') {\n            e.preventDefault();\n            cancelar();",
    reemplazo: "          } else if (e.key === 'Escape') {\n            e.preventDefault();\n            terminar();"
  },
  {
    nombre: 'Intro no guarda',
    archivo: CELDA,
    buscar: "          if (e.key === 'Enter') {\n            e.preventDefault();\n            terminar();",
    reemplazo: "          if (e.key === 'Enter') {\n            e.preventDefault();"
  },
  {
    nombre: 'salir del campo cancela en vez de guardar',
    archivo: CELDA,
    buscar: 'onBlur={terminar}',
    reemplazo: 'onBlur={cancelar}'
  },
  {
    nombre: 'Intro y después el blur guardan dos veces',
    archivo: CELDA,
    buscar: '    if (resuelto.current) return;\n    resuelto.current = true;',
    reemplazo: '    if (resuelto.current) return;'
  },
  {
    nombre: 'sin cambios manda la petición igualmente',
    archivo: CELDA,
    buscar: 'if (leido.valor === actual) {',
    reemplazo: 'if (false) {'
  },
  {
    nombre: 'un precio no válido se manda igualmente',
    archivo: CELDA,
    buscar: 'if (leido.error) {',
    reemplazo: 'if (false) {'
  },
  {
    nombre: 'tras guardar, la celda vuelve al precio de antes hasta la recarga',
    archivo: CELDA,
    buscar: 'if (ok) setGuardado(leido.valor);',
    reemplazo: ''
  },
  {
    nombre: 'si falla, la celda enseña el precio que no se guardó',
    archivo: CELDA,
    buscar: 'if (ok) setGuardado(leido.valor);',
    reemplazo: 'setGuardado(leido.valor);'
  },
  {
    nombre: 'la recarga no sustituye al precio recién guardado',
    archivo: CELDA,
    buscar: 'useEffect(() => setGuardado(undefined), [valor]);',
    reemplazo: 'useEffect(() => {}, [valor]);'
  },
  {
    nombre: 'el campo no se desactiva mientras guarda',
    archivo: CELDA,
    buscar: 'disabled={guardando}',
    reemplazo: 'disabled={false}'
  },
  {
    nombre: 'el campo empieza vacío en vez de con el precio',
    archivo: CELDA,
    buscar: "setTexto(actual === null ? '' : String(actual));",
    reemplazo: "setTexto('');"
  },
  {
    nombre: 'el doble clic no abre el campo',
    archivo: CELDA,
    buscar: 'onDoubleClick={empezar}',
    reemplazo: ''
  },
  {
    nombre: 'el campo no recibe el foco al abrirse',
    archivo: CELDA,
    buscar: '        autoFocus\n',
    reemplazo: ''
  },
  // Pestaña
  {
    nombre: 'la edición rápida manda el precio como número (el servidor lo espera como texto)',
    archivo: PESTANA,
    buscar: '{ [campo]: valor === null ? null : String(valor) }',
    reemplazo: '{ [campo]: valor }'
  },
  {
    nombre: 'la edición rápida no recarga tras guardar',
    archivo: PESTANA,
    buscar: "    showToast('Precio guardado', 'success');\n    recargarMuebles();",
    reemplazo: "    showToast('Precio guardado', 'success');"
  },
  {
    nombre: 'otro texto en el aviso de precio guardado',
    archivo: PESTANA,
    buscar: "showToast('Precio guardado', 'success');",
    reemplazo: "showToast('Guardado', 'success');"
  },
  {
    nombre: 'otro texto en el aviso de error al guardar el precio',
    archivo: PESTANA,
    buscar: "showToast('Error al guardar', 'error');",
    reemplazo: "showToast('Error', 'error');"
  },
  {
    nombre: 'un fallo al guardar el precio cuenta como guardado',
    archivo: PESTANA,
    buscar: "      showToast('Error al guardar', 'error');\n      return false;",
    reemplazo: "      showToast('Error al guardar', 'error');\n      return true;"
  },
  {
    nombre: 'el precio de alquiler se manda con el nombre de la columna en vez del del formulario',
    archivo: PESTANA,
    buscar: "guardarPrecio(m.id, 'precio_alquiler', valor)",
    reemplazo: "guardarPrecio(m.id, 'precio_alquiler_dia', valor)"
  },
  {
    nombre: 'el aviso del lote es de éxito aunque fallen piezas',
    archivo: PESTANA,
    buscar: "fallidos.length === 0 ? 'success' : 'error'",
    reemplazo: "'success'"
  },
  {
    nombre: 'tras asignar el alquiler se vacía la selección aunque fallen piezas',
    archivo: PESTANA,
    buscar: '    setSeleccionados(fallidos);\n    if (hechos > 0) recargarMuebles();\n  };\n\n  return (',
    reemplazo: '    setSeleccionados([]);\n    if (hechos > 0) recargarMuebles();\n  };\n\n  return ('
  },
  {
    nombre: 'tras asignar el alquiler recarga aunque fallen todas',
    archivo: PESTANA,
    buscar: '    if (hechos > 0) recargarMuebles();\n  };\n\n  return (',
    reemplazo: '    recargarMuebles();\n  };\n\n  return ('
  },
  {
    nombre: 'el modal recibe todo el catálogo en vez de las seleccionadas',
    archivo: PESTANA,
    buscar: 'piezas={muebles.filter(m => seleccionados.includes(m.id))}',
    reemplazo: 'piezas={muebles}'
  },
  // Modal
  {
    nombre: 'el porcentaje solo se ofrece si todas tienen precio de venta',
    archivo: MODAL,
    buscar: 'const porcentajeDisponible = sinVenta < total;',
    reemplazo: 'const porcentajeDisponible = sinVenta === 0;'
  },
  {
    nombre: 'el porcentaje se ofrece aunque ninguna tenga precio de venta',
    archivo: MODAL,
    buscar: 'const porcentajeDisponible = sinVenta < total;',
    reemplazo: 'const porcentajeDisponible = true;'
  },
  {
    nombre: 'un precio fijo de 0 € deja seguir',
    archivo: MODAL,
    buscar: 'return valor > 0 ? { modo, fijo: valor } : null;',
    reemplazo: 'return valor >= 0 ? { modo, fijo: valor } : null;'
  },
  {
    nombre: 'un porcentaje de más del 100 % deja seguir',
    archivo: MODAL,
    buscar: 'pct > 0 && pct <= 100 ?',
    reemplazo: 'pct > 0 ?'
  },
  {
    nombre: 'el lote manda el precio como número',
    archivo: MODAL,
    buscar: '{ precio_alquiler: String(precioPorId.get(id)) }',
    reemplazo: '{ precio_alquiler: precioPorId.get(id) }'
  },
  {
    nombre: 'el lote también cambia las piezas sin precio calculado',
    archivo: MODAL,
    buscar: 'new Map(aplicables.map(',
    reemplazo: 'new Map(propuesta.map('
  },
  {
    nombre: '"Revisar y aplicar" aplica sin confirmar',
    archivo: MODAL,
    buscar: 'onClick={() => setConfirmando(true)}',
    reemplazo: 'onClick={aplicar}'
  },
  {
    nombre: 'el resultado cuenta solo las piezas con precio calculado',
    archivo: MODAL,
    buscar: '{textoResultadoAlquiler(resultado.hechos, total)}',
    reemplazo: '{textoResultadoAlquiler(resultado.hechos, aplicables.length)}'
  },
  {
    nombre: 'las piezas no se fijan al abrir el modal',
    archivo: MODAL,
    buscar: 'const [piezas] = useState(piezasElegidas);',
    reemplazo: 'const piezas = piezasElegidas;'
  },
  {
    nombre: 'el redondeo empieza en 0,50 €',
    archivo: MODAL,
    buscar: "useState('entero')",
    reemplazo: "useState('medio')"
  },
  {
    nombre: 'el porcentaje empieza en 5 %',
    archivo: MODAL,
    buscar: "const [porcentaje, setPorcentaje] = useState('10');",
    reemplazo: "const [porcentaje, setPorcentaje] = useState('5');"
  },
  {
    nombre: 'cambiar una opción no cierra la confirmación',
    archivo: MODAL,
    buscar: '    setter(valor);\n    setConfirmando(false);',
    reemplazo: '    setter(valor);'
  },
  {
    nombre: 'el aviso de piezas sin precio de venta, siempre en plural',
    archivo: MODAL,
    buscar: '{sinVenta === 1\n',
    reemplazo: '{sinVenta === 0\n'
  },
  {
    nombre: 'el resultado no dice qué piezas fallaron',
    archivo: MODAL,
    buscar: 'fallidos: piezas.filter((m) => fallidos.includes(m.id))',
    reemplazo: 'fallidos: []'
  },
  {
    nombre: 'el aviso de la pestaña cuenta solo las piezas con precio calculado',
    archivo: MODAL,
    buscar: 'onAplicado({ hechos, fallidos, total });',
    reemplazo: 'onAplicado({ hechos, fallidos, total: aplicables.length });'
  },
  {
    nombre: '"Sí, asignar" se puede pulsar otra vez mientras guarda',
    archivo: MODAL,
    buscar: '<button className="admin-btn" onClick={aplicar} disabled={aplicando}>',
    reemplazo: '<button className="admin-btn" onClick={aplicar} disabled={false}>'
  }
];
