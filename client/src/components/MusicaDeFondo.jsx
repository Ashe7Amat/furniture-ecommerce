import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { EMISORAS, VOLUMEN, CONSULTA_ESCRITORIO } from '../utils/musica';
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

const useEsEscritorio = () => {
  const consulta = () => typeof window.matchMedia === 'function' && window.matchMedia(CONSULTA_ESCRITORIO).matches;
  const [esEscritorio, setEsEscritorio] = useState(consulta);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia(CONSULTA_ESCRITORIO);
    const alCambiar = () => setEsEscritorio(mq.matches);
    alCambiar();
    mq.addEventListener?.('change', alCambiar);
    return () => mq.removeEventListener?.('change', alCambiar);
  }, []);
  return esEscritorio;
};

// Radio de fondo opcional con un mini reproductor. Plegado es un botón redondo abajo a la
// izquierda; al pulsarlo se despliega y empieza a sonar (nunca suena sola: los navegadores
// bloquean el audio automático y, además, molesta). Vive fuera de <Routes>, así que sigue
// sonando al cambiar de página. Solo en ordenador y nunca en el panel de administración.
const MusicaDeFondo = () => {
  const esEscritorio = useEsEscritorio();
  const { pathname } = useLocation();
  if (!esEscritorio || pathname.startsWith('/admin')) return null;
  return <Reproductor />;
};

const Reproductor = () => {
  const audioRef = useRef(null);
  const botonAbrirRef = useRef(null);
  const botonPlayRef = useRef(null);
  // Lo que quiere el visitante (sonar o no). Sigue a los eventos play/pause del <audio>, también
  // cuando pausa el sistema (auriculares, teclas multimedia).
  const quiereSonar = useRef(false);
  // Tras una pausa, al reanudar hay que reconectar para volver al directo (y no a lo que quedó
  // en el búfer hace un rato).
  const reconectar = useRef(false);
  // Al cambiar de emisora: si sonaba, la nueva arranca sola.
  const seguirSonando = useRef(false);

  const [indice, setIndice] = useState(0);
  const [sonando, setSonando] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [fallo, setFallo] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const abiertoPrevio = useRef(abierto);

  const emisora = EMISORAS[indice];

  const reproducir = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    quiereSonar.current = true;
    setFallo(false);
    setCargando(true);
    audio.volume = VOLUMEN;
    if (reconectar.current) {
      reconectar.current = false;
      audio.load();
    }
    try {
      await audio.play();
    } catch (error) {
      // AbortError: se cambió de emisora antes de que arrancara; la nueva ya se encarga.
      if (error?.name === 'AbortError') return;
      quiereSonar.current = false;
      setCargando(false);
      // NotAllowedError: el navegador no deja (se queda en pausa sin más). Lo demás: la emisora
      // no responde o el formato no vale.
      if (error?.name !== 'NotAllowedError') setFallo(true);
    }
  }, []);

  const pausar = useCallback(() => {
    quiereSonar.current = false;
    reconectar.current = true;
    setCargando(false);
    audioRef.current?.pause();
  }, []);

  const cambiarEmisora = useCallback((paso) => {
    seguirSonando.current = quiereSonar.current;
    setFallo(false);
    setIndice((i) => (i + paso + EMISORAS.length) % EMISORAS.length);
  }, []);
  const anterior = useCallback(() => cambiarEmisora(-1), [cambiarEmisora]);
  const siguiente = useCallback(() => cambiarEmisora(1), [cambiarEmisora]);

  // Al cambiar de emisora, si estaba sonando, arranca la nueva.
  useEffect(() => {
    if (!seguirSonando.current) return;
    seguirSonando.current = false;
    reproducir();
  }, [indice, reproducir]);

  // Mientras el reproductor está en pantalla, el pie deja sitio al botón redondo. Al desmontarse
  // (entrar al panel, pasar a pantalla táctil) la radio se para.
  useEffect(() => {
    const audio = audioRef.current;
    document.documentElement.classList.add('con-musica');
    return () => {
      document.documentElement.classList.remove('con-musica');
      audio?.pause();
    };
  }, []);

  // Foco: al desplegar va al botón de reproducir; al plegar vuelve al botón redondo. Se compara
  // con el valor anterior (no con un "ya montado") para que StrictMode no robe el foco al cargar.
  useEffect(() => {
    if (abiertoPrevio.current === abierto) return;
    abiertoPrevio.current = abierto;
    (abierto ? botonPlayRef : botonAbrirRef).current?.focus();
  }, [abierto]);

  // Controles del sistema (teclas multimedia del teclado, widget de música del sistema operativo).
  useEffect(() => {
    if (!('mediaSession' in navigator) || typeof window.MediaMetadata !== 'function') return undefined;
    const ms = navigator.mediaSession;
    ms.metadata = new window.MediaMetadata({ title: emisora.nombre, artist: 'Radio France', album: 'En directo' });
    const acciones = { play: reproducir, pause: pausar, previoustrack: anterior, nexttrack: siguiente };
    const poner = (activas) => Object.keys(acciones).forEach((accion) => {
      try { ms.setActionHandler(accion, activas ? acciones[accion] : null); } catch { /* acción no soportada */ }
    });
    poner(true);
    return () => poner(false);
  }, [emisora, reproducir, pausar, anterior, siguiente]);

  const abrir = () => {
    setAbierto(true);
    if (!sonando && !cargando) reproducir();
  };

  const activo = sonando || cargando;
  const alternar = () => (activo ? pausar() : reproducir());
  const estado = fallo ? 'No disponible ahora' : cargando ? 'Conectando…' : sonando ? 'En directo' : 'En pausa';

  return (
    <>
      {/* preload="none": no se conecta a la emisora hasta que alguien pulsa reproducir. */}
      <audio
        ref={audioRef}
        src={emisora.url}
        preload="none"
        onPlay={() => { quiereSonar.current = true; setSonando(true); }}
        onPlaying={() => setCargando(false)}
        onWaiting={() => { if (quiereSonar.current) setCargando(true); }}
        onPause={() => {
          quiereSonar.current = false;
          reconectar.current = true;
          setSonando(false);
          setCargando(false);
        }}
        onError={() => {
          if (!quiereSonar.current) return;
          quiereSonar.current = false;
          setSonando(false);
          setCargando(false);
          setFallo(true);
        }}
        // Un directo no debería acabar (antes de "ended" llega un "pause"); si el servidor corta,
        // se reconecta.
        onEnded={() => {
          reconectar.current = true;
          reproducir();
        }}
      />

      {!abierto && (
        <button
          ref={botonAbrirRef}
          type="button"
          className={`musica-boton${activo ? ' sonando' : ''}`}
          onClick={abrir}
          aria-label={activo ? 'Abrir reproductor de radio' : 'Escuchar música'}
          title={activo ? `Sonando: ${emisora.nombre}` : 'Escuchar música'}
        >
          <Ondas />
        </button>
      )}

      {abierto && (
        <div
          className={`musica-panel${activo ? ' sonando' : ''}${cargando ? ' cargando' : ''}`}
          role="region"
          aria-label="Reproductor de radio"
          onKeyDown={(e) => { if (e.key === 'Escape') setAbierto(false); }}
        >
          <div className="musica-portada" aria-hidden="true">
            <Ondas />
          </div>

          <div className="musica-info" role="status">
            <p className={`musica-estado${fallo ? ' fallo' : ''}${sonando && !cargando ? ' directo' : ''}`}>{estado}</p>
            <p className="musica-nombre" title={emisora.descripcion}>{emisora.nombre}</p>
          </div>

          <div className="musica-controles">
            <button type="button" className="musica-ctrl" onClick={anterior} aria-label="Emisora anterior">
              <Icono><path d="M7 6h2v12H7zM10.5 12 18 6.5v11z" /></Icono>
            </button>
            <button
              ref={botonPlayRef}
              type="button"
              className="musica-ctrl musica-play"
              onClick={alternar}
              aria-label={activo ? 'Pausar radio' : 'Reproducir radio'}
            >
              {activo
                ? <Icono><path d="M7 5.5h3.5v13H7zM13.5 5.5H17v13h-3.5z" /></Icono>
                : <Icono><path d="M8 5.5v13l10.5-6.5z" /></Icono>}
            </button>
            <button type="button" className="musica-ctrl" onClick={siguiente} aria-label="Emisora siguiente">
              <Icono><path d="M15 6h2v12h-2zM13.5 12 6 17.5v-11z" /></Icono>
            </button>
          </div>

          <button type="button" className="musica-ctrl musica-plegar" onClick={() => setAbierto(false)} aria-label="Minimizar reproductor">
            <Icono><path d="M6.4 8.6 12 14.2l5.6-5.6L19 10l-7 7-7-7z" /></Icono>
          </button>
        </div>
      )}
    </>
  );
};

export default MusicaDeFondo;
