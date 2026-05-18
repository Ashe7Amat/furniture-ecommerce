import React from 'react';

const Legal = () => {
  return (
    <div style={{
      backgroundColor: '#F5F2EC',
      color: '#3E322A',
      minHeight: '80vh',
      padding: '80px 20px',
      fontFamily: '"Outfit", "Inter", sans-serif',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <div style={{
        maxWidth: '800px',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '40px'
      }}>
        {/* Header */}
        <header style={{ borderBottom: '1px solid #E2DCD0', paddingBottom: '20px' }}>
          <span style={{
            fontSize: '0.85rem',
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            color: '#857468',
            fontWeight: 600
          }}>Legal</span>
          <h1 style={{
            fontSize: '3rem',
            fontWeight: 300,
            margin: '10px 0 0 0',
            lineHeight: 1.2,
            letterSpacing: '-0.02em'
          }}>Aviso Legal y Privacidad</h1>
          <p style={{
            fontStyle: 'italic',
            fontSize: '1.2rem',
            color: '#857468',
            marginTop: '10px',
            fontWeight: 300
          }}>Términos de servicio y uso</p>
        </header>

        {/* Content */}
        <article style={{
          fontSize: '1.05rem',
          lineHeight: '1.8',
          fontWeight: 300,
          display: 'flex',
          flexDirection: 'column',
          gap: '30px',
          textAlign: 'justify'
        }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 400, color: '#3E322A', marginBottom: '12px', borderBottom: '1px dashed #E2DCD0', paddingBottom: '6px' }}>1. Información General</h2>
            <p>
              En cumplimiento del deber de información contemplado en el artículo 10 de la Ley 34/2002, de 11 de julio, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), se facilitan a continuación los siguientes datos identificativos del titular del sitio web:
            </p>
            <ul style={{ paddingLeft: '20px', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li><strong>Denominación Social:</strong> Nave 5 Barcelona S.L.</li>
              <li><strong>NIF:</strong> B-00000000</li>
              <li><strong>Domicilio Social:</strong> Carrer del Plom, 32-34, interior, 08038 Barcelona</li>
              <li><strong>Contacto:</strong> hola@nave5barcelona.com</li>
            </ul>
          </div>

          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 400, color: '#3E322A', marginBottom: '12px', borderBottom: '1px dashed #E2DCD0', paddingBottom: '6px' }}>2. Propiedad Intelectual y Uso del Sitio Web</h2>
            <p>
              El sitio web y sus contenidos originales, incluyendo textos, diseños gráficos, logotipos, imágenes y código fuente, son propiedad exclusiva de <strong>Nave 5 Barcelona</strong> y están protegidos por las leyes internacionales de propiedad intelectual y marcas.
            </p>
            <p style={{ marginTop: '10px' }}>
              El usuario se compromete a realizar un uso diligente y lícito de este sitio web. Queda prohibida la reproducción, distribución, comunicación pública o transformación no autorizada de cualquiera de sus elementos sin el consentimiento explícito y por escrito de sus titulares.
            </p>
          </div>

          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 400, color: '#3E322A', marginBottom: '12px', borderBottom: '1px dashed #E2DCD0', paddingBottom: '6px' }}>3. Política de Privacidad (RGPD)</h2>
            <p>
              De conformidad con el Reglamento (UE) 2016/679 del Parlamento Europeo y del Consejo, de 27 de abril de 2016 (RGPD), y la Ley Orgánica 3/2018 (LOPDGDD), informamos que los datos recabados en nuestros formularios se tratarán bajo la responsabilidad de Nave 5 Barcelona S.L. con la única finalidad de gestionar sus solicitudes de información, pedidos y citas personalizadas.
            </p>
            <p style={{ marginTop: '10px' }}>
              Sus datos no serán cedidos a terceros salvo obligación legal y se conservarán mientras dure la relación comercial o durante los años necesarios para cumplir con las obligaciones legales correspondientes. El usuario tiene derecho a acceder, rectificar, limitar y solicitar la supresión de sus datos personales enviando un correo electrónico a <strong>hola@nave5barcelona.com</strong>.
            </p>
          </div>

          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 400, color: '#3E322A', marginBottom: '12px', borderBottom: '1px dashed #E2DCD0', paddingBottom: '6px' }}>4. Limitación de Responsabilidad</h2>
            <p>
              Nave 5 Barcelona no se hace responsable de los posibles daños o perjuicios que puedan derivarse de interferencias, omisiones, interrupciones, virus informáticos o desconexiones en el funcionamiento operativo de este sistema electrónico, motivados por causas ajenas al titular.
            </p>
          </div>
        </article>
      </div>
    </div>
  );
};

export default Legal;
