import { generales, especificasDe } from './categorias';

// Desplegable de categoría de "Añadir mueble" y del modal de edición: las específicas, agrupadas
// bajo su categoría general (las generales no se pueden elegir). El valor es el NOMBRE de la
// categoría; el id lo calcula quien envía el formulario (idDeCategoria).
const SelectorCategoria = ({ categorias, name, value, onChange }) => (
  <select name={name} value={value} onChange={onChange} required>
    <option value="">Selecciona una categoría</option>
    {generales(categorias).map(general => (
      <optgroup key={general.id} label={general.nombre}>
        {especificasDe(categorias, general).map(esp => (
          <option key={esp.id} value={esp.nombre}>{esp.nombre}</option>
        ))}
      </optgroup>
    ))}
  </select>
);

export default SelectorCategoria;
