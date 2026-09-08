import { useEffect } from 'react';

const DEFAULT_TITLE = 'Nave 5 Barcelona | Almacén de ideas';
const DEFAULT_DESCRIPTION = 'Almacén de ideas en el corazón de Barcelona: muebles y piezas restauradas con historia, cuidadas al detalle para dar vida a tus espacios.';
const DEFAULT_IMAGE = '/og-image.png';

const setMetaByAttr = (attr, key, content) => {
  let tag = document.querySelector(`meta[${attr}="${key}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
};

// Pone el <title> y las etiquetas <meta> (description, Open Graph, Twitter Card) de la
// página actual. Reemplaza a react-helmet-async, que en este proyecto dejaba de
// actualizar el <head> después del primer cambio de ruta (problema conocido de esa
// librería con React 18 StrictMode) -- esta versión manipula el DOM directamente, sin
// depender de un tercero.
export function useDocumentMeta({ title, description, image, noindex = false }) {
  useEffect(() => {
    const fullTitle = title ? `${title} | Nave 5 Barcelona` : DEFAULT_TITLE;
    const finalDescription = description || DEFAULT_DESCRIPTION;
    const finalImage = image || DEFAULT_IMAGE;

    document.title = fullTitle;
    setMetaByAttr('name', 'description', finalDescription);
    setMetaByAttr('property', 'og:title', fullTitle);
    setMetaByAttr('property', 'og:description', finalDescription);
    setMetaByAttr('property', 'og:image', finalImage);
    setMetaByAttr('name', 'twitter:title', fullTitle);
    setMetaByAttr('name', 'twitter:description', finalDescription);
    setMetaByAttr('name', 'twitter:image', finalImage);

    let metaRobots = document.querySelector('meta[name="robots"]');
    if (noindex) {
      if (!metaRobots) {
        metaRobots = document.createElement('meta');
        metaRobots.setAttribute('name', 'robots');
        document.head.appendChild(metaRobots);
      }
      metaRobots.setAttribute('content', 'noindex');
    } else if (metaRobots) {
      metaRobots.remove();
    }

    return () => {
      document.title = DEFAULT_TITLE;
      setMetaByAttr('name', 'description', DEFAULT_DESCRIPTION);
      setMetaByAttr('property', 'og:title', DEFAULT_TITLE);
      setMetaByAttr('property', 'og:description', DEFAULT_DESCRIPTION);
      setMetaByAttr('property', 'og:image', DEFAULT_IMAGE);
      setMetaByAttr('name', 'twitter:title', DEFAULT_TITLE);
      setMetaByAttr('name', 'twitter:description', DEFAULT_DESCRIPTION);
      setMetaByAttr('name', 'twitter:image', DEFAULT_IMAGE);
      const leftoverRobots = document.querySelector('meta[name="robots"]');
      if (leftoverRobots) leftoverRobots.remove();
    };
  }, [title, description, image, noindex]);
}
