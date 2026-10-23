import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { enviarContacto } from '../services/api';
import useDialogoModal from '../utils/useDialogoModal';
import { PLACEHOLDER_IMG } from '../utils/images';
import '../styles/ModalContacto.css';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ModalContacto = ({ mueble, onClose }) => {
  const modalRef = useRef(null);
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [errorMsg, setErrorMsg] = useState('');

  const mensajeInicial = mueble
    ? `Hola, me interesa la pieza "${mueble.nombre}"${mueble.referencia ? ` (ref. ${mueble.referencia})` : ''}. ¿Me podéis dar más información?`
    : '';

  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    mensaje: mensajeInicial,
    web: ''
  });

  useDialogoModal(true, modalRef, onClose);

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
  };

  const imagen = mueble?.imagenes?.[0] || PLACEHOLDER_IMG;

  return createPortal(
    <div
      className="mc-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mc-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mc-card" ref={modalRef} tabIndex={-1}>
        <button className="mc-close-btn" onClick={onClose} aria-label="Cerrar ventana">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="mc-header">
          <span className="mc-eyebrow">Solicitud de pieza única</span>
          <h2 id="mc-title" className="mc-title font-display">
            Solicitar información
          </h2>
          {mueble && (
            <div className="mc-piece-preview">
              <img src={imagen} alt={mueble.nombre} className="mc-piece-thumb" />
              <div className="mc-piece-info">
                <span className="mc-piece-name font-display">{mueble.nombre}</span>
                {mueble.referencia && (
                  <span className="mc-piece-ref">Ref. {mueble.referencia}</span>
                )}
              </div>
            </div>
          )}
        </div>

        {status === 'sent' ? (
          <div className="mc-success" role="status">
            <div className="mc-success-icon">✓</div>
            <h3 className="mc-success-title font-display">Solicitud recibida</h3>
            <p className="mc-success-desc">
              Hemos recibido tu interés por <strong>{mueble?.nombre}</strong>. Nos pondremos en
              contacto contigo a la mayor brevedad con todos los detalles.
            </p>
            <button type="button" className="mc-btn mc-btn-primary" onClick={onClose}>
              Cerrar y volver a la pieza
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mc-form" noValidate>
            {/* Honeypot anti-spam */}
            <input
              type="text"
              name="web"
              value={formData.web}
              onChange={(e) => setFormData({ ...formData, web: e.target.value })}
              autoComplete="off"
              tabIndex={-1}
              aria-hidden="true"
              className="mc-honeypot"
            />

            <div className="mc-field">
              <label htmlFor="mc-nombre">Nombre completo</label>
              <input
                id="mc-nombre"
                type="text"
                autoComplete="name"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Tu nombre y apellidos"
                required
              />
            </div>

            <div className="mc-field">
              <label htmlFor="mc-email">Correo electrónico</label>
              <input
                id="mc-email"
                type="email"
                autoComplete="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="ejemplo@correo.es"
                required
              />
            </div>

            <div className="mc-field">
              <label htmlFor="mc-mensaje">Mensaje</label>
              <textarea
                id="mc-mensaje"
                rows="4"
                value={formData.mensaje}
                onChange={(e) => setFormData({ ...formData, mensaje: e.target.value })}
                required
              />
            </div>

            {status === 'error' && <p className="mc-error" role="alert">{errorMsg}</p>}

            <div className="mc-actions">
              <button
                type="submit"
                className="mc-btn mc-btn-primary"
                disabled={status === 'sending'}
              >
                {status === 'sending' ? 'Enviando solicitud…' : 'Enviar solicitud'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
};

export default ModalContacto;
