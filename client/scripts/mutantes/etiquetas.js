// Mutantes de las etiquetas con QR de "Gestionar Inventario" (21 oct 2026; ver scripts/mutantes-panel.js).
export const TEST = 'src/pages/admin/etiquetasQr.test.jsx';

const AYUDANTES = 'src/pages/admin/etiquetas.js';
const QR = 'src/pages/admin/CodigoQr.jsx';
const MODAL = 'src/pages/admin/modales/EtiquetasModal.jsx';
const VISTA = 'src/pages/admin/VistaImpresion.jsx';
const PESTANA = 'src/pages/admin/pestanas/InventarioTab.jsx';

export const MUTANTES = [
  {
    nombre: 'el QR lleva a la web sin www',
    archivo: AYUDANTES,
    buscar: "export const WEB_PUBLICA = 'https://www.nave5barcelona.com';",
    reemplazo: "export const WEB_PUBLICA = 'https://nave5barcelona.com';"
  },
  {
    nombre: 'el QR lleva al catálogo y no a la ficha',
    archivo: AYUDANTES,
    buscar: '`${WEB_PUBLICA}/mueble/${encodeURIComponent(mueble.id)}`',
    reemplazo: '`${WEB_PUBLICA}/catalogo/${encodeURIComponent(mueble.id)}`'
  },
  {
    nombre: 'el id va sin codificar',
    archivo: AYUDANTES,
    buscar: '${encodeURIComponent(mueble.id)}`',
    reemplazo: '${mueble.id}`'
  },
  {
    nombre: '4 etiquetas por hoja',
    archivo: AYUDANTES,
    buscar: 'export const ETIQUETAS_POR_HOJA = 6;',
    reemplazo: 'export const ETIQUETAS_POR_HOJA = 4;'
  },
  {
    nombre: 'las hojas se solapan',
    archivo: AYUDANTES,
    buscar: 'hojas.push(piezas.slice(i, i + porHoja))',
    reemplazo: 'hojas.push(piezas.slice(i, i + porHoja + 1))'
  },
  {
    nombre: 'la última hoja incompleta se pierde',
    archivo: AYUDANTES,
    buscar: 'for (let i = 0; i < piezas.length; i += porHoja)',
    reemplazo: 'for (let i = 0; i + porHoja <= piezas.length; i += porHoja)'
  },
  {
    nombre: 'otra corrección de errores',
    archivo: AYUDANTES,
    buscar: "const qr = qrcode(0, 'M');",
    reemplazo: "const qr = qrcode(0, 'L');"
  },
  {
    nombre: 'el QR no codifica el texto',
    archivo: AYUDANTES,
    buscar: '  qr.addData(texto);\n',
    reemplazo: "  qr.addData('x');\n"
  },
  {
    nombre: 'filas y columnas cambiadas',
    archivo: AYUDANTES,
    buscar: 'd += `M${col} ${fila}h1v1h-1z`',
    reemplazo: 'd += `M${fila} ${col}h1v1h-1z`'
  },
  {
    nombre: 'se pintan los módulos claros',
    archivo: AYUDANTES,
    buscar: 'if (qr.isDark(fila, col))',
    reemplazo: 'if (!qr.isDark(fila, col))'
  },
  {
    nombre: 'falta la última fila',
    archivo: AYUDANTES,
    buscar: 'for (let fila = 0; fila < tamano; fila += 1)',
    reemplazo: 'for (let fila = 0; fila < tamano - 1; fila += 1)'
  },
  {
    nombre: 'sin margen blanco',
    archivo: QR,
    buscar: 'const MARGEN = 4;',
    reemplazo: 'const MARGEN = 0;'
  },
  {
    nombre: 'el QR no mide 100',
    archivo: QR,
    buscar: 'tamano = 100',
    reemplazo: 'tamano = 60'
  },
  {
    nombre: 'el fondo del QR no es blanco',
    archivo: QR,
    buscar: 'fill="#fff"',
    reemplazo: 'fill="none"'
  },
  {
    nombre: 'el QR no dice qué lleva',
    archivo: QR,
    buscar: 'data-qr={texto}',
    reemplazo: ''
  },
  {
    nombre: 'sin la cabecera NAVE 5 BARCELONA',
    archivo: MODAL,
    buscar: '<p className="etiqueta-marca">NAVE 5 BARCELONA</p>',
    reemplazo: '<p className="etiqueta-marca">Nave 5</p>'
  },
  {
    nombre: 'la etiqueta no lleva la referencia',
    archivo: MODAL,
    buscar: "{mueble.referencia || 'Sin referencia'}",
    reemplazo: "{'Sin referencia'}"
  },
  {
    nombre: 'una pieza sin referencia sale vacía',
    archivo: MODAL,
    buscar: "{mueble.referencia || 'Sin referencia'}",
    reemplazo: '{mueble.referencia}'
  },
  {
    nombre: 'la referencia que falta no se marca',
    archivo: MODAL,
    buscar: "${mueble.referencia ? '' : 'sin-ref'}",
    reemplazo: ''
  },
  {
    nombre: 'la etiqueta no lleva el nombre',
    archivo: MODAL,
    buscar: '<p className="etiqueta-nombre">{mueble.nombre}</p>',
    reemplazo: '<p className="etiqueta-nombre" />'
  },
  {
    nombre: 'el QR de la etiqueta no es el de su ficha',
    archivo: MODAL,
    buscar: 'const url = urlFicha(mueble);',
    reemplazo: "const url = 'https://www.nave5barcelona.com/';"
  },
  {
    nombre: 'todo en una hoja',
    archivo: MODAL,
    buscar: 'const hojas = enHojas(piezas);',
    reemplazo: 'const hojas = [piezas];'
  },
  {
    nombre: 'el título no cuenta las hojas',
    archivo: MODAL,
    buscar: "(${hojas.length === 1 ? '1 hoja' : `${hojas.length} hojas`})",
    reemplazo: "(1 hoja)"
  },
  {
    nombre: 'con una sola pieza, el título en plural',
    archivo: MODAL,
    buscar: 'const titulo = piezas.length === 1',
    reemplazo: 'const titulo = piezas.length === 0'
  },
  {
    nombre: '«Imprimir» no imprime',
    archivo: VISTA,
    buscar: 'onClick={() => window.print()}',
    reemplazo: 'onClick={() => {}}'
  },
  {
    nombre: '<body> no lleva la clase de impresión',
    archivo: VISTA,
    buscar: "document.body.classList.add('con-impresion');",
    reemplazo: ''
  },
  {
    nombre: 'la clase de impresión se queda al cerrar',
    archivo: VISTA,
    buscar: "return () => document.body.classList.remove('con-impresion');",
    reemplazo: 'return undefined;'
  },
  {
    nombre: 'la vista no cuelga de <body>',
    archivo: VISTA,
    buscar: '    </div>,\n    document.body\n  );',
    reemplazo: '    </div>\n  );'
  },
  {
    nombre: 'la vista no se cierra con Escape',
    archivo: VISTA,
    buscar: 'useDialogoModal(true, ref, onCerrar);',
    reemplazo: 'useDialogoModal(true, ref, () => {});'
  },
  {
    nombre: '«Imprimir etiqueta» del menú de la fila abre la de otra pieza',
    archivo: PESTANA,
    buscar: 'onElegir: () => setEtiquetas([m]) }',
    reemplazo: 'onElegir: () => setEtiquetas([muebles[0]]) }'
  },
  {
    nombre: 'el lote imprime todo el catálogo',
    archivo: PESTANA,
    buscar: 'onClick={() => setEtiquetas(muebles.filter(m => seleccionados.includes(m.id)))}',
    reemplazo: 'onClick={() => setEtiquetas(muebles)}'
  },
  {
    nombre: '«Cerrar» no cierra',
    archivo: PESTANA,
    buscar: '<EtiquetasModal piezas={etiquetas} onCerrar={() => setEtiquetas(null)} />',
    reemplazo: '<EtiquetasModal piezas={etiquetas} onCerrar={() => {}} />'
  }
];
