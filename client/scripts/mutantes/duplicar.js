// Mutantes de "Duplicar" en "Gestionar Inventario" (21 oct 2026; ver scripts/mutantes-panel.js). La
// copia la hace el servidor: lo suyo está en server/src/__tests__/duplicarMueble.test.js.
export const TEST = 'src/pages/admin/duplicarPieza.test.jsx';

const PESTANA = 'src/pages/admin/pestanas/InventarioTab.jsx';

export const MUTANTES = [
  {
    nombre: 'otro título en la confirmación',
    archivo: PESTANA,
    buscar: "      'Duplicar pieza',\n",
    reemplazo: "      'Duplicar',\n"
  },
  {
    nombre: 'la confirmación no dice que las fotos no se copian',
    archivo: PESTANA,
    buscar: 'con la misma información excepto las fotos.`',
    reemplazo: 'con la misma información.`'
  },
  {
    nombre: 'el botón de la confirmación dice "Eliminar"',
    archivo: PESTANA,
    buscar: "      },\n      'Duplicar'\n    );",
    reemplazo: '      }\n    );'
  },
  {
    nombre: 'se duplica otra pieza (la referencia en vez del id)',
    archivo: PESTANA,
    buscar: 'await duplicarMueble(m.id);',
    reemplazo: 'await duplicarMueble(m.referencia);'
  },
  {
    nombre: 'un segundo clic mientras se duplica crea otra copia',
    archivo: PESTANA,
    buscar: '        if (duplicando.current) return;\n',
    reemplazo: ''
  },
  {
    nombre: 'tras un error ya no se puede volver a duplicar',
    archivo: PESTANA,
    buscar: '        duplicando.current = false;\n',
    reemplazo: ''
  },
  {
    nombre: 'se abre el editor de la pieza original en vez del de la copia',
    archivo: PESTANA,
    buscar: 'abrirEditorMueble(nueva);',
    reemplazo: 'abrirEditorMueble(m);'
  },
  {
    nombre: 'no se abre ningún editor',
    archivo: PESTANA,
    buscar: 'abrirEditorMueble(nueva);',
    reemplazo: ''
  },
  {
    nombre: 'el inventario no se recarga tras duplicar',
    archivo: PESTANA,
    buscar: '        recargarMuebles();\n        abrirEditorMueble(nueva);',
    reemplazo: '        abrirEditorMueble(nueva);'
  },
  {
    nombre: 'el error del servidor se cambia por uno genérico',
    archivo: PESTANA,
    buscar: "showToast(error || 'No se pudo duplicar la pieza.', 'error');",
    reemplazo: "showToast('No se pudo duplicar la pieza.', 'error');"
  },
  {
    nombre: 'una respuesta sin la pieza nueva cuenta como éxito',
    archivo: PESTANA,
    buscar: 'if (error || !nueva) {',
    reemplazo: 'if (error) {'
  },
  {
    nombre: 'tras un error se sigue adelante (recarga y editor)',
    archivo: PESTANA,
    buscar: "          showToast(error || 'No se pudo duplicar la pieza.', 'error');\n          return;",
    reemplazo: "          showToast(error || 'No se pudo duplicar la pieza.', 'error');\n          recargarMuebles();\n          return;"
  },
  {
    nombre: 'el aviso de éxito no dice la referencia nueva',
    archivo: PESTANA,
    buscar: "nueva.referencia ? `Pieza duplicada (${nueva.referencia})` : 'Pieza duplicada'",
    reemplazo: "'Pieza duplicada'"
  },
  {
    nombre: 'una copia sin referencia avisa con "(null)"',
    archivo: PESTANA,
    buscar: "nueva.referencia ? `Pieza duplicada (${nueva.referencia})` : 'Pieza duplicada'",
    reemplazo: '`Pieza duplicada (${nueva.referencia})`'
  },
  {
    nombre: '"Duplicar" del menú de la fila no hace nada',
    archivo: PESTANA,
    buscar: "onElegir: () => handleDuplicar(m) }",
    reemplazo: "onElegir: () => {} }"
  }
];
