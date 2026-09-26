import { useContext } from 'react';
import { ToastContext } from '../../../context/ToastContext';
import { createMueble } from '../../../services/api';
import SelectorCategoria from '../SelectorCategoria';
import { idDeCategoria } from '../categorias';

// Pestaña "Añadir Mueble". El formulario (formData, files) y el mensaje de estado viven en el
// contenedor, así que lo escrito se conserva al cambiar de pestaña (H13) y `status` es el mismo
// para todos los formularios del panel (H14): este es el único sitio donde se pinta.
const CrearMuebleTab = ({ categorias, formData, setFormData, files, setFiles, status, setStatus, recargarMuebles, irA }) => {
  const { showToast } = useContext(ToastContext);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    setFiles(Array.from(e.target.files));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('Guardando producto...');

    const formDataToSend = new FormData();
    formDataToSend.append('nombre', formData.nombre);
    formDataToSend.append('categoria', formData.categoria);
    const categoriaId = idDeCategoria(categorias, formData.categoria);
    if (categoriaId !== undefined) formDataToSend.append('categoria_id', categoriaId);
    formDataToSend.append('descripcion', formData.descripcion);
    if (formData.precio_venta) formDataToSend.append('precio_venta', formData.precio_venta);
    if (formData.precio_alquiler) formDataToSend.append('precio_alquiler', formData.precio_alquiler);
    formDataToSend.append('estado', formData.estado);

    for (const file of files) {
      formDataToSend.append('imagenes', file);
    }

    const res = await createMueble(formDataToSend);
    if (res) {
      setStatus('');
      showToast('Producto añadido con éxito al catálogo', 'success');
      setFormData({ nombre: '', categoria: '', descripcion: '', precio_venta: '', precio_alquiler: '', estado: 'disponible' });
      setFiles([]);
      const fileInput = document.getElementById('mueble-file-input');
      if (fileInput) fileInput.value = '';
      recargarMuebles();
      irA('inventario');
    } else {
      setStatus('Error al guardar en base de datos.');
      showToast('Error al guardar producto', 'error');
    }
  };

  return (
    <div className="admin-view fade-in">
      <div className="admin-view-head"><h2>Añadir Nuevo Producto</h2></div>
      <form onSubmit={handleSubmit} className="admin-form">
        <input name="nombre" placeholder="Nombre del mueble" value={formData.nombre} onChange={handleInputChange} required />
        <SelectorCategoria categorias={categorias} name="categoria" value={formData.categoria} onChange={handleInputChange} />
        <textarea name="descripcion" placeholder="Descripción detallada" value={formData.descripcion} onChange={handleInputChange} required />
        <div className="admin-form-row">
          <input name="precio_venta" type="number" placeholder="Precio Venta (€)" value={formData.precio_venta} onChange={handleInputChange} />
          <input name="precio_alquiler" type="number" placeholder="Precio Alquiler (€/día)" value={formData.precio_alquiler} onChange={handleInputChange} />
        </div>

        <select name="estado" value={formData.estado} onChange={handleInputChange}>
          <option value="disponible">Disponible</option>
          <option value="vendido">Vendido</option>
          <option value="alquilado">Alquilado</option>
        </select>

        <div className="file-input-wrapper">
          <label>Imágenes (Selecciona varias):</label>
          <input type="file" id="mueble-file-input" multiple accept="image/*" onChange={handleFileChange} required />
        </div>

        <button type="submit" className="admin-btn" disabled={status.includes('Subiendo') || status.includes('Guardando')}>Guardar Producto</button>
      </form>
      {status && <p className="admin-status">{status}</p>}
    </div>
  );
};

export default CrearMuebleTab;
