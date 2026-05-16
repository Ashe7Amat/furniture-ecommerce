import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import { FavoritesContext } from '../context/FavoritesContext';
import { getMuebles } from '../services/api';
import { Link, useSearchParams } from 'react-router-dom';
import './Profile.css';

export default function Profile() {
  const { user, login } = useContext(AuthContext);
  const { showToast } = useContext(ToastContext);
  const { favorites } = useContext(FavoritesContext);
  const [searchParams] = useSearchParams();
  
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'datos');
  const [nombre, setNombre] = useState(user?.nombre || '');
  const [email, setEmail] = useState(user?.email || '');
  const [loading, setLoading] = useState(false);
  const [favMuebles, setFavMuebles] = useState([]);

  useEffect(() => {
    if (activeTab === 'favoritos') {
      getMuebles().then(data => {
        setFavMuebles(data.filter(m => favorites.includes(m.id)));
      });
    }
  }, [activeTab, favorites]);

  if (!user) {
    return (
      <div className="profile-container-empty">
        <p>Debes iniciar sesión para ver tu perfil.</p>
      </div>
    );
  }

  const handleUpdatePerfil = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/auth/perfil-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailActual: user.email,
          nuevoNombre: nombre,
          nuevoEmail: email
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        login(data.user); 
        showToast('¡Perfil actualizado con éxito!', 'success');
      } else {
        showToast(data.error || 'Error al actualizar', 'error');
      }
    } catch (error) {
      showToast('Error de conexión con el servidor', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-page-wrapper">
      <div className="profile-header">
        <h1>Mi Cuenta</h1>
        <p className="welcome-text">Hola, <strong>{user.nombre}</strong>. Gestiona tus datos y revisa tus selecciones desde aquí.</p>
      </div>

      <div className="profile-layout">
        <aside className="profile-tabs-menu">
          <button 
            className={activeTab === 'datos' ? 'active' : ''} 
            onClick={() => setActiveTab('datos')}
          >
            Mis Datos
          </button>
          <button 
            className={activeTab === 'favoritos' ? 'active' : ''} 
            onClick={() => setActiveTab('favoritos')}
          >
            Mis Favoritos ({favorites.length})
          </button>
          <button 
            className={activeTab === 'pedidos' ? 'active' : ''} 
            onClick={() => setActiveTab('pedidos')}
          >
            Historial de Pedidos
          </button>
        </aside>

        <main className="profile-tab-content">
          {activeTab === 'datos' && (
            <div className="tab-pane-animate">
              <h2>Información Personal</h2>
              <form onSubmit={handleUpdatePerfil} className="profile-form-minimal">
                <div className="form-group-clean">
                  <label>Nombre completo</label>
                  <input 
                    type="text" 
                    value={nombre} 
                    onChange={(e) => setNombre(e.target.value)} 
                    required
                  />
                </div>
                <div className="form-group-clean">
                  <label>Correo electrónico</label>
                  <input 
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    required
                  />
                </div>
                <button type="submit" className="btn-black-solid" disabled={loading}>
                  {loading ? 'Guardando...' : 'GUARDAR CAMBIOS'}
                </button>
              </form>
            </div>
          )}

          {activeTab === 'favoritos' && (
            <div className="tab-pane-animate">
              <h2>Tus Piezas Favoritas</h2>
              {favorites.length === 0 ? (
                <p className="empty-tab-text">Aún no has guardado ningún mueble en tus favoritos.</p>
              ) : (
                <div className="favorites-profile-grid">
                  {favMuebles.map(mueble => (
                    <Link to={`/mueble/${mueble.id}`} key={mueble.id} className="favorite-mini-card">
                      <img src={mueble.imagenes?.[0] || 'https://via.placeholder.com/400'} alt={mueble.nombre} />
                      <div className="fav-mini-info">
                        <h4>{mueble.nombre}</h4>
                        <p>{mueble.precio_venta} €</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'pedidos' && (
            <div className="tab-pane-animate">
              <h2>Historial de Compras</h2>
              <div className="orders-mock-list">
                <div className="order-mock-item">
                  <div className="order-item-header">
                    <span>Pedido <strong>#KH-2026-8941</strong></span>
                    <span className="order-status badge-success">Entregado</span>
                  </div>
                  <p className="order-date">Realizado el: 14 de Mayo, 2026</p>
                  <p className="order-total">Total: 499,00 € (Simulado - Pago Apple Pay)</p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}