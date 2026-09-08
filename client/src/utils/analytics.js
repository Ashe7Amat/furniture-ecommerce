const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;
const STORAGE_KEY = 'nave5-cookie-consent';

export const getStoredConsent = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const storeConsent = (analytics) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ analytics, date: new Date().toISOString() }));
  } catch {
    // localStorage no disponible (modo privado, etc.) -- no bloqueamos la navegación por esto
  }
  if (analytics) initAnalytics();
};

// Inyecta Google Analytics 4 solo tras el consentimiento, y solo si hay un
// Measurement ID configurado (VITE_GA_MEASUREMENT_ID en el .env del cliente).
export const initAnalytics = () => {
  if (!MEASUREMENT_ID || window.__ga4Loaded) return;
  window.__ga4Loaded = true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args) { window.dataLayer.push(args); };
  window.gtag('js', new Date());
  window.gtag('config', MEASUREMENT_ID, { anonymize_ip: true });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);
};
