import React from 'react';
import '../styles/InfoPage.css';

const InfoPageLayout = ({ eyebrow, title, tagline, wide = false, children }) => (
  <div className="info-page">
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
