import { useContext } from 'react';
import { ToastContext } from '../../../context/ToastContext';
import { updateMueble } from '../../../services/api';
import Icon from '../Icon';
import SelectorCategoria from '../SelectorCategoria';
import { idDeCategoria } from '../categorias';

// Modal "Editar Producto". Lo pinta el contenedor, fuera de <main>, y su estado (la pieza que se
// edita y las fotos nuevas) vive allí. Usa el `status` compartido del panel (H14).
const EditarMuebleModal = ({
  mueble, setMueble,
  archivosNuevos, setArchivosNuevos,
  categorias,
  status, setStatus,
  confirmarBorrado,
  onGuardado,
  onCerrar
}) => {
  const { showToast } = useContext(ToastContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!mueble) return;
    setStatus('Actualizando producto...');

    const formDataToSend = new FormData();
    formDataToSend.append('nombre', mueble.nombre || '');
    formDataToSend.append('categoria', mueble.categoria || '');
    const categoriaId = idDeCategoria(categorias, mueble.categoria);
    if (categoriaId !== undefined) formDataToSend.append('categoria_id', categoriaId);
    formDataToSend.append('descripcion', mueble.descripcion || '');
    formDataToSend.append('precio_venta', mueble.precio_venta || '');
    formDataToSend.append('precio_alquiler', mueble.precio_alquiler ?? mueble.precio_alquiler_dia ?? '');
    formDataToSend.append('estado', mueble.estado || 'disponible');
    formDataToSend.append('imagenes_existentes', JSON.stringify(mueble.imagenes || []));

    if (archivosNuevos.length > 0) {
      for (const file of archivosNuevos) {
        formDataToSend.append('imagenes', file);
      }
    }

    const res = await updateMueble(mueble.id, formDataToSend);
    if (res) {
      setStatus('');
      showToast('Producto actualizado correctamente', 'success');
      onCerrar();
      setArchivosNuevos([]);
      onGuardado();
    } else {
      setStatus('Error al actualizar.');
      showToast('Error al actualizar el producto', 'error');
    }
  };

  return (
    <div className="admin-modal-overlay">
      <div className="admin-modal-content">
        <div className="admin-modal-header">
          <h3>Editar Producto</h3>
          <button className="admin-modal-close" onClick={onCerrar} aria-label="Cerrar"><Icon name="close" /></button>
        </div>
        <form onSubmit={handleSubmit} className="admin-form">
          <div className="field-group">
            <label className="field-label">Nombre del Mueble:</label>
            <input
              type="text"
              value={mueble.nombre || ''}
              onChange={(e) => setMueble({ ...mueble, nombre: e.target.value })}
              required
            />
          </div>

          <div className="field-group">
            <label className="field-label">Categoría:</label>
            <SelectorCategoria
              categorias={categorias}
              value={mueble.categoria || ''}
              onChange={(e) => setMueble({ ...mueble, categoria: e.target.value })}
            />
          </div>

          <div className="field-group">
            <label className="field-label">Descripción:</label>
            <textarea
              value={mueble.descripcion || ''}
              onChange={(e) => setMueble({ ...mueble, descripcion: e.target.value })}
              required
            />
          </div>

          <div className="modal-form-row">
            <div className="field-group">
              <label className="field-label">Venta (€):</label>
              <input
                type="number"
                value={mueble.precio_venta || ''}
                onChange={(e) => setMueble({ ...mueble, precio_venta: e.target.value })}
              />
            </div>
            <div className="field-group">
              <label className="field-label">Alquiler (€/día):</label>
              <input
                type="number"
                value={mueble.precio_alquiler ?? mueble.precio_alquiler_dia ?? ''}
                onChange={(e) => setMueble({ ...mueble, precio_alquiler: e.target.value })}
              />
            </div>
          </div>

          <div className="field-group">
            <label className="field-label">Estado:</label>
            <select
              value={mueble.estado || 'disponible'}
              onChange={(e) => setMueble({ ...mueble, estado: e.target.value })}
            >
              <option value="disponible">Disponible</option>
              <option value="vendido">Vendido</option>
              <option value="alquilado">Alquilado</option>
            </select>
          </div>

          {mueble.imagenes && mueble.imagenes.length > 0 && (
            <div className="field-group">
              <label className="field-label">Imágenes actuales (clic en ✕ para eliminar):</label>
              <div className="image-thumb-grid">
                {mueble.imagenes.map((imgUrl, idx) => (
                  <div key={idx} className="image-thumb">
                    <img src={imgUrl} alt={`Mueble ${idx}`} loading="lazy" decoding="async" />
                    <button
                      type="button"
                      className="image-thumb-remove"
                      onClick={() => {
                        confirmarBorrado(
                          'Eliminar Imagen de Producto',
                          '¿Estás seguro de que deseas eliminar esta imagen de este producto? Se quitará de la previsualización actual.',
                          () => {
                            const updatedImgs = mueble.imagenes.filter((_, i) => i !== idx);
                            setMueble({ ...mueble, imagenes: updatedImgs });
                          }
                        );
                      }}
                    >
                      <Icon name="close" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="file-input-wrapper">
            <label>Añadir más imágenes (Opcional):</label>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => setArchivosNuevos(Array.from(e.target.files))}
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

export default EditarMuebleModal;
