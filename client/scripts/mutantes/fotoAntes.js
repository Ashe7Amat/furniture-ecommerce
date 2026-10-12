// La foto de antes de restaurar en "Editar Producto" (el "antes y después" de la ficha). Sus tests van en
// un archivo propio, fuera de los congelados del panel.
const ARCHIVO = 'src/pages/admin/modales/EditarMuebleModal.jsx';
export const TEST = 'src/pages/admin/modales/EditarMuebleModal.antes.test.jsx';
export const MUTANTES = [
  {
    nombre: 'la foto de antes no se manda',
    archivo: ARCHIVO,
    buscar: "if (fotoAntesLista) formDataToSend.append('imagen_antes', fotoAntesLista);",
    reemplazo: 'if (false) formDataToSend.append(\'imagen_antes\', fotoAntesLista);'
  },
  {
    nombre: 'la foto de antes se manda con las fotos de la pieza',
    archivo: ARCHIVO,
    buscar: "if (fotoAntesLista) formDataToSend.append('imagen_antes', fotoAntesLista);",
    reemplazo: "if (fotoAntesLista) formDataToSend.append('imagenes', fotoAntesLista);"
  },
  {
    nombre: 'la foto de antes se queda también entre las fotos nuevas',
    archivo: ARCHIVO,
    buscar: 'fotosNuevas = fotoAntes ? preparadas.fotos.slice(0, -1) : preparadas.fotos;',
    reemplazo: 'fotosNuevas = preparadas.fotos;'
  },
  {
    nombre: '"Quitar foto de antes" no manda quitar_imagen_antes',
    archivo: ARCHIVO,
    buscar: "else if (quitarAntes) formDataToSend.append('quitar_imagen_antes', 'true');",
    reemplazo: ''
  },
  {
    nombre: 'quitar_imagen_antes se manda siempre',
    archivo: ARCHIVO,
    buscar: "else if (quitarAntes) formDataToSend.append('quitar_imagen_antes', 'true');",
    reemplazo: "else formDataToSend.append('quitar_imagen_antes', 'true');"
  },
  {
    nombre: 'la foto de antes que ya tiene no se enseña',
    archivo: ARCHIVO,
    buscar: '{mueble.imagen_antes && !quitarAntes && !fotoAntes && (',
    reemplazo: '{false && ('
  },
  {
    nombre: 'la foto de antes no se reduce con las demás',
    archivo: ARCHIVO,
    buscar: 'const aSubir = fotoAntes ? [...archivosNuevos, fotoAntes] : archivosNuevos;',
    reemplazo: 'const aSubir = archivosNuevos;'
  }
];
