import { useState, useEffect, useRef, useCallback } from 'react';
import { getResumenReservasAdmin } from '../../../services/api';
import { reservasActivas } from '../../../utils/reservas';

// Cuántas reservas piden atención (retrasadas, pagadas sin confirmar y reembolsos a medias): la
// insignia de "Reservas" en la barra lateral y los números de esas vistas. Viven en el contenedor
// (Admin.jsx) por lo mismo que los pedidos pendientes: los necesita la barra lateral aunque la
// pestaña no esté abierta. Con el interruptor apagado no se pide nada. Se leen al entrar, al cambiar
// de pestaña y cuando la pestaña de reservas avisa de que algo ha cambiado (`recargar`). Si una
// lectura falla se queda el último número que se tenía: un fallo no borra la insignia.
const useAvisosReservas = (user, vistaActiva) => {
  const [avisos, setAvisos] = useState(null);
  // Número de la última lectura: una respuesta tardía no pisa una más reciente.
  const ultima = useRef(0);

  const recargar = useCallback(async () => {
    if (!reservasActivas()) return;
    const numero = ++ultima.current;
    const resultado = await getResumenReservasAdmin();
    if (numero !== ultima.current) return;
    const datos = resultado?.data;
    if (datos && Number.isInteger(datos.total)) setAvisos(datos);
  }, []);

  useEffect(() => {
    if (user) recargar();
  }, [user, vistaActiva, recargar]);

  return { avisos, recargar };
};

export default useAvisosReservas;
