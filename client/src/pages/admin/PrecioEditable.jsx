import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { formatoPrecio, leerPrecio, precioDe } from './precios';

// Celda de precio del inventario que se edita en el sitio: doble clic en el precio o el lápiz lo
// convierten en un campo; Intro o salir del campo lo guardan, y Escape lo deja como estaba.
// `onGuardar(valor)` hace la petición (y avisa) y devuelve true si se guardó. Mientras llega la
// recarga del inventario, la celda ya enseña el precio nuevo.
const PrecioEditable = ({ valor, sufijo = '', etiqueta, onGuardar, onInvalido }) => {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(undefined);
  // Ya se ha decidido qué hacer con lo escrito (Escape, o Intro seguido del blur del campo que
  // desaparece): así no se guarda dos veces, ni se guarda lo que Escape ha cancelado.
  const resuelto = useRef(false);

  useEffect(() => setGuardado(undefined), [valor]);
  const actual = precioDe(guardado !== undefined ? guardado : valor);

  const empezar = () => {
    resuelto.current = false;
    setTexto(actual === null ? '' : String(actual));
    setEditando(true);
  };

  const cancelar = () => {
    resuelto.current = true;
    setEditando(false);
  };

  const terminar = async () => {
    if (resuelto.current) return;
    resuelto.current = true;
    const leido = leerPrecio(texto);
    if (leido.error) {
      onInvalido(leido.error);
      setEditando(false);
      return;
    }
    if (leido.valor === actual) {
      setEditando(false);
      return;
    }
    setGuardando(true);
    const ok = await onGuardar(leido.valor);
    setGuardando(false);
    setEditando(false);
    if (ok) setGuardado(leido.valor);
  };

  if (editando) {
    return (
      <input
        type="number"
        min="0"
        step="0.01"
        className="inv-precio-input"
        aria-label={etiqueta}
        value={texto}
        disabled={guardando}
        autoFocus
        onFocus={(e) => e.target.select()}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={terminar}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            terminar();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelar();
          }
        }}
      />
    );
  }

  return (
    <span className="inv-precio">
      <span className="inv-precio-valor" onDoubleClick={empezar} title={`${etiqueta}: doble clic para editar`}>
        {actual === null ? '—' : `${formatoPrecio(actual)}€${sufijo}`}
      </span>
      <button type="button" className="inv-precio-lapiz" onClick={empezar} aria-label={`Editar ${etiqueta.charAt(0).toLowerCase()}${etiqueta.slice(1)}`}>
        <Icon name="pencil" />
      </button>
    </span>
  );
};

export default PrecioEditable;
