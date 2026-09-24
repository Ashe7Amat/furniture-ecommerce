// Mutantes de la pestaña "Gestionar Categorías" (ver scripts/mutantes-panel.js).
export const TEST = 'src/pages/Admin.categorias.test.jsx';

export const MUTANTES = [
  {
    nombre: 'la categoría general sale al final de su grupo',
    buscar: '{[general, ...categorias.filter(esp => esp.categoria_padre_id === general.id)].map(cat => (',
    reemplazo: '{[...categorias.filter(esp => esp.categoria_padre_id === general.id), general].map(cat => ('
  },
  {
    nombre: 'la tarjeta de la general no lleva "(general)"',
    buscar: "{cat.nombre}{cat.id === general.id && ' (general)'}",
    reemplazo: '{cat.nombre}'
  },
  {
    nombre: 'sin estadísticas se rompe en vez de "Cargando analíticas..."',
    buscar: '{cat.stats ? (',
    reemplazo: '{true ? ('
  },
  {
    nombre: 'el selector de categoría general ofrece también las específicas',
    buscar: '<option value="">— Es una categoría general —</option>\n                    {categorias.filter(c => !c.categoria_padre_id).map(general => (',
    reemplazo: '<option value="">— Es una categoría general —</option>\n                    {categorias.map(general => ('
  },
  {
    nombre: 'el selector de categoría general guarda el nombre en vez del id',
    buscar: '<option key={general.id} value={general.id}>Dentro de: {general.nombre}</option>',
    reemplazo: '<option key={general.id} value={general.nombre}>Dentro de: {general.nombre}</option>'
  },
  {
    nombre: 'sin nombre también llama a la API',
    buscar: '    if (!nuevaCat) return;\n',
    reemplazo: ''
  },
  {
    nombre: 'una general se manda con categoria_padre_id "null" en vez de vacío',
    buscar: "formDataToSend.append('categoria_padre_id', nuevaCatPadre);",
    reemplazo: "formDataToSend.append('categoria_padre_id', nuevaCatPadre || 'null');"
  },
  {
    nombre: 'la imagen se manda aunque no se haya elegido',
    buscar: "    if (categoriaFile) {\n      formDataToSend.append('imagen', categoriaFile);\n    }",
    reemplazo: "    formDataToSend.append('imagen', categoriaFile);"
  },
  {
    nombre: 'al crear no se vacía el nombre',
    buscar: "      setNuevaCat('');\n      setNuevaCatPadre('');",
    reemplazo: "      setNuevaCatPadre('');"
  },
  {
    nombre: 'al crear no se recargan las categorías',
    buscar: "      cargarCategorias();\n    } else {\n      showToast('Error al crear la categoría', 'error');",
    reemplazo: "    } else {\n      showToast('Error al crear la categoría', 'error');"
  },
  {
    nombre: 'si falla al crear, se vacía el formulario',
    buscar: "showToast('Error al crear la categoría', 'error');",
    reemplazo: "showToast('Error al crear la categoría', 'error'); setNuevaCat('');"
  },
  {
    nombre: '"Crear Categoría" se desactiva mientras crea (arreglo de H14 colado en el refactor)',
    buscar: '<button type="submit" className="admin-btn">Crear Categoría</button>',
    reemplazo: '<button type="submit" className="admin-btn" disabled={status.includes(\'Creando\')}>Crear Categoría</button>'
  },
  {
    nombre: 'borrar manda el id de la general del grupo',
    buscar: 'onClick={() => handleDeleteCategoria(cat.id)}',
    reemplazo: 'onClick={() => handleDeleteCategoria(general.id)}'
  },
  {
    nombre: 'tras borrar no se recargan las categorías',
    buscar: "        showToast('Categoría eliminada', 'success');\n        cargarCategorias();",
    reemplazo: "        showToast('Categoría eliminada', 'success');"
  },
  {
    nombre: 'otro texto en el aviso de borrado',
    buscar: "showToast('Categoría eliminada', 'success');",
    reemplazo: "showToast('Categoría borrada', 'success');"
  },
  {
    nombre: 'el lápiz no abre el modal de edición',
    buscar: 'onClick={() => setCategoriaAEditar(cat)}',
    reemplazo: 'onClick={() => {}}'
  }
];
