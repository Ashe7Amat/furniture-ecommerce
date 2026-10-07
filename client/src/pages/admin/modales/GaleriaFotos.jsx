// H57: las fotos de un mueble en el editor, grandes y en orden. Cada una lleva su número, un asa para
// arrastrarla (con el ratón, el dedo o el teclado), "Usar como principal" y la ✕ para quitarla. La primera es
// la principal, la que sale en el catálogo.
//
// La miniatura conserva la estructura de antes (.image-thumb con la foto, alt "Mueble N", y un único botón, la ✕):
// los tests de caracterización del panel la buscan así. Los controles nuevos van alrededor.
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Icon from '../Icon';
import { idsDeFotos, fotosTrasSoltar, usarComoPrincipal, anuncios, INSTRUCCIONES } from '../fotos';

const FotoOrdenable = ({ id, url, indice, alUsarComoPrincipal, alPedirQuitar }) => {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const numero = indice + 1;
  return (
    <li
      ref={setNodeRef}
      className={`foto-galeria-item${isDragging ? ' arrastrando' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <div className="foto-galeria-barra">
        <span className="foto-galeria-orden">{indice === 0 ? `${numero} · Principal` : numero}</span>
        <button
          type="button"
          className="foto-galeria-asa"
          ref={setActivatorNodeRef}
          aria-label={`Mover la foto ${numero}`}
          {...attributes}
          {...listeners}
        >
          <span aria-hidden="true">⠿</span>
        </button>
      </div>
      <div className="image-thumb">
        <img src={url} alt={`Mueble ${indice}`} loading="lazy" decoding="async" />
        <button
          type="button"
          className="image-thumb-remove"
          aria-label={`Quitar la foto ${numero}`}
          onClick={() => alPedirQuitar(indice)}
        >
          <Icon name="close" />
        </button>
      </div>
      {indice > 0 && (
        <button type="button" className="foto-galeria-principal" onClick={() => alUsarComoPrincipal(indice)}>
          Usar como principal
        </button>
      )}
    </li>
  );
};

const GaleriaFotos = ({ fotos, onCambiar, alPedirQuitar }) => {
  const sensores = useSensors(
    // 5 px antes de empezar a arrastrar: un clic suelto en el asa no mueve nada.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const ids = idsDeFotos(fotos);

  const alSoltar = ({ active, over }) => {
    const nuevas = fotosTrasSoltar(fotos, ids, active.id, over?.id);
    if (nuevas !== fotos) onCambiar(nuevas);
  };

  return (
    <DndContext
      sensors={sensores}
      collisionDetection={closestCenter}
      onDragEnd={alSoltar}
      accessibility={{ announcements: anuncios(ids), screenReaderInstructions: INSTRUCCIONES }}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <ul className="foto-galeria" aria-label="Fotos del mueble, en orden">
          {fotos.map((url, indice) => (
            <FotoOrdenable
              key={ids[indice]}
              id={ids[indice]}
              url={url}
              indice={indice}
              alUsarComoPrincipal={(i) => onCambiar(usarComoPrincipal(fotos, i))}
              alPedirQuitar={alPedirQuitar}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
};

export default GaleriaFotos;
