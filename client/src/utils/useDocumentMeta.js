import { useEffect } from 'react';

const DEFAULT_TITLE = 'Nave 5 Barcelona | Almacén de ideas';
const DEFAULT_DESCRIPTION =
  'Almacén de ideas en el corazón de Barcelona: muebles y piezas restauradas con historia, cuidadas al detalle para dar vida a tus espacios.';
const DEFAULT_IMAGE = '/og-image.png';
const BASE_URL = 'https://www.nave5barcelona.com';

const setMetaByAttr = (attr, key, content) => {
  let tag = document.querySelector(`meta[${attr}="${key}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
};

const setLinkCanonical = (href) => {
  let link = document.querySelector('link[rel="canonical"]');
  if (href) {
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', href);
  } else if (link) {
    link.remove();
  }
};

const setJsonLd = (data) => {
  let script = document.getElementById('structured-data-jsonld');
  if (data) {
    if (!script) {
      script = document.createElement('script');
      script.setAttribute('type', 'application/ld+json');
      script.setAttribute('id', 'structured-data-jsonld');
      document.head.appendChild(script);
    }
    script.textContent = typeof data === 'string' ? data : JSON.stringify(data);
  } else if (script) {
    script.remove();
  }
};

export function useDocumentMeta({
  title,
  description,
  image,
  url,
  type = 'website',
  canonical,
  noindex = false,
  nofollow = false,
  jsonLd
}) {
  useEffect(() => {
    let fullTitle = DEFAULT_TITLE;
    if (title) {
      fullTitle = title.includes('Nave 5 Barcelona') ? title : `${title} | Nave 5 Barcelona`;
    }

    const finalDescription = description || DEFAULT_DESCRIPTION;
    const finalImage = image || DEFAULT_IMAGE;
    const finalUrl = url ? (url.startsWith('http') ? url : `${BASE_URL}${url}`) : BASE_URL;

    document.title = fullTitle;
    setMetaByAttr('name', 'description', finalDescription);
    setMetaByAttr('property', 'og:title', fullTitle);
    setMetaByAttr('property', 'og:description', finalDescription);
    setMetaByAttr('property', 'og:image', finalImage);
    setMetaByAttr('property', 'og:url', finalUrl);
    setMetaByAttr('property', 'og:type', type);
    setMetaByAttr('name', 'twitter:card', 'summary_large_image');
    setMetaByAttr('name', 'twitter:title', fullTitle);
    setMetaByAttr('name', 'twitter:description', finalDescription);
    setMetaByAttr('name', 'twitter:image', finalImage);

    // Canonical link
    if (canonical) {
      const canonicalHref = canonical.startsWith('http') ? canonical : `${BASE_URL}${canonical}`;
      setLinkCanonical(canonicalHref);
    } else {
      setLinkCanonical(null);
    }

    // Robots meta tag
    let metaRobots = document.querySelector('meta[name="robots"]');
    if (noindex || nofollow) {
      if (!metaRobots) {
        metaRobots = document.createElement('meta');
        metaRobots.setAttribute('name', 'robots');
        document.head.appendChild(metaRobots);
      }
      const directives = [];
      if (noindex) directives.push('noindex');
      if (nofollow) directives.push('nofollow');
      metaRobots.setAttribute('content', directives.join(', '));
    } else if (metaRobots) {
      metaRobots.remove();
    }

    // JSON-LD structured data
    setJsonLd(jsonLd);

    return () => {
      document.title = DEFAULT_TITLE;
      setMetaByAttr('name', 'description', DEFAULT_DESCRIPTION);
      setMetaByAttr('property', 'og:title', DEFAULT_TITLE);
      setMetaByAttr('property', 'og:description', DEFAULT_DESCRIPTION);
      setMetaByAttr('property', 'og:image', DEFAULT_IMAGE);
      setMetaByAttr('property', 'og:url', BASE_URL);
      setMetaByAttr('property', 'og:type', 'website');
      setMetaByAttr('name', 'twitter:card', 'summary_large_image');
      setMetaByAttr('name', 'twitter:title', DEFAULT_TITLE);
      setMetaByAttr('name', 'twitter:description', DEFAULT_DESCRIPTION);
      setMetaByAttr('name', 'twitter:image', DEFAULT_IMAGE);
      setLinkCanonical(null);
      setJsonLd(null);

      const leftoverRobots = document.querySelector('meta[name="robots"]');
      if (leftoverRobots) leftoverRobots.remove();
    };
  }, [title, description, image, url, type, canonical, noindex, nofollow, jsonLd]);
}
