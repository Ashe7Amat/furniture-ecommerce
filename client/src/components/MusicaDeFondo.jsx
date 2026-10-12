import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PISTAS, VOLUMEN, UMBRAL_REINICIO, formatearTiempo } from '../utils/musica';
import '../styles/MusicaDeFondo.css';

const Icono = ({ children }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" focusable="false">
    {children}
  </svg>
);

const Ondas = () => (
  <span className="musica-ondas" aria-hidden="true">
    <span /><span /><span /><span />
  </span>
);

// Música de fondo opcional con un mini reproductor. Plegado es un botón redondo abajo a la
// izquierda; al pulsarlo se despliega y empieza a sonar (nunca suena sola: los navegadores
// bloquean el audio automático y, además, molesta). Vive fuera de <Routes>, así que sigue
// sonando al cambiar de página. En el panel de administración no aparece.
const MusicaDeFondo = () => {
  const audioRef = useRef(null);
  const botonAbrirRef = useRef(null);
  const botonPlayRef = useRef(null);
  // Lo que quiere el visitante (sonar o no), aparte de lo que esté haciendo el <audio> ahora
  // mismo: al pasar de canción el navegador para un instante la anterior.
  const quiereSonar = useRef(false);
  const montado = useRef(false);

  const [indice, setIndice] = useState(0);
  const [sonando, setSonando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [tiempo, setTiempo] = useState(0);
  const [duracion, setDuracion] = useState(0);

  const { pathname } = useLocation();
  const enAdmin = pathname.startsWith('/admin');
  const pista = PISTAS[indice];

  const reproducir = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    quiereSonar.current = true;
    audio.volume = VOLUMEN;
    try {
      await audio.play();
    } catch (error) {
      // AbortError: se cambió de canción antes de que arrancara; la nueva ya se encarga.
      // Cualquier otro (p. ej. el navegador lo rechaza): el botón se queda en "pausado".
      if (error?.name !== 'AbortError') quiereSonar.current = false;
    }
  }, []);

  const pausar = useCallback(() => {
    quiereSonar.current = false;
    audioRef.current?.pause();
  }, []);

  const cambiarPista = useCallback((paso) => {
    setTiempo(0);
    setDuracion(0);
    setIndice((i) => (i + paso + PISTAS.length) % PISTAS.length);
  }, []);

  const anterior = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > UMBRAL_REINICIO) {
      audio.currentTime = 0;
      setTiempo(0);
      return;
    }
    cambiarPista(-1);
  }, [cambiarPista]);

  const siguiente = useCallback(() => cambiarPista(1), [cambiarPista]);

  // Al cambiar de canción, si estaba sonando, arranca la nueva.
  useEffect(() => {
    if (quiereSonar.current) reproducir();
  }, [indice, reproducir]);

  // Si se entra al panel con la música puesta, se para.
  useEffect(() => {
    if (enAdmin) pausar();
  }, [enAdmin, pausar]);

  // Foco: al desplegar va al botón de reproducir; al plegar vuelve al botón redondo.
  useEffect(() => {
    if (!montado.current) {
      montado.current = true;
      return;
    }
    (abierto ? botonPlayRef : botonAbrirRef).current?.focus();
  }, [abierto]);

  // Controles del sistema (pantalla de bloqueo del móvil, teclas multimedia).
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || typeof window.MediaMetadata !== 'function') return;
    const ms = navigator.mediaSession;
    ms.metadata = new window.MediaMetadata({ title: pista.titulo, artist: pista.artista, album: 'Nave 5 Barcelona' });
    const acciones = { play: reproducir, pause: pausar, previoustrack: anterior, nexttrack: siguiente };
    Object.entries(acciones).forEach(([accion, fn]) => {
      try { ms.setActionHandler(accion, fn); } catch { /* acción no soportada en este navegador */ }
    });
  }, [pista, reproducir, pausar, anterior, siguiente]);

  const abrir = () => {
    setAbierto(true);
    if (!sonando) reproducir();
  };

  const alternar = () => (sonando ? pausar() : reproducir());

  const buscar = (e) => {
    const valor = Number(e.target.value);
    if (audioRef.current) audioRef.current.currentTime = valor;
    setTiempo(valor);
  };

  const progreso = duracion > 0 ? Math.min(100, (tiempo / duracion) * 100) : 0;

  return (
    <>
      {/* preload="none": nada se descarga hasta que alguien pulsa reproducir. */}
      <audio
        ref={audioRef}
        src={pista.src}
        preload="none"
        onPlay={() => setSonando(true)}
        onPause={() => setSonando(false)}
        onEnded={siguiente}
        onTimeUpdate={(e) => setTiempo(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuracion(e.currentTarget.duration)}
        onDurationChange={(e) => setDuracion(e.currentTarget.duration)}
      />

      {!enAdmin && !abierto && (
        <button
          ref={botonAbrirRef}
          type="button"
          className={`musica-boton${sonando ? ' sonando' : ''}`}
          onClick={abrir}
          aria-label={sonando ? `Abrir reproductor de música (sonando: ${pista.titulo})` : 'Escuchar música'}
          title={sonando ? pista.titulo : 'Escuchar música'}
        >
          <Ondas />
        </button>
      )}

      {!enAdmin && abierto && (
        <div
          className={`musica-panel${sonando ? ' sonando' : ''}`}
          role="region"
          aria-label="Reproductor de música"
          onKeyDown={(e) => { if (e.key === 'Escape') setAbierto(false); }}
        >
          <div className="musica-portada" aria-hidden="true">
            <Ondas />
          </div>

          <div className="musica-info">
            <p className="musica-titulo">{pista.titulo}</p>
            <p className="musica-artista">{pista.artista}</p>
          </div>

          <div className="musica-controles">
            <button type="button" className="musica-ctrl" onClick={anterior} aria-label="Canción anterior">
              <Icono><path d="M7 6h2v12H7zM10.5 12 18 6.5v11z" /></Icono>
            </button>
            <button
              ref={botonPlayRef}
              type="button"
              className="musica-ctrl musica-play"
              onClick={alternar}
              aria-label={sonando ? 'Pausar música' : 'Reproducir música'}
            >
              {sonando
                ? <Icono><path d="M7 5.5h3.5v13H7zM13.5 5.5H17v13h-3.5z" /></Icono>
                : <Icono><path d="M8 5.5v13l10.5-6.5z" /></Icono>}
            </button>
            <button type="button" className="musica-ctrl" onClick={siguiente} aria-label="Canción siguiente">
              <Icono><path d="M15 6h2v12h-2zM13.5 12 6 17.5v-11z" /></Icono>
            </button>
          </div>

          <button type="button" className="musica-ctrl musica-plegar" onClick={() => setAbierto(false)} aria-label="Minimizar reproductor">
            <Icono><path d="M6.4 8.6 12 14.2l5.6-5.6L19 10l-7 7-7-7z" /></Icono>
          </button>

          <div className="musica-progreso">
            <span className="musica-tiempo">{formatearTiempo(tiempo)}</span>
            <input
              type="range"
              className="musica-rango"
              min="0"
              max={duracion || 0}
              step="0.1"
              value={Math.min(tiempo, duracion || 0)}
              onChange={buscar}
              disabled={!duracion}
              aria-label="Posición de la canción"
              aria-valuetext={`${formatearTiempo(tiempo)} de ${formatearTiempo(duracion)}`}
              style={{ '--progreso': `${progreso}%` }}
            />
            <span className="musica-tiempo">{formatearTiempo(duracion)}</span>
          </div>
        </div>
      )}
    </>
  );
};

export default MusicaDeFondo;
