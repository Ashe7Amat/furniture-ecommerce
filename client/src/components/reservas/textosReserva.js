// Textos de las reservas que comparten la ficha, el paso de confirmación y "Mis reservas".
import { eurosDeCentimos, textoDias, textoMeses } from '../../utils/reservas';

// Cómo va la pieza en cada trayecto (entrega y recogida).
export const MODO_TRAYECTO = { domicilio: 'a domicilio', tienda: 'en la tienda' };

// El estado de una reserva del cliente (GET /api/reservas/mias), con la clase de su etiqueta (las de
// los pedidos de Mi cuenta, en pages/Profile.css).
export const ESTADO_RESERVA = {
  esperando_pago: ['Esperando pago', 'badge-warning'],
  confirmada: ['Confirmada', 'badge-success'],
  en_curso: ['En curso', 'badge-info'],
  devuelta: ['Devuelta', 'badge-info'],
  cancelada: ['Cancelada', 'badge-danger'],
  no_confirmada: ['No se pudo confirmar', 'badge-danger']
};

// El `codigo` del 409 de crear la reserva cuando hay otra reserva suya a medio pagar (las fechas siguen libres).
export const CODIGO_OTRA_RESERVA = 'otra_reserva_en_curso';

export const CONFIRMA_EMAIL_PARA_RESERVAR = 'Confirma tu email para poder reservar.';

// El paso de confirmación, si el servidor responde 401 al crear la reserva.
export const SESION_CADUCADA = 'Tu sesión ha caducado. Vuelve a iniciar sesión para reservar.';

// Los plazos del calendario, escritos debajo de él para que la clienta sepa por qué hay días que no puede
// elegir. Solo dice lo que el servidor ha mandado (`reglas` de GET /api/muebles/:id/disponibilidad).
export const textoPlazos = ({
  antelacion_min_dias: min,
  antelacion_max_meses: meses,
  dias_margen: margen,
  dias_max_hasta_recogida: tope
}) => {
  const partes = [];
  // Con el tope de la recogida (R-e, por la fianza), es él quien pone el límite y no los meses vista.
  if (Number.isFinite(min) && Number.isFinite(tope)) {
    const recogida = `la recogida tiene que ser, como muy tarde, dentro de ${textoDias(tope)}`;
    partes.push(
      min > 0
        ? `Se reserva con ${textoDias(min)} de antelación como mínimo, y ${recogida}.`
        : `Se puede reservar desde hoy, y ${recogida}.`
    );
  } else if (Number.isFinite(min) && Number.isFinite(meses)) {
    partes.push(
      min > 0
        ? `Se reserva con ${textoDias(min)} de antelación como mínimo y hasta ${textoMeses(meses)} vista.`
        : `Se puede reservar desde hoy y hasta ${textoMeses(meses)} vista.`
    );
  }
  if (Number.isFinite(margen) && margen > 0) {
    partes.push(
      `Después de cada recogida dejamos ${margen === 1 ? '1 día libre' : `${margen} días libres`} antes de la siguiente reserva.`
    );
  }
  return partes.join(' ');
};

// Por qué no se puede elegir un día (motivoNoElegible), para quien lo oye con un lector de pantalla.
export const textoMotivo = (motivo, reglas = {}) => {
  const { antelacion_min_dias: antelacion, antelacion_max_meses: meses } = reglas;
  switch (motivo) {
    case 'pasado':
      return 'ya ha pasado';
    case 'antelacion':
      return Number.isFinite(antelacion) ? `se reserva con ${textoDias(antelacion)} de antelación` : 'falta antelación';
    case 'lejos':
      return Number.isFinite(meses) ? `se reserva hasta ${textoMeses(meses)} vista` : 'todavía no se puede reservar';
    case 'sin_hueco':
      return 'no cabe un alquiler antes de la siguiente reserva';
    case 'duracion_min':
      return `el alquiler mínimo es de ${textoDias(Math.max(1, reglas.duracion_min_dias ?? 1))}`;
    case 'duracion_max':
      return Number.isFinite(reglas.duracion_max_dias)
        ? `el alquiler máximo es de ${textoDias(reglas.duracion_max_dias)}`
        : 'el alquiler es demasiado largo';
    case 'recogida_tope':
      return Number.isFinite(reglas.dias_max_hasta_recogida)
        ? `la recogida tiene que ser dentro de ${textoDias(reglas.dias_max_hasta_recogida)} como mucho`
        : 'la recogida queda demasiado lejos';
    default:
      return 'ocupado';
  }
};

// Una reserva pagada que no se pudo confirmar (las fechas se ocuparon mientras pagaba): el mismo mensaje que
// la página de vuelta del pago.
export const TEXTO_NO_CONFIRMADA =
  'Hemos recibido tu pago, pero esas fechas ya no estaban libres. Te devolveremos el importe y te escribiremos por email.';

// Lo que se le devuelve a la clienta de una reserva cancelada, y si ya está hecho.
export const textoReembolso = ({ importe_centimos: importe, hecho }) =>
  hecho
    ? `Hemos devuelto ${eurosDeCentimos(importe)} a tu tarjeta.`
    : `Te devolveremos ${eurosDeCentimos(importe)} a tu tarjeta.`;
