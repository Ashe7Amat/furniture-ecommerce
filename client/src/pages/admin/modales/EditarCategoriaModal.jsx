import { useContext } from 'react';
import useEstadoEnvio from '../hooks/useEstadoEnvio';
import { ToastContext } from '../../../context/ToastContext';
import { updateCategoria } from '../../../services/api';
import Icon from '../Icon';
import { generales } from '../categorias';
import { prepararFotos, textoOptimizando, textoDemasiadoPeso } from '../../../utils/imagen';

// Modal "Editar Categoría". Lo pinta el contenedor, fuera de <main>, y su estado (la categoría
// que se edita y la imagen nueva) vive allí. El estado del envío es solo de este
// modal (H14): su error sale aquí, no debajo de otro formulario.
const EditarCategoriaModal = ({
  categoria, setCategoria,
  archivoNuevo, setArchivoNuevo,
  categorias,
  confirmarBorrado,
  onGuardado,
  onCerrar
}) => {
  const { showToast } = useContext(ToastContext);
  const envio = useEstadoEnvio();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!categoria) return;
    if (envio.enviando) return; // ya hay un envío en curso (p. ej. un doble clic o Intro)
    envio.empezar('Actualizando categoría...');

    // La foto nueva se reduce antes de subirla (H24, ver utils/imagen.js).
    let imagen = archivoNuevo;
    if (archivoNuevo) {
      const preparadas = await prepararFotos([archivoNuevo], { alProgreso: (n, total) => envio.empezar(textoOptimizando(n, total)) });
      if (!preparadas.caben) {
        envio.acabarMal(textoDemasiadoPeso(preparadas.peso, 1));
        showToast('La foto pesa demasiado', 'error');
        return;
      }
      imagen = preparadas.fotos[0];
      envio.empezar('Actualizando categoría...');
    }

    const formDataToSend = new FormData();
    formDataToSend.append('nombre', categoria.nombre || '');
    formDataToSend.append('categoria_padre_id', categoria.categoria_padre_id || '');
    if (imagen) {
      formDataToSend.append('imagen', imagen);
    } else {
      formDataToSend.append('imagen_url', categoria.imagen_url || '');
    }

    const res = await updateCategoria(categoria.id, formDataToSend);
    if (res) {
      envio.acabarBien();
      showToast('Categoría actualizada correctamente', 'success');
      onCerrar();
      setArchivoNuevo(null);
      onGuardado();
    } else {
      envio.acabarMal('Error al actualizar.');
      showToast('Error al actualizar la categoría', 'error');
    }
  };

  return (
    <div className="admin-modal-overlay">
      <div className="admin-modal-content">
        <div className="admin-modal-header">
          <h3>Editar Categoría</h3>
          <button className="admin-modal-close" onClick={onCerrar} aria-label="Cerrar"><Icon name="close" /></button>
        </div>
        <form onSubmit={handleSubmit} className="admin-form">
          <div className="field-group">
            <label className="field-label">Nombre de la Categoría:</label>
            <input
              type="text"
              value={categoria.nombre || ''}
              onChange={(e) => setCategoria({ ...categoria, nombre: e.target.value })}
              required
            />
          </div>

          <div className="field-group">
            <label className="field-label">Categoría general (opcional):</label>
            <select
              value={categoria.categoria_padre_id || ''}
              onChange={(e) => setCategoria({ ...categoria, categoria_padre_id: e.target.value ? parseInt(e.target.value, 10) : null })}
            >
              <option value="">— Es una categoría general —</option>
              {generales(categorias).filter(c => c.id !== categoria.id).map(general => (
                <option key={general.id} value={general.id}>Dentro de: {general.nombre}</option>
              ))}
            </select>
          </div>

          {categoria.imagen_url && (
            <div className="field-group">
              <label className="field-label">Imagen actual (clic en ✕ para eliminar):</label>
              <div className="image-thumb" style={{ width: '100px', height: '100px' }}>
                <img src={categoria.imagen_url} alt="Categoría" loading="lazy" decoding="async" />
                <button
                  type="button"
                  className="image-thumb-remove"
                  onClick={() => {
                    confirmarBorrado(
                      'Eliminar Imagen de Categoría',
                      '¿Estás seguro de que deseas eliminar la imagen representativa de esta categoría?',
                      () => {
                        setCategoria({ ...categoria, imagen_url: '' });
                      }
                    );
                  }}
                >
                  <Icon name="close" />
                </button>
              </div>
            </div>
          )}

          <div className="file-input-wrapper">
            <label>Reemplazar Imagen (Opcional):</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setArchivoNuevo(e.target.files[0])}
            />
          </div>

          <button type="submit" className="admin-btn" disabled={envio.enviando}>
            Guardar Cambios
          </button>
          {envio.mensaje && <p className="admin-status">{envio.mensaje}</p>}
        </form>
      </div>
    </div>
  );
};

export default EditarCategoriaModal;
