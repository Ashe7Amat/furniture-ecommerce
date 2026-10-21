import { useContext, useState } from 'react';
import { ToastContext } from '../../../context/ToastContext';
import { updateMueble, deleteMueble, exportarCatalogoCsv } from '../../../services/api';
import { descargarArchivo } from '../../../utils/descargarArchivo';
import { PLACEHOLDER_IMG } from '../../../utils/images';
import Icon from '../Icon';
import ImportarCatalogoModal from '../modales/ImportarCatalogoModal';
import AsignarAlquilerModal from '../modales/AsignarAlquilerModal';
import PrecioEditable from '../PrecioEditable';
import { ejecutarLote, textoLoteAMedias } from '../lotes';
import { textoResultadoAlquiler } from '../precios';

// Pestaña "Gestionar Inventario". El estado de la vista (búsqueda, filtros, orden, página,
// selección) llega en `vista` desde el contenedor (useInventarioVista), para que se conserve al
// cambiar de pestaña.
// H12: los borrados y el cambio de estado en lote miran la respuesta. Si algo falla, se avisa con un
// error, solo se recarga si algo cambió, y las piezas que fallaron siguen seleccionadas para
// reintentarlo.
// Los precios de venta y de alquiler se editan en la misma fila (PrecioEditable), y el de alquiler
// se puede poner a varias piezas a la vez (AsignarAlquilerModal).
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
  const [exportando, setExportando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [asignandoAlquiler, setAsignandoAlquiler] = useState(false);

  // El catálogo entero (no solo lo filtrado), con los precios reales, en un CSV para Excel.
  const handleExportar = async () => {
    setExportando(true);
    const resultado = await exportarCatalogoCsv();
    setExportando(false);
    if (!resultado) {
      showToast('No se pudo exportar el catálogo', 'error');
      return;
    }
    descargarArchivo(resultado.blob, resultado.nombreArchivo);
    showToast('Catálogo exportado', 'success');
  };

  const handleDeleteMueble = (id) => {
    confirmarBorrado(
      'Eliminar Mueble',
      '¿Estás seguro de que quieres eliminar de forma permanente este mueble del catálogo?',
      async () => {
        if (!(await deleteMueble(id))) {
          showToast('No se pudo eliminar el mueble', 'error');
          return;
        }
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
        const { hechos, fallidos } = await ejecutarLote(seleccionados, id => deleteMueble(id));
        if (fallidos.length === 0) {
          showToast(`${cantidad} producto${cantidad === 1 ? '' : 's'} eliminado${cantidad === 1 ? '' : 's'}`, 'success');
        } else if (hechos === 0) {
          showToast(cantidad === 1 ? 'No se pudo eliminar el producto' : `No se pudo eliminar ninguno de los ${cantidad} productos`, 'error');
        } else {
          showToast(textoLoteAMedias(hechos, cantidad), 'error');
        }
        setSeleccionados(fallidos);
        if (hechos > 0) recargarMuebles();
      }
    );
  };

  const handleBulkEstado = async () => {
    const cantidad = seleccionados.length;
    const { hechos, fallidos } = await ejecutarLote(seleccionados, id => updateMueble(id, { estado: bulkEstado }));
    if (fallidos.length === 0) {
      showToast(`Estado actualizado en ${cantidad} producto${cantidad === 1 ? '' : 's'}`, 'success');
    } else if (hechos === 0) {
      showToast(cantidad === 1 ? 'No se pudo actualizar el estado' : `No se pudo actualizar el estado de ninguno de los ${cantidad} productos`, 'error');
    } else {
      showToast(textoLoteAMedias(hechos, cantidad), 'error');
    }
    setSeleccionados(fallidos);
    if (hechos > 0) recargarMuebles();
  };

  // Edición rápida de un precio en la fila. `campo` es el del formulario del servidor: precio_venta o
  // precio_alquiler (que se guarda en precio_alquiler_dia). Va como texto, como en el formulario
  // de edición (schemas/muebles.js), y vacío (null) quita el precio.
  const guardarPrecio = async (id, campo, valor) => {
    const res = await updateMueble(id, { [campo]: valor === null ? null : String(valor) });
    if (!res) {
      showToast('Error al guardar', 'error');
      return false;
    }
    showToast('Precio guardado', 'success');
    recargarMuebles();
    return true;
  };
  const avisarPrecioNoValido = (texto) => showToast(texto, 'error');

  // Al acabar "Asignar precio de alquiler": como en las demás acciones en lote, se recarga si algo
  // cambió y las que fallaron siguen seleccionadas.
  const trasAsignarAlquiler = ({ hechos, fallidos, total }) => {
    showToast(textoResultadoAlquiler(hechos, total), fallidos.length === 0 ? 'success' : 'error');
    setSeleccionados(fallidos);
    if (hechos > 0) recargarMuebles();
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
            placeholder="Buscar por nombre o referencia..."
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
          {/* Por referencia (NAV-SIL-002...): orden natural y las piezas sin referencia al final, en
              los dos sentidos. La comparación es la misma que la del catálogo público
              (utils/ordenarPorReferencia.js), y la hace useInventarioVista. */}
          <option value="referencia_asc">Referencia A-Z</option>
          <option value="referencia_desc">Referencia Z-A</option>
          <option value="precio_asc">Precio: menor a mayor</option>
          <option value="precio_desc">Precio: mayor a menor</option>
        </select>
        {(busqueda || filtroCategoria || filtroEstado || orden !== 'recientes') && (
          <button className="admin-btn-ghost" onClick={limpiarFiltros}>Limpiar filtros</button>
        )}
        <div className="admin-toolbar-acciones">
          <button className="admin-btn-ghost" onClick={handleExportar} disabled={exportando}>
            {exportando ? 'Exportando…' : 'Exportar catálogo (CSV)'}
          </button>
          <button className="admin-btn-ghost" onClick={() => setImportando(true)}>
            Importar catálogo (CSV)
          </button>
        </div>
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
            <button className="admin-btn-ghost" onClick={() => setAsignandoAlquiler(true)}>Asignar precio de alquiler</button>
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
              <span className="inv-ref">Referencia</span>
              <span>Nombre</span>
              <span className="inv-category">Categoría</span>
              <span>Estado</span>
              {/* Los dos precios van en la misma columna, uno encima del otro: con dos columnas, en un
                  portátil no quedaba sitio para el nombre. */}
              <span className="inv-price inv-precios"><span>Venta</span><span>Alquiler/día</span></span>
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
                {/* Sin referencia, la celda va vacía (no "—"): la raya ya marca la categoría y el
                    precio que faltan, y Admin.inventario.test.jsx (congelado) las cuenta. */}
                <span className="inv-ref">{m.referencia}</span>
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
                <span className="inv-price inv-precios">
                  <PrecioEditable
                    valor={m.precio_venta}
                    etiqueta={`Precio de venta de ${m.nombre}`}
                    onGuardar={(valor) => guardarPrecio(m.id, 'precio_venta', valor)}
                    onInvalido={avisarPrecioNoValido}
                  />
                  <PrecioEditable
                    valor={m.precio_alquiler_dia}
                    sufijo="/día"
                    etiqueta={`Precio de alquiler por día de ${m.nombre}`}
                    onGuardar={(valor) => guardarPrecio(m.id, 'precio_alquiler', valor)}
                    onInvalido={avisarPrecioNoValido}
                  />
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

      {asignandoAlquiler && (
        <AsignarAlquilerModal
          piezas={muebles.filter(m => seleccionados.includes(m.id))}
          onCerrar={() => setAsignandoAlquiler(false)}
          onAplicado={trasAsignarAlquiler}
        />
      )}

      {importando && (
        <ImportarCatalogoModal onCerrar={() => setImportando(false)} onImportado={recargarMuebles} />
      )}

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
