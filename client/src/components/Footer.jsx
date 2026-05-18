import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import '../styles/HeaderFooter.css';

const Footer = () => {
  const { user } = useContext(AuthContext);
  
  return (
    <footer className="kave-footer">
      <div className="footer-top">
        <div className="footer-newsletter">
          <h3>Únete a nuestra newsletter</h3>
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
            <h4>Nosotros</h4>
            <a href="#">La marca</a>
            <a href="#">Sostenibilidad</a>
            <a href="#">Nuestro espacio</a>
          </div>
          <div className="footer-column">
            <h4>Contacto</h4>
            <a href="#">Preguntas frecuentes</a>
            <a href="#">Centro de ayuda</a>
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
            <h4>Cuenta</h4>
            <Link to={user ? "/cuenta" : "/login"}>Mi cuenta</Link>
            <a href="#">Mis pedidos</a>
            {(!user || user.rol === 'admin') && <Link to="/admin">Panel Admin</Link>}
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
