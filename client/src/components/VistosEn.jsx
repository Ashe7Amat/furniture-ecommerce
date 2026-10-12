// "Vistos en": producciones (series, anuncios, sesiones de fotos, eventos) donde han salido piezas de
// Nave 5. La lista la da el cliente: mientras esté vacía, la sección no se pinta. Para añadir una,
// basta con una línea en PRODUCCIONES, por ejemplo { nombre: 'Las chicas del cable', tipo: 'Serie' }.
export const PRODUCCIONES = [];

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
