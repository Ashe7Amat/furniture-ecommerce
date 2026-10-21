import { useContext, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { updateMueble } from '../services/api';
import { ToastContext } from '../context/ToastContext';
import MenuAcciones from '../pages/admin/MenuAcciones';
import '../styles/BarraAdmin.css';

// Modo admin en la ficha pública (21 oct 2026): con la sesión de un administrador, una barra fija abajo
// con el nombre de la pieza, su estado, «Editar en panel» (abre su editor en /admin?editar={id}, ver
// AdminRuta.jsx) y «Cambiar estado». ProductDetail la carga aparte (lazy) y solo para administradores:
// quien mira el catálogo no descarga nada de esto.
// El estado se cambia como en el selector del inventario: PUT /api/muebles/:id con { estado }, y los
// mismos avisos. Al guardarse, la ficha se pinta con el estado nuevo (onEstadoCambiado).
const ESTADOS = [
  { valor: 'disponible', texto: 'Disponible' },
  { valor: 'vendido', texto: 'Vendido' },
  { valor: 'alquilado', texto: 'Alquilado' }
];

const BarraAdmin = ({ mueble, onEstadoCambiado }) => {
  const { showToast } = useContext(ToastContext);
  const [guardando, setGuardando] = useState(false);
  const barra = useRef(null);

  // Deja en --alto-barra-admin su alto más 8 px de separación, para que lo que flota abajo a la izquierda
  // (el botón de la música) se suba encima en vez de quedar tapado, como con el aviso de cookies
  // (CookieConsent.jsx).
  useEffect(() => {
    const raiz = document.documentElement.style;
    const medir = () => raiz.setProperty('--alto-barra-admin', `${barra.current.offsetHeight + 8}px`);
    medir();
    const observador = typeof ResizeObserver === 'function' ? new ResizeObserver(medir) : null;
    observador?.observe(barra.current);
    return () => {
      observador?.disconnect();
      raiz.removeProperty('--alto-barra-admin');
    };
  }, []);
  const estado = mueble.estado || 'disponible';
  const textoEstado = ESTADOS.find((e) => e.valor === estado)?.texto ?? estado;

  const cambiarEstado = async (nuevo) => {
    if (nuevo === estado || guardando) return;
    setGuardando(true);
    const res = await updateMueble(mueble.id, { estado: nuevo });
    setGuardando(false);
    if (res) {
      onEstadoCambiado(nuevo);
      showToast('Estado actualizado', 'success');
    } else {
      showToast('Error al cambiar estado', 'error');
    }
  };

  return (
    <div ref={barra} className="barra-admin" role="region" aria-label="Modo admin">
      <p className="barra-admin-texto">
        <strong>Modo admin:</strong> <span className="barra-admin-nombre">{mueble.nombre}</span>
      </p>
      <span className="barra-admin-estado">{textoEstado}</span>
      <div className="barra-admin-botones">
        <Link to={`/admin?editar=${encodeURIComponent(mueble.id)}`} className="barra-admin-btn">
          Editar en panel
        </Link>
        <MenuAcciones
          etiqueta={`Cambiar estado de ${mueble.nombre}`}
          titulo="Cambiar estado"
          claseBoton="barra-admin-btn"
          acciones={ESTADOS.map((e) => ({
            texto: e.texto,
            marcada: e.valor === estado,
            onElegir: () => cambiarEstado(e.valor)
          }))}
        >
          Cambiar estado
        </MenuAcciones>
      </div>
    </div>
  );
};

export default BarraAdmin;
