import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import EnlaceComoLlegar from './EnlaceComoLlegar';
import '../styles/HeaderFooter.css';
import { BRAND } from '../theme/brand.config';

const Footer = () => {
  const { user } = useContext(AuthContext);
  
  return (
    <footer className="kave-footer">
      <div className="footer-top">
        {/* Aquí iba un bloque de newsletter sin nada detrás: «Suscribirme» no guardaba el email. Se quitó
            el 28 oct 2026 (decisión de Ashe); vuelve cuando haya dónde guardar las altas y texto de privacidad. */}
        <div className="footer-visita">
          {/* DIRECCIÓN FÍSICA */}
          <div className="footer-address">
            <p className="footer-address-label">Visítanos</p>
            <address className="footer-address-text">
              {BRAND.contacto.direccion}<br />
              {`${BRAND.contacto.codigoPostal} ${BRAND.contacto.ciudad}`}
            </address>
            <EnlaceComoLlegar className="footer-como-llegar" />
          </div>
        </div>

        <div className="footer-links">
          <div className="footer-column">
            <h2>Nosotros</h2>
            <Link to="/sobre-nosotros">La marca</Link>
            <Link to="/sostenibilidad">Sostenibilidad</Link>
            <Link to="/legal">Aviso Legal</Link>
            <Link to="/privacidad">Privacidad</Link>
            <Link to="/terminos">Términos y Condiciones</Link>
          </div>
          <div className="footer-column">
            <h2>Contacto</h2>
            <Link to="/contacto">Contacto</Link>
            <a
              href={BRAND.redes.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="footer-instagram-link"
            >
              {`Instagram @${BRAND.redes.instagramUsuario}`}
            </a>
          </div>
          <div className="footer-column">
            <h2>Cuenta</h2>
            {/* Siempre a /cuenta, con o sin sesión (H50): sin sesión, ProtectedRoute manda al login con esta
                ruta guardada y, al entrar, se vuelve a ella. Con /login directo se perdía y se acababa en la
                portada. */}
            <Link to="/cuenta">Mi cuenta</Link>
            <Link to="/cuenta?tab=pedidos">Mis pedidos</Link>
            {/* Solo al administrador (H30): antes salía también a quien no había iniciado sesión. */}
            {user?.rol === 'admin' && <Link to="/admin">Panel Admin</Link>}
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        {/* Solo los medios que acepta el pago de verdad (tarjeta, `payment_method_types: ['card']` en el
            servidor). PayPal y Apple Pay salían aquí sin funcionar; vuelven cuando se activen en Stripe. */}
        <div className="payment-icons">
          <span>Visa</span>
          <span>Mastercard</span>
        </div>
        <div className="copyright">
          {`© 2026 ${BRAND.nombre}. Todos los derechos reservados.`}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
