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

const limpiarArrayUrls = (arr) =>
  (Array.isArray(arr) ? arr : [])
    .map((item) => (typeof item === 'string' ? item : item?.url || ''))
    .filter((u) => typeof u === 'string' && u.trim().length > 0 && u !== '[object Object]');

const PortadaTab = ({ muebles = [] }) => {
  const { showToast } = useContext(ToastContext);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [heroImagenes, setHeroImagenes] = useState([]);
  const [productosDestacados, setProductosDestacados] = useState([]);
  const [imagenesInspiracion, setImagenesInspiracion] = useState([]);
  const [imagenSostenibilidad, setImagenSostenibilidad] = useState([]);
  const [busqueda, setBusqueda] = useState('');

  // Estados para el modal de Vista Previa
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [heroPreviewIdx, setHeroPreviewIdx] = useState(0);

  // Cargar configuración existente una sola vez al montar
  useEffect(() => {
    let cancelado = false;
    const cargar = async () => {
      setCargando(true);
      try {
        const datos = await getAjustesHome();
        if (!cancelado && datos) {
          setHeroImagenes(limpiarArrayUrls(datos.hero_imagenes));
          setProductosDestacados(Array.isArray(datos.productos_destacados) ? datos.productos_destacados : []);
          setImagenesInspiracion(limpiarArrayUrls(datos.imagenes_seccion_inspiracion));
          setImagenSostenibilidad(
            typeof datos.imagen_seccion_sostenibilidad === 'string' && datos.imagen_seccion_sostenibilidad.trim()
              ? [datos.imagen_seccion_sostenibilidad.trim()]
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cerrar el modal con Escape
  useEffect(() => {
    if (!isPreviewOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsPreviewOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPreviewOpen]);

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

  // Manejo de cambios en las secciones de imágenes (soporta updater funcional y limpia URLs)
  const handleCambioHero = (nuevas) => {
    setHeroImagenes((prev) => {
      const res = typeof nuevas === 'function' ? nuevas(prev) : nuevas;
      return limpiarArrayUrls(res);
    });
  };

  const handleCambioInspiracion = (nuevas) => {
    setImagenesInspiracion((prev) => {
      const res = typeof nuevas === 'function' ? nuevas(prev) : nuevas;
      return limpiarArrayUrls(res);
    });
  };

  const handleCambioSostenibilidad = (nuevas) => {
    setImagenSostenibilidad((prev) => {
      const res = typeof nuevas === 'function' ? nuevas(prev) : nuevas;
      return limpiarArrayUrls(res).slice(0, 1);
    });
  };

  // Guardar cambios generales (PUT)
  const handleGuardarCambios = async () => {
    setGuardando(true);
    try {
      const res = await actualizarAjustesHome({
        hero_imagenes: limpiarArrayUrls(heroImagenes),
        productos_destacados: Array.isArray(productosDestacados) ? productosDestacados : [],
        imagenes_seccion_inspiracion: limpiarArrayUrls(imagenesInspiracion),
        imagen_seccion_sostenibilidad: imagenSostenibilidad[0] || null
      });
      if (res?.success) {
        if (res?.data) {
          if (res.data.hero_imagenes) setHeroImagenes(limpiarArrayUrls(res.data.hero_imagenes));
          if (Array.isArray(res.data.productos_destacados)) setProductosDestacados(res.data.productos_destacados);
          if (res.data.imagenes_seccion_inspiracion) {
            setImagenesInspiracion(limpiarArrayUrls(res.data.imagenes_seccion_inspiracion));
          }
          if (res.data.imagen_seccion_sostenibilidad) {
            setImagenSostenibilidad([res.data.imagen_seccion_sostenibilidad]);
          } else {
            setImagenSostenibilidad([]);
          }
        }
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
      .filter((m) => !productosDestacados.includes(m.id))
      .filter(
        (m) =>
          (m.nombre && m.nombre.toLowerCase().includes(busquedaNormalizada)) ||
          (m.referencia && m.referencia.toLowerCase().includes(busquedaNormalizada)) ||
          (m.categoria && m.categoria.toLowerCase().includes(busquedaNormalizada))
      )
      .slice(0, 6)
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

  // Datos calculados en vivo para el Modal de Vista Previa
  const previewHeroUrls =
    heroImagenes.length > 0 ? heroImagenes : PLACEHOLDERS_HERO.map((p) => p.url);

  const previewDestacados =
    mueblesDestacadosInfo.length > 0 ? mueblesDestacadosInfo : muebles.slice(0, 4);

  const previewInspiracionUrls =
    imagenesInspiracion.length >= 2
      ? imagenesInspiracion
      : PLACEHOLDERS_INSPIRACION.map((p) => p.url);

  const previewSostenibilidadUrl = imagenSostenibilidad[0] || null;

  const abrirVistaPrevia = () => {
    setHeroPreviewIdx(0);
    setIsPreviewOpen(true);
  };

  if (cargando) {
    return (
      <div className="admin-view fade-in">
        <div className="admin-view-head">
          <h2>Gestión de Portada</h2>
        </div>
        <p className="portada-cargando" aria-live="polite">
          Cargando ajustes de portada...
        </p>
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
            onClick={abrirVistaPrevia}
            aria-label="Abrir modal de vista previa de la portada"
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

        {/* SECCIÓN 3: ESPACIOS QUE INSPIRAN */}
        <SeccionImagenes
          id="seccion-inspiracion"
          titulo="Galería: Espacios que inspiran"
          descripcion="Fotografías de ambiente para la galería intermedia (admite de 2 a 3 imágenes). Si está vacía, se muestran las fotos predeterminadas."
          imagenes={imagenesInspiracion}
          onChange={handleCambioInspiracion}
          max={MAX_INSPIRACION}
          minimo={2}
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

      {/* MODAL DE VISTA PREVIA EN TIEMPO REAL */}
      {isPreviewOpen && (
        <div
          className="preview-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Vista previa de la portada"
          onClick={() => setIsPreviewOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.78)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
          }}
        >
          <div
            className="preview-modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '1120px',
              maxHeight: '92vh',
              backgroundColor: '#faf8f5',
              color: '#1f1f1f',
              borderRadius: '14px',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}
          >
            {/* Botón X en la esquina superior derecha */}
            <button
              type="button"
              className="preview-modal-close"
              onClick={() => setIsPreviewOpen(false)}
              aria-label="Cerrar vista previa"
              title="Cerrar vista previa"
              style={{
                position: 'sticky',
                top: '16px',
                float: 'right',
                marginRight: '16px',
                zIndex: 10000,
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: 'rgba(17, 17, 17, 0.85)',
                color: '#ffffff',
                fontSize: '20px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
              }}
            >
              ✕
            </button>

            {/* Aviso superior de vista previa en vivo */}
            <div
              style={{
                backgroundColor: '#1e293b',
                color: '#f8fafc',
                padding: '10px 24px',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <strong>Modo Vista Previa (En vivo):</strong>
              <span>
                Mostrando los cambios actuales en pantalla antes de guardar en la base de datos.
              </span>
            </div>

            {/* 1. Preview: Carrusel Hero */}
            <div style={{ position: 'relative', height: '420px', backgroundColor: '#111', overflow: 'hidden' }}>
              <img
                src={previewHeroUrls[heroPreviewIdx % previewHeroUrls.length]}
                alt={`Hero slide ${heroPreviewIdx + 1}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.82 }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(to top, rgba(0,0,0,0.65), rgba(0,0,0,0.15))',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  color: '#fff',
                  textAlign: 'center',
                  padding: '24px'
                }}
              >
                <span
                  style={{
                    fontSize: '12px',
                    textTransform: 'uppercase',
                    letterSpacing: '2px',
                    backgroundColor: 'rgba(0,0,0,0.55)',
                    padding: '4px 12px',
                    borderRadius: '999px',
                    marginBottom: '12px'
                  }}
                >
                  Carrusel Hero · Foto {(heroPreviewIdx % previewHeroUrls.length) + 1} de{' '}
                  {previewHeroUrls.length}
                </span>
                <h2 style={{ fontSize: '34px', margin: '0 0 10px', fontWeight: 700 }}>
                  Mobiliario con Historia y Carácter
                </h2>
                <p style={{ maxWidth: '560px', margin: '0 0 20px', opacity: 0.9 }}>
                  Piezas únicas seleccionadas y recuperadas para transformar tus espacios.
                </p>

                {previewHeroUrls.length > 1 && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    {previewHeroUrls.map((_, i) => (
                      <button
                        key={`dot-${i}`}
                        type="button"
                        onClick={() => setHeroPreviewIdx(i)}
                        aria-label={`Ver imagen Hero ${i + 1}`}
                        style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          border: 'none',
                          cursor: 'pointer',
                          backgroundColor:
                            i === heroPreviewIdx % previewHeroUrls.length
                              ? '#ffffff'
                              : 'rgba(255,255,255,0.4)'
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 2. Preview: Piezas Destacadas */}
            <div style={{ padding: '48px 32px' }}>
              <div style={{ marginBottom: '24px', textAlign: 'center' }}>
                <h3 style={{ fontSize: '26px', margin: '0 0 6px' }}>Piezas Destacadas</h3>
                <p style={{ color: '#666', margin: 0, fontSize: '14px' }}>
                  {productosDestacados.length > 0
                    ? `Mostrando ${productosDestacados.length} pieza(s) seleccionada(s) manualmente`
                    : 'Sin selección manual (mostrando las últimas 4 piezas del catálogo por defecto)'}
                </p>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                  gap: '20px'
                }}
              >
                {previewDestacados.map((mueble) => (
                  <div
                    key={`prev-dest-${mueble.id}`}
                    style={{
                      backgroundColor: '#fff',
                      borderRadius: '10px',
                      overflow: 'hidden',
                      border: '1px solid #e5e5e5'
                    }}
                  >
                    <img
                      src={mueble.imagenes?.[0] || PLACEHOLDER_IMG}
                      alt={mueble.nombre}
                      style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }}
                    />
                    <div style={{ padding: '14px' }}>
                      <strong style={{ display: 'block', fontSize: '15px', marginBottom: '4px' }}>
                        {mueble.nombre}
                      </strong>
                      <span style={{ fontSize: '12px', color: '#777' }}>
                        {mueble.categoria || 'Catálogo'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Preview: Galería Espacios que Inspiran */}
            <div style={{ padding: '40px 32px', backgroundColor: '#f1ede6' }}>
              <div style={{ marginBottom: '24px', textAlign: 'center' }}>
                <h3 style={{ fontSize: '26px', margin: '0 0 6px' }}>Espacios que inspiran</h3>
                <p style={{ color: '#666', margin: 0, fontSize: '14px' }}>
                  {imagenesInspiracion.length >= 2
                    ? `Mostrando ${imagenesInspiracion.length} fotografías personalizadas`
                    : 'Mostrando las 2 fotografías predeterminadas'}
                </p>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${previewInspiracionUrls.length}, 1fr)`,
                  gap: '16px'
                }}
              >
                {previewInspiracionUrls.map((url, idx) => (
                  <img
                    key={`prev-insp-${idx}`}
                    src={url}
                    alt={`Inspiración ${idx + 1}`}
                    style={{
                      width: '100%',
                      height: '260px',
                      objectFit: 'cover',
                      borderRadius: '10px',
                      display: 'block'
                    }}
                  />
                ))}
              </div>
            </div>

            {/* 4. Preview: Sostenibilidad */}
            <div
              style={{
                padding: '48px 32px',
                display: 'grid',
                gridTemplateColumns: previewSostenibilidadUrl ? '1fr 1fr' : '1fr',
                gap: '32px',
                alignItems: 'center'
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: '12px',
                    textTransform: 'uppercase',
                    letterSpacing: '1.5px',
                    color: '#4d6b53',
                    fontWeight: 600
                  }}
                >
                  Sostenibilidad · Segunda Vida
                </span>
                <h3 style={{ fontSize: '28px', margin: '8px 0 14px' }}>
                  El mueble más sostenible es el que ya existe
                </h3>
                <p style={{ color: '#555', lineHeight: 1.6, margin: 0 }}>
                  Apostamos por la recuperación y conservación de mobiliario con historia, reduciendo la
                  huella ecológica y dando una segunda vida a piezas irrepetibles.
                </p>
              </div>
              {previewSostenibilidadUrl && (
                <div>
                  <img
                    src={previewSostenibilidadUrl}
                    alt="Sostenibilidad"
                    style={{
                      width: '100%',
                      maxHeight: '320px',
                      objectFit: 'cover',
                      borderRadius: '12px',
                      display: 'block'
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PortadaTab;
