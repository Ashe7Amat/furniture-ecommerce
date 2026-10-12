import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import '../styles/MusicaDeFondo.css';

// Pista provisional (un acorde suave generado). Cuando el cliente confirme la canción y tenga
// derechos para usarla en la web, basta con dejar el archivo en public/audio/ y cambiar esta ruta.
export const PISTA = '/audio/musica-provisional.mp3';
const VOLUMEN = 0.35;

// Música de fondo opcional. Solo suena cuando el visitante pulsa el botón: los navegadores
// bloquean el audio automático con sonido y, además, sonar sin permiso molesta. Vive fuera de
// <Routes>, así que sigue sonando al cambiar de página. En el panel de administración no aparece.
const MusicaDeFondo = () => {
  const audioRef = useRef(null);
  const [sonando, setSonando] = useState(false);
  const { pathname } = useLocation();
  const enAdmin = pathname.startsWith('/admin');

  // Si se entra al panel con la música puesta, se para.
  useEffect(() => {
    if (enAdmin && audioRef.current && !audioRef.current.paused) audioRef.current.pause();
  }, [enAdmin]);

  const alternar = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.volume = VOLUMEN;
      try {
        await audio.play();
      } catch {
        // El navegador puede rechazarlo (p. ej. ahorro de datos); el botón sigue en "pausado".
      }
    } else {
      audio.pause();
    }
  };

  return (
    <>
      {/* preload="none": el archivo no se descarga hasta que alguien pulsa reproducir. */}
      <audio
        ref={audioRef}
        src={PISTA}
        loop
        preload="none"
        onPlay={() => setSonando(true)}
        onPause={() => setSonando(false)}
      />
      {!enAdmin && (
        <button
          type="button"
          className={`musica-boton${sonando ? ' sonando' : ''}`}
          onClick={alternar}
          aria-pressed={sonando}
          aria-label={sonando ? 'Pausar música' : 'Escuchar música'}
          title={sonando ? 'Pausar música' : 'Escuchar música'}
        >
          <span className="musica-ondas" aria-hidden="true">
            <span /><span /><span /><span />
          </span>
        </button>
      )}
    </>
  );
};

export default MusicaDeFondo;
