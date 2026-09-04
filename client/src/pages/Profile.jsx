import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import { FavoritesContext } from '../context/FavoritesContext';
import { getMuebles, updateProfile, getMisPedidos } from '../services/api';
import { formatPrice } from '../utils/format';
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
  const [passwordActual, setPasswordActual] = useState('');
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmarNuevaPassword, setConfirmarNuevaPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [favMuebles, setFavMuebles] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [cargandoPedidos, setCargandoPedidos] = useState(false);

  useEffect(() => {
    if (activeTab === 'favoritos') {
      getMuebles().then(data => {
        setFavMuebles(data.filter(m => favorites.includes(m.id)));
      });
    }
  }, [activeTab, favorites]);

  useEffect(() => {
    if (activeTab === 'pedidos') {
      setCargandoPedidos(true);
      getMisPedidos().then(data => {
        setPedidos(Array.isArray(data) ? data : []);
        setCargandoPedidos(false);
      });
    }
  }, [activeTab]);

  const ETIQUETA_ESTADO = { procesando: 'Procesando', enviado: 'Enviado', entregado: 'Entregado', cancelado: 'Cancelado' };
  const CLASE_ESTADO = { procesando: 'badge-warning', enviado: 'badge-info', entregado: 'badge-success', cancelado: 'badge-danger' };

  if (!user) {
    return (
      <div className="profile-container-empty">
        <p>Debes iniciar sesión para ver tu perfil.</p>
      </div>
    );
  }

  const handleUpdatePerfil = async (e) => {
    e.preventDefault();
    
    const estaCambiandoEmail = email !== user.email;
    const estaCambiandoPassword = nuevaPassword.length > 0;

    if ((estaCambiandoEmail || estaCambiandoPassword) && !passwordActual) {
      showToast('Debes ingresar tu contraseña actual para autorizar cambios en tu correo o contraseña.', 'error');
      return;
    }

    if (nuevaPassword && nuevaPassword !== confirmarNuevaPassword) {
      showToast('Las nuevas contraseñas no coinciden.', 'error');
      return;
    }

    setLoading(true);
    try {
      const data = await updateProfile({
        emailActual: user.email,
        nuevoNombre: nombre,
        nuevoEmail: email,
        passwordActual: (estaCambiandoEmail || estaCambiandoPassword) ? passwordActual : undefined,
        nuevaPassword: estaCambiandoPassword ? nuevaPassword : undefined
      });

      if (data.error) {
        showToast(data.error, 'error');
      } else {
        login(data.user);
        setPasswordActual('');
        setNuevaPassword('');
        setConfirmarNuevaPassword('');
        showToast('¡Perfil actualizado con éxito!', 'success');
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
                
                <div className="form-group-clean form-group-security">
                  <label>Contraseña actual (Solo requerida si cambias correo o contraseña)</label>
                  <input 
                    type="password" 
                    value={passwordActual} 
                    onChange={(e) => setPasswordActual(e.target.value)} 
                    placeholder="Introduce tu contraseña para autorizar"
                  />
                </div>

                <div className="form-group-clean">
                  <label>Nueva contraseña (Dejar en blanco si no deseas cambiarla)</label>
                  <input 
                    type="password" 
                    value={nuevaPassword} 
                    onChange={(e) => setNuevaPassword(e.target.value)} 
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>

                <div className="form-group-clean">
                  <label>Confirmar nueva contraseña</label>
                  <input 
                    type="password" 
                    value={confirmarNuevaPassword} 
                    onChange={(e) => setConfirmarNuevaPassword(e.target.value)} 
                    placeholder="Repite la nueva contraseña"
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
                      <img src={mueble.imagenes?.[0] || 'https://via.placeholder.com/400'} alt={mueble.nombre} loading="lazy" decoding="async" />
                      <div className="fav-mini-info">
                        <h4>{mueble.nombre}</h4>
                        <p>{mueble.precio_venta ? `${formatPrice(mueble.precio_venta)} €` : (mueble.precio_alquiler_dia ? `${formatPrice(mueble.precio_alquiler_dia)} €/día` : 'Consultar')}</p>
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
              {cargandoPedidos ? (
                <p className="empty-tab-text">Cargando tus pedidos...</p>
              ) : pedidos.length === 0 ? (
                <p className="empty-tab-text">
                  Todavía no has hecho ninguna compra. Cuando compres algo con este correo ({user.email}), aparecerá aquí.
                </p>
              ) : (
                <div className="orders-mock-list">
                  {pedidos.map(pedido => {
                    const items = Array.isArray(pedido.items) ? pedido.items : [];
                    const fecha = pedido.created_at
                      ? new Date(pedido.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
                      : '—';
                    const estado = pedido.estado || 'procesando';

                    return (
                      <div key={pedido.id} className="order-mock-item">
                        <div className="order-item-header">
                          <span>Pedido <strong>#{pedido.id.slice(0, 8).toUpperCase()}</strong></span>
                          <span className={`order-status ${CLASE_ESTADO[estado] || 'badge-warning'}`}>
                            {ETIQUETA_ESTADO[estado] || estado}
                          </span>
                        </div>
                        <p className="order-date">Realizado el: {fecha}</p>
                        {items.length > 0 && (
                          <ul className="order-items-list">
                            {items.map((item, idx) => (
                              <li key={idx}>
                                <span>{item.nombre}{item.modalidad === 'alquiler' ? ' (alquiler/día)' : ''}</span>
                                <span>{item.cantidad || 1} x {formatPrice(item.precio)} €</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <p className="order-total">Total: {formatPrice(pedido.total)} €</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}