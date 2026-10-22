import { useState, useContext, useRef } from 'react';
import { ToastContext } from '../../context/ToastContext';
import { subirImagenHero } from '../../services/api';
import { redimensionarImagen } from '../../utils/imagen';
import Icon from './Icon';

// Sección de imágenes de la pestaña "Portada": lista ordenable de fotos subidas a Supabase Storage
// (carpeta home/). La usan el hero, las fotos de inspiración y la de sostenibilidad.
//   - `max`: tope de fotos. Con max = 1 la foto nueva sustituye a la actual.
//   - `predeterminadas`: las fotos estáticas que enseña la web mientras la lista está vacía.
//   - `minimo`: con menos fotos que esto la web usa las predeterminadas, y se avisa aquí.
const SeccionImagenes = ({
  id,
  titulo,
  descripcion,
  imagenes,
  onChange,
  max,
  minimo = 1,
  predeterminadas = [],
  textoVacio,
  etiqueta = 'imagen',
  ariaSubir,
  mensajeAnadida
}) => {
  const { showToast } = useContext(ToastContext);
  const inputRef = useRef(null);
  const [subiendo, setSubiendo] = useState(false);
  const [mensaje, setMensaje] = useState('');

  const sustituye = max === 1;
  const lleno = !sustituye && imagenes.length >= max;
  const Etiqueta = etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1);

  const handleArchivo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (lleno) {
      showToast?.(`Se admite un máximo de ${max} imágenes. Elimina una para añadir otra.`, 'error');
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    try {
      setSubiendo(true);
      setMensaje('Optimizando imagen...');
      const optimizada = await redimensionarImagen(file, { maxLado: 1920, calidad: 0.85 });
      setMensaje('Subiendo a Supabase Storage...');
      const resultado = await subirImagenHero(optimizada);
      if (resultado?.url) {
        // Siempre al final de la lista (o en lugar de la única foto, con max = 1).
        onChange(sustituye ? [resultado.url] : [...imagenes, resultado.url]);
        showToast?.(mensajeAnadida || 'Imagen añadida', 'success');
      } else {
        showToast?.('Error al subir la imagen a Storage', 'error');
      }
    } catch {
      showToast?.('Error al procesar la imagen', 'error');
    } finally {
      setSubiendo(false);
      setMensaje('');
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const eliminar = (index) => onChange(imagenes.filter((_, i) => i !== index));

  const mover = (index, direccion) => {
    const destino = index + direccion;
    if (destino < 0 || destino >= imagenes.length) return;
    const copia = [...imagenes];
    [copia[index], copia[destino]] = [copia[destino], copia[index]];
    onChange(copia);
  };

  const resumen =
    imagenes.length === 0
      ? textoVacio
      : `Imágenes personalizadas: ${imagenes.length} de ${max}.`;

  return (
    <section className="portada-seccion" aria-labelledby={`${id}-titulo`}>
      <div className="portada-seccion-header">
        <div>
          <h3 id={`${id}-titulo`}>{titulo}</h3>
          <p className="portada-seccion-desc">{descripcion}</p>
          <p className="portada-seccion-desc">{resumen}</p>
          {imagenes.length > 0 && imagenes.length < minimo && (
            <p className="portada-seccion-aviso" role="status">
              Añade al menos {minimo} fotos: con menos, la web usa las predeterminadas.
            </p>
          )}
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            id={`${id}-file-input`}
            accept="image/*"
            onChange={handleArchivo}
            style={{ display: 'none' }}
            disabled={subiendo || lleno}
          />
          <button
            type="button"
            className="admin-btn"
            onClick={() => inputRef.current?.click()}
            disabled={subiendo || lleno}
            aria-label={ariaSubir}
          >
            <Icon name="add" /> {sustituye && imagenes.length > 0 ? 'Cambiar imagen' : 'Subir nueva imagen'}
          </button>
        </div>
      </div>

      {subiendo && (
        <p className="admin-status" aria-live="polite">
          {mensaje || 'Subiendo imagen...'}
        </p>
      )}

      <div className="hero-grid" role="list" aria-label={`Lista de imágenes: ${titulo}`}>
        {imagenes.length === 0
          ? predeterminadas.map((p, i) => (
              <div key={p.url} className="hero-slot hero-slot--placeholder" role="listitem">
                <div className="hero-slot-preview">
                  <img src={p.url} alt={`Placeholder ${i + 1}: ${p.titulo}`} className="hero-slot-img" />
                  <span className="hero-slot-badge">Predeterminada {i + 1}</span>
                </div>
                <div className="hero-slot-info">
                  <span className="hero-slot-label">{p.titulo}</span>
                </div>
              </div>
            ))
          : imagenes.map((url, i) => (
              <div key={`${url}-${i}`} className="hero-slot hero-slot--activo" role="listitem">
                <div className="hero-slot-preview">
                  <img src={url} alt={`${Etiqueta} de portada ${i + 1}`} className="hero-slot-img" />
                  <span className="hero-slot-badge">Posición {i + 1}</span>
                </div>
                <div className="hero-slot-info">
                  <span className="hero-slot-label">
                    {Etiqueta} {i + 1}
                  </span>
                  <div className="hero-slot-acciones">
                    {!sustituye && (
                      <>
                        <button
                          type="button"
                          className="hero-accion-btn"
                          onClick={() => mover(i, -1)}
                          disabled={i === 0}
                          aria-label={`Mover ${etiqueta} ${i + 1} hacia arriba`}
                          title="Subir posición"
                        >
                          <Icon name="arrowUp" />
                        </button>
                        <button
                          type="button"
                          className="hero-accion-btn"
                          onClick={() => mover(i, 1)}
                          disabled={i === imagenes.length - 1}
                          aria-label={`Mover ${etiqueta} ${i + 1} hacia abajo`}
                          title="Bajar posición"
                        >
                          <Icon name="arrowDown" />
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="hero-accion-btn hero-accion-btn--borrar"
                      onClick={() => eliminar(i)}
                      aria-label={`Eliminar ${etiqueta} ${i + 1}`}
                      title="Eliminar de la lista"
                    >
                      <Icon name="trash" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
      </div>
    </section>
  );
};

export default SeccionImagenes;
