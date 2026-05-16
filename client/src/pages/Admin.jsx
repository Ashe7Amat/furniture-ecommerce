import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import { supabase } from '../utils/supabaseClient';
import { createMueble, getMuebles, deleteMueble, getCategorias, createCategoria, deleteCategoria } from '../services/api';
import '../styles/Admin.css';

const Admin = () => {
  const { user } = useContext(AuthContext);
  const { showToast } = useContext(ToastContext);
  
  const [vistaActiva, setVistaActiva] = useState('resumen');
  
  const [muebles, setMuebles] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [nuevaCat, setNuevaCat] = useState('');
  
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
    await createCategoria({ nombre: nuevaCat });
    showToast('Categoría creada correctamente', 'success');
    setNuevaCat('');
    cargarCategorias();
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
    setStatus('Subiendo imágenes...');
    
    let uploadedUrls = [];

    for (const file of files) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `muebles/${fileName}`;

      const { data, error } = await supabase.storage
        .from('imagenes')
        .upload(filePath, file);

      if (error) {
        setStatus(`Error al subir imágenes: ${error.message}`);
        showToast('Error al subir imágenes', 'error');
        return;
      }

      const { data: publicData } = supabase.storage
        .from('imagenes')
        .getPublicUrl(filePath);

      uploadedUrls.push(publicData.publicUrl);
    }

    setStatus('Guardando producto...');

    const newMueble = {
      ...formData,
      precio_venta: formData.precio_venta ? parseFloat(formData.precio_venta) : null,
      precio_alquiler: formData.precio_alquiler ? parseFloat(formData.precio_alquiler) : null,
      imagenes: uploadedUrls
    };

    const res = await createMueble(newMueble);
    if (res) {
      setStatus('');
      showToast('Producto añadido con éxito al catálogo', 'success');
      setFormData({ nombre: '', categoria: '', descripcion: '', precio_venta: '', precio_alquiler: '', estado: 'disponible' });
      setFiles([]);
      cargarMuebles(); // Refresh inventory
      setVistaActiva('inventario'); // Jump to inventory to see it
    } else {
      setStatus('Error al guardar en base de datos.');
      showToast('Error al guardar producto', 'error');
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
                <input type="file" multiple accept="image/*" onChange={handleFileChange} />
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
                        {m.estado === 'vendido' ? '🔴 Vendido' : m.estado === 'alquilado' ? '🟡 Alquilado' : '🟢 Disponible'}
                      </span>
                      <span className="inv-price">{m.precio_venta ? `${m.precio_venta}€` : `${m.precio_alquiler}€/día`}</span>
                      <button onClick={() => handleDeleteMueble(m.id)} className="inv-del-btn">Eliminar</button>
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
                />
                <button type="submit" className="admin-btn">Crear Categoría</button>
              </form>
              
              <div className="cat-grid">
                {categorias.map(cat => (
                  <div key={cat.id} className="cat-card">
                    <div className="cat-card-header">
                      <h3>{cat.nombre}</h3>
                      <button onClick={() => handleDeleteCategoria(cat.id)} className="cat-card-del-btn" aria-label="Eliminar">🗑️</button>
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
