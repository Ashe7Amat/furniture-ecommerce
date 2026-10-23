import { useSearchParams } from 'react-router-dom';
import Admin from './Admin';

// La ruta /admin: pasa al panel el ?editar={id} de la URL (el enlace «Editar en panel» de la barra de
// modo admin de la ficha pública) y lo quita cuando ya se ha usado, sin dejar otra entrada en el
// historial. Admin.jsx no lee la URL él mismo: sus tests (congelados) lo montan sin router.
const AdminRuta = () => {
  const [params, setParams] = useSearchParams();
  const olvidarEnlace = () =>
    setParams((actuales) => {
      actuales.delete('editar');
      return actuales;
    }, { replace: true });

  return <Admin idEditar={params.get('editar')} onEnlaceUsado={olvidarEnlace} />;
};

export default AdminRuta;
