// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { BRAND, brand } from './brand.config';

describe('brand.config.js', () => {
  it('exporta el objeto BRAND con las propiedades requeridas', () => {
    expect(BRAND.nombre).toBe('Nave 5 Barcelona');
    expect(BRAND.prefijoSku).toBe('NAV');
    expect(BRAND.moneda).toBe('EUR');
    expect(BRAND.locale).toBe('es-ES');
    expect(BRAND.modulos).toEqual({ ecommerce: true, bookings: true });
    expect(BRAND.contacto.email).toContain('@');
    expect(BRAND.contacto.telefono).toBeTruthy();
  });

  it('expone los atajos de la guía del starter, que leen los campos canónicos', () => {
    expect(BRAND.prefijoSKU).toBe(BRAND.prefijoSku);
    expect(BRAND.emailContacto).toBe('hola@nave5barcelona.com');
    expect(BRAND.telefono).toBe(BRAND.contacto.telefono);
    expect(BRAND.direccion).toBe(BRAND.contacto.direccion);
    expect(BRAND.redesSociales).toBe(BRAND.redes);
    expect(brand.prefijoSKU).toBe('NAV');
    expect(brand.get('emailContacto')).toBe('hola@nave5barcelona.com');
  });

  it('brand.get resuelve rutas anidadas y proporciona valor por defecto', () => {
    expect(brand.get('prefijoSku')).toBe('NAV');
    expect(brand.get('contacto.email')).toBe('hola@nave5barcelona.com');
    expect(brand.get('modulos.bookings')).toBe(true);
    expect(brand.get('inexistente', 'defecto')).toBe('defecto');
    expect(brand.get()).toEqual(BRAND);
  });
});

describe('tokens.css', () => {
  it('contiene todos los tokens requeridos de color, tipografía, espaciado y radios', () => {
    const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
    
    // Colores
    expect(css).toContain('--color-primary');
    expect(css).toContain('--color-accent');
    expect(css).toContain('--color-accent-text');
    expect(css).toContain('--color-surface');
    expect(css).toContain('--color-surface-alt');
    expect(css).toContain('--color-text');
    expect(css).toContain('--color-text-muted');
    expect(css).toContain('--color-border');
    expect(css).toContain('--color-success');
    expect(css).toContain('--color-warning');
    expect(css).toContain('--color-danger');
    expect(css).toContain('--color-etiqueta-bg');
    expect(css).toContain('--color-etiqueta-text');

    // Tipografía
    expect(css).toContain('--font-display');
    expect(css).toContain('--font-body');
    expect(css).toContain('--font-mono');

    // Espaciado
    expect(css).toContain('--space-xs');
    expect(css).toContain('--space-sm');
    expect(css).toContain('--space-md');
    expect(css).toContain('--space-lg');
    expect(css).toContain('--space-xl');

    // Radios
    expect(css).toContain('--radius-sm');
    expect(css).toContain('--radius-md');
    expect(css).toContain('--radius-lg');

    // Sombras
    expect(css).toContain('--shadow-sm');
    expect(css).toContain('--shadow-md');
    expect(css).toContain('--shadow-lg');

    // Alias retrocompatibles
    expect(css).toContain('--primary-color:');
    expect(css).toContain('--accent-color:');
    expect(css).toContain('--card-bg:');
    expect(css).toContain('--surface-alt:');
  });
});
