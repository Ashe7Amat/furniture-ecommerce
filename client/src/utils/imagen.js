// client/src/utils/imagen.js
//
// Reduce las fotos en el navegador antes de subirlas desde el panel (H24). Vercel rechaza cualquier
// petición de más de 4,5 MB con un 413 que no es JSON, y el panel manda todas las fotos de un mueble
// en una sola petición: dos o tres fotos de móvil (2-4 MB cada una) ya pasaban del límite, y el
// administrador solo veía "no se pudo guardar". Una foto de 1920 px con calidad 0,85 pesa unos
// cientos de KB. El servidor la sigue pasando por sharp (WebP a 1600 px de ancho), así que la calidad
// final no cambia.
//
// Nunca impide subir una foto: si el navegador no la sabe leer (p. ej. HEIC en Chrome), si no tiene
// las APIs necesarias o si reducirla no la hace más ligera, se devuelve el archivo original, que es
// lo que se subía antes. Redibujarla en un canvas quita de paso los metadatos EXIF, incluida la
// ubicación GPS que guardan los móviles (sharp ya la quitaba en el servidor).

export const MAX_LADO = 1920;
export const CALIDAD = 0.85;
// Por debajo de este peso y de MAX_LADO, la foto se sube tal cual: recomprimirla no ganaría nada.
export const PESO_PEQUENO = 500 * 1024;

// Formatos que pueden tener transparencia. En JPEG no la hay (el fondo transparente saldría negro),
// así que se pasan a WebP, que sí la conserva. Si el navegador no sabe codificar WebP, toBlob
// devuelve un PNG, y entonces decide la comparación de pesos del final.
const PUEDEN_TENER_TRANSPARENCIA = ['image/png', 'image/webp', 'image/gif'];

const EXTENSION = { 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/png': 'png' };

const puedeConImg = () =>
  typeof Image === 'function' &&
  typeof HTMLImageElement.prototype.decode === 'function' &&
  typeof URL.createObjectURL === 'function';

// Decodifica la foto. Devuelve la fuente que acepta drawImage, sus medidas y cómo liberarla, o null
// si este navegador no tiene cómo hacerlo. Lanza si el archivo no se puede leer como imagen.
//   - createImageBitmap, con `imageOrientation: 'from-image'`, que aplica la rotación del EXIF para
//     que una foto hecha en vertical no salga tumbada. Ese valor solo existe desde Chrome 112,
//     Firefox 111 y Safari 16: los anteriores (por ejemplo, un iPhone que se ha quedado en iOS 15)
//     tienen createImageBitmap pero rechazan la llamada. Entonces se prueba con <img>.
//   - <img> con decode(), que devuelve una promesa y falla si la imagen no se puede leer. También
//     aplica la rotación del EXIF. No se usa onload: en un entorno que no carga imágenes nunca
//     llegaría, y el guardado se quedaría colgado esperando.
const decodificar = async (archivo) => {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
      return {
        fuente: bitmap,
        ancho: bitmap.width,
        alto: bitmap.height,
        liberar: () => bitmap.close?.(),
      };
    } catch (error) {
      if (!puedeConImg()) throw error;
      // Se sigue con <img>: si la foto de verdad no se puede leer (un HEIC en Chrome), decode()
      // también fallará, y se subirá la original.
    }
  }
  if (!puedeConImg()) return null;

  const url = URL.createObjectURL(archivo);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
  return {
    fuente: img,
    ancho: img.naturalWidth,
    alto: img.naturalHeight,
    liberar: () => URL.revokeObjectURL(url),
  };
};

const aBlob = (canvas, tipo, calidad) => new Promise((resolve) => canvas.toBlob(resolve, tipo, calidad));

const renombrar = (nombre, tipo) => {
  const extension = EXTENSION[tipo];
  if (!extension) return nombre;
  const base = nombre.includes('.') ? nombre.slice(0, nombre.lastIndexOf('.')) : nombre;
  return `${base}.${extension}`;
};

// Reduce UNA foto a `maxLado` píxeles en su lado mayor y la recomprime. Devuelve un File (que es un
// Blob, así que va tal cual en un FormData) con el mismo nombre y la extensión del tipo nuevo, o el
// archivo original si no hay nada que ganar o no se puede (ver arriba).
// `tipo`: el formato de salida. Por defecto, JPEG, o WebP si la foto puede tener transparencia.
export const redimensionarImagen = async (archivo, { maxLado = MAX_LADO, calidad = CALIDAD, tipo } = {}) => {
  if (!archivo || typeof archivo.type !== 'string' || !archivo.type.startsWith('image/')) return archivo;

  let imagen;
  try {
    imagen = await decodificar(archivo);
  } catch {
    return archivo; // formato que este navegador no sabe leer: se sube tal cual
  }
  if (!imagen) return archivo;

  try {
    const ladoMayor = Math.max(imagen.ancho, imagen.alto);
    if (archivo.size < PESO_PEQUENO && ladoMayor <= maxLado) return archivo;

    const escala = Math.min(1, maxLado / ladoMayor);
    const ancho = Math.max(1, Math.round(imagen.ancho * escala));
    const alto = Math.max(1, Math.round(imagen.alto * escala));
    const canvas = document.createElement('canvas');
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext('2d');
    if (!ctx) return archivo;

    const tipoSalida = tipo || (PUEDEN_TENER_TRANSPARENCIA.includes(archivo.type) ? 'image/webp' : 'image/jpeg');
    if (tipoSalida === 'image/jpeg') {
      // JPEG no tiene transparencia: lo transparente sale blanco, no negro.
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, ancho, alto);
    }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(imagen.fuente, 0, 0, ancho, alto);

    const blob = await aBlob(canvas, tipoSalida, calidad);
    if (!blob || blob.size >= archivo.size) return archivo; // no ha salido más ligera: la original
    return new File([blob], renombrar(archivo.name, blob.type), {
      type: blob.type,
      lastModified: archivo.lastModified,
    });
  } catch {
    return archivo;
  } finally {
    imagen.liberar();
  }
};

// Reduce varias fotos, de una en una: tener varias decodificadas a la vez puede agotar la memoria de
// un móvil. Antes de cada una llama a `alProgreso(numero, total)`, para enseñar por cuál va.
export const redimensionarImagenes = async (archivos, { alProgreso, ...opciones } = {}) => {
  const lista = Array.from(archivos || []);
  const resultado = [];
  for (let i = 0; i < lista.length; i++) {
    alProgreso?.(i + 1, lista.length);
    resultado.push(await redimensionarImagen(lista[i], opciones));
  }
  return resultado;
};

// Texto de progreso para el panel: "Optimizando imagen..." con una sola foto, y
// "Optimizando imágenes... 2/3" con varias.
export const textoOptimizando = (numero, total) =>
  total > 1 ? `Optimizando imágenes... ${numero}/${total}` : 'Optimizando imagen...';

// Tope para el total de fotos de una petición: los 4,5 MB de Vercel menos un margen para el resto
// del formulario.
export const TOPE_SUBIDA = 4 * 1024 * 1024;
// Segundo intento si con los valores normales no caben: 1600 px (lo mismo que deja sharp en el
// servidor) y calidad 0,7.
const SEGUNDO_INTENTO = { maxLado: 1600, calidad: 0.7 };

const pesoDe = (archivos) => archivos.reduce((total, archivo) => total + (archivo?.size || 0), 0);

// Deja las fotos listas para subirlas juntas. Normalmente basta con reducirlas una vez: una foto de
// 1920 px pesa unos cientos de KB. Si aun así pasan del tope (varias fotos con mucho detalle, como
// una tela o la veta de la madera), se reducen otra vez desde los originales, más pequeñas. Devuelve
// las fotos, su peso total y si caben: si no caben, no hay que mandarlas, porque Vercel rechazaría
// la petición entera.
export const prepararFotos = async (archivos, { alProgreso } = {}) => {
  let fotos = await redimensionarImagenes(archivos, { alProgreso });
  if (pesoDe(fotos) > TOPE_SUBIDA) {
    fotos = await redimensionarImagenes(archivos, { alProgreso, ...SEGUNDO_INTENTO });
  }
  const peso = pesoDe(fotos);
  return { fotos, peso, caben: peso <= TOPE_SUBIDA };
};

const enMB = (bytes) => (bytes / (1024 * 1024)).toLocaleString('es-ES', { maximumFractionDigits: 1 });

// Aviso cuando ni reduciéndolas caben (por ejemplo, un navegador que no puede reducirlas).
export const textoDemasiadoPeso = (peso, numeroDeFotos) =>
  numeroDeFotos > 1
    ? `Las fotos pesan demasiado para subirlas juntas (${enMB(peso)} MB de un máximo de ${enMB(TOPE_SUBIDA)} MB). Sube menos a la vez: puedes añadir el resto después, editando el mueble.`
    : `La foto pesa demasiado (${enMB(peso)} MB de un máximo de ${enMB(TOPE_SUBIDA)} MB). Prueba con una más ligera.`;
