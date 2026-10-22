import { useState, useEffect, useContext, useRef } from 'react';
import { ToastContext } from '../../../context/ToastContext';
import { getAjustesHome, actualizarAjustesHome, subirImagenHero } from '../../../services/api';
import { redimensionarImagen } from '../../../utils/imagen';
import { PLACEHOLDER_IMG } from '../../../utils/images';
import Icon from '../Icon';

const PLACEHOLDERS_HERO = [
  { url: '/img/hero-almacen.webp', titulo: 'Por defecto 1 (Almacén)' },
  { url: '/img/hero-aerea.webp', titulo: 'Por defecto 2 (Vista aérea)' },
  { url: '/img/hero-sillones.webp', titulo: 'Por defecto 3 (Butacas)' },
  { url: '/img/hero-showroom.webp', titulo: 'Por defecto 4 (Showroom)' }
];

const PortadaTab = ({ muebles = [] }) => {
  const { showToast } = useContext(ToastContext);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [subiendoHero, setSubiendoHero] = useState(false);
  const [mensajeSubida, setMensajeSubida] = useState('');

  const [heroImagenes, setHeroImagenes] = useState([]);
  const [productosDestacados, setProductosDestacados] = useState([]);
  const [busqueda, setBusqueda] = useState('');

  const fileInputRef = useRef(null);

  // Cargar configuración existente
  useEffect(() => {
    let cancelado = false;
    const cargar = async () => {
      setCargando(true);
      try {
        const datos = await getAjustesHome();
        if (!cancelado && datos) {
          setHeroImagenes(Array.isArray(datos.hero_imagenes) ? datos.hero_imagenes : []);
          setProductosDestacados(Array.isArray(datos.productos_destacados) ? datos.productos_destacados : []);
        }
      } catch (err) {
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
  }, [showToast]);

  // Manejo de subida de imagen para el Hero
  const handleSeleccionarArchivo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (heroImagenes.length >= 4) {
      showToast?.('El Hero admite un máximo de 4 imágenes. Elimina una para añadir otra.', 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      setSubiendoHero(true);
      setMensajeSubida('Optimizando imagen...');
      const optimizada = await redimensionarImagen(file, { maxLado: 1920, calidad: 0.85 });

      setMensajeSubida('Subiendo a Supabase Storage...');
      const resultado = await subirImagenHero(optimizada);

      if (resultado?.url) {
        setHeroImagenes(prev => [...prev, resultado.url]);
        showToast?.('Imagen añadida al Hero', 'success');
      } else {
        showToast?.('Error al subir la imagen a Storage', 'error');
      }
    } catch (err) {
      showToast?.('Error al procesar la imagen', 'error');
    } finally {
      setSubiendoHero(false);
      setMensajeSubida('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleEliminarHero = (index) => {
    setHeroImagenes(prev => prev.filter((_, i) => i !== index));
  };

  const handleMoverHero = (index, direccion) => {
    const nuevoIndex = index + direccion;
    if (nuevoIndex < 0 || nuevoIndex >= heroImagenes.length) return;
    setHeroImagenes(prev => {
      const copia = [...prev];
      const temp = copia[index];
      copia[index] = copia[nuevoIndex];
      copia[nuevoIndex] = temp;
      return copia;
    });
  };

  // Manejo de Destacados
  const handleAnadirDestacado = (muebleId) => {
    if (productosDestacados.includes(muebleId)) return;
    setProductosDestacados(prev => [...prev, muebleId]);
    setBusqueda('');
  };

  const handleQuitarDestacado = (muebleId) => {
    setProductosDestacados(prev => prev.filter(id => id !== muebleId));
  };

  const handleMoverDestacado = (index, direccion) => {
    const nuevoIndex = index + direccion;
    if (nuevoIndex < 0 || nuevoIndex >= productosDestacados.length) return;
    setProductosDestacados(prev => {
      const copia = [...prev];
      const temp = copia[index];
      copia[index] = copia[nuevoIndex];
      copia[nuevoIndex] = temp;
      return copia;
    });
  };

  // Guardar cambios generales (PUT)
  const handleGuardarCambios = async () => {
    setGuardando(true);
    try {
      const res = await actualizarAjustesHome({
        hero_imagenes: heroImagenes,
        productos_destacados: productosDestacados
      });
      if (res?.success) {
        showToast?.('Ajustes de portada guardados correctamente', 'success');
      } else {
        showToast?.('Error al guardar los ajustes de portada', 'error');
      }
    } catch (err) {
      showToast?.('Error de conexión al guardar los ajustes', 'error');
    } finally {
      setGuardando(false);
    }
  };

  // Filtrar muebles para el buscador
  const busquedaNormalizada = busqueda.trim().toLowerCase();
  const mueblesSugeridos = busquedaNormalizada
    ? muebles
        .filter(m => !productosDestacados.includes(m.id))
        .filter(m =>
          (m.nombre && m.nombre.toLowerCase().includes(busquedaNormalizada)) ||
          (m.referencia && m.referencia.toLowerCase().includes(busquedaNormalizada)) ||
          (m.categoria && m.categoria.toLowerCase().includes(busquedaNormalizada))
        )
        .slice(0, 6)
    : [];

  // Muebles seleccionados en orden
  const mueblesDestacadosInfo = productosDestacados.map(id => {
    const encontrado = muebles.find(m => String(m.id) === String(id));
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
        <p className="portada-cargando" aria-live="polite">Cargando ajustes de portada...</p>
      </div>
    );
  }

  return (
    <div className="admin-view fade-in">
      <div className="admin-view-head">
        <div>
          <h2>Gestión de Portada</h2>
          <p>Personaliza las 4 imágenes del carrusel Hero y la selección de piezas destacadas.</p>
        </div>
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

      <div className="portada-contenedor">
        {/* SECCIÓN 1: HERO */}
        <section className="portada-seccion" aria-labelledby="seccion-hero-titulo">
          <div className="portada-seccion-header">
            <div>
              <h3 id="seccion-hero-titulo">Carrusel Hero (4 imágenes)</h3>
              <p className="portada-seccion-desc">
                {heroImagenes.length === 0
                  ? 'No hay imágenes personalizadas. La web usa las 4 fotos predeterminadas.'
                  : `${heroImagenes.length} de 4 imágenes personalizadas configuradas.`}
              </p>
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                id="hero-file-input"
                accept="image/*"
                onChange={handleSeleccionarArchivo}
                style={{ display: 'none' }}
                disabled={subiendoHero || heroImagenes.length >= 4}
              />
              <button
                type="button"
                className="admin-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={subiendoHero || heroImagenes.length >= 4}
                aria-label="Subir nueva imagen al carrusel Hero"
              >
                <Icon name="add" /> Subir nueva imagen
              </button>
            </div>
          </div>

          {subiendoHero && (
            <p className="admin-status" aria-live="polite">
              {mensajeSubida || 'Subiendo imagen...'}
            </p>
          )}

          <div className="hero-grid" role="list" aria-label="Lista de imágenes del Hero">
            {[0, 1, 2, 3].map(slotIndex => {
              const url = heroImagenes[slotIndex];
              const esPersonalizada = Boolean(url);
              const infoPlaceholder = PLACEHOLDERS_HERO[slotIndex];
              const srcFinal = esPersonalizada ? url : infoPlaceholder.url;

              return (
                <div
                  key={`hero-slot-${slotIndex}`}
                  className={`hero-slot ${esPersonalizada ? 'hero-slot--activo' : 'hero-slot--placeholder'}`}
                  role="listitem"
                >
                  <div className="hero-slot-preview">
                    <img
                      src={srcFinal}
                      alt={
                        esPersonalizada
                          ? `Imagen de portada ${slotIndex + 1}`
                          : `Placeholder ${slotIndex + 1}: ${infoPlaceholder.titulo}`
                      }
                      className="hero-slot-img"
                    />
                    <span className="hero-slot-badge">
                      {esPersonalizada ? `Slot ${slotIndex + 1}` : `Predeterminada ${slotIndex + 1}`}
                    </span>
                  </div>

                  <div className="hero-slot-info">
                    <span className="hero-slot-label">
                      {esPersonalizada ? `Imagen ${slotIndex + 1}` : infoPlaceholder.titulo}
                    </span>
                    {esPersonalizada && (
                      <div className="hero-slot-acciones">
                        <button
                          type="button"
                          className="hero-accion-btn"
                          onClick={() => handleMoverHero(slotIndex, -1)}
                          disabled={slotIndex === 0}
                          aria-label={`Mover imagen ${slotIndex + 1} hacia arriba`}
                          title="Subir posición"
                        >
                          <Icon name="arrowUp" />
                        </button>
                        <button
                          type="button"
                          className="hero-accion-btn"
                          onClick={() => handleMoverHero(slotIndex, 1)}
                          disabled={slotIndex === heroImagenes.length - 1}
                          aria-label={`Mover imagen ${slotIndex + 1} hacia abajo`}
                          title="Bajar posición"
                        >
                          <Icon name="arrowDown" />
                        </button>
                        <button
                          type="button"
                          className="hero-accion-btn hero-accion-btn--borrar"
                          onClick={() => handleEliminarHero(slotIndex)}
                          aria-label={`Eliminar imagen ${slotIndex + 1}`}
                          title="Eliminar de la lista"
                        >
                          <Icon name="trash" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* SECCIÓN 2: DESTACADOS */}
        <section className="portada-seccion" aria-labelledby="seccion-destacados-titulo">
          <div className="portada-seccion-header">
            <div>
              <h3 id="seccion-destacados-titulo">Piezas Destacadas</h3>
              <p className="portada-seccion-desc">
                Selecciona manualmente los muebles para la sección principal de la portada.
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
                onChange={e => setBusqueda(e.target.value)}
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
                  mueblesSugeridos.map(mueble => (
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
