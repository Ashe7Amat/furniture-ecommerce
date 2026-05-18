import React from 'react';

const About = () => {
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
          }}>Sobre Nosotros</span>
          <h1 style={{
            fontSize: '3rem',
            fontWeight: 300,
            margin: '10px 0 0 0',
            lineHeight: 1.2,
            letterSpacing: '-0.02em'
          }}>Nave 5 Barcelona</h1>
          <p style={{
            fontStyle: 'italic',
            fontSize: '1.2rem',
            color: '#857468',
            marginTop: '10px',
            fontWeight: 300
          }}>Almacén de ideas</p>
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
            En el corazón del distrito industrial de Barcelona, en un antiguo almacén reconvertido, nace <strong>Nave 5 Barcelona</strong>. Nos definimos como un <em>almacén de ideas</em>, un espacio híbrido donde el diseño, la artesanía y la devoción por la historia se encuentran para dar una segunda vida al mobiliario excepcional.
          </p>
          <p>
            Nuestra pasión radica en el rescate y la recuperación activa de muebles vintage, maderas nobles y objetos singulares con alma. Piezas que han resistido el paso de las décadas y que, a menudo, quedan olvidadas en desvanes, talleres antiguos o fábricas abandonadas. Vemos la belleza en la pátina del tiempo, en las vetas desgastadas y en las uniones hechas a mano por maestros carpinteros de otra época.
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
              "No fabricamos muebles nuevos; rescatamos el carácter y el oficio del pasado para integrarlo con orgullo en los hogares contemporáneos."
            </p>
          </div>

          <p>
            Cada pieza que entra en nuestro taller es sometida a un cuidadoso proceso de restauración artesanal. Respetamos su autenticidad y su historia, saneando las estructuras mediante técnicas respetuosas con los materiales originales y aplicando acabados naturales como aceites orgánicos, cera de abejas y pigmentos ecológicos. El resultado son muebles únicos, cargados de carácter, listos para escribir un nuevo capítulo en tu espacio.
          </p>
          <p>
            Nave 5 Barcelona no es solo una tienda de muebles; es un punto de encuentro para amantes del diseño slow, coleccionistas de tesoros y creadores que buscan inspiración. Te invitamos a sumergirte en nuestro catálogo y a compartir nuestra visión de un diseño más humano, histórico y respetuoso.
          </p>
        </article>
      </div>
    </div>
  );
};

export default About;
