import { useState } from 'react';
import InfoPageLayout from '../components/InfoPageLayout';

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
    <InfoPageLayout eyebrow="Contacto" title="Conecta con Nosotros" tagline="Visítanos o escríbenos" wide>
      <div className="contact-grid">
        <div className="contact-details">
          <div className="contact-detail-block">
            <h3>El Almacén</h3>
            <p>
              Carrer del Plom, 32-34, interior<br />
              08038 Barcelona
            </p>
            <p className="contact-detail-note">*Acceso por el callejón interior privado.</p>
          </div>

          <div className="contact-detail-block">
            <h3>Horario de Visitas</h3>
            <p>
              De lunes a viernes<br />
              Bajo cita previa personalizada
            </p>
          </div>

          <div className="contact-detail-block">
            <h3>Correo Electrónico</h3>
            <a href="mailto:hola@nave5barcelona.com" className="contact-email-link">
              hola@nave5barcelona.com
            </a>
          </div>
        </div>

        <div className="contact-form-card">
          <h3>Escríbenos tu idea</h3>

          <form onSubmit={handleSubmit} className="contact-form">
            <div className="contact-field">
              <label>Nombre:</label>
              <input
                type="text"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                required
              />
            </div>

            <div className="contact-field">
              <label>Email:</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            <div className="contact-field">
              <label>Mensaje:</label>
              <textarea
                value={formData.mensaje}
                onChange={(e) => setFormData({ ...formData, mensaje: e.target.value })}
                required
                rows="4"
              />
            </div>

            <button type="submit" className="contact-submit-btn">
              Enviar Mensaje
            </button>
          </form>

          {sent && (
            <div className="contact-success-msg">
              ✓ ¡Mensaje enviado con éxito! Te responderemos en menos de 24 horas.
            </div>
          )}
        </div>
      </div>
    </InfoPageLayout>
  );
};

export default Contact;
