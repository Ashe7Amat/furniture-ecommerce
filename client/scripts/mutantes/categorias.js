// Mutantes de la pestaña "Gestionar Categorías" (ver scripts/mutantes-panel.js).
export const TEST = 'src/pages/Admin.categorias.test.jsx';

export const MUTANTES = [
  {
    nombre: 'la categoría general sale al final de su grupo',
    archivo: 'src/pages/admin/pestanas/CategoriasTab.jsx',
    buscar: '{[general, ...especificasDe(categorias, general)].map(cat => (',
    reemplazo: '{[...especificasDe(categorias, general), general].map(cat => ('
  },
  {
    nombre: 'la tarjeta de la general no lleva "(general)"',
    archivo: 'src/pages/admin/pestanas/CategoriasTab.jsx',
    buscar: "{cat.nombre}{cat.id === general.id && ' (general)'}",
    reemplazo: '{cat.nombre}'
  },
  {
    nombre: 'sin estadísticas se rompe en vez de "Cargando analíticas..."',
    archivo: 'src/pages/admin/pestanas/CategoriasTab.jsx',
    buscar: '{cat.stats ? (',
    reemplazo: '{true ? ('
  },
  {
    nombre: 'el selector de categoría general ofrece también las específicas',
    archivo: 'src/pages/admin/pestanas/CategoriasTab.jsx',
    buscar: '<option value="">— Es una categoría general —</option>\n              {generales(categorias).map(general => (',
    reemplazo: '<option value="">— Es una categoría general —</option>\n              {categorias.map(general => ('
  },
  {
    nombre: 'el selector de categoría general guarda el nombre en vez del id',
    archivo: 'src/pages/admin/pestanas/CategoriasTab.jsx',
    buscar: '<option key={general.id} value={general.id}>Dentro de: {general.nombre}</option>',
    reemplazo: '<option key={general.id} value={general.nombre}>Dentro de: {general.nombre}</option>'
  },
  {
    nombre: 'sin nombre también llama a la API',
    archivo: 'src/pages/admin/pestanas/CategoriasTab.jsx',
    buscar: '    if (!nuevaCat) return;\n',
    reemplazo: ''
  },
  {
    nombre: 'una general se manda con categoria_padre_id "null" en vez de vacío',
    archivo: 'src/pages/admin/pestanas/CategoriasTab.jsx',
    buscar: "formDataToSend.append('categoria_padre_id', nuevaCatPadre);",
    reemplazo: "formDataToSend.append('categoria_padre_id', nuevaCatPadre || 'null');"
  },
  {
    nombre: 'la imagen se manda aunque no se haya elegido',
    archivo: 'src/pages/admin/pestanas/CategoriasTab.jsx',
    buscar: "    if (categoriaFile) {\n      formDataToSend.append('imagen', categoriaFile);\n    }",
    reemplazo: "    formDataToSend.append('imagen', categoriaFile);"
  },
  {
    nombre: 'al crear no se vacía el nombre',
    archivo: 'src/pages/admin/pestanas/CategoriasTab.jsx',
    buscar: "      setNuevaCat('');\n      setNuevaCatPadre('');",
    reemplazo: "      setNuevaCatPadre('');"
  },
  {
    nombre: 'al crear no se recargan las categorías',
    archivo: 'src/pages/admin/pestanas/CategoriasTab.jsx',
    buscar: "      recargarCategorias();\n    } else {\n      showToast('Error al crear la categoría', 'error');",
    reemplazo: "    } else {\n      showToast('Error al crear la categoría', 'error');"
  },
  {
    nombre: 'si falla al crear, se vacía el formulario',
    archivo: 'src/pages/admin/pestanas/CategoriasTab.jsx',
    buscar: "showToast('Error al crear la categoría', 'error');",
    reemplazo: "showToast('Error al crear la categoría', 'error'); setNuevaCat('');"
  },
  {
    nombre: '"Crear Categoría" se desactiva mientras crea (arreglo de H14 colado en el refactor)',
    archivo: 'src/pages/admin/pestanas/CategoriasTab.jsx',
    // Tras el refactor, la pestaña no recibe `status`: el arreglo que se colaría es el que propone
    // H14, un estado de envío local. (Con la versión de una línea, `status.includes('Creando')`,
    // `status` sería `window.status` y el botón no se desactivaría: el mutante no cambiaba nada.)
    cambios: [
      { buscar: "import { useContext } from 'react';", reemplazo: "import { useContext, useState } from 'react';" },
      {
        buscar: '  const { showToast } = useContext(ToastContext);',
        reemplazo: '  const { showToast } = useContext(ToastContext);\n  const [creando, setCreando] = useState(false);'
      },
      { buscar: "    setStatus('Creando categoría...');", reemplazo: "    setStatus('Creando categoría...');\n    setCreando(true);" },
      { buscar: "    setStatus('');\n  };", reemplazo: "    setStatus('');\n    setCreando(false);\n  };" },
      {
        buscar: '<button type="submit" className="admin-btn">Crear Categoría</button>',
        reemplazo: '<button type="submit" className="admin-btn" disabled={creando}>Crear Categoría</button>'
      }
    ]
  },
  {
    nombre: 'borrar manda el id de la general del grupo',
    archivo: 'src/pages/admin/pestanas/CategoriasTab.jsx',
    buscar: 'onClick={() => handleDeleteCategoria(cat.id)}',
    reemplazo: 'onClick={() => handleDeleteCategoria(general.id)}'
  },
  {
    nombre: 'tras borrar no se recargan las categorías',
    archivo: 'src/pages/admin/pestanas/CategoriasTab.jsx',
    buscar: "        showToast('Categoría eliminada', 'success');\n        recargarCategorias();",
    reemplazo: "        showToast('Categoría eliminada', 'success');"
  },
  {
    nombre: 'otro texto en el aviso de borrado',
    archivo: 'src/pages/admin/pestanas/CategoriasTab.jsx',
    buscar: "showToast('Categoría eliminada', 'success');",
    reemplazo: "showToast('Categoría borrada', 'success');"
  },
  {
    nombre: 'el lápiz no abre el modal de edición',
    archivo: 'src/pages/admin/pestanas/CategoriasTab.jsx',
    buscar: 'onClick={() => abrirEditorCategoria(cat)}',
    reemplazo: 'onClick={() => {}}'
  }
];
