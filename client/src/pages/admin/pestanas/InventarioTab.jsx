import { useContext } from 'react';
import { ToastContext } from '../../../context/ToastContext';
import { updateMueble, deleteMueble } from '../../../services/api';
import { formatPrice } from '../../../utils/format';
import { PLACEHOLDER_IMG } from '../../../utils/images';
import Icon from '../Icon';

// Pestaña "Gestionar Inventario". El estado de la vista (búsqueda, filtros, orden, página,
// selección) llega en `vista` desde el contenedor (useInventarioVista), para que se conserve al
// cambiar de pestaña.
// Ojo (H12): los borrados y el cambio de estado en lote avisan de éxito sin mirar la respuesta.
// Se conserva a propósito en el refactor; se corrige en su propio commit.
const InventarioTab = ({ vista, muebles, categorias, recargarMuebles, confirmarBorrado, abrirEditorMueble }) => {
  const { showToast } = useContext(ToastContext);
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
    limpiarFiltros
  } = vista;
  const totalMuebles = muebles.length;

  const handleDeleteMueble = (id) => {
    confirmarBorrado(
      'Eliminar Mueble',
      '¿Estás seguro de que quieres eliminar de forma permanente este mueble del catálogo?',
      async () => {
        await deleteMueble(id);
        showToast('Mueble eliminado con éxito', 'success');
        recargarMuebles();
      }
    );
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
        recargarMuebles();
      }
    );
  };

  const handleBulkEstado = async () => {
    const cantidad = seleccionados.length;
    await Promise.all(seleccionados.map(id => updateMueble(id, { estado: bulkEstado })));
    showToast(`Estado actualizado en ${cantidad} producto${cantidad === 1 ? '' : 's'}`, 'success');
    setSeleccionados([]);
    recargarMuebles();
  };

  return (
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
          <button className="admin-btn-ghost" onClick={limpiarFiltros}>Limpiar filtros</button>
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
                        recargarMuebles();
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
                  <button onClick={() => abrirEditorMueble(m)} className="inv-edit-btn">Editar</button>
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
  );
};

export default InventarioTab;
