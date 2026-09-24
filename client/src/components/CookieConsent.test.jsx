import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import CookieConsent from './CookieConsent';
import * as analytics from '../utils/analytics';

const STORAGE_KEY = 'nave5-cookie-consent';

const renderConsent = () => render(
  <MemoryRouter>
    <CookieConsent />
  </MemoryRouter>
);

describe('CookieConsent', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(analytics, 'initAnalytics').mockImplementation(() => {});
    vi.spyOn(analytics, 'storeConsent');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sin consentimiento previo guardado, muestra el banner', () => {
    renderConsent();
    expect(screen.getByRole('dialog', { name: 'Consentimiento de cookies' })).toBeInTheDocument();
  });

  it('con un consentimiento ya guardado, no muestra el banner', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ analytics: false, date: new Date().toISOString() }));
    renderConsent();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('con un consentimiento previo que aceptó analítica, inicializa analytics de nuevo al cargar', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ analytics: true, date: new Date().toISOString() }));
    renderConsent();
    expect(analytics.initAnalytics).toHaveBeenCalledTimes(1);
  });

  it('con un consentimiento previo que rechazó analítica, no inicializa analytics', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ analytics: false, date: new Date().toISOString() }));
    renderConsent();
    expect(analytics.initAnalytics).not.toHaveBeenCalled();
  });

  it('"Solo esenciales" guarda el rechazo, no llama a initAnalytics, y cierra el banner', async () => {
    renderConsent();

    await userEvent.click(screen.getByText('Solo esenciales'));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(analytics.storeConsent).toHaveBeenCalledWith(false);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).analytics).toBe(false);
    expect(analytics.initAnalytics).not.toHaveBeenCalled();
  });

  it('"Aceptar todo" guarda la aceptación (analytics: true) y cierra el banner', async () => {
    renderConsent();

    await userEvent.click(screen.getByText('Aceptar todo'));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(analytics.storeConsent).toHaveBeenCalledWith(true);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).analytics).toBe(true);
  });

  it('incluye un enlace a la Política de Privacidad', () => {
    renderConsent();
    expect(screen.getByRole('link', { name: 'Política de Privacidad' })).toHaveAttribute('href', '/privacidad');
  });
});
