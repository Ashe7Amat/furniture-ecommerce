import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import '../styles/HeaderFooter.css';

const Footer = () => {
  const { user } = useContext(AuthContext);
  
  return (
    <footer className="kave-footer">
      <div className="footer-top">
        <div className="footer-newsletter">
          <h2>Únete a nuestra newsletter</h2>
          <p>Y recibe nuestras novedades y tendencias de diseño.</p>
          <div className="newsletter-form">
            <input type="email" placeholder="Tu email" />
            <button>Suscribirme</button>
          </div>

          {/* DIRECCIÓN FÍSICA */}
          <div className="footer-address">
            <p className="footer-address-label">Visítanos</p>
            <address className="footer-address-text">
              Carrer del Plom, 32-34, interior<br />
              08038 Barcelona
            </address>
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
              href="https://www.instagram.com/nave5bcn"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-instagram-link"
            >
              Instagram @nave5bcn
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
        <div className="payment-icons">
          <span>Visa</span>
          <span>Mastercard</span>
          <span>PayPal</span>
          <span>Apple Pay</span>
        </div>
        <div className="copyright">
          © 2026 Nave 5 Barcelona. Todos los derechos reservados.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
