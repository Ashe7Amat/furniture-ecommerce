import { Helmet } from 'react-helmet-async';
import '../styles/InfoPage.css';

// Título/descripción por página: se define una vez aquí y beneficia a todas las páginas
// de contenido (Sobre Nosotros, Sostenibilidad, Contacto, Legal) que usan este layout --
// antes todas mostraban el mismo título genérico en la pestaña del navegador.
const InfoPageLayout = ({ eyebrow, title, tagline, wide = false, children }) => (
  <div className="info-page">
    <Helmet>
      <title>{`${title} | Nave 5 Barcelona`}</title>
      {tagline && <meta name="description" content={tagline} />}
    </Helmet>
    <div className={`info-page-inner ${wide ? 'info-page-wide' : ''}`}>
      <header className="info-page-header">
        <span className="info-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {tagline && <p className="info-tagline">{tagline}</p>}
      </header>
      <article className="info-content">{children}</article>
    </div>
  </div>
);

export default InfoPageLayout;
