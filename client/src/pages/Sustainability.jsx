import React from 'react';

const Sustainability = () => {
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
          }}>Compromiso</span>
          <h1 style={{
            fontSize: '3rem',
            fontWeight: 300,
            margin: '10px 0 0 0',
            lineHeight: 1.2,
            letterSpacing: '-0.02em'
          }}>Sostenibilidad y Restauración</h1>
          <p style={{
            fontStyle: 'italic',
            fontSize: '1.2rem',
            color: '#857468',
            marginTop: '10px',
            fontWeight: 300
          }}>Diseño con impacto positivo</p>
        </header>

        {/* Content */}
        <article style={{
          fontSize: '1.15rem',
          lineHeight: '1.8',
          fontWeight: 300,
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          textAlign: 'justify'
        }}>
          <p>
            Creemos firmemente que el mueble más sostenible del planeta es aquel que <strong>ya existe</strong>. En una era dominada por la producción en masa acelerada y el consumo de usar y tirar (fast-furniture), en <strong>Nave 5 Barcelona</strong> apostamos por una alternativa consciente y de impacto positivo a través de la economía circular y la restauración consciente.
          </p>
          <p>
            La fabricación masiva de mobiliario moderno genera una alta huella de carbono, impulsando la deforestación de bosques sensibles y el uso intensivo de colas plásticas y aglomerados que no se pueden reciclar. Nuestro enfoque es diametralmente opuesto: buscamos, recuperamos y restauramos piezas que ya han superado la prueba del tiempo. Al hacerlo, evitamos la demanda de nuevos recursos naturales y rescatamos la energía, el agua y la madera ya invertidas en su día.
          </p>

          <div style={{
            margin: '20px 0',
            padding: '24px',
            borderLeft: '2px solid #B38A70',
            backgroundColor: '#FCFAF8',
            borderRadius: '4px'
          }}>
            <p style={{
              margin: 0,
              fontSize: '1.25rem',
              fontWeight: 300,
              color: '#3E322A',
              lineHeight: '1.6',
              fontStyle: 'italic'
            }}>
              "Cada mueble restaurado en nuestro taller representa una victoria directa contra el olvido y una huella ecológica evitada."
            </p>
          </div>

          <h2 style={{ fontSize: '1.8rem', fontWeight: 300, color: '#3E322A', marginTop: '20px' }}>Nuestros Pilares Ecológicos</h2>
          
          <ul style={{
            paddingLeft: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '15px',
            listStyleType: 'square'
          }}>
            <li>
              <strong>Economía Circular Activa:</strong> Reintroducimos piezas antiguas en el mercado dándoles un nuevo sentido estético e higienizándolas para que duren otra generación.
            </li>
            <li>
              <strong>Procesos y Materiales Limpios:</strong> En nuestro taller utilizamos únicamente ceras naturales de abejas, aceites minerales respetuosos con el medio ambiente y pinturas a base de agua con bajos compuestos orgánicos volátiles (COVs).
            </li>
            <li>
              <strong>Recuperación de Madera Noble:</strong> Priorizamos la restauración de muebles hechos con maderas macizas como el roble, el nogal, el castaño y la teca, materiales de una calidad imposible de encontrar en el mobiliario genérico actual.
            </li>
            <li>
              <strong>Diseño Atemporal:</strong> Al huir de modas efímeras, seleccionamos piezas cuyo diseño y presencia arquitectónica trascienden tendencias pasajeras, asegurando que sigan resultando hermosas y funcionales durante décadas.
            </li>
          </ul>

          <p style={{ marginTop: '20px' }}>
            Consumir diseño sostenible en Nave 5 Barcelona es una declaración de intenciones. Significa valorar el oficio del artesano, preferir la autenticidad frente a la uniformidad y entender que el confort en el hogar puede y debe convivir en perfecta armonía con el cuidado de nuestro planeta.
          </p>
        </article>
      </div>
    </div>
  );
};

export default Sustainability;
