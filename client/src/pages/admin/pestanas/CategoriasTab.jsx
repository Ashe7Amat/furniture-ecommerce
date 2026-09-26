import { useContext } from 'react';
import { ToastContext } from '../../../context/ToastContext';
import { createCategoria, deleteCategoria } from '../../../services/api';
import Icon from '../Icon';
import { generales, especificasDe } from '../categorias';

// Pestaña "Gestionar Categorías". El formulario de alta vive en el contenedor, así que lo escrito
// se conserva al cambiar de pestaña (H13), y usa el `status` compartido del panel (H14).
// Ojo (H12): borrar avisa de éxito sin mirar la respuesta. Se conserva a propósito en el refactor.
const CategoriasTab = ({
  categorias,
  nuevaCat, setNuevaCat,
  nuevaCatPadre, setNuevaCatPadre,
  categoriaFile, setCategoriaFile,
  setStatus,
  recargarCategorias,
  confirmarBorrado,
  abrirEditorCategoria
}) => {
  const { showToast } = useContext(ToastContext);

  const handleAddCategoria = async (e) => {
    e.preventDefault();
    if (!nuevaCat) return;

    setStatus('Creando categoría...');
    const formDataToSend = new FormData();
    formDataToSend.append('nombre', nuevaCat);
    formDataToSend.append('categoria_padre_id', nuevaCatPadre);
    if (categoriaFile) {
      formDataToSend.append('imagen', categoriaFile);
    }

    const res = await createCategoria(formDataToSend);
    if (res) {
      showToast('Categoría creada correctamente', 'success');
      setNuevaCat('');
      setNuevaCatPadre('');
      setCategoriaFile(null);
      const fileInput = document.getElementById('categoria-file-input');
      if (fileInput) fileInput.value = '';
      recargarCategorias();
    } else {
      showToast('Error al crear la categoría', 'error');
    }
    setStatus('');
  };

  const handleDeleteCategoria = (id) => {
    confirmarBorrado(
      'Eliminar Categoría',
      '¿Deseas eliminar esta categoría? Si tiene muebles asociados podrían quedarse sin categoría.',
      async () => {
        await deleteCategoria(id);
        showToast('Categoría eliminada', 'success');
        recargarCategorias();
      }
    );
  };

  return (
    <div className="admin-view fade-in">
      <div className="admin-view-head"><h2>Gestionar Categorías</h2></div>
      <div className="admin-cat-manager">
        <form onSubmit={handleAddCategoria} className="cat-add-form">
          <input
            type="text"
            placeholder="Nueva categoría (Ej: Sofás)"
            value={nuevaCat}
            onChange={(e) => setNuevaCat(e.target.value)}
            required
          />
          <div className="field-group">
            <label className="field-label">Categoría general (opcional):</label>
            <select value={nuevaCatPadre} onChange={(e) => setNuevaCatPadre(e.target.value)}>
              <option value="">— Es una categoría general —</option>
              {generales(categorias).map(general => (
                <option key={general.id} value={general.id}>Dentro de: {general.nombre}</option>
              ))}
            </select>
          </div>
          <div className="file-input-wrapper">
            <label>Imagen de la Categoría:</label>
            <input
              type="file"
              id="categoria-file-input"
              accept="image/*"
              onChange={(e) => setCategoriaFile(e.target.files[0])}
              required
            />
          </div>
          <button type="submit" className="admin-btn">Crear Categoría</button>
        </form>

        {generales(categorias).map(general => (
          <div key={general.id} className="cat-group">
            <h3 className="cat-group-title">{general.nombre}</h3>
            <div className="cat-grid">
              {[general, ...especificasDe(categorias, general)].map(cat => (
                <div key={cat.id} className={`cat-card${cat.id === general.id ? ' cat-card--general' : ''}`}>
                  <div className="cat-card-header">
                    <h3>{cat.nombre}{cat.id === general.id && ' (general)'}</h3>
                    <div className="cat-card-actions">
                      <button onClick={() => abrirEditorCategoria(cat)} className="cat-card-edit-btn" aria-label="Editar">
                        <Icon name="pencil" />
                      </button>
                      <button onClick={() => handleDeleteCategoria(cat.id)} className="cat-card-del-btn" aria-label="Eliminar">
                        <Icon name="trash" />
                      </button>
                    </div>
                  </div>
                  {cat.stats ? (
                    <div className="cat-card-stats">
                      <p>Productos totales: <strong>{cat.stats.totalProductos}</strong></p>
                      <p>Stock: {cat.stats.disponibles} disponibles · {cat.stats.vendidos} vendidos · {cat.stats.alquilados} alquilados</p>
                      <p>Valor del catálogo: <strong>{cat.stats.valorTotalVenta}</strong></p>
                    </div>
                  ) : (
                    <div className="cat-card-stats">
                      <p>Cargando analíticas...</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CategoriasTab;
