// Mutantes de los modales de edición de mueble y de categoría (ver scripts/mutantes-panel.js).
export const TEST = 'src/pages/Admin.modales.test.jsx';

export const MUTANTES = [
  {
    nombre: 'el alquiler no se rellena desde precio_alquiler_dia',
    buscar: "value={muebleAEditar.precio_alquiler ?? muebleAEditar.precio_alquiler_dia ?? ''}",
    reemplazo: "value={muebleAEditar.precio_alquiler ?? ''}"
  },
  {
    nombre: 'un estado vacío abre como "Vendido"',
    buscar: "value={muebleAEditar.estado || 'disponible'}",
    reemplazo: "value={muebleAEditar.estado || 'vendido'}"
  },
  {
    nombre: 'no se manda categoria_id al editar',
    buscar: "const categoriaId = idDeCategoria(muebleAEditar.categoria);\n    if (categoriaId !== undefined) formDataToSend.append('categoria_id', categoriaId);",
    reemplazo: 'const categoriaId = idDeCategoria(muebleAEditar.categoria);'
  },
  {
    nombre: 'el alquiler se manda sin mirar precio_alquiler_dia',
    buscar: "formDataToSend.append('precio_alquiler', muebleAEditar.precio_alquiler ?? muebleAEditar.precio_alquiler_dia ?? '');",
    reemplazo: "formDataToSend.append('precio_alquiler', muebleAEditar.precio_alquiler ?? '');"
  },
  {
    nombre: 'un precio 0 se manda como 0 (en vez de vacío)',
    buscar: "formDataToSend.append('precio_venta', muebleAEditar.precio_venta || '');",
    reemplazo: "formDataToSend.append('precio_venta', muebleAEditar.precio_venta ?? '');"
  },
  {
    nombre: 'no se mandan las fotos actuales',
    buscar: "    formDataToSend.append('imagenes_existentes', JSON.stringify(muebleAEditar.imagenes || []));\n",
    reemplazo: ''
  },
  {
    nombre: 'no se mandan las fotos nuevas',
    buscar: "      for (const file of editMuebleFiles) {\n        formDataToSend.append('imagenes', file);\n      }",
    reemplazo: ''
  },
  {
    nombre: 'quitar una foto quita siempre la primera',
    buscar: 'const updatedImgs = muebleAEditar.imagenes.filter((_, i) => i !== idx);',
    reemplazo: 'const updatedImgs = muebleAEditar.imagenes.filter((_, i) => i !== 0);'
  },
  {
    nombre: 'al guardar bien, el modal no se cierra',
    buscar: '      setMuebleAEditar(null);\n      setEditMuebleFiles([]);',
    reemplazo: '      setEditMuebleFiles([]);'
  },
  {
    nombre: 'al guardar bien, no se recargan los muebles',
    buscar: '      setEditMuebleFiles([]);\n      cargarMuebles();',
    reemplazo: '      setEditMuebleFiles([]);'
  },
  {
    nombre: 'si falla, el modal se cierra',
    buscar: "showToast('Error al actualizar el producto', 'error');",
    reemplazo: "showToast('Error al actualizar el producto', 'error'); setMuebleAEditar(null);"
  },
  {
    nombre: '"Guardar Cambios" del mueble no se desactiva mientras guarda',
    buscar: "<button type=\"submit\" className=\"admin-btn\" disabled={status.includes('Actualizando')}>",
    reemplazo: '<button type="submit" className="admin-btn" disabled={false}>'
  },
  {
    nombre: '"Cerrar" del modal de mueble no cierra',
    buscar: 'onClick={() => setMuebleAEditar(null)} aria-label="Cerrar"',
    reemplazo: 'onClick={() => {}} aria-label="Cerrar"'
  },
  {
    nombre: 'la categoría puede elegirse a sí misma como general',
    buscar: 'categorias.filter(c => !c.categoria_padre_id && c.id !== categoriaAEditar.id)',
    reemplazo: 'categorias.filter(c => !c.categoria_padre_id)'
  },
  {
    nombre: 'no se manda la categoría general al editar',
    buscar: "formDataToSend.append('categoria_padre_id', categoriaAEditar.categoria_padre_id || '');",
    reemplazo: ''
  },
  {
    nombre: 'sin imagen nueva no se manda imagen_url',
    buscar: "formDataToSend.append('imagen_url', categoriaAEditar.imagen_url || '');",
    reemplazo: ''
  },
  {
    nombre: 'la imagen nueva de la categoría no se manda',
    buscar: "formDataToSend.append('imagen', editCategoriaFile);",
    reemplazo: ''
  },
  {
    nombre: 'quitar la imagen de la categoría no la quita',
    buscar: "setCategoriaAEditar({ ...categoriaAEditar, imagen_url: '' });",
    reemplazo: ''
  },
  {
    nombre: 'al guardar bien la categoría, no se recargan las categorías',
    buscar: '      setEditCategoriaFile(null);\n      cargarCategorias();',
    reemplazo: '      setEditCategoriaFile(null);'
  },
  {
    nombre: 'al guardar bien la categoría, el modal no se cierra',
    buscar: '      setCategoriaAEditar(null);\n      setEditCategoriaFile(null);',
    reemplazo: '      setEditCategoriaFile(null);'
  }
];
