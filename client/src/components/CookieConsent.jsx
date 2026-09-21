import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getStoredConsent, storeConsent, initAnalytics } from '../utils/analytics';
import '../styles/CookieConsent.css';

const CookieConsent = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = getStoredConsent();
    if (!stored) {
      setVisible(true);
    } else if (stored.analytics) {
      initAnalytics();
    }
  }, []);

  const handleChoice = (analytics) => {
    storeConsent(analytics);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-label="Consentimiento de cookies">
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
