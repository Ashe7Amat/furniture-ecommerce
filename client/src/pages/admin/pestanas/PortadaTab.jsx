import { useState, useEffect, useContext } from 'react';
import { ToastContext } from '../../../context/ToastContext';
import { getAjustesHome, actualizarAjustesHome } from '../../../services/api';
import SeccionImagenes from '../SeccionImagenes';
import { PLACEHOLDER_IMG } from '../../../utils/images';
import Icon from '../Icon';

// Tope de fotos por sección: hero hasta 10, inspiración 2-3, sostenibilidad 1.
const MAX_HERO = 10;
const MAX_INSPIRACION = 3;
const MAX_SOSTENIBILIDAD = 1;

const PLACEHOLDERS_HERO = [
  { url: '/img/hero-almacen.webp', titulo: 'Por defecto 1 (Almacén)' },
  { url: '/img/hero-aerea.webp', titulo: 'Por defecto 2 (Vista aérea)' },
  { url: '/img/hero-sillones.webp', titulo: 'Por defecto 3 (Butacas)' },
  { url: '/img/hero-showroom.webp', titulo: 'Por defecto 4 (Showroom)' }
];

const PLACEHOLDERS_INSPIRACION = [
  { url: '/img/galeria-rincon.webp', titulo: 'Por defecto 1 (Rincón de decoración)' },
  { url: '/img/galeria-butacas.webp', titulo: 'Por defecto 2 (Butacas de cine)' }
];

const PortadaTab = ({ muebles = [] }) => {
  const { showToast } = useContext(ToastContext);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [heroImagenes, setHeroImagenes] = useState([]);
  const [productosDestacados, setProductosDestacados] = useState([]);
  const [imagenesInspiracion, setImagenesInspiracion] = useState([]);
  const [imagenSostenibilidad, setImagenSostenibilidad] = useState([]);
  const [busqueda, setBusqueda] = useState('');

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
          setImagenesInspiracion(
            Array.isArray(datos.imagenes_seccion_inspiracion) ? datos.imagenes_seccion_inspiracion : []
          );
          setImagenSostenibilidad(
            typeof datos.imagen_seccion_sostenibilidad === 'string' && datos.imagen_seccion_sostenibilidad.trim()
              ? [datos.imagen_seccion_sostenibilidad]
              : []
          );
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

  // Manejo de cambios en las secciones de imágenes (soporta updater funcional)
  const handleCambioHero = (nuevas) => {
    setHeroImagenes((prev) => (typeof nuevas === 'function' ? nuevas(prev) : nuevas));
  };

  const handleCambioInspiracion = (nuevas) => {
    setImagenesInspiracion((prev) => (typeof nuevas === 'function' ? nuevas(prev) : nuevas));
  };

  const handleCambioSostenibilidad = (nuevas) => {
    setImagenSostenibilidad((prev) => (typeof nuevas === 'function' ? nuevas(prev) : nuevas));
  };

  // Guardar cambios generales (PUT)
  const handleGuardarCambios = async () => {
    setGuardando(true);
    try {
      const res = await actualizarAjustesHome({
        hero_imagenes: heroImagenes,
        productos_destacados: productosDestacados,
        imagenes_seccion_inspiracion: imagenesInspiracion,
        imagen_seccion_sostenibilidad: imagenSostenibilidad[0] || null
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
          <p>Personaliza las imágenes del carrusel Hero, las piezas destacadas y el resto de secciones visuales.</p>
        </div>
        <div className="admin-view-head-actions">
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            onClick={() => window.open('/', '_blank', 'noopener,noreferrer')}
            aria-label="Abrir vista previa de la portada en una pestaña nueva"
          >
            <Icon name="eye" /> Vista previa
          </button>
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
        {/* SECCIÓN 1: HERO (número libre de fotos, hasta MAX_HERO) */}
        <SeccionImagenes
          id="seccion-hero"
          titulo="Carrusel Hero"
          descripcion={`Las fotos rotan en el orden de la lista, hasta ${MAX_HERO}. Las nuevas se añaden al final.`}
          imagenes={heroImagenes}
          onChange={handleCambioHero}
          max={MAX_HERO}
          predeterminadas={PLACEHOLDERS_HERO}
          textoVacio="No hay imágenes personalizadas. La web usa las 4 fotos predeterminadas."
          ariaSubir="Subir nueva imagen al carrusel Hero"
          mensajeAnadida="Imagen añadida al Hero"
        />

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

        {/* SECCIÓN 3: ESPACIOS QUE INSPIRAN */}
        <SeccionImagenes
          id="seccion-inspiracion"
          titulo="Galería: Espacios que inspiran"
          descripcion="Fotografías de ambiente para la galería intermedia (admite de 2 a 3 imágenes). Si está vacía, se muestran las fotos predeterminadas."
          imagenes={imagenesInspiracion}
          onChange={handleCambioInspiracion}
          max={MAX_INSPIRACION}
          predeterminadas={PLACEHOLDERS_INSPIRACION}
          textoVacio="No hay fotos personalizadas para esta galería. La web muestra las 2 fotos predeterminadas."
          ariaSubir="Subir nueva imagen para la galería de inspiración"
          mensajeAnadida="Imagen añadida a la galería de inspiración"
        />

        {/* SECCIÓN 4: SOSTENIBILIDAD */}
        <SeccionImagenes
          id="seccion-sostenibilidad"
          titulo="Sección Sostenibilidad (Segunda vida)"
          descripcion="Fotografía ilustrativa para acompañar el bloque 'El mueble más sostenible es el que ya existe' (1 imagen)."
          imagenes={imagenSostenibilidad}
          onChange={handleCambioSostenibilidad}
          max={MAX_SOSTENIBILIDAD}
          predeterminadas={[]}
          textoVacio="No hay foto personalizada configurada. El bloque se muestra con su estilo original."
          ariaSubir="Subir imagen para la sección de sostenibilidad"
          mensajeAnadida="Imagen asignada a sostenibilidad"
        />
      </div>
    </div>
  );
};

export default PortadaTab;
