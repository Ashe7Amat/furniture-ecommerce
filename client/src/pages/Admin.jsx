import { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import {
  updateMueble,
  updateCategoria
} from '../services/api';
import '../styles/Admin.css';
import Icon from './admin/Icon';
import SelectorCategoria from './admin/SelectorCategoria';
import { generales, idDeCategoria, primeraEspecifica } from './admin/categorias';
import useAdminDatos from './admin/hooks/useAdminDatos';
import useInventarioVista from './admin/hooks/useInventarioVista';
import useConfirmacion from './admin/hooks/useConfirmacion';
import ResumenTab from './admin/pestanas/ResumenTab';
import CrearMuebleTab from './admin/pestanas/CrearMuebleTab';
import InventarioTab from './admin/pestanas/InventarioTab';
import PedidosTab from './admin/pestanas/PedidosTab';
import CategoriasTab from './admin/pestanas/CategoriasTab';

// Pestañas de la barra lateral, en orden. Añadir una (p. ej. "Reservas") es una entrada más aquí
// y su caso en <main> (ver docs/tarea4-diseno.md, sección 7).
const PESTANAS = [
  { id: 'resumen', etiqueta: 'Resumen', icono: 'dashboard' },
  { id: 'crear', etiqueta: 'Añadir Mueble', icono: 'add' },
  { id: 'inventario', etiqueta: 'Gestionar Inventario', icono: 'inventory' },
  { id: 'pedidos', etiqueta: 'Pedidos', icono: 'box' },
  { id: 'categorias', etiqueta: 'Gestionar Categorías', icono: 'tag' }
];

const Admin = () => {
  const { user } = useContext(AuthContext);
  const { showToast } = useContext(ToastContext);

  const [vistaActiva, setVistaActiva] = useState('resumen');

  const { muebles, categorias, pedidos, setPedidos, cargarMuebles, cargarCategorias, cargarPedidos } = useAdminDatos(user);
  const [filtroEstadoPedido, setFiltroEstadoPedido] = useState('');

  // Estados para creación de categorías
  const [nuevaCat, setNuevaCat] = useState('');
  const [nuevaCatPadre, setNuevaCatPadre] = useState(''); // '' = categoría general (sin padre)
  const [categoriaFile, setCategoriaFile] = useState(null);

  // Estados para modales de edición (CMS)
  const [muebleAEditar, setMuebleAEditar] = useState(null);
  const [categoriaAEditar, setCategoriaAEditar] = useState(null);

  // Nuevos archivos durante la edición
  const [editMuebleFiles, setEditMuebleFiles] = useState([]);
  const [editCategoriaFile, setEditCategoriaFile] = useState(null);

  const [formData, setFormData] = useState({
    nombre: '',
    categoria: '',
    descripcion: '',
    precio_venta: '',
    precio_alquiler: '',
    estado: 'disponible'
  });
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState('');

  // Inventario: búsqueda, filtros, orden, paginación y selección (se conservan al cambiar de pestaña)
  const vista = useInventarioVista(muebles);

  const { confirmConfig, confirmarBorrado, cerrarConfirmacion } = useConfirmacion();

  // Casos A, B y C del diseño (docs/tarea4-diseno.md, sección 5): al cargar o recargar las
  // categorías, "Añadir mueble" preselecciona la primera específica, solo si no hay ninguna elegida.
  // Un mueble solo puede pertenecer a una categoría específica (con padre), nunca a una general.
  useEffect(() => {
    const especifica = primeraEspecifica(categorias);
    if (especifica && !formData.categoria) {
      setFormData(prev => ({ ...prev, categoria: especifica.nombre }));
    }
    // Solo [categorias], a propósito: con formData.categoria en las dependencias, se volvería a
    // preseleccionar justo después de vaciar el formulario al crear un mueble (caso C).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorias]);

  const handleUpdateMuebleSubmit = async (e) => {
    e.preventDefault();
    if (!muebleAEditar) return;
    setStatus('Actualizando producto...');

    const formDataToSend = new FormData();
    formDataToSend.append('nombre', muebleAEditar.nombre || '');
    formDataToSend.append('categoria', muebleAEditar.categoria || '');
    const categoriaId = idDeCategoria(categorias, muebleAEditar.categoria);
    if (categoriaId !== undefined) formDataToSend.append('categoria_id', categoriaId);
    formDataToSend.append('descripcion', muebleAEditar.descripcion || '');
    formDataToSend.append('precio_venta', muebleAEditar.precio_venta || '');
    formDataToSend.append('precio_alquiler', muebleAEditar.precio_alquiler ?? muebleAEditar.precio_alquiler_dia ?? '');
    formDataToSend.append('estado', muebleAEditar.estado || 'disponible');
    formDataToSend.append('imagenes_existentes', JSON.stringify(muebleAEditar.imagenes || []));

    if (editMuebleFiles.length > 0) {
      for (const file of editMuebleFiles) {
        formDataToSend.append('imagenes', file);
      }
    }

    const res = await updateMueble(muebleAEditar.id, formDataToSend);
    if (res) {
      setStatus('');
      showToast('Producto actualizado correctamente', 'success');
      setMuebleAEditar(null);
      setEditMuebleFiles([]);
      cargarMuebles();
    } else {
      setStatus('Error al actualizar.');
      showToast('Error al actualizar el producto', 'error');
    }
  };

  const handleUpdateCategoriaSubmit = async (e) => {
    e.preventDefault();
    if (!categoriaAEditar) return;
    setStatus('Actualizando categoría...');

    const formDataToSend = new FormData();
    formDataToSend.append('nombre', categoriaAEditar.nombre || '');
    formDataToSend.append('categoria_padre_id', categoriaAEditar.categoria_padre_id || '');
    if (editCategoriaFile) {
      formDataToSend.append('imagen', editCategoriaFile);
    } else {
      formDataToSend.append('imagen_url', categoriaAEditar.imagen_url || '');
    }

    const res = await updateCategoria(categoriaAEditar.id, formDataToSend);
    if (res) {
      setStatus('');
      showToast('Categoría actualizada correctamente', 'success');
      setCategoriaAEditar(null);
      setEditCategoriaFile(null);
      cargarCategorias();
    } else {
      setStatus('Error al actualizar.');
      showToast('Error al actualizar la categoría', 'error');
    }
  };

  if (!user) {
    return <div className="admin-msg">Acceso denegado. Inicia sesión primero.</div>;
  }

  // Pedidos por procesar: la insignia de la barra lateral y una tarjeta del resumen.
  const pedidosPendientes = pedidos.filter(p => p.estado === 'procesando').length;

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <h3 className="sidebar-title">Gestión</h3>
        <nav className="sidebar-menu">
          {PESTANAS.map(pestana => (
            <button key={pestana.id} className={`sidebar-btn ${vistaActiva === pestana.id ? 'active' : ''}`} onClick={() => setVistaActiva(pestana.id)}>
              <Icon name={pestana.icono} /> {pestana.etiqueta}
              {pestana.id === 'pedidos' && pedidosPendientes > 0 && <span className="sidebar-badge">{pedidosPendientes}</span>}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="admin-content">

        {vistaActiva === 'resumen' && (
          <ResumenTab muebles={muebles} pedidosPendientes={pedidosPendientes} irA={setVistaActiva} />
        )}

        {vistaActiva === 'crear' && (
          <CrearMuebleTab
            categorias={categorias}
            formData={formData}
            setFormData={setFormData}
            files={files}
            setFiles={setFiles}
            status={status}
            setStatus={setStatus}
            recargarMuebles={cargarMuebles}
            irA={setVistaActiva}
          />
        )}

        {vistaActiva === 'inventario' && (
          <InventarioTab
            vista={vista}
            muebles={muebles}
            categorias={categorias}
            recargarMuebles={cargarMuebles}
            confirmarBorrado={confirmarBorrado}
            abrirEditorMueble={setMuebleAEditar}
          />
        )}

        {vistaActiva === 'pedidos' && (
          <PedidosTab
            pedidos={pedidos}
            setPedidos={setPedidos}
            filtroEstadoPedido={filtroEstadoPedido}
            setFiltroEstadoPedido={setFiltroEstadoPedido}
            cargarPedidos={cargarPedidos}
          />
        )}

        {vistaActiva === 'categorias' && (
          <CategoriasTab
            categorias={categorias}
            nuevaCat={nuevaCat}
            setNuevaCat={setNuevaCat}
            nuevaCatPadre={nuevaCatPadre}
            setNuevaCatPadre={setNuevaCatPadre}
            categoriaFile={categoriaFile}
            setCategoriaFile={setCategoriaFile}
            setStatus={setStatus}
            recargarCategorias={cargarCategorias}
            confirmarBorrado={confirmarBorrado}
            abrirEditorCategoria={setCategoriaAEditar}
          />
        )}

      </main>

      {/* MODAL DE EDICIÓN MUEBLE */}
      {muebleAEditar && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content">
            <div className="admin-modal-header">
              <h3>Editar Producto</h3>
              <button className="admin-modal-close" onClick={() => setMuebleAEditar(null)} aria-label="Cerrar"><Icon name="close" /></button>
            </div>
            <form onSubmit={handleUpdateMuebleSubmit} className="admin-form">
              <div className="field-group">
                <label className="field-label">Nombre del Mueble:</label>
                <input
                  type="text"
                  value={muebleAEditar.nombre || ''}
                  onChange={(e) => setMuebleAEditar({ ...muebleAEditar, nombre: e.target.value })}
                  required
                />
              </div>

              <div className="field-group">
                <label className="field-label">Categoría:</label>
                <SelectorCategoria
                  categorias={categorias}
                  value={muebleAEditar.categoria || ''}
                  onChange={(e) => setMuebleAEditar({ ...muebleAEditar, categoria: e.target.value })}
                />
              </div>

              <div className="field-group">
                <label className="field-label">Descripción:</label>
                <textarea
                  value={muebleAEditar.descripcion || ''}
                  onChange={(e) => setMuebleAEditar({ ...muebleAEditar, descripcion: e.target.value })}
                  required
                />
              </div>

              <div className="modal-form-row">
                <div className="field-group">
                  <label className="field-label">Venta (€):</label>
                  <input
                    type="number"
                    value={muebleAEditar.precio_venta || ''}
                    onChange={(e) => setMuebleAEditar({ ...muebleAEditar, precio_venta: e.target.value })}
                  />
                </div>
                <div className="field-group">
                  <label className="field-label">Alquiler (€/día):</label>
                  <input
                    type="number"
                    value={muebleAEditar.precio_alquiler ?? muebleAEditar.precio_alquiler_dia ?? ''}
                    onChange={(e) => setMuebleAEditar({ ...muebleAEditar, precio_alquiler: e.target.value })}
                  />
                </div>
              </div>

              <div className="field-group">
                <label className="field-label">Estado:</label>
                <select
                  value={muebleAEditar.estado || 'disponible'}
                  onChange={(e) => setMuebleAEditar({ ...muebleAEditar, estado: e.target.value })}
                >
                  <option value="disponible">Disponible</option>
                  <option value="vendido">Vendido</option>
                  <option value="alquilado">Alquilado</option>
                </select>
              </div>

              {muebleAEditar.imagenes && muebleAEditar.imagenes.length > 0 && (
                <div className="field-group">
                  <label className="field-label">Imágenes actuales (clic en ✕ para eliminar):</label>
                  <div className="image-thumb-grid">
                    {muebleAEditar.imagenes.map((imgUrl, idx) => (
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
                                const updatedImgs = muebleAEditar.imagenes.filter((_, i) => i !== idx);
                                setMuebleAEditar({ ...muebleAEditar, imagenes: updatedImgs });
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
                  onChange={(e) => setEditMuebleFiles(Array.from(e.target.files))}
                />
              </div>

              <button type="submit" className="admin-btn" disabled={status.includes('Actualizando')}>
                Guardar Cambios
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE EDICIÓN CATEGORÍA */}
      {categoriaAEditar && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content">
            <div className="admin-modal-header">
              <h3>Editar Categoría</h3>
              <button className="admin-modal-close" onClick={() => setCategoriaAEditar(null)} aria-label="Cerrar"><Icon name="close" /></button>
            </div>
            <form onSubmit={handleUpdateCategoriaSubmit} className="admin-form">
              <div className="field-group">
                <label className="field-label">Nombre de la Categoría:</label>
                <input
                  type="text"
                  value={categoriaAEditar.nombre || ''}
                  onChange={(e) => setCategoriaAEditar({ ...categoriaAEditar, nombre: e.target.value })}
                  required
                />
              </div>

              <div className="field-group">
                <label className="field-label">Categoría general (opcional):</label>
                <select
                  value={categoriaAEditar.categoria_padre_id || ''}
                  onChange={(e) => setCategoriaAEditar({ ...categoriaAEditar, categoria_padre_id: e.target.value ? parseInt(e.target.value, 10) : null })}
                >
                  <option value="">— Es una categoría general —</option>
                  {generales(categorias).filter(c => c.id !== categoriaAEditar.id).map(general => (
                    <option key={general.id} value={general.id}>Dentro de: {general.nombre}</option>
                  ))}
                </select>
              </div>

              {categoriaAEditar.imagen_url && (
                <div className="field-group">
                  <label className="field-label">Imagen actual (clic en ✕ para eliminar):</label>
                  <div className="image-thumb" style={{ width: '100px', height: '100px' }}>
                    <img src={categoriaAEditar.imagen_url} alt="Categoría" loading="lazy" decoding="async" />
                    <button
                      type="button"
                      className="image-thumb-remove"
                      onClick={() => {
                        confirmarBorrado(
                          'Eliminar Imagen de Categoría',
                          '¿Estás seguro de que deseas eliminar la imagen representativa de esta categoría?',
                          () => {
                            setCategoriaAEditar({ ...categoriaAEditar, imagen_url: '' });
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
                  onChange={(e) => setEditCategoriaFile(e.target.files[0])}
                />
              </div>

              <button type="submit" className="admin-btn" disabled={status.includes('Actualizando')}>
                Guardar Cambios
              </button>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={confirmConfig.onConfirm}
        onCancel={cerrarConfirmacion}
      />
    </div>
  );
};

export default Admin;
