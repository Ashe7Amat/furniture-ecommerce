import React, { useContext, useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import { FavoritesContext } from '../context/FavoritesContext';
import { CartContext } from '../context/CartContext';
import { getCategorias, buscarMuebles } from '../services/api';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  
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

  useEffect(() => {
    if (searchQuery.length > 2) {
      buscarMuebles(searchQuery).then(data => setSearchResults(data));
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const handleNavClick = (e, category) => {
    e.preventDefault();
    setIsMenuOpen(false);
    setIsProductsMenuOpen(false);
    navigate(`/catalogo?categoria=${category}`);
  };

  const closeSearch = () => {
    setIsSearchOpen(false);
    setSearchQuery('');
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
          <Link to="/" className="logo">Kave Home</Link>
        </div>
        
        <div className="header-center" style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <div className="header-search-bar" onClick={() => setIsSearchOpen(true)}>
            <span style={{fontSize: '1.2rem', paddingLeft: '15px', color: '#666'}}>🔍</span>
            <span className="search-placeholder">¿Qué estás buscando?</span>
          </div>
        </div>

        <div className="header-right">

          <Link to="/cuenta?tab=favoritos" className="icon-btn header-fav-btn" aria-label="Favoritos">
            🤍
            {favorites.length > 0 && <span className="fav-badge">{favorites.length}</span>}
          </Link>
          
          {user ? (
            <div className="user-menu" ref={dropdownRef}>
              <button className="icon-btn user-menu-btn" onClick={toggleDropdown} aria-label="Cuenta">
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
            <Link to="/login" className="icon-btn" aria-label="Cuenta">👤</Link>
          )}
          
          <button className="icon-btn header-fav-btn" aria-label="Cesta" onClick={toggleCart}>
            🛒
            {cartItems.length > 0 && <span className="fav-badge">{cartItems.length}</span>}
          </button>
        </div>
      </header>

      {/* --- SEARCH OVERLAY --- */}
      {isSearchOpen && (
        <div className="search-overlay fade-in">
          <div className="search-backdrop" onClick={closeSearch}></div>
          <div className="search-panel">
            <div className="search-panel-header">
              <input 
                type="text" 
                placeholder="¿Qué estás buscando?" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
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
                <h3>Te puede interesar</h3>
                <div className="search-results-grid">
                  {searchResults.length > 0 ? searchResults.map(item => (
                    <Link to={`/mueble/${item.id}`} key={item.id} className="search-result-card" onClick={closeSearch}>
                      <img src={item.imagenes ? item.imagenes[0] : 'https://via.placeholder.com/150'} alt={item.nombre} />
                      <p>{item.nombre}</p>
                    </Link>
                  )) : (
                    <p className="no-results-text">Empieza a escribir para ver muebles...</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- SIDE MENU (MEGAMENU) --- */}
      {isMenuOpen && (
        <div className="mega-menu-overlay fade-in">
          <div className="mega-menu-backdrop" onClick={() => { setIsMenuOpen(false); setIsProductsMenuOpen(false); }}></div>
          
          {/* Primera capa (Main Menu) */}
          <div className={`mega-menu-panel primary-panel ${isMenuOpen ? 'open' : ''} ${isProductsMenuOpen ? 'shifted' : ''}`}>
            <div className="mega-menu-header">
              <Link to="/" className="logo" onClick={() => { setIsMenuOpen(false); setIsProductsMenuOpen(false); }}>Kave Home</Link>
              <button className="mega-menu-close" onClick={() => { setIsMenuOpen(false); setIsProductsMenuOpen(false); }}>✕</button>
            </div>
            <ul className="mega-menu-list">
              <li>
                <button className="mega-menu-item" onClick={() => setIsProductsMenuOpen(true)}>
                  Productos <span className="arrow">›</span>
                </button>
              </li>
              <li><button className="mega-menu-item">Novedades</button></li>
              <li><button className="mega-menu-item">Inspiración</button></li>
            </ul>
          </div>

          {/* Segunda capa (Products Submenu) */}
          <div className={`mega-menu-panel secondary-panel ${isProductsMenuOpen ? 'open' : ''}`}>
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
      )}
    </>
  );
};

export default Header;
