import { useState } from 'react';
import '../styles/AntesDespues.css';

// "Antes y después" de la restauración, en la ficha: la foto de cómo llegó la pieza encima de la de ahora,
// recortada hasta donde marque el deslizador. El deslizador es un <input type="range"> de verdad, transparente
// y del tamaño de la foto: se arrastra con el ratón o el dedo, y con las flechas del teclado.
const AntesDespues = ({ antes, despues, nombre }) => {
  const [posicion, setPosicion] = useState(50);
  return (
    <figure className="antes-despues">
      <div className="ad-marco" style={{ '--ad-pos': `${posicion}%` }}>
        <img src={despues} alt={`${nombre}, después de restaurar`} className="ad-foto" loading="lazy" decoding="async" />
        <img src={antes} alt={`${nombre}, antes de restaurar`} className="ad-foto ad-antes" loading="lazy" decoding="async" />
        <span className="ad-linea" aria-hidden="true" />
        <span className="ad-etiqueta ad-etiqueta-antes" aria-hidden="true">Antes</span>
        <span className="ad-etiqueta ad-etiqueta-despues" aria-hidden="true">Después</span>
        <input
          type="range"
          min="0"
          max="100"
          value={posicion}
          onChange={(e) => setPosicion(Number(e.target.value))}
          className="ad-control"
          aria-label="Comparar antes y después de la restauración"
          aria-valuetext={`${posicion} % de la foto de antes`}
        />
      </div>
      <figcaption className="ad-pie">Antes y después de la restauración. Desliza para comparar.</figcaption>
    </figure>
  );
};

export default AntesDespues;
