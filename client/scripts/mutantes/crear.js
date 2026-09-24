// Mutantes de la pestaña "Añadir Mueble" (ver scripts/mutantes-panel.js).
export const TEST = 'src/pages/Admin.crear.test.jsx';

export const MUTANTES = [
  {
    nombre: 'no manda categoria_id',
    archivo: 'src/pages/admin/pestanas/CrearMuebleTab.jsx',
    buscar: "if (categoriaId !== undefined) formDataToSend.append('categoria_id', categoriaId);",
    reemplazo: ''
  },
  {
    nombre: 'manda precio_venta aunque esté vacío',
    archivo: 'src/pages/admin/pestanas/CrearMuebleTab.jsx',
    buscar: "if (formData.precio_venta) formDataToSend.append('precio_venta', formData.precio_venta);",
    reemplazo: "formDataToSend.append('precio_venta', formData.precio_venta);"
  },
  {
    nombre: 'no manda precio_alquiler',
    archivo: 'src/pages/admin/pestanas/CrearMuebleTab.jsx',
    buscar: "if (formData.precio_alquiler) formDataToSend.append('precio_alquiler', formData.precio_alquiler);",
    reemplazo: ''
  },
  {
    nombre: 'solo manda la primera foto',
    archivo: 'src/pages/admin/pestanas/CrearMuebleTab.jsx',
    buscar: "    for (const file of files) {\n      formDataToSend.append('imagenes', file);\n    }",
    reemplazo: "    formDataToSend.append('imagenes', files[0]);"
  },
  {
    nombre: 'no lleva al inventario tras crear',
    archivo: 'src/pages/admin/pestanas/CrearMuebleTab.jsx',
    buscar: "      recargarMuebles();\n      irA('inventario');",
    reemplazo: '      recargarMuebles();'
  },
  {
    nombre: 'no recarga los muebles tras crear',
    archivo: 'src/pages/admin/pestanas/CrearMuebleTab.jsx',
    buscar: "      recargarMuebles();\n      irA('inventario');",
    reemplazo: "      irA('inventario');"
  },
  {
    nombre: 'caso C: al vaciar el formulario vuelve a preseleccionar categoría',
    archivo: 'src/pages/admin/pestanas/CrearMuebleTab.jsx',
    buscar: "setFormData({ nombre: '', categoria: '', descripcion: ''",
    reemplazo: "setFormData({ nombre: '', categoria: categorias.find(c => c.categoria_padre_id)?.nombre || '', descripcion: ''"
  },
  {
    nombre: 'caso A: preselecciona la última específica',
    archivo: 'src/pages/admin/categorias.js',
    buscar: 'export const primeraEspecifica = (categorias) => categorias.find(c => c.categoria_padre_id);',
    reemplazo: 'export const primeraEspecifica = (categorias) => [...categorias].reverse().find(c => c.categoria_padre_id);'
  },
  {
    nombre: 'caso A: preselecciona la primera del desplegable, no la primera de la API',
    archivo: 'src/pages/admin/categorias.js',
    buscar: 'export const primeraEspecifica = (categorias) => categorias.find(c => c.categoria_padre_id);',
    reemplazo: 'export const primeraEspecifica = (categorias) => generales(categorias).flatMap(g => especificasDe(categorias, g))[0];'
  },
  {
    nombre: 'si falla, no enseña el mensaje de error',
    archivo: 'src/pages/admin/pestanas/CrearMuebleTab.jsx',
    buscar: "setStatus('Error al guardar en base de datos.');",
    reemplazo: "setStatus('');"
  },
  {
    nombre: 'si falla, vacía el formulario',
    archivo: 'src/pages/admin/pestanas/CrearMuebleTab.jsx',
    buscar: "      setStatus('Error al guardar en base de datos.');",
    reemplazo: "      setStatus('Error al guardar en base de datos.');\n      setFormData({ nombre: '', categoria: '', descripcion: '', precio_venta: '', precio_alquiler: '', estado: 'disponible' });"
  },
  {
    nombre: 'el botón no se desactiva mientras guarda',
    archivo: 'src/pages/admin/pestanas/CrearMuebleTab.jsx',
    buscar: "disabled={status.includes('Subiendo') || status.includes('Guardando')}",
    reemplazo: "disabled={status.includes('Subiendo')}"
  },
  {
    nombre: 'las fotos dejan de ser obligatorias',
    archivo: 'src/pages/admin/pestanas/CrearMuebleTab.jsx',
    buscar: 'onChange={handleFileChange} required />',
    reemplazo: 'onChange={handleFileChange} />'
  },
  {
    nombre: 'otro texto en el aviso de éxito',
    archivo: 'src/pages/admin/pestanas/CrearMuebleTab.jsx',
    buscar: "showToast('Producto añadido con éxito al catálogo', 'success');",
    reemplazo: "showToast('Producto añadido', 'success');"
  },
  {
    nombre: 'el estado por defecto pasa a "vendido"',
    archivo: 'src/pages/Admin.jsx',
    buscar: "    precio_alquiler: '',\n    estado: 'disponible'\n  });",
    reemplazo: "    precio_alquiler: '',\n    estado: 'vendido'\n  });"
  },
  {
    nombre: 'caso B: pisa la categoría que ya había elegido el usuario',
    archivo: 'src/pages/Admin.jsx',
    buscar: 'if (especifica && !formData.categoria) {',
    reemplazo: 'if (especifica) {',
    sobreviveAqui: 'el caso B cruza dos pestañas y lo cubre Admin.navegacion.test.jsx'
  }
];
