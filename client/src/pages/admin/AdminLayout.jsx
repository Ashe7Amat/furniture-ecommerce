/**
 * client/src/pages/admin/AdminLayout.jsx
 *
 * ARQUITECTURA MODULAR DEL PANEL DE ADMINISTRACIÓN:
 * --------------------------------------------------
 * 1. AdminLayout (este componente):
 *    - Renderiza la estructura global del panel: Barra lateral (Sidebar), cabecera de gestión y contenedor de contenido.
 *    - Gestiona los accesos rápidos a las pestañas y las insignias numéricas (badges) de atención:
 *        * Pedidos pendientes de procesar
 *        * Mensajes de contacto no leídos
 *        * Avisos y reservas por confirmar
 *    - Proyecta la vista activa mediante `<Outlet />` (para rutas anidadas en React Router) o mediante `children`
 *      (para montaje directo y compatibilidad con tests unitarios).
 *
 * 2. Hooks Especializados:
 *    - `useAdminDatos`: Centraliza la carga y sincronización de datos compartidos (muebles, categorías, pedidos, mensajes).
 *    - `useAdminAuth`: Verifica sesión y privilegios de administración, redirigiendo si no procede.
 *    - `useInventarioVista`: Gestiona filtros, búsqueda, ordenación y selección masiva de muebles.
 *    - `useAvisosReservas`: Agrupa alertas del calendario de reservas.
 *    - `useConfirmacion`: Orquesta diálogos modales de confirmación para acciones destructivas.
 *
 * 3. Pestañas Desacopladas (`pestanas/`):
 *    - ResumenTab, PortadaTab, CrearMuebleTab, InventarioTab, PedidosTab, CategoriasTab, MensajesTab, ReservasTab, ActividadTab.
 */

import { Outlet } from 'react-router-dom';
import Icon from './Icon';
import { textoAvisos } from './reservasAdmin';
import '../../styles/Admin.css';

const AdminLayout = ({
  pestanas = [],
  vistaActiva = 'resumen',
  onCambiarVista = () => {},
  pedidosPendientes = 0,
  mensajesNoLeidos = 0,
  avisosReservas = null,
  children
}) => {
  return (
    <div className="admin-layout">
      {/* Barra lateral / Sidebar */}
      <aside className="admin-sidebar">
        <h3 className="sidebar-title">Gestión</h3>
        <nav className="sidebar-menu" aria-label="Menú de administración">
          {pestanas.map((pestana) => (
            <button
              key={pestana.id}
              type="button"
              className={`sidebar-btn ${vistaActiva === pestana.id ? 'active' : ''}`}
              onClick={() => onCambiarVista(pestana.id)}
            >
              <Icon name={pestana.icono} />
              <span>{pestana.etiqueta}</span>

              {pestana.id === 'pedidos' && pedidosPendientes > 0 && (
                <span className="sidebar-badge">{pedidosPendientes}</span>
              )}

              {pestana.id === 'mensajes' && mensajesNoLeidos > 0 && (
                <span className="sidebar-badge">{mensajesNoLeidos}</span>
              )}

              {pestana.id === 'reservas' && avisosReservas?.total > 0 && (
                <span className="sidebar-badge" title={textoAvisos(avisosReservas)}>
                  {avisosReservas.total}
                </span>
              )}
            </button>
          ))}
        </nav>
      </aside>

      {/* Área de contenido principal */}
      <main className="admin-content">
        {children || <Outlet />}
      </main>
    </div>
  );
};

export default AdminLayout;
