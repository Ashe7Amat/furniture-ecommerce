import { useState, useEffect, useContext } from 'react';
import { ToastContext } from '../../../context/ToastContext';
import { getAjustesHome, actualizarAjustesHome } from '../../../services/api';
import { PLACEHOLDER_IMG } from '../../../utils/images';
import Icon from '../Icon';

const PortadaTab = ({ muebles = [] }) => {
  const { showToast } = useContext(ToastContext);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [productosDestacados, setProductosDestacados] = useState([]);
  const [busqueda, setBusqueda] = useState('');

  // Cargar configuración de destacados una sola vez al montar
  useEffect(() => {
    let cancelado = false;
    const cargar = async () => {
      setCargando(true);
      try {
        const datos = await getAjustesHome();
        if (!cancelado && datos) {
          setProductosDestacados(
            Array.isArray(datos.productos_destacados) ? datos.productos_destacados : []
          );
        }
      } catch {
        if (!cancelado) {
          showToast?.('No se pudieron cargar los ajustes de portada', 'error');
        }
      } finally {
        if (!cancelado) setCargando(false);
      }
    };
    cargar();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Manejo de Destacados
  const handleAnadirDestacado = (muebleId) => {
    if (productosDestacados.includes(muebleId)) return;
    setProductosDestacados((prev) => [...prev, muebleId]);
    setBusqueda('');
  };

  const handleQuitarDestacado = (muebleId) => {
    setProductosDestacados((prev) => prev.filter((id) => id !== muebleId));
  };

  const handleMoverDestacado = (index, direccion) => {
    const nuevoIndex = index + direccion;
    if (nuevoIndex < 0 || nuevoIndex >= productosDestacados.length) return;
    setProductosDestacados((prev) => {
      const copia = [...prev];
      const temp = copia[index];
      copia[index] = copia[nuevoIndex];
      copia[nuevoIndex] = temp;
      return copia;
    });
  };

  // Guardar cambios en el endpoint
  const handleGuardarCambios = async () => {
    setGuardando(true);
    try {
      const res = await actualizarAjustesHome({
        productos_destacados: productosDestacados
      });
      if (res?.success) {
        if (Array.isArray(res?.data?.productos_destacados)) {
          setProductosDestacados(res.data.productos_destacados);
        }
        showToast?.('Piezas destacadas guardadas correctamente', 'success');
      } else {
        showToast?.('Error al guardar las piezas destacadas', 'error');
      }
    } catch {
      showToast?.('Error de conexión al guardar los ajustes', 'error');
    } finally {
      setGuardando(false);
    }
  };

  // Filtrar muebles para el buscador
  const busquedaNormalizada = busqueda.trim().toLowerCase();
  const mueblesSugeridos = busquedaNormalizada
    ? muebles
      .filter((m) => !productosDestacados.includes(m.id))
      .filter(
        (m) =>
          (m.nombre && m.nombre.toLowerCase().includes(busquedaNormalizada)) ||
          (m.referencia && m.referencia.toLowerCase().includes(busquedaNormalizada)) ||
          (m.categoria && m.categoria.toLowerCase().includes(busquedaNormalizada))
      )
      .slice(0, 8)
    : [];

  // Muebles seleccionados en orden
  const mueblesDestacadosInfo = productosDestacados.map((id) => {
    const encontrado = muebles.find((m) => String(m.id) === String(id));
    return (
      encontrado || {
        id,
        nombre: `Pieza #${String(id).slice(0, 8)}`,
        referencia: '—',
        imagenes: []
      }
    );
  });

  if (cargando) {
    return (
      <div className="admin-view fade-in">
        <div className="admin-view-head">
          <h2>Gestión de Portada</h2>
        </div>
        <p className="portada-cargando" aria-live="polite">
          Cargando piezas destacadas...
        </p>
      </div>
    );
  }

  return (
    <div className="admin-view fade-in">
      <div className="admin-view-head">
        <div>
          <h2>Gestión de Portada</h2>
          <p>Selecciona manualmente las piezas que aparecen en la sección destacada de la portada principal.</p>
        </div>
        <div className="admin-view-head-actions">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="admin-btn admin-btn--secondary"
            aria-label="Ver portada de la tienda en una pestaña nueva"
          >
            <Icon name="eye" /> Ver portada
          </a>
          <button
            type="button"
            className="admin-btn admin-btn--guardar"
            onClick={handleGuardarCambios}
            disabled={guardando}
            aria-label="Guardar cambios de la portada"
          >
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      <div className="portada-contenedor">
        {/* SECCIÓN ÚNICA: DESTACADOS */}
        <section className="portada-seccion" aria-labelledby="seccion-destacados-titulo">
          <div className="portada-seccion-header">
            <div>
              <h3 id="seccion-destacados-titulo">Piezas Destacadas</h3>
              <p className="portada-seccion-desc">
                Busca muebles por nombre, referencia o categoría para añadirlos. Puedes cambiar el orden con las flechas.
              </p>
            </div>
            <span className="destacados-contador">
              {productosDestacados.length}{' '}
              {productosDestacados.length === 1 ? 'mueble seleccionado' : 'muebles seleccionados'}
            </span>
          </div>

          {/* Buscador de muebles */}
          <div className="destacados-buscador">
            <div className="destacados-input-wrapper">
              <span className="destacados-search-icon" aria-hidden="true">
                <Icon name="search" />
              </span>
              <input
                type="text"
                className="destacados-search-input"
                placeholder="Buscar mueble por nombre, referencia o categoría para destacar..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                aria-label="Buscar muebles para añadir a destacados"
              />
              {busqueda && (
                <button
                  type="button"
                  className="destacados-clear-btn"
                  onClick={() => setBusqueda('')}
                  aria-label="Limpiar búsqueda"
                >
                  <Icon name="close" />
                </button>
              )}
            </div>

            {/* Resultados del buscador */}
            {busquedaNormalizada && (
              <div className="destacados-sugerencias" role="region" aria-label="Resultados de búsqueda">
                {mueblesSugeridos.length > 0 ? (
                  mueblesSugeridos.map((mueble) => (
                    <div key={`sug-${mueble.id}`} className="destacado-sugerencia-item">
                      <img
                        src={mueble.imagenes?.[0] || PLACEHOLDER_IMG}
                        alt=""
                        className="destacado-mini-foto"
                      />
                      <div className="destacado-sugerencia-info">
                        <strong>{mueble.nombre}</strong>
                        <span className="destacado-sugerencia-meta">
                          {mueble.referencia ? `Ref: ${mueble.referencia} · ` : ''}
                          {mueble.categoria || 'Sin categoría'}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="admin-btn admin-btn--sm"
                        onClick={() => handleAnadirDestacado(mueble.id)}
                        aria-label={`Añadir ${mueble.nombre} a destacados`}
                      >
                        <Icon name="add" /> Destacar
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="destacados-sin-resultados">
                    No se encontraron muebles que coincidan con &quot;{busqueda}&quot;
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Lista de Destacados Actuales */}
          <div className="destacados-lista-wrapper">
            <h4 className="destacados-lista-titulo">Muebles actualmente seleccionados:</h4>
            {mueblesDestacadosInfo.length === 0 ? (
              <div className="destacados-vacio">
                <p>No hay ningún mueble destacado seleccionado.</p>
                <small>La portada mostrará las últimas 4 piezas añadidas al catálogo por defecto.</small>
              </div>
            ) : (
              <div className="destacados-lista" role="list" aria-label="Lista de muebles destacados">
                {mueblesDestacadosInfo.map((mueble, idx) => (
                  <div key={`dest-${mueble.id}`} className="destacado-fila" role="listitem">
                    <span className="destacado-orden-badge" aria-label={`Posición ${idx + 1}`}>
                      #{idx + 1}
                    </span>
                    <img
                      src={mueble.imagenes?.[0] || PLACEHOLDER_IMG}
                      alt={mueble.nombre}
                      className="destacado-mini-foto"
                    />
                    <div className="destacado-fila-info">
                      <span className="destacado-nombre">{mueble.nombre}</span>
                      <span className="destacado-meta">
                        {mueble.referencia ? `Ref: ${mueble.referencia} · ` : ''}
                        {mueble.categoria || 'Sin categoría'}
                      </span>
                    </div>
                    <div className="destacado-fila-acciones">
                      <button
                        type="button"
                        className="hero-accion-btn"
                        onClick={() => handleMoverDestacado(idx, -1)}
                        disabled={idx === 0}
                        aria-label={`Mover ${mueble.nombre} arriba`}
                        title="Mover arriba"
                      >
                        <Icon name="arrowUp" />
                      </button>
                      <button
                        type="button"
                        className="hero-accion-btn"
                        onClick={() => handleMoverDestacado(idx, 1)}
                        disabled={idx === mueblesDestacadosInfo.length - 1}
                        aria-label={`Mover ${mueble.nombre} abajo`}
                        title="Mover abajo"
                      >
                        <Icon name="arrowDown" />
                      </button>
                      <button
                        type="button"
                        className="hero-accion-btn hero-accion-btn--borrar"
                        onClick={() => handleQuitarDestacado(mueble.id)}
                        aria-label={`Quitar ${mueble.nombre} de destacados`}
                        title="Quitar de destacados"
                      >
                        <Icon name="trash" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default PortadaTab;
