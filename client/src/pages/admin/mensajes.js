// Ayudantes de la pestaña "Mensajes" (pestanas/MensajesTab.jsx).

// Corta un texto largo para la tabla (y junta sus espacios y saltos de línea); el texto entero sale
// al pasar el ratón y en el modal del mensaje.
export const recortar = (texto, maximo) => {
  const limpio = String(texto ?? '').replace(/\s+/g, ' ').trim();
  return limpio.length > maximo ? `${limpio.slice(0, maximo - 1).trimEnd()}…` : limpio;
};

// Fecha y hora cortas, en hora de Madrid (la del negocio).
export const fechaMensaje = (iso) =>
  new Date(iso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Madrid' });
