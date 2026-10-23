import { LEYENDA } from './ocupacion';

// Qué es cada dibujo de los calendarios de «Reservas». Cada uno se distingue por la forma, no solo por el
// color: un relleno liso, rayas, puntos o un sombreado.
const LeyendaOcupacion = () => (
  <ul className="ocupacion-leyenda" aria-label="Leyenda del calendario">
    {LEYENDA.map(([clase, texto]) => (
      <li key={clase}>
        <span className={`ocupacion-muestra ocupacion-muestra--${clase}`} aria-hidden="true" />
        {texto}
      </li>
    ))}
  </ul>
);

export default LeyendaOcupacion;
