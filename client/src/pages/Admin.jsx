import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import { 
  createMueble, 
  getMuebles, 
  updateMueble, 
  deleteMueble, 
  getCategorias, 
  createCategoria, 
  updateCategoria, 
  deleteCategoria 
} from '../services/api';
import '../styles/Admin.css';

const Admin = () => {
  const { user } = useContext(AuthContext);
  const { showToast } = useContext(ToastContext);
  
  const [vistaActiva, setVistaActiva] = useState('resumen');
  
  const [muebles, setMuebles] = useState([]);
  const [categorias, setCategorias] = useState([]);
  
  // Estados para creación de categorías
  const [nuevaCat, setNuevaCat] = useState('');
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

  // Configuración del Modal de Confirmación
  const [confirmConfig, setConfirmConfig] = useState({ 
    isOpen: false, 
    title: '', 
    message: '', 
    onConfirm: null 
  });

  useEffect(() => {
    if (user) {
      cargarCategorias();
      cargarMuebles();
    }
  }, [user]);

  const cargarMuebles = async () => {
    const data = await getMuebles();
    setMuebles(data);
  };

  const cargarCategorias = async () => {
    const data = await getCategorias();
    setCategorias(data);
    if (data.length > 0 && !formData.categoria) {
      setFormData(prev => ({ ...prev, categoria: data[0].nombre }));
    }
  };

  const confirmarBorrado = (title, message, action) => {
    setConfirmConfig({
      isOpen: true,
      title,
      message,
      onConfirm: async () => {
        await action();
        setConfirmConfig({ ...confirmConfig, isOpen: false });
      }
    });
  };

  const handleDeleteMueble = (id) => {
    confirmarBorrado(
      'Eliminar Mueble',
      '¿Estás seguro de que quieres eliminar de forma permanente este mueble del catálogo?',
      async () => {
        await deleteMueble(id);
        showToast('Mueble eliminado con éxito', 'success');
        cargarMuebles();
      }
    );
  };

  const handleAddCategoria = async (e) => {
    e.preventDefault();
    if (!nuevaCat) return;

    setStatus('Creando categoría...');
    const formDataToSend = new FormData();
    formDataToSend.append('nombre', nuevaCat);
    if (categoriaFile) {
      formDataToSend.append('imagen', categoriaFile);
    }

    const res = await createCategoria(formDataToSend);
    if (res) {
      showToast('Categoría creada correctamente', 'success');
      setNuevaCat('');
      setCategoriaFile(null);
      const fileInput = document.getElementById('categoria-file-input');
      if (fileInput) fileInput.value = '';
      cargarCategorias();
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
        cargarCategorias();
      }
    );
  };

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
      cargarMuebles(); // Refresh inventory
      setVistaActiva('inventario'); // Jump to inventory to see it
    } else {
      setStatus('Error al guardar en base de datos.');
      showToast('Error al guardar producto', 'error');
    }
  };

  const handleUpdateMuebleSubmit = async (e) => {
    e.preventDefault();
    if (!muebleAEditar) return;
    setStatus('Actualizando producto...');

    const formDataToSend = new FormData();
    formDataToSend.append('nombre', muebleAEditar.nombre || '');
    formDataToSend.append('categoria', muebleAEditar.categoria || '');
    formDataToSend.append('descripcion', muebleAEditar.descripcion || '');
    formDataToSend.append('precio_venta', muebleAEditar.precio_venta || '');
    formDataToSend.append('precio_alquiler', muebleAEditar.precio_alquiler || '');
    formDataToSend.append('estado', muebleAEditar.estado || 'disponible');

    // Siempre enviamos las imágenes existentes que persisten tras las eliminaciones individuales
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

  // Cálculos para el resumen
  const totalMuebles = muebles.length;
  const disponibles = muebles.filter(m => m.estado === 'disponible' || !m.estado).length;
  const vendidos = muebles.filter(m => m.estado === 'vendido').length;
  const alquilados = muebles.filter(m => m.estado === 'alquilado').length;

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <h3 className="sidebar-title">Gestión</h3>
        <nav className="sidebar-menu">
          <button 
            className={`sidebar-btn ${vistaActiva === 'resumen' ? 'active' : ''}`} 
            onClick={() => setVistaActiva('resumen')}
          >
            <span style={{width: '24px'}}>📊</span> Resumen
          </button>
          <button 
            className={`sidebar-btn ${vistaActiva === 'crear' ? 'active' : ''}`} 
            onClick={() => setVistaActiva('crear')}
          >
            <span style={{width: '24px'}}>➕</span> Añadir Mueble
          </button>
          <button 
            className={`sidebar-btn ${vistaActiva === 'inventario' ? 'active' : ''}`} 
            onClick={() => setVistaActiva('inventario')}
          >
            <span style={{width: '24px'}}>📦</span> Gestionar Inventario
          </button>
          <button 
            className={`sidebar-btn ${vistaActiva === 'categorias' ? 'active' : ''}`} 
            onClick={() => setVistaActiva('categorias')}
          >
            <span style={{width: '24px'}}>🏷️</span> Gestionar Categorías
          </button>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="admin-content">
        
        {vistaActiva === 'resumen' && (
          <div className="admin-view fade-in">
            <h2>Dashboard</h2>
            <div className="resumen-cards">
              <div className="resumen-card">
                <h3>{totalMuebles}</h3>
                <p>Total Catálogo</p>
              </div>
              <div className="resumen-card">
                <h3>{disponibles}</h3>
                <p>Disponibles</p>
              </div>
              <div className="resumen-card">
                <h3>{vendidos}</h3>
                <p>Vendidos</p>
              </div>
              <div className="resumen-card">
                <h3>{alquilados}</h3>
                <p>Alquilados</p>
              </div>
            </div>
          </div>
        )}

        {vistaActiva === 'crear' && (
          <div className="admin-view fade-in">
            <h2>Añadir Nuevo Producto</h2>
            <form onSubmit={handleSubmit} className="admin-form">
              <input name="nombre" placeholder="Nombre del mueble" value={formData.nombre} onChange={handleInputChange} required />
              <select name="categoria" value={formData.categoria} onChange={handleInputChange} required>
                <option value="">Selecciona una categoría</option>
                {categorias.map(cat => (
                  <option key={cat.id} value={cat.nombre}>{cat.nombre}</option>
                ))}
              </select>
              <textarea name="descripcion" placeholder="Descripción detallada" value={formData.descripcion} onChange={handleInputChange} required />
              <div style={{display: 'flex', gap: '20px'}}>
                <input name="precio_venta" type="number" placeholder="Precio Venta (€)" value={formData.precio_venta} onChange={handleInputChange} style={{flex: 1}} />
                <input name="precio_alquiler" type="number" placeholder="Precio Alquiler (€/día)" value={formData.precio_alquiler} onChange={handleInputChange} style={{flex: 1}} />
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
        )}

        {vistaActiva === 'inventario' && (
          <div className="admin-view fade-in">
            <h2>Gestionar Inventario</h2>
            <div className="admin-inventory-manager">
              {muebles.length === 0 ? <p>No hay muebles en el inventario.</p> : (
                <ul className="inventory-list">
                  {muebles.map(m => (
                    <li key={m.id} className="inventory-list-item">
                      <span className="inv-name">{m.nombre}</span>
                      <span className="inv-category">{m.categoria}</span>
                      <span className="inv-state">
                        <select 
                          value={m.estado || 'disponible'} 
                          onChange={async (e) => {
                            const nuevoEstado = e.target.value;
                            const res = await updateMueble(m.id, { estado: nuevoEstado });
                            if (res) {
                              showToast('Estado actualizado', 'success');
                              cargarMuebles();
                            } else {
                              showToast('Error al cambiar estado', 'error');
                            }
                          }}
                          className="inv-status-select"
                          style={{
                            padding: '6px 12px',
                            border: '1px solid #E2DCD0',
                            borderRadius: '4px',
                            backgroundColor: '#FCFAF8',
                            color: '#3E322A',
                            fontFamily: 'inherit',
                            cursor: 'pointer',
                            outline: 'none'
                          }}
                        >
                          <option value="disponible">🟢 Disponible</option>
                          <option value="vendido">🔴 Vendido</option>
                          <option value="alquilado">🟡 Alquilado</option>
                        </select>
                      </span>
                      <span className="inv-price">{m.precio_venta ? `${m.precio_venta}€` : `${m.precio_alquiler}€/día`}</span>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={() => setMuebleAEditar(m)} className="inv-edit-btn" style={{
                          backgroundColor: 'transparent',
                          border: '1px solid #E2DCD0',
                          color: '#857468',
                          padding: '8px 16px',
                          borderRadius: '4px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}>Editar</button>
                        <button onClick={() => handleDeleteMueble(m.id)} className="inv-del-btn">Eliminar</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {vistaActiva === 'categorias' && (
          <div className="admin-view fade-in">
            <h2>Gestionar Categorías</h2>
            <div className="admin-cat-manager">
              <form onSubmit={handleAddCategoria} className="cat-add-form">
                <input 
                  type="text" 
                  placeholder="Nueva categoría (Ej: Sofás)" 
                  value={nuevaCat} 
                  onChange={(e) => setNuevaCat(e.target.value)} 
                  required
                />
                <div className="file-input-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontSize: '0.85rem', color: '#857468', fontWeight: 600 }}>Imagen de la Categoría:</label>
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
              
              <div className="cat-grid">
                {categorias.map(cat => (
                  <div key={cat.id} className="cat-card">
                    <div className="cat-card-header">
                      <h3>{cat.nombre}</h3>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <button 
                          onClick={() => setCategoriaAEditar(cat)} 
                          className="cat-card-edit-btn" 
                          aria-label="Editar"
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            padding: '0',
                            color: '#857468'
                          }}
                        >
                          ✏️
                        </button>
                        <button onClick={() => handleDeleteCategoria(cat.id)} className="cat-card-del-btn" aria-label="Eliminar">🗑️</button>
                      </div>
                    </div>
                    {cat.stats ? (
                      <div className="cat-card-stats">
                        <p>Productos totales: {cat.stats.totalProductos}</p>
                        <p>Stock: {cat.stats.disponibles} disponibles | {cat.stats.vendidos} vendidos | {cat.stats.alquilados} alquilados</p>
                        <p>Valor del catálogo: {cat.stats.valorTotalVenta}</p>
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
          </div>
        )}

      </main>

      {/* MODAL DE EDICIÓN MUEBLE (CMS CLIENT-PROOF) */}
      {muebleAEditar && (
        <div className="admin-modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(62, 50, 42, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 3000
        }}>
          <div className="admin-modal-content" style={{
            background: '#FCFAF8',
            border: '1px solid #E2DCD0',
            borderRadius: '8px',
            padding: '30px',
            width: '90%',
            maxWidth: '500px',
            boxShadow: '0 10px 35px rgba(62, 50, 42, 0.15)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div className="admin-modal-header" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
              borderBottom: '1px solid #E2DCD0',
              paddingBottom: '12px'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.4rem', color: '#3E322A', fontWeight: 300 }}>Editar Producto</h3>
              <button 
                onClick={() => setMuebleAEditar(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.2rem',
                  color: '#857468',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdateMuebleSubmit} className="admin-form" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: '#857468', fontWeight: 600 }}>Nombre del Mueble:</label>
                <input 
                  type="text" 
                  value={muebleAEditar.nombre || ''} 
                  onChange={(e) => setMuebleAEditar({ ...muebleAEditar, nombre: e.target.value })} 
                  required 
                  style={{ padding: '12px', border: '1px solid #E2DCD0', borderRadius: '4px', backgroundColor: '#FCFAF8', color: '#3E322A' }}
                />
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: '#857468', fontWeight: 600 }}>Categoría:</label>
                <select 
                  value={muebleAEditar.categoria || ''} 
                  onChange={(e) => setMuebleAEditar({ ...muebleAEditar, categoria: e.target.value })} 
                  required
                  style={{ padding: '12px', border: '1px solid #E2DCD0', borderRadius: '4px', backgroundColor: '#FCFAF8', color: '#3E322A' }}
                >
                  <option value="">Selecciona una categoría</option>
                  {categorias.map(cat => (
                    <option key={cat.id} value={cat.nombre}>{cat.nombre}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: '#857468', fontWeight: 600 }}>Descripción:</label>
                <textarea 
                  value={muebleAEditar.descripcion || ''} 
                  onChange={(e) => setMuebleAEditar({ ...muebleAEditar, descripcion: e.target.value })} 
                  required 
                  style={{ padding: '12px', border: '1px solid #E2DCD0', borderRadius: '4px', backgroundColor: '#FCFAF8', color: '#3E322A', minHeight: '100px', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '15px' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', color: '#857468', fontWeight: 600 }}>Venta (€):</label>
                  <input 
                    type="number" 
                    value={muebleAEditar.precio_venta || ''} 
                    onChange={(e) => setMuebleAEditar({ ...muebleAEditar, precio_venta: e.target.value })} 
                    style={{ padding: '12px', border: '1px solid #E2DCD0', borderRadius: '4px', backgroundColor: '#FCFAF8', color: '#3E322A', width: '100%' }}
                  />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', color: '#857468', fontWeight: 600 }}>Alquiler (€/día):</label>
                  <input 
                    type="number" 
                    value={muebleAEditar.precio_alquiler || ''} 
                    onChange={(e) => setMuebleAEditar({ ...muebleAEditar, precio_alquiler: e.target.value })} 
                    style={{ padding: '12px', border: '1px solid #E2DCD0', borderRadius: '4px', backgroundColor: '#FCFAF8', color: '#3E322A', width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: '#857468', fontWeight: 600 }}>Estado:</label>
                <select 
                  value={muebleAEditar.estado || 'disponible'} 
                  onChange={(e) => setMuebleAEditar({ ...muebleAEditar, estado: e.target.value })}
                  style={{ padding: '12px', border: '1px solid #E2DCD0', borderRadius: '4px', backgroundColor: '#FCFAF8', color: '#3E322A' }}
                >
                  <option value="disponible">🟢 Disponible</option>
                  <option value="vendido">🔴 Vendido</option>
                  <option value="alquilado">🟡 Alquilado</option>
                </select>
              </div>

              {muebleAEditar.imagenes && muebleAEditar.imagenes.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.85rem', color: '#857468', fontWeight: 600 }}>Imágenes actuales (Haz clic en ✕ para eliminar):</label>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {muebleAEditar.imagenes.map((imgUrl, idx) => (
                      <div key={idx} style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '4px', overflow: 'hidden', border: '1px solid #E2DCD0' }}>
                        <img src={imgUrl} alt={`Mueble ${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button 
                          type="button" 
                          onClick={() => {
                            confirmarBorrado(
                              'Eliminar Imagen de Producto',
                              '¿Estás seguro de que deseas eliminar esta imagen de este producto? Se quitará de la previsualización actual.',
                              () => {
                                const updatedImgs = muebleAEditar.imagenes.filter((_, i) => i !== idx);
                                setMuebleAEditar({ ...muebleAEditar, ...muebleAEditar, imagenes: updatedImgs });
                              }
                            );
                          }}
                          style={{
                            position: 'absolute',
                            top: '4px',
                            right: '4px',
                            background: 'rgba(62, 50, 42, 0.8)',
                            color: '#FCFAF8',
                            border: 'none',
                            borderRadius: '50%',
                            width: '20px',
                            height: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="file-input-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: '#857468', fontWeight: 600 }}>Añadir más imágenes (Opcional):</label>
                <input 
                  type="file" 
                  multiple 
                  accept="image/*" 
                  onChange={(e) => setEditMuebleFiles(Array.from(e.target.files))} 
                />
              </div>

              <button 
                type="submit" 
                className="admin-btn"
                disabled={status.includes('Actualizando')}
                style={{ marginTop: '10px' }}
              >
                Guardar Cambios
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE EDICIÓN CATEGORÍA (CMS CLIENT-PROOF) */}
      {categoriaAEditar && (
        <div className="admin-modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(62, 50, 42, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 3000
        }}>
          <div className="admin-modal-content" style={{
            background: '#FCFAF8',
            border: '1px solid #E2DCD0',
            borderRadius: '8px',
            padding: '30px',
            width: '90%',
            maxWidth: '500px',
            boxShadow: '0 10px 35px rgba(62, 50, 42, 0.15)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div className="admin-modal-header" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
              borderBottom: '1px solid #E2DCD0',
              paddingBottom: '12px'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.4rem', color: '#3E322A', fontWeight: 300 }}>Editar Categoría</h3>
              <button 
                onClick={() => setCategoriaAEditar(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.2rem',
                  color: '#857468',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdateCategoriaSubmit} className="admin-form" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: '#857468', fontWeight: 600 }}>Nombre de la Categoría:</label>
                <input 
                  type="text" 
                  value={categoriaAEditar.nombre || ''} 
                  onChange={(e) => setCategoriaAEditar({ ...categoriaAEditar, nombre: e.target.value })} 
                  required 
                  style={{ padding: '12px', border: '1px solid #E2DCD0', borderRadius: '4px', backgroundColor: '#FCFAF8', color: '#3E322A' }}
                />
              </div>

              {categoriaAEditar.imagen_url && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.85rem', color: '#857468', fontWeight: 600 }}>Imagen actual (Haz clic en ✕ para eliminar):</label>
                  <div style={{ position: 'relative', width: '100px', height: '100px', borderRadius: '4px', overflow: 'hidden', border: '1px solid #E2DCD0' }}>
                    <img src={categoriaAEditar.imagen_url} alt="Categoría" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button 
                      type="button" 
                      onClick={() => {
                        confirmarBorrado(
                          'Eliminar Imagen de Categoría',
                          '¿Estás seguro de que deseas eliminar la imagen representativa de esta categoría?',
                          () => {
                            setCategoriaAEditar({ ...categoriaAEditar, imagen_url: '' });
                          }
                        );
                      }}
                      style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        background: 'rgba(62, 50, 42, 0.8)',
                        color: '#FCFAF8',
                        border: 'none',
                        borderRadius: '50%',
                        width: '20px',
                        height: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              <div className="file-input-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: '#857468', fontWeight: 600 }}>Reemplazar Imagen (Opcional):</label>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => setEditCategoriaFile(e.target.files[0])} 
                />
              </div>

              <button 
                type="submit" 
                className="admin-btn"
                disabled={status.includes('Actualizando')}
                style={{ marginTop: '10px' }}
              >
                Guardar Cambios
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal de confirmación global para admin */}
      <ConfirmModal 
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
      />
    </div>
  );
};

export default Admin;
