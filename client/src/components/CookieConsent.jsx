import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getStoredConsent, storeConsent, initAnalytics } from '../utils/analytics';
import '../styles/CookieConsent.css';

const CookieConsent = () => {
  const [visible, setVisible] = useState(false);
  const avisoRef = useRef(null);

  useEffect(() => {
    const stored = getStoredConsent();
    if (!stored) {
      setVisible(true);
    } else if (stored.analytics) {
      initAnalytics();
    }
  }, []);

  // Mientras el aviso está abierto, deja su alto en --alto-aviso-cookies para que lo que flota abajo
  // (el botón de la música) se suba encima en vez de quedar tapado. Si un bloqueador de avisos de
  // cookies lo oculta, mide 0 y no mueve nada.
  useEffect(() => {
    const aviso = avisoRef.current;
    if (!aviso) return undefined;
    const raiz = document.documentElement.style;
    const medir = () => raiz.setProperty('--alto-aviso-cookies', `${aviso.offsetHeight}px`);
    medir();
    const observador = typeof ResizeObserver === 'function' ? new ResizeObserver(medir) : null;
    observador?.observe(aviso);
    return () => {
      observador?.disconnect();
      raiz.removeProperty('--alto-aviso-cookies');
    };
  }, [visible]);

  const handleChoice = (analytics) => {
    storeConsent(analytics);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div ref={avisoRef} className="cookie-banner" role="dialog" aria-label="Consentimiento de cookies">
      <p>
        Usamos cookies esenciales para que la web funcione y, si nos das permiso, cookies de analítica para entender cómo se usa el sitio. Puedes leer más en nuestra{' '}
        <Link to="/privacidad">Política de Privacidad</Link>.
      </p>
      <div className="cookie-banner-actions">
        <button className="cookie-btn-ghost" onClick={() => handleChoice(false)}>Solo esenciales</button>
        <button className="cookie-btn-solid" onClick={() => handleChoice(true)}>Aceptar todo</button>
      </div>
    </div>
  );
};

export default CookieConsent;
