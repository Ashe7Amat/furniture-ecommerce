import { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import { formatPrice } from '../utils/format';
import { PLACEHOLDER_IMG } from '../utils/images';
import {
  updateMueble,
  deleteMueble,
  createCategoria,
  updateCategoria,
  deleteCategoria,
  actualizarEstadoPedido
} from '../services/api';
import '../styles/Admin.css';
import Icon from './admin/Icon';
import SelectorCategoria from './admin/SelectorCategoria';
import { generales, especificasDe, idDeCategoria, primeraEspecifica } from './admin/categorias';
import useAdminDatos from './admin/hooks/useAdminDatos';
import useInventarioVista from './admin/hooks/useInventarioVista';
import useConfirmacion from './admin/hooks/useConfirmacion';
import ResumenTab from './admin/pestanas/ResumenTab';
import CrearMuebleTab from './admin/pestanas/CrearMuebleTab';

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
  const {
    busqueda, setBusqueda,
    filtroCategoria, setFiltroCategoria,
    filtroEstado, setFiltroEstado,
    orden, setOrden,
    setPagina,
    seleccionados, setSeleccionados,
    bulkEstado, setBulkEstado,
    muebleFiltrados, muebleVisibles,
    totalPaginas, paginaSegura,
    todosVisiblesSeleccionados,
    toggleSeleccionado, toggleSeleccionarPagina,
    limpiarFiltros: limpiarFiltrosInventario
  } = vista;

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

  const handleCambiarEstadoPedido = async (id, nuevoEstado) => {
    const res = await actualizarEstadoPedido(id, nuevoEstado);
    if (res) {
      showToast('Estado del pedido actualizado', 'success');
      setPedidos(prev => prev.map(p => (p.id === id ? { ...p, estado: nuevoEstado } : p)));
    } else {
      showToast('Error al actualizar el estado del pedido', 'error');
    }
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

  const handleBulkDelete = () => {
    const cantidad = seleccionados.length;
    confirmarBorrado(
      'Eliminar productos seleccionados',
      `¿Seguro que quieres eliminar ${cantidad} producto${cantidad === 1 ? '' : 's'} de forma permanente?`,
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

  const totalMuebles = muebles.length;

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
