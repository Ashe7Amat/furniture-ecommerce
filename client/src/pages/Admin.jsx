import { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import '../styles/Admin.css';
import Icon from './admin/Icon';
import { primeraEspecifica } from './admin/categorias';
import useAdminDatos from './admin/hooks/useAdminDatos';
import useInventarioVista from './admin/hooks/useInventarioVista';
import useConfirmacion from './admin/hooks/useConfirmacion';
import ResumenTab from './admin/pestanas/ResumenTab';
import CrearMuebleTab from './admin/pestanas/CrearMuebleTab';
import InventarioTab from './admin/pestanas/InventarioTab';
import PedidosTab from './admin/pestanas/PedidosTab';
import CategoriasTab from './admin/pestanas/CategoriasTab';
import MensajesTab from './admin/pestanas/MensajesTab';
import ReservasTab from './admin/pestanas/ReservasTab';
import { reservasActivas } from '../utils/reservas';
import EditarMuebleModal from './admin/modales/EditarMuebleModal';
import EditarCategoriaModal from './admin/modales/EditarCategoriaModal';

// Pestañas de la barra lateral, en orden. Añadir una (p. ej. "Reservas") es una entrada más aquí
// y su caso en <main> (ver docs/tarea4-diseno.md, sección 7).
const PESTANAS = [
  { id: 'resumen', etiqueta: 'Resumen', icono: 'dashboard' },
  { id: 'crear', etiqueta: 'Añadir Mueble', icono: 'add' },
  { id: 'inventario', etiqueta: 'Gestionar Inventario', icono: 'inventory' },
  { id: 'pedidos', etiqueta: 'Pedidos', icono: 'box' },
  { id: 'mensajes', etiqueta: 'Mensajes', icono: 'mail' },
  { id: 'categorias', etiqueta: 'Gestionar Categorías', icono: 'tag' }
];

// Reservas por fechas (docs/reservas-diseno.md, 8.1): la pestaña solo existe con el interruptor
// VITE_RESERVAS_ACTIVAS encendido, después de "Pedidos". Apagado, la barra lateral es la de siempre.
const PESTANA_RESERVAS = { id: 'reservas', etiqueta: 'Reservas', icono: 'bell' };
const pestanasVisibles = () =>
  reservasActivas() ? PESTANAS.flatMap(p => (p.id === 'pedidos' ? [p, PESTANA_RESERVAS] : [p])) : PESTANAS;

// `idEditar` y `onEnlaceUsado` vienen de la URL /admin?editar={id} (AdminRuta.jsx): la barra de modo
// admin de la ficha pública enlaza así al editor de la pieza. Sin ellos (los tests del panel montan
// <Admin /> sin router), el panel es el de siempre.
const Admin = ({ idEditar = null, onEnlaceUsado }) => {
  const { user } = useContext(AuthContext);
  const { showToast } = useContext(ToastContext);

  const [vistaActiva, setVistaActiva] = useState('resumen');

  // El filtro de pedidos vive aquí (se conserva al cambiar de pestaña) y lo aplica el servidor (H37).
  const [filtroEstadoPedido, setFiltroEstadoPedido] = useState('');
  const {
    muebles, mueblesCargados, categorias, pedidos, setPedidos, cargarMuebles, cargarCategorias, cargarPedidos,
    infoPedidos, ajustarTrasCambioDeEstado,
    mensajes, setMensajes, errorMensajes, cargarMensajes
  } = useAdminDatos(user, filtroEstadoPedido);

  // Estados para creación de categorías
  const [nuevaCat, setNuevaCat] = useState('');
  const [nuevaCatPadre, setNuevaCatPadre] = useState(''); // '' = categoría general (sin padre)
  const [nuevaCatCodigo, setNuevaCatCodigo] = useState(''); // A5: '' = sin código
  const [categoriaFile, setCategoriaFile] = useState(null);

  // Estados para modales de edición (CMS)
  const [muebleAEditar, setMuebleAEditar] = useState(null);
  const [categoriaAEditar, setCategoriaAEditar] = useState(null);

  // Nuevos archivos durante la edición
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

  // Inventario: búsqueda, filtros, orden, paginación y selección (se conservan al cambiar de pestaña)
  const vista = useInventarioVista(muebles);

  const { confirmConfig, confirmarBorrado, cerrarConfirmacion } = useConfirmacion();

  // Casos A, B y C del diseño (docs/tarea4-diseno.md, sección 5): al cargar o recargar las
  // categorías, "Añadir mueble" preselecciona la primera específica, solo si no hay ninguna elegida.
  // Un mueble solo puede pertenecer a una categoría específica (con padre), nunca a una general.
  useEffect(() => {
    const especifica = primeraEspecifica(categorias);
    if (especifica && !formData.categoria) {
      setFormData(prev => ({ ...prev, categoria: especifica.nombre }));
    }
    // Solo [categorias], a propósito: con formData.categoria en las dependencias, se volvería a
    // preseleccionar justo después de vaciar el formulario al crear un mueble (caso C).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorias]);

  // /admin?editar={id}: con el inventario ya cargado, se abre el editor de esa pieza (en "Gestionar
  // Inventario", para que al cerrarlo se vea en la lista). Al cerrarlo, ?editar sale de la URL, así que
  // recargar el inventario tras guardar no lo vuelve a abrir. Si la pieza no está, se avisa y se quita
  // de la URL.
  useEffect(() => {
    if (!idEditar || !mueblesCargados) return;
    const pieza = muebles.find(m => String(m.id) === idEditar);
    if (pieza) {
      setVistaActiva('inventario');
      setMuebleAEditar(pieza);
    } else {
      showToast('No se ha encontrado la pieza que querías editar', 'error');
      onEnlaceUsado();
    }
    // Solo al llegar el enlace o el inventario: showToast y onEnlaceUsado cambian en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idEditar, mueblesCargados, muebles]);

  // Al cerrar el editor abierto por el enlace, el ?editar sale de la URL: recargar no lo reabre.
  const cerrarEditorMueble = () => {
    setMuebleAEditar(null);
    if (idEditar) onEnlaceUsado();
  };

  if (!user) {
    return <div className="admin-msg">Acceso denegado. Inicia sesión primero.</div>;
  }

  // Pedidos por procesar: la insignia de la barra lateral y una tarjeta del resumen. Los cuenta el
  // servidor en toda la historia (H37): la lista que hay aquí es solo una página.
  const pedidosPendientes = infoPedidos.pendientes;
  // Mensajes del formulario de contacto sin leer: la insignia de "Mensajes".
  const mensajesNoLeidos = mensajes.filter(m => !m.leido).length;

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <h3 className="sidebar-title">Gestión</h3>
        <nav className="sidebar-menu">
          {pestanasVisibles().map(pestana => (
            <button key={pestana.id} className={`sidebar-btn ${vistaActiva === pestana.id ? 'active' : ''}`} onClick={() => setVistaActiva(pestana.id)}>
              <Icon name={pestana.icono} /> {pestana.etiqueta}
              {pestana.id === 'pedidos' && pedidosPendientes > 0 && <span className="sidebar-badge">{pedidosPendientes}</span>}
              {pestana.id === 'mensajes' && mensajesNoLeidos > 0 && <span className="sidebar-badge">{mensajesNoLeidos}</span>}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="admin-content">

        {vistaActiva === 'resumen' && (
          <ResumenTab muebles={muebles} pedidosPendientes={pedidosPendientes} irA={setVistaActiva} />
        )}

        {vistaActiva === 'crear' && (
          <CrearMuebleTab
            categorias={categorias}
            formData={formData}
            setFormData={setFormData}
            files={files}
            setFiles={setFiles}
            recargarMuebles={cargarMuebles}
            irA={setVistaActiva}
          />
        )}

        {vistaActiva === 'inventario' && (
          <InventarioTab
            vista={vista}
            muebles={muebles}
            categorias={categorias}
            recargarMuebles={cargarMuebles}
            confirmarBorrado={confirmarBorrado}
            abrirEditorMueble={setMuebleAEditar}
          />
        )}

        {vistaActiva === 'pedidos' && (
          <PedidosTab
            pedidos={pedidos}
            setPedidos={setPedidos}
            infoPedidos={infoPedidos}
            ajustarTrasCambioDeEstado={ajustarTrasCambioDeEstado}
            filtroEstadoPedido={filtroEstadoPedido}
            setFiltroEstadoPedido={setFiltroEstadoPedido}
            cargarPedidos={cargarPedidos}
          />
        )}

        {vistaActiva === 'reservas' && <ReservasTab muebles={muebles} />}

        {vistaActiva === 'mensajes' && (
          <MensajesTab
            mensajes={mensajes}
            setMensajes={setMensajes}
            errorMensajes={errorMensajes}
            recargarMensajes={cargarMensajes}
            muebles={muebles}
            abrirEditorMueble={setMuebleAEditar}
          />
        )}

        {vistaActiva === 'categorias' && (
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
        )}

      </main>

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
    </div>
  );
};

export default Admin;
