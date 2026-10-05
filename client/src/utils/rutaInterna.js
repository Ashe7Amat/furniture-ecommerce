// H45: a dónde volver después de iniciar sesión. La ruta la pone ProtectedRoute en el `state` de la
// navegación (nunca en la URL: un parámetro ?volver=... sería la redirección abierta de H44). Aun así
// se valida, porque el `state` también se puede manipular: solo vale una ruta de esta misma web. Si no,
// la portada.
export const rutaInterna = (ruta) => {
  if (typeof ruta !== 'string') return '/';
  // "/cuenta" sí; "https://...", "cuenta", "//otra.web" (sin protocolo) y "/\otra.web" no. Tampoco
  // espacios ni caracteres de control: el navegador quita los tabuladores y saltos de línea de una URL,
  // así que "/\t/otra.web" acabaría siendo "//otra.web". Lo que queda (una sola barra al principio,
  // sin barras invertidas) es siempre una ruta de esta misma web.
  const valida =
    ruta.startsWith('/') && !ruta.startsWith('//') && !ruta.includes('\\') && !/[\s\p{Cc}]/u.test(ruta);
  return valida ? ruta : '/';
};
