// Datos y utilidades del reproductor de música de fondo (components/MusicaDeFondo.jsx).

// Emisoras: los flujos públicos de las radios temáticas de FIP (Radio France). Son en directo, así
// que no hay duración ni barra de progreso. Si se añade una de otro dominio, hay que abrirlo también
// en media-src de la CSP (client/vercel.json); lo comprueba cspVercel.test.js.
const fip = (id) => `https://icecast.radiofrance.fr/${id}-midfi.mp3?id=radiofrance`;

export const EMISORAS = [
  { nombre: 'FIP Pop', descripcion: 'Pop francés e internacional', url: fip('fippop') },
  { nombre: 'FIP Sacré français', descripcion: 'Canción francesa', url: fip('fipsacrefrancais') },
  { nombre: 'FIP Groove', descripcion: 'Soul, funk y groove', url: fip('fipgroove') },
  { nombre: 'FIP Jazz', descripcion: 'Jazz', url: fip('fipjazz') },
  { nombre: 'FIP', descripcion: 'La mezcla ecléctica de FIP', url: fip('fip') },
];

export const VOLUMEN = 0.35;

// Solo en ordenador: en el móvil no hay música (decisión de Ashe, 12 oct 2026). Se mira cómo se
// maneja el aparato (ratón que puede pasar por encima), no el ancho, para que estrechar la ventana
// del ordenador no corte la radio.
export const CONSULTA_ESCRITORIO = '(hover: hover) and (pointer: fine)';
