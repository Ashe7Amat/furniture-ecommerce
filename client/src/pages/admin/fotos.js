// H57: el orden de las fotos de un mueble en el editor. La primera es la principal: la que sale en el catálogo
// y en la ficha. El servidor guarda la lista en el orden en que llega (imagenes_existentes) y añade las fotos
// nuevas al final.
import { arrayMove } from '@dnd-kit/sortable';

// Lleva la foto de la posición `desde` a la posición `hasta`, desplazando las demás. Lista nueva.
export const moverFoto = (fotos, desde, hasta) => arrayMove(fotos, desde, hasta);

// "Usar como principal": la foto pasa a la primera posición y las demás conservan su orden.
export const usarComoPrincipal = (fotos, indice) => moverFoto(fotos, indice, 0);

// Al soltar una foto arrastrada (ids de idsDeFotos): la lista con la foto en su sitio nuevo. Si se suelta fuera
// de la galería o en su mismo sitio, la misma lista, sin cambios.
export const fotosTrasSoltar = (fotos, ids, idArrastrada, idDestino) => {
  if (idDestino == null || idArrastrada === idDestino) return fotos;
  const desde = ids.indexOf(idArrastrada);
  const hasta = ids.indexOf(idDestino);
  if (desde < 0 || hasta < 0) return fotos;
  return moverFoto(fotos, desde, hasta);
};

// Un id estable y único por foto, para arrastrarlas: la URL. Si la misma URL sale repetida, la segunda es
// "url#2", la tercera "url#3"...
export const idsDeFotos = (fotos) => {
  const vistas = new Map();
  return fotos.map((url) => {
    const n = (vistas.get(url) || 0) + 1;
    vistas.set(url, n);
    return n === 1 ? url : `${url}#${n}`;
  });
};

// Textos para los lectores de pantalla mientras se arrastra (los de dnd-kit vienen en inglés).
const posicion = (ids, id) => ids.indexOf(id) + 1;
export const anuncios = (ids) => ({
  onDragStart: ({ active }) => `Has cogido la foto ${posicion(ids, active.id)}.`,
  onDragOver: ({ active, over }) =>
    over
      ? `La foto ${posicion(ids, active.id)} está sobre la posición ${posicion(ids, over.id)}.`
      : `La foto ${posicion(ids, active.id)} no está sobre ninguna posición.`,
  onDragEnd: ({ active, over }) =>
    over
      ? `La foto ${posicion(ids, active.id)} se ha soltado en la posición ${posicion(ids, over.id)}.`
      : `La foto ${posicion(ids, active.id)} se ha soltado.`,
  onDragCancel: ({ active }) => `Cancelado: la foto ${posicion(ids, active.id)} vuelve a su sitio.`
});
export const INSTRUCCIONES = {
  draggable:
    'Para mover la foto, pulsa espacio o Intro. Con las flechas la cambias de sitio; vuelve a pulsar espacio o Intro para soltarla, o Escape para cancelar.'
};
