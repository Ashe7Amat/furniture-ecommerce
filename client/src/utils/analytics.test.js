import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// analytics.js lee VITE_GA_MEASUREMENT_ID al cargarse: cada test pone la variable que quiere y
// carga el módulo de nuevo.
const cargar = async (idDeMedicion) => {
  vi.stubEnv('VITE_GA_MEASUREMENT_ID', idDeMedicion);
  vi.resetModules();
  return import('./analytics');
};
const CLAVE = 'nave5-cookie-consent';
const scriptsDeGoogle = () => document.head.querySelectorAll('script[src^="https://www.googletagmanager.com/"]');

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  delete window.__ga4Loaded;
  delete window.dataLayer;
  delete window.gtag;
  scriptsDeGoogle().forEach((s) => s.remove());
});

describe('getStoredConsent', () => {
  it('sin consentimiento guardado devuelve null', async () => {
    const { getStoredConsent } = await cargar('');
    expect(getStoredConsent()).toBeNull();
  });

  it('devuelve lo guardado', async () => {
    const { getStoredConsent } = await cargar('');
    localStorage.setItem(CLAVE, JSON.stringify({ analytics: true, date: '2026-09-29T00:00:00.000Z' }));

    expect(getStoredConsent()).toEqual({ analytics: true, date: '2026-09-29T00:00:00.000Z' });
  });

  it('con algo que no es JSON guardado, devuelve null en vez de romper la página', async () => {
    const { getStoredConsent } = await cargar('');
    localStorage.setItem(CLAVE, '{roto');

    expect(getStoredConsent()).toBeNull();
  });

  it('sin localStorage (modo privado estricto), devuelve null', async () => {
    const { getStoredConsent } = await cargar('');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('SecurityError'); });

    expect(getStoredConsent()).toBeNull();
  });
});

describe('storeConsent', () => {
  it('guarda la elección con la fecha', async () => {
    const { storeConsent } = await cargar('');

    storeConsent(false);

    const guardado = JSON.parse(localStorage.getItem(CLAVE));
    expect(guardado.analytics).toBe(false);
    expect(new Date(guardado.date).toString()).not.toBe('Invalid Date');
  });

  it('sin localStorage no falla, y si se aceptó la analítica la arranca igualmente', async () => {
    const { storeConsent } = await cargar('G-PRUEBA');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });

    expect(() => storeConsent(true)).not.toThrow();
    expect(scriptsDeGoogle()).toHaveLength(1);
  });

  it('si se rechaza la analítica, no carga Google Analytics', async () => {
    const { storeConsent } = await cargar('G-PRUEBA');

    storeConsent(false);

    expect(scriptsDeGoogle()).toHaveLength(0);
    expect(window.gtag).toBeUndefined();
  });
});

describe('initAnalytics', () => {
  it('sin Measurement ID configurado no carga nada', async () => {
    const { initAnalytics } = await cargar('');

    initAnalytics();

    expect(scriptsDeGoogle()).toHaveLength(0);
    expect(window.__ga4Loaded).toBeUndefined();
  });

  it('con Measurement ID, carga el script de Google con ese id y configura gtag con la IP anonimizada', async () => {
    const { initAnalytics } = await cargar('G-PRUEBA');

    initAnalytics();

    const [script] = scriptsDeGoogle();
    expect(script.src).toBe('https://www.googletagmanager.com/gtag/js?id=G-PRUEBA');
    expect(script.async).toBe(true);
    expect(window.dataLayer.map((args) => args[0])).toEqual(['js', 'config']);
    expect(window.dataLayer[1]).toEqual(['config', 'G-PRUEBA', { anonymize_ip: true }]);
  });

  it('llamarla dos veces no carga el script dos veces', async () => {
    const { initAnalytics } = await cargar('G-PRUEBA');

    initAnalytics();
    initAnalytics();

    expect(scriptsDeGoogle()).toHaveLength(1);
    expect(window.dataLayer).toHaveLength(2);
  });
});
