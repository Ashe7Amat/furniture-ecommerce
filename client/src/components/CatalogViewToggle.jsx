// client/src/components/CatalogViewToggle.jsx
//
// Selector de densidad de cuadrícula y vista en lista/tabla del catálogo.
// Componente controlado (no lee ni escribe localStorage directamente: eso vive en useCatalogView).
import '../styles/Catalog.css';

const CatalogViewToggle = ({ vista, onChange }) => (
  <div className="catalog-view-toggle" role="group" aria-label="Vista del catálogo">
    {/* Grid Grande: 2 columnas */}
    <button
      type="button"
      className={`catalog-view-btn ${vista === 'grid-large' ? 'active' : ''}`}
      aria-pressed={vista === 'grid-large'}
      aria-label="Vista de 2 columnas"
      title="Vista grande (2 columnas)"
      onClick={() => onChange('grid-large')}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="8" height="18" rx="1.5" />
        <rect x="13" y="3" width="8" height="18" rx="1.5" />
      </svg>
    </button>

    {/* Grid Normal: 3 columnas */}
    <button
      type="button"
      className={`catalog-view-btn ${vista === 'grid-normal' ? 'active' : ''}`}
      aria-pressed={vista === 'grid-normal'}
      aria-label="Vista de 3 columnas"
      title="Vista estándar (3 columnas)"
      onClick={() => onChange('grid-normal')}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    </button>

    {/* Grid Compacto: 4 columnas */}
    <button
      type="button"
      className={`catalog-view-btn ${vista === 'grid-compact' ? 'active' : ''}`}
      aria-pressed={vista === 'grid-compact'}
      aria-label="Vista de 4 columnas"
      title="Vista compacta (4 columnas)"
      onClick={() => onChange('grid-compact')}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="3" width="4" height="18" rx="0.75" />
        <rect x="8" y="3" width="4" height="18" rx="0.75" />
        <rect x="14" y="3" width="4" height="18" rx="0.75" />
        <rect x="20" y="3" width="4" height="18" rx="0.75" />
      </svg>
    </button>

    {/* Tabla / Lista */}
    <button
      type="button"
      className={`catalog-view-btn ${vista === 'table' ? 'active' : ''}`}
      aria-pressed={vista === 'table'}
      aria-label="Vista de lista"
      title="Vista en lista detallada"
      onClick={() => onChange('table')}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    </button>
  </div>
);

export default CatalogViewToggle;
