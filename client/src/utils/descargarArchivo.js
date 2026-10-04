// Hace que el navegador descargue un Blob con el nombre dado (p. ej. el CSV del catálogo). El
// enlace temporal no llega a verse; la URL se libera justo después del clic.
export const descargarArchivo = (blob, nombreArchivo) => {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
};
