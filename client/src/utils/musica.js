// Datos y utilidades del reproductor de música de fondo (components/MusicaDeFondo.jsx).

// Canciones libres de derechos de Pixabay (su licencia permite el uso comercial sin atribución; no
// deja vender ni repartir el archivo suelto), elegidas por Ashe el 13 oct 2026. Los mp3 viven en
// client/public/audio/, así que se sirven desde la propia web y la CSP no necesita abrir ningún
// origen. Están recomprimidos a 128 kbps y con el mismo volumen (-17 LUFS) para que ninguna suene
// más fuerte que otra. `pixabay` es el número de la canción en Pixabay (el que venía al final del
// nombre del archivo descargado), para poder demostrar la licencia. Si la lista se vacía, el
// reproductor no aparece. Lo comprueba utils/musica.test.js.
export const CANCIONES = [
  { titulo: 'Glass of Wine', artista: 'Monument Music', url: '/audio/glass-of-wine.mp3', pixabay: 143532 },
  { titulo: 'Cocktail Music', artista: 'FreeGroove', url: '/audio/cocktail-music.mp3', pixabay: 110969 },
  { titulo: 'Bossa in My Heart', artista: 'Serge Quadrado', url: '/audio/bossa-in-my-heart.mp3', pixabay: 13187 },
  { titulo: 'Jazz in a Gentle Coffee Shop', artista: 'Onion All Stars', url: '/audio/jazz-in-a-gentle-coffee-shop.mp3', pixabay: 137710 },
  { titulo: 'Midnight Owl', artista: 'Tatsuhiro Horii', url: '/audio/midnight-owl.mp3', pixabay: 128651 },
  { titulo: 'The Ghost of Shepard’s Pie', artista: 'Geoffrey Burch', url: '/audio/the-ghost-of-shepards-pie.mp3', pixabay: 112816 },
  { titulo: 'Round Midnight in NYC', artista: 'UsefulPix', url: '/audio/round-midnight-in-nyc.mp3', pixabay: 139545 },
  { titulo: 'The Hustle and Bustle', artista: 'UsefulPix', url: '/audio/the-hustle-and-bustle.mp3', pixabay: 139546 },
];

export const VOLUMEN = 0.35;

// Solo en ordenador: en el móvil no hay música (decisión de Ashe, 12 oct 2026). Se mira cómo se
// maneja el aparato (ratón que puede pasar por encima), no el ancho, para que estrechar la ventana
// del ordenador no corte la música.
export const CONSULTA_ESCRITORIO = '(hover: hover) and (pointer: fine)';
