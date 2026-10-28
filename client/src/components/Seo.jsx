import PropTypes from 'prop-types';
import { useDocumentMeta } from '../utils/useDocumentMeta';

/**
 * Componente SEO reutilizable para gestión de meta tags y JSON-LD
 */
export default function Seo({
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
  useDocumentMeta({
    title,
    description,
    image,
    url,
    type,
    canonical,
    noindex,
    nofollow,
    jsonLd
  });

  return null;
}

Seo.propTypes = {
  title: PropTypes.string,
  description: PropTypes.string,
  image: PropTypes.string,
  url: PropTypes.string,
  type: PropTypes.string,
  canonical: PropTypes.string,
  noindex: PropTypes.bool,
  nofollow: PropTypes.bool,
  jsonLd: PropTypes.oneOfType([PropTypes.object, PropTypes.string])
};
