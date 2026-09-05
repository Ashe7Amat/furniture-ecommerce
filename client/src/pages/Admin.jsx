import { useState, useContext, useEffect, useMemo } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import { formatPrice } from '../utils/format';
import { PLACEHOLDER_IMG } from '../utils/images';
import {
  createMueble,
  getMuebles,
  updateMueble,
  deleteMueble,
  getCategorias,
  createCategoria,
  updateCategoria,
  deleteCategoria,
  getPedidos,
  actualizarEstadoPedido
} from '../services/api';
import '../styles/Admin.css';

const PAGE_SIZE = 20;

const ICONS = {
  dashboard: <path d="M4 13h6V4H4v9zm0 7h6v-5H4v5zm10 0h6V11h-6v9zm0-16v5h6V4h-6z" />,
  add: <path d="M12 5v14M5 12h14" />,
  inventory: <path d="M3 7l9-4 9 4-9 4-9-4zm0 0v10l9 4 9-4V7M12 11v10" />,
  tag: <path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3.24L4 3a1 1 0 0 0-1 1l.24 5.59a2 2 0 0 0 .58 1.41l9.59 9.59a2 2 0 0 0 2.83 0l4.35-4.35a2 2 0 0 0 0-2.83zM7 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" />,
  box: <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.27 6.96 12 12l8.73-5.04M12 22.08V12" />,
  bell: <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />,
  warning: <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.6-4.6" /></>,
  pencil: <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />,
  trash: <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16z" />,
  close: <path d="M18 6 6 18M6 6l12 12" />,
};

const Icon = ({ name }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    {ICONS[name]}
  </svg>
);

const Admin = () => {
  const { user } = useContext(AuthContext);
  const { showToast } = useContext(ToastContext);

  const [vistaActiva, setVistaActiva] = useState('resumen');

  const [muebles, setMuebles] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [pedidos, setPedidos] = useState([]);
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

  // Inventario: búsqueda, filtros, orden, paginación y selección
  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [orden, setOrden] = useState('recientes');
  const [pagina, setPagina] = useState(1);
  const [seleccionados, setSeleccionados] = useState([]);
  const [bulkEstado, setBulkEstado] = useState('disponible');

  // Configuración del Modal de Confirmación
  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null
  });

  // Solo debe recargarse cuando cambia el usuario (login/logout), no en cada render --
  // las tres funciones se redefinen en cada render pero no son las que queremos vigilar.
  useEffect(() => {
    if (user) {
      cargarCategorias();
      cargarMuebles();
      cargarPedidos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    setPagina(1);
  }, [busqueda, filtroCategoria, filtroEstado, orden]);

  const cargarMuebles = async () => {
    const data = await getMuebles();
    setMuebles(data);
  };

  const cargarPedidos = async () => {
    const data = await getPedidos();
    setPedidos(Array.isArray(data) ? data : []);
  };

  const handleCambiarEstadoPedido = async (id, nuevoEstado) => {
    const res = await actualizarEstadoPedido(id, nuevoEstado);
    if (res) {
      showToast('Estado del pedido actualizado', 'success');
      setPedidos(prev => prev.map(p => (p.id === id ? { ...p, estado: nuevoEstado } : p)));
    } else {
      showToast('Error al actualizar el estado del pedido', 'error');
    }
  };

  const cargarCategorias = async () => {
    const data = await getCategorias();
    setCategorias(data);
    // Un mueble solo puede pertenecer a una categoría específica (con padre), nunca a una general
    const especificas = data.filter(c => c.categoria_padre_id);
    if (especificas.length > 0 && !formData.categoria) {
      setFormData(prev => ({ ...prev, categoria: especificas[0].nombre }));
    }
  };

  const confirmarBorrado = (title, message, action) => {
    setConfirmConfig({
      isOpen: true,
      title,
      message,
      onConfirm: async () => {
        await action();
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
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
      cargarMuebles();
      setVistaActiva('inventario');
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

  // ─── Inventario: filtrado, orden y paginación (memoizados: con 157+ productos no
  // tiene sentido recalcular esto en cada render que no afecte a estos valores) ───
  const muebleFiltrados = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    const muebleCoincide = (m) => {
      const matchTexto = !term || m.nombre?.toLowerCase().includes(term);
      const matchCategoria = !filtroCategoria || m.categoria === filtroCategoria;
      const matchEstado = !filtroEstado || (m.estado || 'disponible') === filtroEstado;
      return matchTexto && matchCategoria && matchEstado;
    };

    return muebles.filter(muebleCoincide).sort((a, b) => {
      if (orden === 'nombre') return (a.nombre || '').localeCompare(b.nombre || '');
      if (orden === 'precio_asc') return (a.precio_venta || 0) - (b.precio_venta || 0);
      if (orden === 'precio_desc') return (b.precio_venta || 0) - (a.precio_venta || 0);
      return 0; // 'recientes' = orden original (más nuevo primero, ya viene así de la API)
    });
  }, [muebles, busqueda, filtroCategoria, filtroEstado, orden]);

  const totalPaginas = Math.max(1, Math.ceil(muebleFiltrados.length / PAGE_SIZE));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const muebleVisibles = muebleFiltrados.slice((paginaSegura - 1) * PAGE_SIZE, paginaSegura * PAGE_SIZE);

  const idsVisiblesSeleccionados = muebleVisibles.filter(m => seleccionados.includes(m.id));
  const todosVisiblesSeleccionados = muebleVisibles.length > 0 && idsVisiblesSeleccionados.length === muebleVisibles.length;

  const toggleSeleccionado = (id) => {
    setSeleccionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSeleccionarPagina = () => {
    if (todosVisiblesSeleccionados) {
      setSeleccionados(prev => prev.filter(id => !muebleVisibles.some(m => m.id === id)));
    } else {
      setSeleccionados(prev => [...new Set([...prev, ...muebleVisibles.map(m => m.id)])]);
    }
  };

  const limpiarFiltrosInventario = () => {
    setBusqueda('');
    setFiltroCategoria('');
    setFiltroEstado('');
    setOrden('recientes');
  };

  const handleBulkDelete = () => {
    const cantidad = seleccionados.length;
    confirmarBorrado(
      'Eliminar productos seleccionados',
      `¿Seguro que querés eliminar ${cantidad} producto${cantidad === 1 ? '' : 's'} de forma permanente?`,
      async () => {
        await Promise.all(seleccionados.map(id => deleteMueble(id)));
        showToast(`${cantidad} producto${cantidad === 1 ? '' : 's'} eliminado${cantidad === 1 ? '' : 's'}`, 'success');
        setSeleccionados([]);
        cargarMuebles();
      }
    );
  };

  const handleBulkEstado = async () => {
    const cantidad = seleccionados.length;
    await Promise.all(seleccionados.map(id => updateMueble(id, { estado: bulkEstado })));
    showToast(`Estado actualizado en ${cantidad} producto${cantidad === 1 ? '' : 's'}`, 'success');
    setSeleccionados([]);
    cargarMuebles();
  };

  if (!user) {
    return <div className="admin-msg">Acceso denegado. Inicia sesión primero.</div>;
  }

  // Cálculos para el resumen
  const totalMuebles = muebles.length;
  const disponibles = muebles.filter(m => m.estado === 'disponible' || !m.estado);
  const vendidos = muebles.filter(m => m.estado === 'vendido').length;
  const alquilados = muebles.filter(m => m.estado === 'alquilado').length;
  const valorDisponible = disponibles.reduce((acc, m) => acc + (Number(m.precio_venta) || 0), 0);
  const sinImagen = muebles.filter(m => !m.imagenes || m.imagenes.length === 0).length;
  const sinCategoria = muebles.filter(m => !m.categoria).length;

  // Cálculos para pedidos
  const pedidosPendientes = pedidos.filter(p => p.estado === 'procesando').length;
  const pedidosFiltrados = filtroEstadoPedido ? pedidos.filter(p => p.estado === filtroEstadoPedido) : pedidos;
  const ESTADOS_PEDIDO = ['procesando', 'enviado', 'entregado', 'cancelado'];
  const ETIQUETA_ESTADO_PEDIDO = { procesando: 'Procesando', enviado: 'Enviado', entregado: 'Entregado', cancelado: 'Cancelado' };

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <h3 className="sidebar-title">Gestión</h3>
        <nav className="sidebar-menu">
          <button className={`sidebar-btn ${vistaActiva === 'resumen' ? 'active' : ''}`} onClick={() => setVistaActiva('resumen')}>
            <Icon name="dashboard" /> Resumen
          </button>
          <button className={`sidebar-btn ${vistaActiva === 'crear' ? 'active' : ''}`} onClick={() => setVistaActiva('crear')}>
            <Icon name="add" /> Añadir Mueble
          </button>
          <button className={`sidebar-btn ${vistaActiva === 'inventario' ? 'active' : ''}`} onClick={() => setVistaActiva('inventario')}>
            <Icon name="inventory" /> Gestionar Inventario
          </button>
          <button className={`sidebar-btn ${vistaActiva === 'pedidos' ? 'active' : ''}`} onClick={() => setVistaActiva('pedidos')}>
            <Icon name="box" /> Pedidos
            {pedidosPendientes > 0 && <span className="sidebar-badge">{pedidosPendientes}</span>}
          </button>
          <button className={`sidebar-btn ${vistaActiva === 'categorias' ? 'active' : ''}`} onClick={() => setVistaActiva('categorias')}>
            <Icon name="tag" /> Gestionar Categorías
          </button>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="admin-content">

        {vistaActiva === 'resumen' && (
          <div className="admin-view fade-in">
            <div className="admin-view-head">
              <h2>Dashboard</h2>
            </div>
            <div className="resumen-cards">
              <div className="resumen-card accent-brand">
                <h3>{totalMuebles}</h3>
                <p>Total Catálogo</p>
              </div>
              <div className="resumen-card accent-success">
                <h3>{disponibles.length}</h3>
                <p>Disponibles</p>
              </div>
              <div className="resumen-card accent-danger">
                <h3>{vendidos}</h3>
                <p>Vendidos</p>
              </div>
              <div className="resumen-card accent-warning">
                <h3>{alquilados}</h3>
                <p>Alquilados</p>
              </div>
              <div className="resumen-card">
                <h3>{formatPrice(valorDisponible)} €</h3>
                <p>Valor en stock</p>
              </div>
              <div className="resumen-card accent-warning">
                <h3>{pedidosPendientes}</h3>
                <p>Pedidos por procesar</p>
              </div>
            </div>

            {(sinImagen > 0 || sinCategoria > 0) && (
              <div className="admin-alerts">
                {sinImagen > 0 && (
                  <div className="admin-alert">
                    <Icon name="warning" />
                    {sinImagen} producto{sinImagen === 1 ? '' : 's'} sin ninguna foto cargada
                    <button onClick={() => setVistaActiva('inventario')}>Ver inventario</button>
                  </div>
                )}
                {sinCategoria > 0 && (
                  <div className="admin-alert">
                    <Icon name="warning" />
                    {sinCategoria} producto{sinCategoria === 1 ? '' : 's'} sin categoría asignada
                    <button onClick={() => setVistaActiva('inventario')}>Ver inventario</button>
                  </div>
                )}
              </div>
            )}

            <div style={{ marginTop: '40px' }}>
              <h3 className="admin-section-title"><Icon name="bell" /> Avisos / Últimas Ventas</h3>
              {muebles.filter(m => m.estado === 'vendido' || m.estado === 'alquilado').length === 0 ? (
                <p className="admin-empty-note">No se han registrado transacciones aún.</p>
              ) : (
                <div className="sales-list">
                  {muebles.filter(m => m.estado === 'vendido' || m.estado === 'alquilado').map(m => (
                    <div key={m.id} className="sale-row">
                      <div className="sale-row-info">
                        <div className="sale-thumb">
                          <img src={m.imagenes?.[0] || PLACEHOLDER_IMG} alt={m.nombre} loading="lazy" decoding="async" />
                        </div>
                        <div>
                          <h4 className="sale-name">{m.nombre}</h4>
                          <span className="sale-cat">{m.categoria}</span>
                        </div>
                      </div>
                      <div className="sale-row-meta">
                        <span className={`status-pill ${m.estado}`}>{m.estado}</span>
                        <p className="sale-price">
                          {m.precio_venta ? `${formatPrice(m.precio_venta)} €` : `${formatPrice(m.precio_alquiler_dia)} €/día`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {vistaActiva === 'crear' && (
          <div className="admin-view fade-in">
            <div className="admin-view-head"><h2>Añadir Nuevo Producto</h2></div>
            <form onSubmit={handleSubmit} className="admin-form">
              <input name="nombre" placeholder="Nombre del mueble" value={formData.nombre} onChange={handleInputChange} required />
              <select name="categoria" value={formData.categoria} onChange={handleInputChange} required>
                <option value="">Selecciona una categoría</option>
                {categorias.filter(c => !c.categoria_padre_id).map(general => (
                  <optgroup key={general.id} label={general.nombre}>
                    {categorias.filter(esp => esp.categoria_padre_id === general.id).map(esp => (
                      <option key={esp.id} value={esp.nombre}>{esp.nombre}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
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
        )}

        {vistaActiva === 'inventario' && (
          <div className="admin-view fade-in">
            <div className="admin-view-head">
              <h2>Gestionar Inventario</h2>
              <p>{muebleFiltrados.length} de {totalMuebles} productos</p>
            </div>

            <div className="admin-toolbar">
              <div className="admin-search">
                <Icon name="search" />
                <input
                  type="text"
                  placeholder="Buscar por nombre..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </div>
              <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
                <option value="">Todas las categorías</option>
                {categorias.map(cat => (
                  <option key={cat.id} value={cat.nombre}>{cat.nombre}</option>
                ))}
              </select>
              <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
                <option value="">Todos los estados</option>
                <option value="disponible">Disponible</option>
                <option value="vendido">Vendido</option>
                <option value="alquilado">Alquilado</option>
              </select>
              <select value={orden} onChange={(e) => setOrden(e.target.value)}>
                <option value="recientes">Más recientes</option>
                <option value="nombre">Nombre A-Z</option>
                <option value="precio_asc">Precio: menor a mayor</option>
                <option value="precio_desc">Precio: mayor a menor</option>
              </select>
              {(busqueda || filtroCategoria || filtroEstado || orden !== 'recientes') && (
                <button className="admin-btn-ghost" onClick={limpiarFiltrosInventario}>Limpiar filtros</button>
              )}
            </div>

            {seleccionados.length > 0 && (
              <div className="bulk-bar">
                <strong>{seleccionados.length} seleccionado{seleccionados.length === 1 ? '' : 's'}</strong>
                <div className="bulk-actions">
                  <select value={bulkEstado} onChange={(e) => setBulkEstado(e.target.value)}>
                    <option value="disponible">Marcar disponible</option>
                    <option value="vendido">Marcar vendido</option>
                    <option value="alquilado">Marcar alquilado</option>
                  </select>
                  <button className="admin-btn-ghost" onClick={handleBulkEstado}>Aplicar estado</button>
                  <button className="admin-btn-danger-ghost" onClick={handleBulkDelete}>Eliminar seleccionados</button>
                  <button className="admin-btn-ghost" onClick={() => setSeleccionados([])}>Cancelar</button>
                </div>
              </div>
            )}

            <div className="admin-inventory-manager">
              {muebleFiltrados.length === 0 ? (
                <p className="inventory-empty">No hay productos que coincidan con estos filtros.</p>
              ) : (
                <div className="inventory-table">
                  <div className="inventory-head-row">
                    <input type="checkbox" className="inv-checkbox" checked={todosVisiblesSeleccionados} onChange={toggleSeleccionarPagina} aria-label="Seleccionar todos" />
                    <span></span>
                    <span>Nombre</span>
                    <span className="inv-category">Categoría</span>
                    <span>Estado</span>
                    <span className="inv-price">Precio</span>
                    <span>Acciones</span>
                  </div>
                  {muebleVisibles.map(m => (
                    <div key={m.id} className={`inventory-list-item ${seleccionados.includes(m.id) ? 'is-selected' : ''}`}>
                      <input
                        type="checkbox"
                        className="inv-checkbox"
                        checked={seleccionados.includes(m.id)}
                        onChange={() => toggleSeleccionado(m.id)}
                        aria-label={`Seleccionar ${m.nombre}`}
                      />
                      <div className="inv-thumb">
                        <img src={m.imagenes?.[0] || PLACEHOLDER_IMG} alt={m.nombre} loading="lazy" decoding="async" />
                      </div>
                      <span className="inv-name">{m.nombre}</span>
                      <span className="inv-category">{m.categoria || '—'}</span>
                      <span>
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
                        >
                          <option value="disponible">Disponible</option>
                          <option value="vendido">Vendido</option>
                          <option value="alquilado">Alquilado</option>
                        </select>
                      </span>
                      <span className="inv-price">
                        {m.precio_venta ? `${formatPrice(m.precio_venta)}€` : (m.precio_alquiler_dia ? `${formatPrice(m.precio_alquiler_dia)}€/día` : '—')}
                      </span>
                      <div className="inv-actions">
                        <button onClick={() => setMuebleAEditar(m)} className="inv-edit-btn">Editar</button>
                        <button onClick={() => handleDeleteMueble(m.id)} className="inv-del-btn">Eliminar</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {totalPaginas > 1 && (
              <div className="admin-pagination">
                <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={paginaSegura === 1}>← Anterior</button>
                <span>Página {paginaSegura} de {totalPaginas}</span>
                <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={paginaSegura === totalPaginas}>Siguiente →</button>
              </div>
            )}
          </div>
        )}

        {vistaActiva === 'pedidos' && (
          <div className="admin-view fade-in">
            <div className="admin-view-head">
              <h2>Pedidos</h2>
              <p>{pedidosFiltrados.length} de {pedidos.length} pedidos</p>
            </div>

            <div className="admin-toolbar">
              <select value={filtroEstadoPedido} onChange={(e) => setFiltroEstadoPedido(e.target.value)}>
                <option value="">Todos los estados</option>
                {ESTADOS_PEDIDO.map(estado => (
                  <option key={estado} value={estado}>{ETIQUETA_ESTADO_PEDIDO[estado]}</option>
                ))}
              </select>
              <button className="admin-btn-ghost" onClick={cargarPedidos}>Actualizar</button>
            </div>

            {pedidosFiltrados.length === 0 ? (
              <p className="admin-empty-note">
                {pedidos.length === 0
                  ? 'Todavía no se ha registrado ningún pedido.'
                  : 'No hay pedidos que coincidan con este filtro.'}
              </p>
            ) : (
              <div className="pedidos-list">
                {pedidosFiltrados.map(pedido => {
                  const cliente = pedido.cliente_info || {};
                  const items = Array.isArray(pedido.items) ? pedido.items : [];
                  const fecha = pedido.created_at
                    ? new Date(pedido.created_at).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
                    : '—';

                  return (
                    <div key={pedido.id} className="pedido-card">
                      <div className="pedido-card-header">
                        <div>
                          <span className="pedido-fecha">{fecha}</span>
                          <span className="pedido-id">Ref. {pedido.id.slice(0, 8).toUpperCase()}</span>
                        </div>
                        <select
                          value={pedido.estado}
                          onChange={(e) => handleCambiarEstadoPedido(pedido.id, e.target.value)}
                          className={`pedido-estado-select estado-${pedido.estado}`}
                        >
                          {ESTADOS_PEDIDO.map(estado => (
                            <option key={estado} value={estado}>{ETIQUETA_ESTADO_PEDIDO[estado]}</option>
                          ))}
                        </select>
                      </div>

                      <div className="pedido-card-body">
                        <div className="pedido-cliente">
                          <h4>Cliente</h4>
                          <p><strong>{cliente.nombre || 'Sin nombre'}</strong></p>
                          {cliente.email && <p><a href={`mailto:${cliente.email}`}>{cliente.email}</a></p>}
                          {cliente.telefono && <p><a href={`tel:${cliente.telefono}`}>{cliente.telefono}</a></p>}
                          <p className="pedido-direccion">{pedido.direccion_envio || cliente.direccion || 'Sin dirección de envío'}</p>
                          {cliente.notas && cliente.notas !== 'Ninguna' && (
                            <p className="pedido-notas"><strong>Notas:</strong> {cliente.notas}</p>
                          )}
                        </div>

                        <div className="pedido-items">
                          <h4>Productos</h4>
                          <ul>
                            {items.map((item, idx) => (
                              <li key={idx}>
                                <span>{item.nombre}{item.modalidad === 'alquiler' ? ' (alquiler/día)' : ''}</span>
                                <span>{item.cantidad || 1} x {formatPrice(item.precio)} €</span>
                              </li>
                            ))}
                          </ul>
                          <div className="pedido-total">Total: <strong>{formatPrice(pedido.total)} €</strong></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {vistaActiva === 'categorias' && (
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
                    {categorias.filter(c => !c.categoria_padre_id).map(general => (
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

              {categorias.filter(c => !c.categoria_padre_id).map(general => (
                <div key={general.id} className="cat-group">
                  <h3 className="cat-group-title">{general.nombre}</h3>
                  <div className="cat-grid">
                    {[general, ...categorias.filter(esp => esp.categoria_padre_id === general.id)].map(cat => (
                      <div key={cat.id} className={`cat-card${cat.id === general.id ? ' cat-card--general' : ''}`}>
                        <div className="cat-card-header">
                          <h3>{cat.nombre}{cat.id === general.id && ' (general)'}</h3>
                          <div className="cat-card-actions">
                            <button onClick={() => setCategoriaAEditar(cat)} className="cat-card-edit-btn" aria-label="Editar">
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
                <select
                  value={muebleAEditar.categoria || ''}
                  onChange={(e) => setMuebleAEditar({ ...muebleAEditar, categoria: e.target.value })}
                  required
                >
                  <option value="">Selecciona una categoría</option>
                  {categorias.filter(c => !c.categoria_padre_id).map(general => (
                    <optgroup key={general.id} label={general.nombre}>
                      {categorias.filter(esp => esp.categoria_padre_id === general.id).map(esp => (
                        <option key={esp.id} value={esp.nombre}>{esp.nombre}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
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
                  {categorias.filter(c => !c.categoria_padre_id && c.id !== categoriaAEditar.id).map(general => (
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
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default Admin;
