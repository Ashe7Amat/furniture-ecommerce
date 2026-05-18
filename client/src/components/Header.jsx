import React, { useContext, useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import { FavoritesContext } from '../context/FavoritesContext';
import { CartContext } from '../context/CartContext';
import { getCategorias, getMuebles } from '../services/api';
import '../styles/HeaderFooter.css';

const Header = () => {
  const { user, logout } = useContext(AuthContext);
  const { showToast } = useContext(ToastContext);
  const { favorites } = useContext(FavoritesContext);
  const { cartItems, toggleCart } = useContext(CartContext);
  
  const [categorias, setCategorias] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // Search state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  
  // Megamenu state
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProductsMenuOpen, setIsProductsMenuOpen] = useState(false);

  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    getCategorias().then(data => setCategorias(data));
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Carga perezosa del catálogo al abrir el buscador por primera vez
  useEffect(() => {
    if (isSearchOpen && allProducts.length === 0) {
      getMuebles().then(data => setAllProducts(Array.isArray(data) ? data : []));
    }
  }, [isSearchOpen]);

  // Filtrado en vivo — case-insensitive sobre nombre y categoría
  useEffect(() => {
    const term = searchTerm.trim().toLowerCase();
    if (term.length === 0) {
      setSearchResults([]);
      return;
    }
    const filtered = allProducts.filter(p =>
      p.nombre?.toLowerCase().includes(term) ||
      p.categoria?.toLowerCase().includes(term)
    );
    setSearchResults(filtered);
  }, [searchTerm, allProducts]);

  const handleNavClick = (e, category) => {
    e.preventDefault();
    setIsMenuOpen(false);
    setIsProductsMenuOpen(false);
    navigate(`/catalogo?categoria=${category}`);
  };

  const handleLinkClick = (path) => {
    setIsMenuOpen(false);
    setIsProductsMenuOpen(false);
    navigate(path);
  };

  const closeSearch = () => {
    setIsSearchOpen(false);
    setSearchTerm('');
    setSearchResults([]);
  };

  const handleLogout = () => {
    logout();
    setIsDropdownOpen(false);
    showToast('Sesión cerrada. ¡Gracias por visitarnos!', 'success');
    navigate('/');
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  return (
    <>
      <header className="kave-header">
        <div className="header-left">
          <button className="hamburger-btn icon-btn" onClick={() => setIsMenuOpen(true)}>☰</button>
          <Link to="/" className="logo">Nave 5 Barcelona</Link>
        </div>
        
        <div className="header-center" style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <div className="header-search-bar" onClick={() => setIsSearchOpen(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#857468" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '16px' }}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span className="search-placeholder">¿Qué estás buscando?</span>
          </div>
        </div>

        <div className="header-right">

          <Link to="/cuenta?tab=favoritos" className="icon-btn header-fav-btn" aria-label="Favoritos">
            <svg width="20" height="20" viewBox="0 0 24 24" fill={favorites.length > 0 ? "#B38A70" : "none"} stroke={favorites.length > 0 ? "#B38A70" : "currentColor"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="header-icon-svg">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            {favorites.length > 0 && <span className="fav-badge">{favorites.length}</span>}
          </Link>
          
          {user ? (
            <div className="user-menu" ref={dropdownRef}>
              <button className="icon-btn user-menu-btn" onClick={toggleDropdown} aria-label="Cuenta">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="header-icon-svg">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span className="user-name">Hola, {user.nombre || user.email.split('@')[0]}</span>
              </button>
              {isDropdownOpen && (
                <div className="user-dropdown">
                  <Link to="/cuenta" className="dropdown-item" onClick={() => setIsDropdownOpen(false)}>
                    Mi Cuenta
                  </Link>
                  {user.rol === 'admin' && (
                    <Link to="/admin" className="dropdown-item" onClick={() => setIsDropdownOpen(false)}>
                      Panel Admin
                    </Link>
                  )}
                  <button className="dropdown-item logout-action" onClick={handleLogout}>
                    Cerrar Sesión
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="icon-btn" aria-label="Cuenta">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="header-icon-svg">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </Link>
          )}
          
          <button className="icon-btn header-fav-btn" aria-label="Cesta" onClick={toggleCart}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="header-icon-svg">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            {cartItems.length > 0 && <span className="fav-badge">{cartItems.length}</span>}
          </button>
        </div>
      </header>

      {/* --- SEARCH OVERLAY (always in DOM, toggled via CSS class) --- */}
      <div className={`search-overlay${isSearchOpen ? ' open' : ''}`}>
        <div className="search-backdrop" onClick={closeSearch}></div>
        <div className="search-panel">
          <div className="search-panel-header">
            <input 
              type="text" 
              placeholder="¿Qué estás buscando?" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              tabIndex={isSearchOpen ? 0 : -1}
              autoComplete="off"
            />
            <button className="close-search-btn" onClick={closeSearch}>✕ Cerrar</button>
          </div>
          <div className="search-panel-content">
            <div className="search-suggestions">
              <h3>Sugerencias</h3>
              <ul>
                {categorias.slice(0, 5).map(cat => (
                  <li key={cat.id} onClick={(e) => { closeSearch(); handleNavClick(e, cat.nombre); }}>{cat.nombre}</li>
                ))}
              </ul>
            </div>
            <div className="search-results">
              <h3>{searchTerm ? 'Resultados' : 'Te puede interesar'}</h3>

              {/* Resultados predictivos */}
              {searchTerm.trim() ? (
                searchResults.length > 0 ? (
                  <div className="search-live-results">
                    {searchResults.slice(0, 6).map(producto => (
                      <Link
                        to={`/producto/${producto.id}`}
                        key={producto.id}
                        className="search-live-item"
                        onClick={closeSearch}
                      >
                        <img
                          src={producto.imagenes?.[0] || 'https://via.placeholder.com/60'}
                          alt={producto.nombre}
                          className="search-live-img"
                        />
                        <div className="search-live-info">
                          <span className="search-live-name">{producto.nombre}</span>
                          <span className="search-live-cat">{producto.categoria}</span>
                        </div>
                        <span className="search-live-price">
                          {producto.precio_venta?.toLocaleString('es-ES')} €
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="no-results-text">
                    No se encontraron resultados para &ldquo;<strong>{searchTerm}</strong>&rdquo;
                  </p>
                )
              ) : (
                /* Estado vacío — grid editorial por defecto */
                <div className="search-results-grid">
                  <p className="no-results-text">Empieza a escribir para ver muebles...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* --- SIDE MENU (always in DOM, toggled via CSS class) --- */}
      <div className={`mega-menu-overlay${isMenuOpen ? ' open' : ''}`}>
        <div className="mega-menu-backdrop" onClick={() => { setIsMenuOpen(false); setIsProductsMenuOpen(false); }}></div>
        
        {/* Primera capa (Main Menu) */}
        <div className={`mega-menu-panel primary-panel${isMenuOpen ? ' open' : ''}${isProductsMenuOpen ? ' shifted' : ''}`}>
          <div className="mega-menu-header">
            <Link to="/" className="logo" onClick={() => { setIsMenuOpen(false); setIsProductsMenuOpen(false); }}>Nave 5 Barcelona</Link>
            <button className="mega-menu-close" onClick={() => { setIsMenuOpen(false); setIsProductsMenuOpen(false); }}>✕</button>
          </div>
          <ul className="mega-menu-list">
            <li>
              <button className="mega-menu-item" onClick={() => setIsProductsMenuOpen(true)}>
                Productos <span className="arrow">›</span>
              </button>
            </li>
            <li>
              <button className="mega-menu-item" onClick={() => handleLinkClick('/catalogo')}>
                Novedades
              </button>
            </li>
            <li>
              <button className="mega-menu-item" onClick={() => handleLinkClick('/sobre-nosotros')}>
                Inspiración
              </button>
            </li>
          </ul>
        </div>

        {/* Segunda capa (Products Submenu) */}
        <div className={`mega-menu-panel secondary-panel${isProductsMenuOpen ? ' open' : ''}`}>
          <div className="mega-menu-header">
            <button className="mega-menu-back" onClick={() => setIsProductsMenuOpen(false)}>‹ Volver</button>
            <h3>Productos</h3>
            <button className="mega-menu-close" onClick={() => { setIsMenuOpen(false); setIsProductsMenuOpen(false); }}>✕</button>
          </div>
          <ul className="mega-menu-list sub-list">
            {categorias.map(cat => (
              <li key={cat.id}>
                <button className="mega-menu-item" onClick={(e) => handleNavClick(e, cat.nombre)}>
                  {cat.nombre}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
};

export default Header;
