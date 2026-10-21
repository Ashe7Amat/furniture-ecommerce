import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';

// El botón «⋮» de una fila del inventario y su menú (21 oct 2026): las acciones que no caben como
// botones en la fila. `acciones` es una lista de { texto, onElegir, peligro? } y `null` para una
// línea de separación.
// El menú se pinta en <body> con posición fija, junto al botón: dentro de la tabla (que se desplaza
// en horizontal) se cortaría. Si debajo del botón no cabe, se abre hacia arriba.
// Teclado, como un menú de la guía de ARIA: al abrir, el foco va a la primera opción; las flechas,
// Inicio y Fin se mueven entre opciones; Intro elige; Escape cierra y devuelve el foco al botón.
// Se cierra también al hacer clic fuera y con Tab. Al desplazar la página o la tabla, o al cambiar el
// tamaño de la ventana, se vuelve a colocar junto al botón; si el botón sale de la pantalla, se cierra
// (en el móvil, la tabla se desplaza sola al pulsar un botón medio tapado, y el menú no debe cerrarse).
const MARGEN = 4;

const MenuAcciones = ({ etiqueta, acciones }) => {
  const [abierto, setAbierto] = useState(false);
  const [posicion, setPosicion] = useState(null);
  const boton = useRef(null);
  const menu = useRef(null);
  const idMenu = useId();

  const opciones = () => [...menu.current.querySelectorAll('[role="menuitem"]')];
  const cerrar = (devolverFoco) => {
    setAbierto(false);
    setPosicion(null);
    if (devolverFoco) boton.current?.focus();
  };

  const colocar = () => {
    const caja = boton.current.getBoundingClientRect();
    const alto = menu.current.offsetHeight;
    const haciaArriba = caja.bottom + MARGEN + alto > window.innerHeight && caja.top - MARGEN - alto >= 0;
    setPosicion({
      haciaArriba,
      top: haciaArriba ? caja.top - MARGEN - alto : caja.bottom + MARGEN,
      right: window.innerWidth - caja.right
    });
  };

  // La posición se calcula con el menú ya pintado (para saber su alto) y antes de que se vea: un
  // efecto de diseño corre antes de que el navegador pinte.
  useLayoutEffect(() => {
    if (!abierto) return;
    colocar();
    opciones()[0]?.focus();
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => {
      if (!menu.current?.contains(e.target) && !boton.current?.contains(e.target)) cerrar(false);
    };
    const alMover = () => {
      const caja = boton.current.getBoundingClientRect();
      if (caja.bottom < 0 || caja.top > window.innerHeight) cerrar(false);
      else colocar();
    };
    document.addEventListener('mousedown', fuera);
    window.addEventListener('scroll', alMover, true);
    window.addEventListener('resize', alMover);
    return () => {
      document.removeEventListener('mousedown', fuera);
      window.removeEventListener('scroll', alMover, true);
      window.removeEventListener('resize', alMover);
    };
  }, [abierto]);

  const teclas = (e) => {
    const lista = opciones();
    const actual = lista.indexOf(document.activeElement);
    const ir = (i) => {
      e.preventDefault();
      lista[(i + lista.length) % lista.length].focus();
    };
    if (e.key === 'ArrowDown') ir(actual + 1);
    else if (e.key === 'ArrowUp') ir(actual - 1);
    else if (e.key === 'Home') ir(0);
    else if (e.key === 'End') ir(lista.length - 1);
    else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cerrar(true);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      cerrar(true);
    }
  };

  const elegir = (accion) => {
    cerrar(true);
    accion.onElegir();
  };

  return (
    <>
      <button
        ref={boton}
        type="button"
        className="inv-edit-btn inv-icon-btn inv-menu-btn"
        aria-label={etiqueta}
        title="Más acciones"
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls={abierto ? idMenu : undefined}
        onClick={() => (abierto ? cerrar(false) : setAbierto(true))}
      >
        <Icon name="more" />
      </button>
      {abierto && createPortal(
        <div
          ref={menu}
          id={idMenu}
          role="menu"
          aria-label={etiqueta}
          className={`menu-acciones ${posicion?.haciaArriba ? 'hacia-arriba' : ''}`}
          style={posicion ? { top: posicion.top, right: posicion.right } : undefined}
          onKeyDown={teclas}
        >
          {acciones.map((accion, i) =>
            accion === null ? (
              <div key={`separador-${i}`} role="separator" className="menu-acciones-separador" />
            ) : (
              <button
                key={accion.texto}
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={`menu-acciones-opcion ${accion.peligro ? 'peligro' : ''}`}
                onClick={() => elegir(accion)}
              >
                {accion.icono && <Icon name={accion.icono} />}
                {accion.texto}
              </button>
            )
          )}
        </div>,
        document.body
      )}
    </>
  );
};

export default MenuAcciones;
