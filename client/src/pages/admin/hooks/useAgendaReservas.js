import { useState, useEffect, useRef, useCallback } from 'react';
import { getAgendaReservasAdmin } from '../../../services/api';

// La agenda de hoy y mañana de la pestaña «Reservas»: las entregas y recogidas, en una sola lista. Se
// lee al abrir la pestaña y cuando la pestaña avisa de que algo ha cambiado (`recargar`: una entrega
// marcada ya no está pendiente). Si una lectura falla se queda la última agenda que se tenía y el
// error aparte: una agenda de hace un momento sirve más que un hueco. Una respuesta tardía no pisa una
// más reciente.
const useAgendaReservas = () => {
  const [estado, setEstado] = useState({ cargando: true, error: '', datos: null });
  const ultima = useRef(0);

  const recargar = useCallback(async () => {
    const numero = ++ultima.current;
    const resultado = await getAgendaReservasAdmin();
    if (numero !== ultima.current) return;
    const { data, error } = resultado ?? {};
    if (data && Array.isArray(data.trayectos)) {
      setEstado({ cargando: false, error: '', datos: data });
    } else {
      setEstado((anterior) => ({ cargando: false, error: error ?? '', datos: anterior.datos }));
    }
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  return { ...estado, recargar };
};

export default useAgendaReservas;
