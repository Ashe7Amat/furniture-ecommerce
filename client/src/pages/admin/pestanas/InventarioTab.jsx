import { useContext, useEffect, useRef, useState } from 'react';
import { ToastContext } from '../../../context/ToastContext';
import { updateMueble, deleteMueble, duplicarMueble, exportarCatalogoCsv } from '../../../services/api';
import { descargarArchivo } from '../../../utils/descargarArchivo';
import { PLACEHOLDER_IMG } from '../../../utils/images';
import Icon from '../Icon';
import ImportarCatalogoModal from '../modales/ImportarCatalogoModal';
import AsignarAlquilerModal from '../modales/AsignarAlquilerModal';
import EtiquetasModal from '../modales/EtiquetasModal';
import PrecioEditable from '../PrecioEditable';
import MenuAcciones from '../MenuAcciones';
import { ejecutarLote, textoLoteAMedias } from '../lotes';
import { textoResultadoAlquiler } from '../precios';

const OPCIONES_ESTADO = [
  { valor: 'disponible', etiqueta: 'Disponible' },
  { valor: 'vendido', etiqueta: 'Vendido' },
  { valor: 'alquilado', etiqueta: 'Alquilado' }
];

// Subcomponente: Pastilla de Estado interactiva con menú desplegable
const EstadoBadgeMenu = ({ estadoActual = 'disponible', nombreMueble, onCambiarEstado }) => {
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const contenedorRef = useRef(null);

  useEffect(() => {
    if (!abierto) return;
    const handleClickFuera = (e) => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target)) {
        setAbierto(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('mousedown', handleClickFuera);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickFuera);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [abierto]);

  const infoActual =
    OPCIONES_ESTADO.find((op) => op.valor === estadoActual) || OPCIONES_ESTADO[0];

  const handleSeleccionar = async (nuevoValor) => {
    setAbierto(false);
    if (nuevoValor === estadoActual) return;
    setGuardando(true);
    await onCambiarEstado(nuevoValor);
    setGuardando(false);
  };

  return (
    <div className="inv-status-dropdown" ref={contenedorRef}>
      <select
        className="inv-status-native-select"
        value={estadoActual}
        onChange={(e) => onCambiarEstado(e.target.value)}
        aria-label={`Estado de ${nombreMueble}`}
      >
        {OPCIONES_ESTADO.map((op) => (
          <option key={op.valor} value={op.valor}>
            {op.etiqueta}
          </option>
        ))}
      </select>

      <button
        type="button"
        className={`inv-status-badge status-${infoActual.valor}`}
        onClick={() => setAbierto((prev) => !prev)}
        disabled={guardando}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-label={`Estado de ${nombreMueble}: ${infoActual.etiqueta}. Clic para cambiar`}
      >
        <span className="inv-status-dot" aria-hidden="true" />
        <span>{guardando ? 'Guardando…' : infoActual.etiqueta}</span>
        <svg
          className="inv-status-chevron"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {abierto && (
        <ul
          className="inv-status-popover"
          role="listbox"
          aria-label={`Cambiar estado de ${nombreMueble}`}
        >
          {OPCIONES_ESTADO.map((opcion) => {
            const activo = opcion.valor === estadoActual;
            return (
              <li key={opcion.valor} role="option" aria-selected={activo}>
                <button
                  type="button"
                  className={`inv-status-option status-${opcion.valor} ${activo ? 'is-active' : ''}`}
                  onClick={() => handleSeleccionar(opcion.valor)}
                >
                  <span className="inv-status-dot" aria-hidden="true" />
                  <span>{opcion.etiqueta}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

// Pestaña "Gestionar Inventario". El estado de la vista (búsqueda, filtros, orden, página,
// selección) llega en `vista` desde el contenedor (useInventarioVista), para que se conserve al
// cambiar de pestaña.
const InventarioTab = ({
  vista,
  muebles,
  categorias,
  recargarMuebles,
  confirmarBorrado,
  abrirEditorMueble
}) => {
  const { showToast } = useContext(ToastContext);
  const {
    busqueda,
    setBusqueda,
    filtroCategoria,
    setFiltroCategoria,
    filtroEstado,
    setFiltroEstado,
    orden,
    setOrden,
    setPagina,
    seleccionados,
    setSeleccionados,
    bulkEstado,
    setBulkEstado,
    muebleFiltrados,
    muebleVisibles,
    totalPaginas,
    paginaSegura,
    todosVisiblesSeleccionados,
    toggleSeleccionado,
    toggleSeleccionarPagina,
    limpiarFiltros
  } = vista;

  const totalMuebles = muebles.length;
  const [exportando, setExportando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [asignandoAlquiler, setAsignandoAlquiler] = useState(false);
  // Las piezas de las etiquetas abiertas (se fijan al abrir, aunque luego cambie la selección).
  const [etiquetas, setEtiquetas] = useState(null);

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

  // "Duplicar" en la fila: el servidor crea la copia (mismos datos, sin fotos, disponible y con la
  // referencia siguiente de su categoría) y aquí se abre su editor, para ponerle las fotos.
  const duplicando = useRef(false);
  const handleDuplicar = (m) => {
    confirmarBorrado(
      'Duplicar pieza',
      `¿Duplicar ${m.nombre}? Se creará una nueva pieza con la misma información excepto las fotos.`,
      async () => {
        if (duplicando.current) return;
        duplicando.current = true;
        const { data, error } = await duplicarMueble(m.id);
        duplicando.current = false;
        const nueva = data?.data?.[0];
        if (error || !nueva) {
          showToast(error || 'No se pudo duplicar la pieza.', 'error');
          return;
        }
        showToast(
          nueva.referencia ? `Pieza duplicada (${nueva.referencia})` : 'Pieza duplicada',
          'success'
        );
        recargarMuebles();
        abrirEditorMueble(nueva);
      },
      'Duplicar'
    );
  };

  const handleBulkDelete = () => {
    const cantidad = seleccionados.length;
    confirmarBorrado(
      'Eliminar productos seleccionados',
      `¿Seguro que quieres eliminar ${cantidad} producto${cantidad === 1 ? '' : 's'} de forma permanente?`,
      async () => {
        const { hechos, fallidos } = await ejecutarLote(seleccionados, (id) => deleteMueble(id));
        if (fallidos.length === 0) {
          showToast(
            `${cantidad} producto${cantidad === 1 ? '' : 's'} eliminado${cantidad === 1 ? '' : 's'}`,
            'success'
          );
        } else if (hechos === 0) {
          showToast(
            cantidad === 1
              ? 'No se pudo eliminar el producto'
              : `No se pudo eliminar ninguno de los ${cantidad} productos`,
            'error'
          );
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
    const { hechos, fallidos } = await ejecutarLote(seleccionados, (id) =>
      updateMueble(id, { estado: bulkEstado })
    );
    if (fallidos.length === 0) {
      showToast(
        `Estado actualizado en ${cantidad} producto${cantidad === 1 ? '' : 's'}`,
        'success'
      );
    } else if (hechos === 0) {
      showToast(
        cantidad === 1
          ? 'No se pudo actualizar el estado'
          : `No se pudo actualizar el estado de ninguno de los ${cantidad} productos`,
        'error'
      );
    } else {
      showToast(textoLoteAMedias(hechos, cantidad), 'error');
    }
    setSeleccionados(fallidos);
    if (hechos > 0) recargarMuebles();
  };

  // Edición rápida de un precio en la fila.
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

  const trasAsignarAlquiler = ({ hechos, fallidos, total }) => {
    showToast(textoResultadoAlquiler(hechos, total), fallidos.length === 0 ? 'success' : 'error');
    setSeleccionados(fallidos);
    if (hechos > 0) recargarMuebles();
  };

  const tienePrecioDefinido = (valor) =>
    valor !== null && valor !== undefined && String(valor).trim() !== '' && Number(valor) > 0;

  return (
    <div className="admin-view fade-in">
      {/* CABECERA CON BOTONES CSV REUBICADOS A LA DERECHA */}
      <div className="admin-view-head inv-header-bar">
        <div className="inv-header-titles">
          <h2>Gestionar Inventario</h2>
          <p>
            {muebleFiltrados.length} de {totalMuebles} productos
          </p>
        </div>

        <div className="admin-toolbar-acciones inv-header-csv-actions">
          <button
            type="button"
            className="admin-btn-ghost inv-csv-btn"
            onClick={handleExportar}
            disabled={exportando}
          >
            {exportando ? 'Exportando…' : 'Exportar catálogo (CSV)'}
          </button>
          <button
            type="button"
            className="admin-btn-ghost inv-csv-btn"
            onClick={() => setImportando(true)}
          >
            Importar catálogo (CSV)
          </button>
        </div>
      </div>

      {/* BARRA DE FILTROS EN UNA SOLA LÍNEA CON CLASES .n5-input */}
      <div className="admin-toolbar inv-filters-row">
        <div className="admin-search inv-search-wrapper">
          <Icon name="search" />
          <input
            type="text"
            className="n5-input inv-search-input"
            placeholder="Buscar por nombre o referencia..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        <select
          className="n5-input inv-filter-select"
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
        >
          <option value="">Todas las categorías</option>
          {categorias.map((cat) => (
            <option key={cat.id} value={cat.nombre}>
              {cat.nombre}
            </option>
          ))}
        </select>

        <select
          className="n5-input inv-filter-select"
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="disponible">Disponible</option>
          <option value="vendido">Vendido</option>
          <option value="alquilado">Alquilado</option>
        </select>

        <select
          className="n5-input inv-filter-select"
          value={orden}
          onChange={(e) => setOrden(e.target.value)}
        >
          <option value="recientes">Más recientes</option>
          <option value="nombre">Nombre A-Z</option>
          <option value="referencia_asc">Referencia A-Z</option>
          <option value="referencia_desc">Referencia Z-A</option>
          <option value="precio_asc">Precio: menor a mayor</option>
          <option value="precio_desc">Precio: mayor a menor</option>
        </select>

        {(busqueda || filtroCategoria || filtroEstado || orden !== 'recientes') && (
          <button
            type="button"
            className="admin-btn-ghost inv-clear-btn"
            onClick={limpiarFiltros}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* BARRA DE ACCIONES EN LOTE */}
      {seleccionados.length > 0 && (
        <div className="bulk-bar">
          <strong>
            {seleccionados.length} seleccionado{seleccionados.length === 1 ? '' : 's'}
          </strong>
          <div className="bulk-actions">
            <select
              className="n5-input"
              value={bulkEstado}
              onChange={(e) => setBulkEstado(e.target.value)}
            >
              <option value="disponible">Marcar disponible</option>
              <option value="vendido">Marcar vendido</option>
              <option value="alquilado">Marcar alquilado</option>
            </select>
            <button type="button" className="admin-btn-ghost" onClick={handleBulkEstado}>
              Aplicar estado
            </button>
            <button
              type="button"
              className="admin-btn-ghost"
              onClick={() => setAsignandoAlquiler(true)}
            >
              Asignar precio de alquiler
            </button>
            <button
              type="button"
              className="admin-btn-ghost"
              onClick={() => setEtiquetas(muebles.filter((m) => seleccionados.includes(m.id)))}
            >
              Imprimir etiquetas
            </button>
            <button type="button" className="admin-btn-danger-ghost" onClick={handleBulkDelete}>
              Eliminar seleccionados
            </button>
            <button type="button" className="admin-btn-ghost" onClick={() => setSeleccionados([])}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* TABLA DE INVENTARIO REDISEÑADA */}
      <div className="admin-inventory-manager">
        {muebleFiltrados.length === 0 ? (
          <p className="inventory-empty">No hay productos que coincidan con estos filtros.</p>
        ) : (
          <div className="inventory-table">
            <div className="inventory-head-row">
              <input
                type="checkbox"
                className="inv-checkbox"
                checked={todosVisiblesSeleccionados}
                onChange={toggleSeleccionarPagina}
                aria-label="Seleccionar todos"
              />
              <span></span>
              <span className="inv-ref">Referencia</span>
              <span>Nombre</span>
              <span className="inv-category">Categoría</span>
              <span>Estado</span>
              <span className="inv-price inv-precios">
                <span>Venta</span>
                <span>Alquiler/día</span>
              </span>
              <span className="inv-actions-head">Acciones</span>
            </div>

            {muebleVisibles.map((m) => {
              const tieneVenta = tienePrecioDefinido(m.precio_venta);
              const tieneAlquiler = tienePrecioDefinido(m.precio_alquiler_dia);

              return (
                <div
                  key={m.id}
                  className={`inventory-list-item ${seleccionados.includes(m.id) ? 'is-selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    className="inv-checkbox"
                    checked={seleccionados.includes(m.id)}
                    onChange={() => toggleSeleccionado(m.id)}
                    aria-label={`Seleccionar ${m.nombre}`}
                  />

                  <div className="inv-thumb">
                    <img
                      src={m.imagenes?.[0] || PLACEHOLDER_IMG}
                      alt={m.nombre}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>

                  {/* Referencia con estilo etiqueta de papel Kraft si existe; vacía si no existe */}
                  {m.referencia ? (
                    <span className="inv-ref inv-ref-tag">{m.referencia}</span>
                  ) : (
                    <span className="inv-ref" />
                  )}

                  <span className="inv-name">{m.nombre}</span>

                  <span className="inv-category">{m.categoria || '—'}</span>

                  {/* Badge de Estado con desplegable en lugar de <select> nativo */}
                  <span>
                    <EstadoBadgeMenu
                      estadoActual={m.estado || 'disponible'}
                      nombreMueble={m.nombre}
                      onCambiarEstado={async (nuevoEstado) => {
                        const res = await updateMueble(m.id, { estado: nuevoEstado });
                        if (res) {
                          showToast('Estado actualizado', 'success');
                          recargarMuebles();
                        } else {
                          showToast('Error al cambiar estado', 'error');
                        }
                      }}
                    />
                  </span>

                  {/* Precios con indicador "Sin precio" sutil cuando están vacíos y lápiz en hover */}
                  <span className="inv-price inv-precios">
                    <div className={`inv-precio-slot ${!tieneVenta ? 'is-empty' : ''}`}>
                      <PrecioEditable
                        valor={m.precio_venta}
                        etiqueta={`Precio de venta de ${m.nombre}`}
                        onGuardar={(valor) => guardarPrecio(m.id, 'precio_venta', valor)}
                        onInvalido={avisarPrecioNoValido}
                      />
                    </div>
                    <div className={`inv-precio-slot ${!tieneAlquiler ? 'is-empty' : ''}`}>
                      <PrecioEditable
                        valor={m.precio_alquiler_dia}
                        sufijo="/día"
                        etiqueta={`Precio de alquiler por día de ${m.nombre}`}
                        onGuardar={(valor) => guardarPrecio(m.id, 'precio_alquiler', valor)}
                        onInvalido={avisarPrecioNoValido}
                      />
                    </div>
                  </span>

                  <div className="inv-actions">
                    <button
                      type="button"
                      onClick={() => abrirEditorMueble(m)}
                      className="inv-edit-btn"
                      title={`Editar ${m.nombre}`}
                    >
                      <svg
                        className="inv-edit-icon"
                        viewBox="0 0 16 16"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M11.333 2.00004C11.5081 1.82494 11.716 1.68605 11.9447 1.59129C12.1735 1.49653 12.4187 1.44775 12.6663 1.44775C12.914 1.44775 13.1592 1.49653 13.3879 1.59129C13.6167 1.68605 13.8246 1.82494 13.9997 2.00004C14.1748 2.17513 14.3137 2.383 14.4084 2.61178C14.5032 2.84055 14.552 3.08575 14.552 3.33337C14.552 3.58099 14.5032 3.82619 14.4084 4.05497C14.3137 4.28374 14.1748 4.49161 13.9997 4.66671L5.00001 13.6667L1.33334 14.6667L2.33334 11L11.333 2.00004Z"
                          stroke="currentColor"
                          strokeWidth="1.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span>Editar</span>
                    </button>
                    <MenuAcciones
                      etiqueta={`Más acciones de ${m.nombre}`}
                      acciones={[
                        { texto: 'Duplicar', icono: 'copy', onElegir: () => handleDuplicar(m) },
                        {
                          texto: 'Imprimir etiqueta',
                          icono: 'qr',
                          onElegir: () => setEtiquetas([m])
                        },
                        null,
                        {
                          texto: 'Eliminar',
                          icono: 'trash',
                          peligro: true,
                          onElegir: () => handleDeleteMueble(m.id)
                        }
                      ]}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {asignandoAlquiler && (
        <AsignarAlquilerModal
          piezas={muebles.filter((m) => seleccionados.includes(m.id))}
          onCerrar={() => setAsignandoAlquiler(false)}
          onAplicado={trasAsignarAlquiler}
        />
      )}

      {etiquetas && <EtiquetasModal piezas={etiquetas} onCerrar={() => setEtiquetas(null)} />}

      {importando && (
        <ImportarCatalogoModal onCerrar={() => setImportando(false)} onImportado={recargarMuebles} />
      )}

      {totalPaginas > 1 && (
        <div className="admin-pagination">
          <button
            type="button"
            onClick={() => setPagina((p) => Math.max(1, p - 1))}
            disabled={paginaSegura === 1}
          >
            ← Anterior
          </button>
          <span>
            Página {paginaSegura} de {totalPaginas}
          </span>
          <button
            type="button"
            onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
            disabled={paginaSegura === totalPaginas}
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
};

export default InventarioTab;
