// client/src/utils/useDialogoModal.js
// H55: el comportamiento de teclado de un diálogo modal (como ya hacía la cesta, A5), para AuthModal y CheckoutModal.
//  - Al abrir, el foco entra en el diálogo: en su primer elemento enfocable (o en el propio diálogo si no hay).
//  - Mientras está abierto, Tab y Mayús+Tab dan la vuelta dentro del diálogo (el foco no se escapa a la página).
//  - Escape lo cierra.
//  - Al cerrar, el foco vuelve al elemento que tenía antes de abrirse (normalmente el botón que lo abrió).
//
// Las teclas se escuchan en `document` en fase de CAPTURA, antes que nadie: los dos modales se abren encima de la
// cesta, que también se cierra con Escape (escucha en `document`, en burbuja). Al parar aquí la propagación, un
// Escape cierra solo el modal y deja la cesta abierta debajo. Capturar en `document` también cubre el caso de que
// el foco se haya salido del diálogo (p. ej., un botón con el foco que pasa a desactivado): Tab lo devuelve dentro.
import { useEffect, useRef } from 'react';

export const SELECTOR_ENFOCABLES = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ');

export const enfocables = (contenedor) => (contenedor ? [...contenedor.querySelectorAll(SELECTOR_ENFOCABLES)] : []);

const useDialogoModal = (abierto, refDialogo, alCerrar) => {
  // Siempre la última versión de alCerrar, sin volver a montar el efecto (y sin mover el foco) en cada render.
  const alCerrarRef = useRef(alCerrar);
  alCerrarRef.current = alCerrar;

  useEffect(() => {
    if (!abierto) return undefined;
    const dialogo = refDialogo.current;
    const focoAnterior = document.activeElement;
    (enfocables(dialogo)[0] || dialogo)?.focus();

    const alPulsarTecla = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        alCerrarRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogo) return;
      const lista = enfocables(dialogo);
      if (lista.length === 0) {
        event.preventDefault();
        dialogo.focus();
        return;
      }
      const primero = lista[0];
      const ultimo = lista[lista.length - 1];
      const actual = document.activeElement;
      const dentro = dialogo.contains(actual);
      if (event.shiftKey && (!dentro || actual === primero || actual === dialogo)) {
        event.preventDefault();
        ultimo.focus();
      } else if (!event.shiftKey && (!dentro || actual === ultimo)) {
        event.preventDefault();
        primero.focus();
      }
    };

    document.addEventListener('keydown', alPulsarTecla, true);
    return () => {
      document.removeEventListener('keydown', alPulsarTecla, true);
      if (focoAnterior instanceof HTMLElement && document.contains(focoAnterior)) focoAnterior.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);
};

export default useDialogoModal;
