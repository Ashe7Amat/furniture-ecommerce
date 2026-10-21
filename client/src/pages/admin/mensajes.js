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

// Las referencias de pieza (NAV-SIL-001) que trae un mensaje, sin repetir y en el orden en que salen.
// El botón «Preguntar por esta pieza» de la web las escribe así: «(ref. NAV-SIL-001)». La tabla
// mensajes_contacto no tiene asunto, así que solo se mira el texto del mensaje.
const REFERENCIA = /NAV-[A-Z]{3}-\d{3}/g;

export const referenciasEn = (texto) => [...new Set(String(texto).match(REFERENCIA) ?? [])];

// Cada referencia del mensaje con su pieza del inventario, o `mueble: null` si ya no está.
export const piezasDelMensaje = (mensaje, muebles) =>
  referenciasEn(mensaje?.mensaje).map((referencia) => ({
    referencia,
    mueble: muebles.find((m) => m.referencia === referencia) ?? null
  }));

// El texto de la insignia de estado de una pieza (los colores son los de .status-pill).
const ESTADOS = { disponible: 'Disponible', vendido: 'Vendido', alquilado: 'Alquilado' };
// Sin estado cuenta como disponible, igual que en el inventario.
export const textoEstado = (estado) => ESTADOS[estado || 'disponible'] ?? estado;
