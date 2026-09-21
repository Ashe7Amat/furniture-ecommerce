import { useState } from 'react';
import InfoPageLayout from '../components/InfoPageLayout';
import { enviarContacto } from '../services/api';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const Contact = () => {
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [errorMsg, setErrorMsg] = useState('');
  const [formData, setFormData] = useState({ nombre: '', email: '', mensaje: '', web: '' });

  const validar = () => {
    if (!formData.nombre.trim() || formData.nombre.trim().length < 2) {
      return 'Indica tu nombre.';
    }
    if (!EMAIL_REGEX.test(formData.email)) {
      return 'Indica un correo electrónico válido.';
    }
    if (formData.mensaje.trim().length < 10) {
      return 'Cuéntanos un poco más — el mensaje debe tener al menos 10 caracteres.';
    }
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const error = validar();
    if (error) {
      setStatus('error');
      setErrorMsg(error);
      return;
    }

    setStatus('sending');
    const res = await enviarContacto(formData);
    if (res.error) {
      setStatus('error');
      setErrorMsg(res.error);
      return;
    }

    setStatus('sent');
    setFormData({ nombre: '', email: '', mensaje: '', web: '' });
    setTimeout(() => setStatus('idle'), 6000);
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
            {/* Honeypot anti-spam: oculto para personas, visible para bots que rellenan todo */}
            <input
              type="text"
              name="web"
              value={formData.web}
              onChange={(e) => setFormData({ ...formData, web: e.target.value })}
              autoComplete="off"
              tabIndex={-1}
              aria-hidden="true"
              className="contact-honeypot"
            />

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

            {status === 'error' && <p className="contact-error-msg">{errorMsg}</p>}

            <button type="submit" className="contact-submit-btn" disabled={status === 'sending'}>
              {status === 'sending' ? 'Enviando…' : 'Enviar Mensaje'}
            </button>
          </form>

          {status === 'sent' && (
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
