import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import Seo from './Seo';

describe('Componente Seo', () => {
  beforeEach(() => {
    document.title = '';
    const oldTags = document.querySelectorAll('meta, link[rel="canonical"], script[type="application/ld+json"]');
    oldTags.forEach(el => el.remove());
  });

  afterEach(() => {
    document.title = '';
  });

  it('renderiza null y actualiza el título y meta descripción', () => {
    const { container } = render(
      <Seo
        title="Pieza Especial"
        description="Descripción detallada de la pieza"
      />
    );
    expect(container.firstChild).toBeNull();
    expect(document.title).toContain('Pieza Especial');
    const metaDesc = document.querySelector('meta[name="description"]');
    expect(metaDesc).not.toBeNull();
    expect(metaDesc.getAttribute('content')).toBe('Descripción detallada de la pieza');
  });

  it('genera canonical y robots noindex nofollow adecuadamente', () => {
    render(
      <Seo
        title="Admin"
        canonical="/admin"
        noindex
        nofollow
      />
    );
    const linkCanonical = document.querySelector('link[rel="canonical"]');
    expect(linkCanonical).not.toBeNull();
    expect(linkCanonical.getAttribute('href')).toBe('https://www.nave5barcelona.com/admin');

    const metaRobots = document.querySelector('meta[name="robots"]');
    expect(metaRobots).not.toBeNull();
    expect(metaRobots.getAttribute('content')).toBe('noindex, nofollow');
  });

  it('inyecta script de JSON-LD estructurado correctamente', () => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: 'Nave 5 Barcelona'
    };
    render(<Seo jsonLd={schema} />);
    const script = document.getElementById('structured-data-jsonld');
    expect(script).not.toBeNull();
    expect(JSON.parse(script.textContent)).toEqual(schema);
  });
});
