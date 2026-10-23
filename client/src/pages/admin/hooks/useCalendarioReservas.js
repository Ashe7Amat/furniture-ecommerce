import { useEffect, useRef, useState } from 'react';
import { getCalendarioReservasAdmin } from '../../../services/api';

const SIN_RESPUESTA = 'No se ha podido cargar el calendario de reservas.';

// Las reservas que dibujan los calendarios de «Reservas» entre `desde` y `hasta` (y de una pieza, si
// hay `muebleId`). Se leen al pedir un rango distinto y cuando sube `version` (la pestaña avisa de que
// algo ha cambiado: «Actualizar», una acción, un alta). Con `activo` apagado no se lee nada.
// Un calendario con los días de otro mes enseñaría días libres que no lo son: lo leído solo vale para el
// rango que se pidió, y mientras llega el de uno nuevo no hay datos. Si una lectura del mismo rango
// falla, se queda lo que ya se tenía y el error aparte. Una respuesta tardía no pisa una más reciente.
const useCalendarioReservas = ({ desde, hasta, muebleId = '', version = 0, activo = true }) => {
  const [estado, setEstado] = useState({ clave: null, datos: null, errorDe: null, error: '', cargando: activo });
  const ultima = useRef(0);
  const clave = `${desde}|${hasta}|${muebleId}`;

  useEffect(() => {
    if (!activo) return undefined;
    const numero = ++ultima.current;
    setEstado((e) => ({ ...e, cargando: true }));
    (async () => {
      const resultado = await getCalendarioReservasAdmin({ desde, hasta, muebleId: muebleId || undefined });
      if (numero !== ultima.current) return;
      const { data, error } = resultado ?? {};
      if (data && Array.isArray(data.reservas)) {
        setEstado({ clave, datos: data, errorDe: null, error: '', cargando: false });
      } else {
        setEstado((e) => ({ ...e, errorDe: clave, error: error || SIN_RESPUESTA, cargando: false }));
      }
    })();
    return () => {
      ultima.current += 1;
    };
  }, [activo, clave, version, desde, hasta, muebleId]);

  const datos = estado.clave === clave ? estado.datos : null;
  const error = estado.errorDe === clave ? estado.error : '';
  return { datos, error, cargando: estado.cargando || (!datos && !error) };
};

export default useCalendarioReservas;
