// Datos y utilidades del reproductor de música de fondo (components/MusicaDeFondo.jsx).

// Canciones libres de derechos de Pixabay (su licencia permite el uso comercial sin atribución; no
// deja vender ni repartir el archivo suelto). Los mp3 viven en client/public/audio/, así que se
// sirven desde la propia web y la CSP no necesita abrir ningún origen. `fuente` es la página de
// Pixabay de cada una, para poder demostrar la licencia. Mientras la lista esté vacía, el
// reproductor no aparece. Lo comprueba utils/musica.test.js.
export const CANCIONES = [];

export const VOLUMEN = 0.35;

// Solo en ordenador: en el móvil no hay música (decisión de Ashe, 12 oct 2026). Se mira cómo se
// maneja el aparato (ratón que puede pasar por encima), no el ancho, para que estrechar la ventana
// del ordenador no corte la música.
export const CONSULTA_ESCRITORIO = '(hover: hover) and (pointer: fine)';
