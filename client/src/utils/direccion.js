// Dirección de la nave, para el enlace «Cómo llegar» (Contacto y pie de página).
// Es un enlace normal a Google Maps, no un mapa incrustado: así la web no carga nada de Google ni pone
// cookies de terceros, y no hace falta pedir consentimiento. Google solo entra si la persona pulsa el enlace.
export const DIRECCION_NAVE = 'Carrer del Plom, 32-34, 08038 Barcelona';

// URL universal de Google Maps: en el móvil abre la app de Mapas, en el ordenador la web.
export const URL_COMO_LLEGAR = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(DIRECCION_NAVE)}`;
