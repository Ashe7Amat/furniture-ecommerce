import { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
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
import EditarMuebleModal from './admin/modales/EditarMuebleModal';
import EditarCategoriaModal from './admin/modales/EditarCategoriaModal';

// Pestañas de la barra lateral, en orden. Añadir una (p. ej. "Reservas") es una entrada más aquí
// y su caso en <main> (ver docs/tarea4-diseno.md, sección 7).
const PESTANAS = [
  { id: 'resumen', etiqueta: 'Resumen', icono: 'dashboard' },
  { id: 'crear', etiqueta: 'Añadir Mueble', icono: 'add' },
  { id: 'inventario', etiqueta: 'Gestionar Inventario', icono: 'inventory' },
  { id: 'pedidos', etiqueta: 'Pedidos', icono: 'box' },
  { id: 'categorias', etiqueta: 'Gestionar Categorías', icono: 'tag' }
];

const Admin = () => {
  const { user } = useContext(AuthContext);

  const [vistaActiva, setVistaActiva] = useState('resumen');

  const { muebles, categorias, pedidos, setPedidos, cargarMuebles, cargarCategorias, cargarPedidos } = useAdminDatos(user);
  const [filtroEstadoPedido, setFiltroEstadoPedido] = useState('');

  // Estados para creación de categorías
  const [nuevaCat, setNuevaCat] = useState('');
  const [nuevaCatPadre, setNuevaCatPadre] = useState(''); // '' = categoría general (sin padre)
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
  const [status, setStatus] = useState('');

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

  if (!user) {
    return <div className="admin-msg">Acceso denegado. Inicia sesión primero.</div>;
  }

  // Pedidos por procesar: la insignia de la barra lateral y una tarjeta del resumen.
  const pedidosPendientes = pedidos.filter(p => p.estado === 'procesando').length;

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <h3 className="sidebar-title">Gestión</h3>
        <nav className="sidebar-menu">
          {PESTANAS.map(pestana => (
            <button key={pestana.id} className={`sidebar-btn ${vistaActiva === pestana.id ? 'active' : ''}`} onClick={() => setVistaActiva(pestana.id)}>
              <Icon name={pestana.icono} /> {pestana.etiqueta}
              {pestana.id === 'pedidos' && pedidosPendientes > 0 && <span className="sidebar-badge">{pedidosPendientes}</span>}
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
            status={status}
            setStatus={setStatus}
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
            filtroEstadoPedido={filtroEstadoPedido}
            setFiltroEstadoPedido={setFiltroEstadoPedido}
            cargarPedidos={cargarPedidos}
          />
        )}

        {vistaActiva === 'categorias' && (
          <CategoriasTab
            categorias={categorias}
            nuevaCat={nuevaCat}
            setNuevaCat={setNuevaCat}
            nuevaCatPadre={nuevaCatPadre}
            setNuevaCatPadre={setNuevaCatPadre}
            categoriaFile={categoriaFile}
            setCategoriaFile={setCategoriaFile}
            setStatus={setStatus}
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
          status={status}
          setStatus={setStatus}
          confirmarBorrado={confirmarBorrado}
          onGuardado={cargarMuebles}
          onCerrar={() => setMuebleAEditar(null)}
        />
      )}

      {categoriaAEditar && (
        <EditarCategoriaModal
          categoria={categoriaAEditar}
          setCategoria={setCategoriaAEditar}
          archivoNuevo={editCategoriaFile}
          setArchivoNuevo={setEditCategoriaFile}
          categorias={categorias}
          status={status}
          setStatus={setStatus}
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
        onCancel={cerrarConfirmacion}
      />
    </div>
  );
};

export default Admin;
