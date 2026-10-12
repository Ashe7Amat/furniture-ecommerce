// Datos y utilidades del reproductor de música de fondo (components/MusicaDeFondo.jsx).

// Lista de canciones. Todas son instrumentales originales compuestos por código
// (client/scripts/musica/*.py), así que no hay derechos de terceros. Para añadir o quitar una,
// deja el archivo en public/audio/ y toca esta lista.
export const PISTAS = [
  { titulo: 'Après-midi à Nave 5', artista: 'Nave 5 Sessions', src: '/audio/nave5-chill.mp3' },
  { titulo: 'Soleil de Poblenou', artista: 'Nave 5 Sessions', src: '/audio/soleil-poblenou.mp3' },
  { titulo: 'Café Gràcia', artista: 'Nave 5 Sessions', src: '/audio/cafe-gracia.mp3' },
  { titulo: 'Rue des Antiquaires', artista: 'Nave 5 Sessions', src: '/audio/rue-des-antiquaires.mp3' },
];

export const VOLUMEN = 0.35;
// Si la canción ya lleva más de esto, "anterior" vuelve a su principio (como en cualquier reproductor).
export const UMBRAL_REINICIO = 3;

export const formatearTiempo = (segundos) => {
  const s = Number.isFinite(segundos) && segundos > 0 ? Math.floor(segundos) : 0;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
