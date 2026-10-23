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
  imagenes = [],
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
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (lleno) {
      showToast?.(`Se admite un máximo de ${max} imágenes. Elimina una para añadir otra.`, 'error');
      if (e.target) e.target.value = '';
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    // Calcular cuántos archivos podemos subir sin superar el tope máximo
    let archivosASubir = files;
    if (sustituye) {
      archivosASubir = [files[0]];
    } else {
      const disponibles = max - imagenes.length;
      if (files.length > disponibles) {
        showToast?.(
          `Solo puedes añadir ${disponibles} ${disponibles === 1 ? 'imagen' : 'imágenes'} más (máximo ${max}).`,
          'warning'
        );
        archivosASubir = files.slice(0, disponibles);
      }
    }

    try {
      setSubiendo(true);
      const nuevasUrls = [];

      for (let i = 0; i < archivosASubir.length; i++) {
        const file = archivosASubir[i];
        const sufijo = archivosASubir.length > 1 ? ` (${i + 1}/${archivosASubir.length})` : '';

        setMensaje(`Optimizando imagen${sufijo}...`);
        const optimizada = await redimensionarImagen(file, { maxLado: 1920, calidad: 0.85 });

        setMensaje(`Subiendo a Supabase Storage${sufijo}...`);
        const resultado = await subirImagenHero(optimizada);

        if (resultado?.url) {
          nuevasUrls.push(resultado.url);
        } else {
          showToast?.(`Error al subir "${file.name}" a Storage`, 'error');
        }
      }

      if (nuevasUrls.length > 0) {
        // Actualización funcional acumulando todas las nuevas URLs
        onChange((prev) => {
          const base = Array.isArray(prev) ? prev : [];
          return sustituye ? [nuevasUrls[0]] : [...base, ...nuevasUrls];
        });

        const msgExito =
          nuevasUrls.length > 1
            ? `${nuevasUrls.length} imágenes añadidas correctamente`
            : mensajeAnadida || 'Imagen añadida';
        showToast?.(msgExito, 'success');
      }
    } catch {
      showToast?.('Error al procesar las imágenes', 'error');
    } finally {
      setSubiendo(false);
      setMensaje('');
      if (e.target) e.target.value = '';
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const eliminar = (index) => {
    onChange((prev) => {
      const base = Array.isArray(prev) ? prev : imagenes;
      return base.filter((_, i) => i !== index);
    });
  };

  const mover = (index, direccion) => {
    const destino = index + direccion;
    onChange((prev) => {
      const base = Array.isArray(prev) ? [...prev] : [...imagenes];
      if (destino < 0 || destino >= base.length) return base;
      [base[index], base[destino]] = [base[destino], base[index]];
      return base;
    });
  };

  const resumen =
    imagenes.length === 0
      ? textoVacio
      : `Imágenes personalizadas: ${imagenes.length} de ${max}.`;

  return (
    <section className="portada-seccion" id={id} aria-labelledby={`${id}-titulo`}>
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
            multiple={!sustituye}
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
            <Icon name="add" />{' '}
            {sustituye && imagenes.length > 0
              ? 'Cambiar imagen'
              : sustituye
                ? 'Subir nueva imagen'
                : 'Subir imágenes'}
          </button>
        </div>
      </div>

      {subiendo && (
        <p className="admin-status" aria-live="polite">
          {mensaje || 'Subiendo imágenes...'}
        </p>
      )}

      <div
        className="hero-grid"
        role="list"
        aria-label={`Lista de imágenes: ${titulo}`}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
          gap: '12px'
        }}
      >
        {imagenes.length === 0
          ? predeterminadas.map((p, i) => (
            <div key={p.url} className="hero-slot hero-slot--placeholder" role="listitem">
              <div className="hero-slot-preview">
                <img
                  src={p.url}
                  alt={`Placeholder ${i + 1}: ${p.titulo}`}
                  className="hero-slot-img"
                  style={{
                    width: '100%',
                    aspectRatio: '1 / 1',
                    objectFit: 'cover',
                    borderRadius: '8px',
                    display: 'block'
                  }}
                />
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
                <img
                  src={url}
                  alt={`${Etiqueta} de portada ${i + 1}`}
                  className="hero-slot-img"
                  style={{
                    width: '100%',
                    aspectRatio: '1 / 1',
                    objectFit: 'cover',
                    borderRadius: '8px',
                    display: 'block'
                  }}
                />
                <span className="hero-slot-badge">#{i + 1}</span>
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