import { useContext } from 'react';
import { AuthContext } from '../../../context/AuthContext';

/**
 * Hook para verificar sesión y rol de administrador.
 * Proporciona el usuario actual y si tiene permisos de administración.
 */
export const useAdminAuth = () => {
  const auth = useContext(AuthContext);
  const user = auth?.user || null;
  const loading = auth?.loading || false;
  const esAdmin = user?.rol === 'admin';

  return {
    user,
    esAdmin,
    loading,
    autorizado: !!user && esAdmin
  };
};

export default useAdminAuth;
