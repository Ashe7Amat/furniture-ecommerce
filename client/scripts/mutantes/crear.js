// Mutantes de la pestaña "Añadir Mueble" (ver scripts/mutantes-panel.js).
export const TEST = 'src/pages/Admin.crear.test.jsx';

export const MUTANTES = [
  {
    nombre: 'no manda categoria_id',
    buscar: "if (categoriaId !== undefined) formDataToSend.append('categoria_id', categoriaId);",
    reemplazo: ''
  },
  {
    nombre: 'manda precio_venta aunque esté vacío',
    buscar: "if (formData.precio_venta) formDataToSend.append('precio_venta', formData.precio_venta);",
    reemplazo: "formDataToSend.append('precio_venta', formData.precio_venta);"
  },
  {
    nombre: 'no manda precio_alquiler',
    buscar: "if (formData.precio_alquiler) formDataToSend.append('precio_alquiler', formData.precio_alquiler);",
    reemplazo: ''
  },
  {
    nombre: 'solo manda la primera foto',
    buscar: "    for (const file of files) {\n      formDataToSend.append('imagenes', file);\n    }",
    reemplazo: "    formDataToSend.append('imagenes', files[0]);"
  },
  {
    nombre: 'no lleva al inventario tras crear',
    buscar: "      cargarMuebles();\n      setVistaActiva('inventario');",
    reemplazo: '      cargarMuebles();'
  },
  {
    nombre: 'no recarga los muebles tras crear',
    buscar: "      cargarMuebles();\n      setVistaActiva('inventario');",
    reemplazo: "      setVistaActiva('inventario');"
  },
  {
    nombre: 'caso C: al vaciar el formulario vuelve a preseleccionar categoría',
    buscar: "setFormData({ nombre: '', categoria: '', descripcion: ''",
    reemplazo: "setFormData({ nombre: '', categoria: categorias.find(c => c.categoria_padre_id)?.nombre || '', descripcion: ''"
  },
  {
    nombre: 'caso A: preselecciona la última específica',
    buscar: 'categoria: especificas[0].nombre',
    reemplazo: 'categoria: especificas[especificas.length - 1].nombre'
  },
  {
    nombre: 'caso A: preselecciona la primera del desplegable, no la primera de la API',
    buscar: 'const especificas = data.filter(c => c.categoria_padre_id);',
    reemplazo: 'const especificas = data.filter(c => !c.categoria_padre_id).flatMap(g => data.filter(e => e.categoria_padre_id === g.id));'
  },
  {
    nombre: 'si falla, no enseña el mensaje de error',
    buscar: "setStatus('Error al guardar en base de datos.');",
    reemplazo: "setStatus('');"
  },
  {
    nombre: 'si falla, vacía el formulario',
    buscar: "      setStatus('Error al guardar en base de datos.');",
    reemplazo: "      setStatus('Error al guardar en base de datos.');\n      setFormData({ nombre: '', categoria: '', descripcion: '', precio_venta: '', precio_alquiler: '', estado: 'disponible' });"
  },
  {
    nombre: 'el botón no se desactiva mientras guarda',
    buscar: "disabled={status.includes('Subiendo') || status.includes('Guardando')}",
    reemplazo: "disabled={status.includes('Subiendo')}"
  },
  {
    nombre: 'las fotos dejan de ser obligatorias',
    buscar: 'onChange={handleFileChange} required />',
    reemplazo: 'onChange={handleFileChange} />'
  },
  {
    nombre: 'otro texto en el aviso de éxito',
    buscar: "showToast('Producto añadido con éxito al catálogo', 'success');",
    reemplazo: "showToast('Producto añadido', 'success');"
  },
  {
    nombre: 'el estado por defecto pasa a "vendido"',
    buscar: "    precio_alquiler: '',\n    estado: 'disponible'\n  });",
    reemplazo: "    precio_alquiler: '',\n    estado: 'vendido'\n  });"
  },
  {
    nombre: 'caso B: pisa la categoría que ya había elegido el usuario',
    buscar: 'if (especificas.length > 0 && !formData.categoria) {',
    reemplazo: 'if (especificas.length > 0) {',
    sobreviveAqui: 'el caso B cruza dos pestañas y lo cubre Admin.navegacion.test.jsx'
  }
];
