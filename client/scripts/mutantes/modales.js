// Mutantes de los modales de edición de mueble y de categoría (ver scripts/mutantes-panel.js).
export const TEST = 'src/pages/Admin.modales.test.jsx';

export const MUTANTES = [
  {
    nombre: 'el alquiler no se rellena desde precio_alquiler_dia',
    archivo: 'src/pages/admin/modales/EditarMuebleModal.jsx',
    buscar: "value={mueble.precio_alquiler ?? mueble.precio_alquiler_dia ?? ''}",
    reemplazo: "value={mueble.precio_alquiler ?? ''}"
  },
  {
    nombre: 'un estado vacío abre como "Vendido"',
    archivo: 'src/pages/admin/modales/EditarMuebleModal.jsx',
    buscar: "value={mueble.estado || 'disponible'}",
    reemplazo: "value={mueble.estado || 'vendido'}"
  },
  {
    nombre: 'no se manda categoria_id al editar',
    archivo: 'src/pages/admin/modales/EditarMuebleModal.jsx',
    buscar: "const categoriaId = idDeCategoria(categorias, mueble.categoria);\n    if (categoriaId !== undefined) formDataToSend.append('categoria_id', categoriaId);",
    reemplazo: 'const categoriaId = idDeCategoria(categorias, mueble.categoria);'
  },
  {
    nombre: 'el alquiler se manda sin mirar precio_alquiler_dia',
    archivo: 'src/pages/admin/modales/EditarMuebleModal.jsx',
    buscar: "formDataToSend.append('precio_alquiler', mueble.precio_alquiler ?? mueble.precio_alquiler_dia ?? '');",
    reemplazo: "formDataToSend.append('precio_alquiler', mueble.precio_alquiler ?? '');"
  },
  {
    nombre: 'un precio 0 se manda como 0 (en vez de vacío)',
    archivo: 'src/pages/admin/modales/EditarMuebleModal.jsx',
    buscar: "formDataToSend.append('precio_venta', mueble.precio_venta || '');",
    reemplazo: "formDataToSend.append('precio_venta', mueble.precio_venta ?? '');"
  },
  {
    nombre: 'no se mandan las fotos actuales',
    archivo: 'src/pages/admin/modales/EditarMuebleModal.jsx',
    buscar: "    formDataToSend.append('imagenes_existentes', JSON.stringify(mueble.imagenes || []));\n",
    reemplazo: ''
  },
  {
    nombre: 'no se mandan las fotos nuevas',
    archivo: 'src/pages/admin/modales/EditarMuebleModal.jsx',
    buscar: "      for (const file of archivosNuevos) {\n        formDataToSend.append('imagenes', file);\n      }",
    reemplazo: ''
  },
  {
    nombre: 'quitar una foto quita siempre la primera',
    archivo: 'src/pages/admin/modales/EditarMuebleModal.jsx',
    buscar: 'const updatedImgs = mueble.imagenes.filter((_, i) => i !== idx);',
    reemplazo: 'const updatedImgs = mueble.imagenes.filter((_, i) => i !== 0);'
  },
  {
    nombre: 'al guardar bien, el modal no se cierra',
    archivo: 'src/pages/admin/modales/EditarMuebleModal.jsx',
    buscar: '      onCerrar();\n      setArchivosNuevos([]);',
    reemplazo: '      setArchivosNuevos([]);'
  },
  {
    nombre: 'al guardar bien, no se recargan los muebles',
    archivo: 'src/pages/admin/modales/EditarMuebleModal.jsx',
    buscar: '      setArchivosNuevos([]);\n      onGuardado();',
    reemplazo: '      setArchivosNuevos([]);'
  },
  {
    nombre: 'si falla, el modal se cierra',
    archivo: 'src/pages/admin/modales/EditarMuebleModal.jsx',
    buscar: "showToast('Error al actualizar el producto', 'error');",
    reemplazo: "showToast('Error al actualizar el producto', 'error'); onCerrar();"
  },
  {
    nombre: '"Guardar Cambios" del mueble no se desactiva mientras guarda',
    archivo: 'src/pages/admin/modales/EditarMuebleModal.jsx',
    buscar: "<button type=\"submit\" className=\"admin-btn\" disabled={status.includes('Actualizando')}>",
    reemplazo: '<button type="submit" className="admin-btn" disabled={false}>'
  },
  {
    nombre: '"Cerrar" del modal de mueble no cierra',
    archivo: 'src/pages/admin/modales/EditarMuebleModal.jsx',
    buscar: 'onClick={onCerrar} aria-label="Cerrar"',
    reemplazo: 'onClick={() => {}} aria-label="Cerrar"'
  },
  {
    nombre: 'la categoría puede elegirse a sí misma como general',
    archivo: 'src/pages/admin/modales/EditarCategoriaModal.jsx',
    buscar: 'generales(categorias).filter(c => c.id !== categoria.id)',
    reemplazo: 'generales(categorias)'
  },
  {
    nombre: 'no se manda la categoría general al editar',
    archivo: 'src/pages/admin/modales/EditarCategoriaModal.jsx',
    buscar: "formDataToSend.append('categoria_padre_id', categoria.categoria_padre_id || '');",
    reemplazo: ''
  },
  {
    nombre: 'sin imagen nueva no se manda imagen_url',
    archivo: 'src/pages/admin/modales/EditarCategoriaModal.jsx',
    buscar: "formDataToSend.append('imagen_url', categoria.imagen_url || '');",
    reemplazo: ''
  },
  {
    nombre: 'la imagen nueva de la categoría no se manda',
    archivo: 'src/pages/admin/modales/EditarCategoriaModal.jsx',
    buscar: "formDataToSend.append('imagen', archivoNuevo);",
    reemplazo: ''
  },
  {
    nombre: 'quitar la imagen de la categoría no la quita',
    archivo: 'src/pages/admin/modales/EditarCategoriaModal.jsx',
    buscar: "setCategoria({ ...categoria, imagen_url: '' });",
    reemplazo: ''
  },
  {
    nombre: 'al guardar bien la categoría, no se recargan las categorías',
    archivo: 'src/pages/admin/modales/EditarCategoriaModal.jsx',
    buscar: '      setArchivoNuevo(null);\n      onGuardado();',
    reemplazo: '      setArchivoNuevo(null);'
  },
  {
    nombre: 'al guardar bien la categoría, el modal no se cierra',
    archivo: 'src/pages/admin/modales/EditarCategoriaModal.jsx',
    buscar: '      onCerrar();\n      setArchivoNuevo(null);',
    reemplazo: '      setArchivoNuevo(null);'
  }
];
