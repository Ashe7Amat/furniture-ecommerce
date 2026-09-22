// client/src/components/CatalogViewToggle.jsx
//
// Toggle cuadrícula/tabla del catálogo. Componente controlado (no lee ni escribe
// localStorage por sí mismo: eso vive en useCatalogView) para poder probarlo sin montar
// la página completa.
import '../styles/Catalog.css';

const CatalogViewToggle = ({ vista, onChange }) => (
  <div className="catalog-view-toggle" role="group" aria-label="Vista del catálogo">
    <button
      type="button"
      className={`catalog-view-btn ${vista === 'grid' ? 'active' : ''}`}
      aria-pressed={vista === 'grid'}
      aria-label="Vista cuadrícula"
      onClick={() => onChange('grid')}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    </button>
    <button
      type="button"
      className={`catalog-view-btn ${vista === 'table' ? 'active' : ''}`}
      aria-pressed={vista === 'table'}
      aria-label="Vista lista"
      onClick={() => onChange('table')}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    </button>
  </div>
);

export default CatalogViewToggle;
