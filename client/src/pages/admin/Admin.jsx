/**
 * client/src/pages/admin/Admin.jsx
 *
 * Componente orquestador del Panel de Administración.
 * Coordina layout, estado compartido, modales de gestión y resolución de pestañas.
 */

import { useState, useEffect, useContext } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { ToastContext } from '../../context/ToastContext';
import ConfirmModal from '../../components/ConfirmModal';
import AdminLayout from './AdminLayout';
import { primeraEspecifica } from './categorias';
import useAdminAuth from './hooks/useAdminAuth';
import useAdminDatos from './hooks/useAdminDatos';
import useInventarioVista from './hooks/useInventarioVista';
import useConfirmacion from './hooks/useConfirmacion';
import useAvisosReservas from './hooks/useAvisosReservas';
import ResumenTab from './pestanas/ResumenTab';
import CrearMuebleTab from './pestanas/CrearMuebleTab';
import InventarioTab from './pestanas/InventarioTab';
import PedidosTab from './pestanas/PedidosTab';
import CategoriasTab from './pestanas/CategoriasTab';
import MensajesTab from './pestanas/MensajesTab';
import ReservasTab from './pestanas/ReservasTab';
import ActividadTab from './pestanas/ActividadTab';
import PortadaTab from './pestanas/PortadaTab';
import { reservasActivas } from '../../utils/reservas';
import EditarMuebleModal from './modales/EditarMuebleModal';
import EditarCategoriaModal from './modales/EditarCategoriaModal';

// Lista canónica de pestañas administrativas
const PESTANAS = [
  { id: 'resumen', etiqueta: 'Resumen', icono: 'dashboard' },
  { id: 'portada', etiqueta: 'Portada', icono: 'home' },
  { id: 'crear', etiqueta: 'Añadir Mueble', icono: 'add' },
  { id: 'inventario', etiqueta: 'Gestionar Inventario', icono: 'inventory' },
  { id: 'pedidos', etiqueta: 'Pedidos', icono: 'box' },
  { id: 'mensajes', etiqueta: 'Mensajes', icono: 'mail' },
  { id: 'categorias', etiqueta: 'Gestionar Categorías', icono: 'tag' },
  { id: 'actividad', etiqueta: 'Actividad', icono: 'activity' }
];

const PESTANA_RESERVAS = { id: 'reservas', etiqueta: 'Reservas', icono: 'calendar' };

const pestanasVisibles = () =>
  reservasActivas() ? PESTANAS.flatMap((p) => (p.id === 'pedidos' ? [p, PESTANA_RESERVAS] : [p])) : PESTANAS;

const extraerVistaDesdePath = (pathname) => {
  if (!pathname) return 'resumen';
  const partes = pathname.split('/').filter(Boolean);
  if (partes[0] === 'admin' && partes[1]) {
    return partes[1];
  }
  return 'resumen';
};

const Admin = ({ idEditar = null, onEnlaceUsado }) => {
  const { user } = useAdminAuth();
  const { showToast } = useContext(ToastContext);

  let location = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    location = useLocation();
  } catch {
    // Modo standalone / tests sin router
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const outlet = (() => { try { return useOutlet(); } catch { return null; } })();

  const [vistaActiva, setVistaActiva] = useState(() => (location ? extraerVistaDesdePath(location.pathname) : 'resumen'));
  const [filtroEstadoPedido, setFiltroEstadoPedido] = useState('');

  const {
    muebles,
    mueblesCargados,
    categorias,
    pedidos,
    setPedidos,
    cargarMuebles,
    cargarCategorias,
    cargarPedidos,
    infoPedidos,
    ajustarTrasCambioDeEstado,
    mensajes,
    setMensajes,
    errorMensajes,
    cargarMensajes
  } = useAdminDatos(user, filtroEstadoPedido);

  const { avisos: avisosReservas, recargar: recargarAvisosReservas } = useAvisosReservas(user, vistaActiva);

  // Estados para creación de categorías
  const [nuevaCat, setNuevaCat] = useState('');
  const [nuevaCatPadre, setNuevaCatPadre] = useState('');
  const [nuevaCatCodigo, setNuevaCatCodigo] = useState('');
  const [categoriaFile, setCategoriaFile] = useState(null);

  // Estados para modales de edición (CMS)
  const [muebleAEditar, setMuebleAEditar] = useState(null);
  const [categoriaAEditar, setCategoriaAEditar] = useState(null);

  // Archivos durante la edición
  const [editMuebleFiles, setEditMuebleFiles] = useState([]);
  const [editCategoriaFile, setEditCategoriaFile] = useState(null);

  const [formData, setFormData] = useState({
    nombre: '',
    categoria: '',
    descripcion: '',
    precio_venta: '',
    precio_alquiler: '',
    estado: 'disponible'
  });
  const [files, setFiles] = useState([]);

  // Inventario: búsqueda, filtros, ordenación y selección
  const vista = useInventarioVista(muebles);
  const { confirmConfig, confirmarBorrado, cerrarConfirmacion } = useConfirmacion();

  const cambiarVista = (nuevaVista) => {
    setVistaActiva(nuevaVista);
  };

  // Preselección de primera categoría específica
  useEffect(() => {
    const especifica = primeraEspecifica(categorias);
    if (especifica && !formData.categoria) {
      setFormData((prev) => ({ ...prev, categoria: especifica.nombre }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorias]);

  // Soporte para /admin?editar={id}
  useEffect(() => {
    if (!idEditar || !mueblesCargados) return;
    const pieza = muebles.find((m) => String(m.id) === idEditar);
    if (pieza) {
      cambiarVista('inventario');
      setMuebleAEditar(pieza);
    } else {
      showToast('No se ha encontrado la pieza que querías editar', 'error');
      onEnlaceUsado?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idEditar, mueblesCargados, muebles]);

  const cerrarEditorMueble = () => {
    setMuebleAEditar(null);
    if (idEditar) onEnlaceUsado?.();
  };

  if (!user) {
    return <div className="admin-msg">Acceso denegado. Inicia sesión primero.</div>;
  }

  const pedidosPendientes = infoPedidos.pendientes;
  const mensajesNoLeidos = mensajes.filter((m) => !m.leido).length;

  const renderPestanaActiva = () => {
    if (outlet) return outlet;

    switch (vistaActiva) {
      case 'resumen':
        return (
          <ResumenTab
            muebles={muebles}
            pedidosPendientes={pedidosPendientes}
            irA={(vista, filtro) => {
              if (filtro !== undefined) setFiltroEstadoPedido(filtro);
              cambiarVista(vista);
            }}
          />
        );
      case 'portada':
        return <PortadaTab muebles={muebles} />;
      case 'crear':
        return (
          <CrearMuebleTab
            categorias={categorias}
            formData={formData}
            setFormData={setFormData}
            files={files}
            setFiles={setFiles}
            recargarMuebles={cargarMuebles}
            irA={cambiarVista}
          />
        );
      case 'inventario':
        return (
          <InventarioTab
            vista={vista}
            muebles={muebles}
            categorias={categorias}
            recargarMuebles={cargarMuebles}
            confirmarBorrado={confirmarBorrado}
            abrirEditorMueble={setMuebleAEditar}
          />
        );
      case 'pedidos':
        return (
          <PedidosTab
            pedidos={pedidos}
            setPedidos={setPedidos}
            infoPedidos={infoPedidos}
            ajustarTrasCambioDeEstado={ajustarTrasCambioDeEstado}
            filtroEstadoPedido={filtroEstadoPedido}
            setFiltroEstadoPedido={setFiltroEstadoPedido}
            cargarPedidos={cargarPedidos}
            muebles={muebles}
          />
        );
      case 'reservas':
        return (
          <ReservasTab
            muebles={muebles}
            recargarMuebles={cargarMuebles}
            resumen={avisosReservas}
            alCambiar={recargarAvisosReservas}
          />
        );
      case 'mensajes':
        return (
          <MensajesTab
            mensajes={mensajes}
            setMensajes={setMensajes}
            errorMensajes={errorMensajes}
            recargarMensajes={cargarMensajes}
            muebles={muebles}
            abrirEditorMueble={setMuebleAEditar}
          />
        );
      case 'categorias':
        return (
          <CategoriasTab
            categorias={categorias}
            nuevaCat={nuevaCat}
            setNuevaCat={setNuevaCat}
            nuevaCatPadre={nuevaCatPadre}
            setNuevaCatPadre={setNuevaCatPadre}
            nuevaCatCodigo={nuevaCatCodigo}
            setNuevaCatCodigo={setNuevaCatCodigo}
            categoriaFile={categoriaFile}
            setCategoriaFile={setCategoriaFile}
            recargarCategorias={cargarCategorias}
            confirmarBorrado={confirmarBorrado}
            abrirEditorCategoria={setCategoriaAEditar}
          />
        );
      case 'actividad':
        return <ActividadTab />;
      default:
        return (
          <ResumenTab
            muebles={muebles}
            pedidosPendientes={pedidosPendientes}
            irA={(vista, filtro) => {
              if (filtro !== undefined) setFiltroEstadoPedido(filtro);
              cambiarVista(vista);
            }}
          />
        );
    }
  };

  return (
    <AdminLayout
      pestanas={pestanasVisibles()}
      vistaActiva={vistaActiva}
      onCambiarVista={cambiarVista}
      pedidosPendientes={pedidosPendientes}
      mensajesNoLeidos={mensajesNoLeidos}
      avisosReservas={avisosReservas}
    >
      {renderPestanaActiva()}

      {muebleAEditar && (
        <EditarMuebleModal
          mueble={muebleAEditar}
          setMueble={setMuebleAEditar}
          archivosNuevos={editMuebleFiles}
          setArchivosNuevos={setEditMuebleFiles}
          categorias={categorias}
          confirmarBorrado={confirmarBorrado}
          onGuardado={cargarMuebles}
          onCerrar={cerrarEditorMueble}
        />
      )}

      {categoriaAEditar && (
        <EditarCategoriaModal
          categoria={categoriaAEditar}
          setCategoria={setCategoriaAEditar}
          archivoNuevo={editCategoriaFile}
          setArchivoNuevo={setEditCategoriaFile}
          categorias={categorias}
          muebles={muebles}
          confirmarBorrado={confirmarBorrado}
          onGuardado={cargarCategorias}
          onCerrar={() => setCategoriaAEditar(null)}
        />
      )}

      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={confirmConfig.onConfirm}
        textoConfirmar={confirmConfig.textoConfirmar}
        onCancel={cerrarConfirmacion}
      />
    </AdminLayout>
  );
};

export default Admin;
