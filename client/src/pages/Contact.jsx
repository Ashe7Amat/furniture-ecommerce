import React, { useState } from 'react';

const Contact = () => {
  const [sent, setSent] = useState(false);
  const [formData, setFormData] = useState({ nombre: '', email: '', mensaje: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    setSent(true);
    setFormData({ nombre: '', email: '', mensaje: '' });
    setTimeout(() => setSent(false), 5000);
  };

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
        maxWidth: '900px',
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
          }}>Contacto</span>
          <h1 style={{
            fontSize: '3rem',
            fontWeight: 300,
            margin: '10px 0 0 0',
            lineHeight: 1.2,
            letterSpacing: '-0.02em'
          }}>Conecta con Nosotros</h1>
          <p style={{
            fontStyle: 'italic',
            fontSize: '1.2rem',
            color: '#857468',
            marginTop: '10px',
            fontWeight: 300
          }}>Visítanos o escríbenos</p>
        </header>

        {/* Two-Column Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '50px',
          marginTop: '20px'
        }}>
          {/* Details Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#857468', marginBottom: '12px' }}>El Almacén</h3>
              <p style={{ fontSize: '1.15rem', lineHeight: '1.6', margin: 0, fontWeight: 300 }}>
                Carrer del Plom, 32-34, interior<br />
                08038 Barcelona
              </p>
              <p style={{ fontSize: '0.95rem', color: '#857468', marginTop: '8px', fontWeight: 300 }}>
                *Acceso por el callejón interior privado.
              </p>
            </div>

            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#857468', marginBottom: '12px' }}>Horario de Visitas</h3>
              <p style={{ fontSize: '1.15rem', lineHeight: '1.6', margin: 0, fontWeight: 300 }}>
                De lunes a viernes<br />
                Bajo cita previa personalizada
              </p>
            </div>

            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#857468', marginBottom: '12px' }}>Correo Electrónico</h3>
              <a href="mailto:hola@nave5barcelona.com" style={{ fontSize: '1.15rem', color: '#B38A70', textDecoration: 'none', borderBottom: '1px dashed #B38A70', alignSelf: 'flex-start', paddingBottom: '2px', fontWeight: 300 }}>
                hola@nave5barcelona.com
              </a>
            </div>
          </div>

          {/* Form Column */}
          <div style={{
            backgroundColor: '#FCFAF8',
            border: '1px solid #E2DCD0',
            borderRadius: '6px',
            padding: '30px',
            boxShadow: '0 4px 20px rgba(62,50,42,0.02)'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 400, color: '#3E322A', marginBottom: '20px' }}>Escríbenos tu idea</h3>
            
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: '#857468', fontWeight: 600 }}>Nombre:</label>
                <input 
                  type="text" 
                  value={formData.nombre} 
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} 
                  required
                  style={{
                    padding: '12px',
                    border: '1px solid #E2DCD0',
                    borderRadius: '4px',
                    backgroundColor: '#FCFAF8',
                    color: '#3E322A',
                    fontFamily: 'inherit',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#B38A70'}
                  onBlur={(e) => e.target.style.borderColor = '#E2DCD0'}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: '#857468', fontWeight: 600 }}>Email:</label>
                <input 
                  type="email" 
                  value={formData.email} 
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
                  required
                  style={{
                    padding: '12px',
                    border: '1px solid #E2DCD0',
                    borderRadius: '4px',
                    backgroundColor: '#FCFAF8',
                    color: '#3E322A',
                    fontFamily: 'inherit',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#B38A70'}
                  onBlur={(e) => e.target.style.borderColor = '#E2DCD0'}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: '#857468', fontWeight: 600 }}>Mensaje:</label>
                <textarea 
                  value={formData.mensaje} 
                  onChange={(e) => setFormData({ ...formData, mensaje: e.target.value })} 
                  required
                  rows="4"
                  style={{
                    padding: '12px',
                    border: '1px solid #E2DCD0',
                    borderRadius: '4px',
                    backgroundColor: '#FCFAF8',
                    color: '#3E322A',
                    fontFamily: 'inherit',
                    outline: 'none',
                    resize: 'vertical',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#B38A70'}
                  onBlur={(e) => e.target.style.borderColor = '#E2DCD0'}
                />
              </div>

              <button 
                type="submit" 
                style={{
                  backgroundColor: '#B38A70',
                  color: '#FCFAF8',
                  border: 'none',
                  padding: '14px',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  fontFamily: 'inherit',
                  marginTop: '10px'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#9D735A'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#B38A70'}
              >
                Enviar Mensaje
              </button>
            </form>

            {sent && (
              <div style={{
                marginTop: '15px',
                padding: '12px',
                backgroundColor: '#e8f5e9',
                color: '#2e7d32',
                borderRadius: '4px',
                fontSize: '0.9rem',
                textAlign: 'center',
                border: '1px solid #c8e6c9'
              }}>
                ✓ ¡Mensaje enviado con éxito! Te responderemos en menos de 24 horas.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
