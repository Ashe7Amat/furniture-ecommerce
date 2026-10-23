import { cloneElement, useId } from 'react';

// Un campo de los formularios de reservas: su etiqueta unida al control y, si hay, una pista
// debajo que el lector de pantalla lee como descripción del campo.
const CampoReserva = ({ etiqueta, pista, children }) => {
  const id = useId();
  const idPista = `${id}-pista`;
  return (
    <div className="field-group">
      <label className="field-label" htmlFor={id}>{etiqueta}</label>
      {cloneElement(children, { id, 'aria-describedby': pista ? idPista : undefined })}
      {pista && <p className="field-hint" id={idPista}>{pista}</p>}
    </div>
  );
};

export default CampoReserva;
