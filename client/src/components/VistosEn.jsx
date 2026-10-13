import { PRODUCCIONES } from '../utils/producciones';

// Sección "Vistos en" de la portada; la lista está en utils/producciones.js.
const VistosEn = ({ producciones = PRODUCCIONES }) => {
  if (!producciones.length) return null;
  return (
    <section className="home-vistos-en" aria-labelledby="vistos-en-titulo">
      <h2 id="vistos-en-titulo" className="vistos-en-titulo">Nuestras piezas han salido en</h2>
      <ul className="vistos-en-lista">
        {producciones.map(({ nombre, tipo }) => (
          <li key={nombre} className="vistos-en-item">
            <span className="vistos-en-nombre">{nombre}</span>
            {tipo && <span className="vistos-en-tipo">{tipo}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
};

export default VistosEn;
