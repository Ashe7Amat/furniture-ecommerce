// Fase C (C3): sin precios a la vista (el servidor los oculta con MOSTRAR_PRECIOS, o la pieza no
// tiene ninguno), el botón de la cesta se sustituye por "Preguntar por esta pieza", que lleva al
// formulario de contacto con la pieza ya escrita en el mensaje. Se pasa por la URL
// (/contacto?pieza=…&ref=…): sobrevive a recargar la página y no hace falta ninguna dependencia.
export const TEXTO_PREGUNTAR = 'Preguntar por esta pieza';

// Lo que se acepta de la URL: es texto que cualquiera puede escribir en un enlace, así que se recorta.
const MAX_NOMBRE = 200;
const MAX_REFERENCIA = 30;

export const rutaPreguntarPorPieza = (mueble) => {
  const params = new URLSearchParams({ pieza: mueble.nombre || '' });
  if (mueble.referencia) params.set('ref', mueble.referencia);
  return `/contacto?${params.toString()}`;
};

// El mensaje con el que empieza el formulario de contacto, o '' si la URL no trae ninguna pieza.
export const mensajeSobrePieza = (searchParams) => {
  const pieza = (searchParams.get('pieza') || '').trim().slice(0, MAX_NOMBRE);
  if (!pieza) return '';
  const ref = (searchParams.get('ref') || '').trim().slice(0, MAX_REFERENCIA);
  return `Hola, me interesa la pieza "${pieza}"${ref ? ` (ref. ${ref})` : ''}. ¿Me podéis dar más información?`;
};
