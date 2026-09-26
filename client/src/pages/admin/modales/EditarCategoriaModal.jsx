import { useContext } from 'react';
import { ToastContext } from '../../../context/ToastContext';
import { updateCategoria } from '../../../services/api';
import Icon from '../Icon';
import { generales } from '../categorias';

// Modal "Editar Categoría". Lo pinta el contenedor, fuera de <main>, y su estado (la categoría
// que se edita y la imagen nueva) vive allí. Usa el `status` compartido del panel (H14).
const EditarCategoriaModal = ({
  categoria, setCategoria,
  archivoNuevo, setArchivoNuevo,
  categorias,
  status, setStatus,
  confirmarBorrado,
  onGuardado,
  onCerrar
}) => {
  const { showToast } = useContext(ToastContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!categoria) return;
    setStatus('Actualizando categoría...');

    const formDataToSend = new FormData();
    formDataToSend.append('nombre', categoria.nombre || '');
    formDataToSend.append('categoria_padre_id', categoria.categoria_padre_id || '');
    if (archivoNuevo) {
      formDataToSend.append('imagen', archivoNuevo);
    } else {
      formDataToSend.append('imagen_url', categoria.imagen_url || '');
    }

    const res = await updateCategoria(categoria.id, formDataToSend);
    if (res) {
      setStatus('');
      showToast('Categoría actualizada correctamente', 'success');
      onCerrar();
      setArchivoNuevo(null);
      onGuardado();
    } else {
      setStatus('Error al actualizar.');
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

          <button type="submit" className="admin-btn" disabled={status.includes('Actualizando')}>
            Guardar Cambios
          </button>
        </form>
      </div>
    </div>
  );
};

export default EditarCategoriaModal;
