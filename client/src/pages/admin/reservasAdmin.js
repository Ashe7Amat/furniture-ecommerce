// Ayudantes de la pestaña "Reservas" del panel (pestanas/ReservasTab.jsx; docs/reservas-diseno.md,
// 8.1 y 8.3). Las fechas llegan como texto 'AAAA-MM-DD' en hora de Madrid y así se quedan (ver
// utils/reservas.js). Los importes de la lista llegan en euros y se mandan en céntimos enteros.
import { esFecha, fechaCorta, eurosDeCentimos, textoDias } from '../../utils/reservas';

// Fecha y hora de un instante, en hora de Madrid (la del negocio): "19/10/2026, 12:30".
const momentoLegible = (iso) =>
  new Date(iso).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Madrid'
  });

// El día ('AAAA-MM-DD') de un instante en Madrid.
const formatoDiaMadrid = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Madrid',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});
export const diaEnMadrid = (instante) => formatoDiaMadrid.format(new Date(instante));

// Qué día es hoy para un diálogo: el del servidor al cargar la lista o, si esta pestaña lleva abierta
// desde ayer, el del reloj. El servidor vuelve a comprobarlo.
export const hoyMasReciente = (hoyServidor, ahora = new Date()) => {
  const reloj = diaEnMadrid(ahora);
  return hoyServidor && hoyServidor > reloj ? hoyServidor : reloj;
};

// Las vistas de la lista, en orden. `id` es el valor de ?vista= de GET /api/admin/reservas.
export const VISTAS = [
  { id: 'proximas', etiqueta: 'Próximas', vacia: 'No hay reservas próximas.' },
  { id: 'entregas', etiqueta: 'Entregas hoy y mañana', vacia: 'No hay entregas hoy ni mañana.' },
  { id: 'recogidas', etiqueta: 'Recogidas hoy y mañana', vacia: 'No hay recogidas hoy ni mañana.' },
  { id: 'retrasadas', etiqueta: 'Retrasadas', vacia: 'No hay ninguna reserva retrasada.' },
  { id: 'conflicto', etiqueta: 'En conflicto', vacia: 'No hay ninguna reserva en conflicto.' },
  { id: 'reembolsos', etiqueta: 'Reembolsos a medias', vacia: 'No hay ningún reembolso a medias.' },
  { id: 'legacy', etiqueta: 'Contratos antiguos', vacia: 'No hay contratos antiguos en revisión.' },
  { id: 'todas', etiqueta: 'Todas', vacia: 'Todavía no hay ninguna reserva.' }
];

// El texto del botón de cada acción que puede traer una reserva en `acciones`. Una acción que no
// esté aquí (una nueva del servidor) no se pinta.
export const ETIQUETA_ACCION = {
  entregar: 'Marcar entregada',
  recoger: 'Marcar recogida',
  ampliar: 'Ampliar',
  cancelar: 'Cancelar reserva',
  'reintentar-reembolso': 'Reintentar reembolso',
  'dar-por-reembolsado': 'Dar por reembolsado',
  'levantar-bloqueo': 'Levantar bloqueo'
};

// El texto del botón de una acción en su tarjeta: cancelar una venta no es cancelar una reserva.
export const etiquetaAccion = (reserva, accion) =>
  accion === 'cancelar' && reserva.tipo === 'venta' ? 'Cancelar venta' : ETIQUETA_ACCION[accion];

// Cómo se entrega y se recoge: las opciones de los formularios y el texto de la lista.
export const MODOS = [
  ['domicilio', 'A domicilio'],
  ['tienda', 'En tienda']
];
const MODO_EN_TEXTO = { domicilio: 'a domicilio', tienda: 'en tienda' };

// Las reservas que no se hicieron en la web llevan una marca en la tarjeta.
export const ORIGEN = { manual: 'Fuera de la web', legacy: 'Contrato antiguo' };

// '10:00:00' (una hora de Postgres) o '10:00' → '10:00'
export const horaCorta = (hora) => String(hora).slice(0, 5);

// "15/10/2026 a las 10:00, a domicilio" (sin hora o sin modo, sin esa parte)
export const momento = (fecha, hora, modo) =>
  [`${fechaCorta(fecha)}${hora ? ` a las ${horaCorta(hora)}` : ''}`, MODO_EN_TEXTO[modo]].filter(Boolean).join(', ');

// Euros (un número, como los da la lista) a céntimos enteros, sin errores de coma flotante.
export const centimosDeEuros = (euros) => Math.round(euros * 100);

// Lo que escribe el administrador ("120", "120,5", "120.50") a céntimos enteros; null si no es un
// importe (letras, negativo, más de dos decimales o separador de miles: "1.234,50" no se adivina).
export const centimosDeTexto = (texto) => {
  const limpio = String(texto).replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return null;
  const [enteros, decimales = ''] = limpio.split('.');
  return Number(enteros) * 100 + Number(decimales.padEnd(2, '0'));
};

// 12050 → "120,50": el valor inicial de un campo de importe (sin el símbolo).
export const textoDeCentimos = (centimos) => `${Math.floor(centimos / 100)},${String(centimos % 100).padStart(2, '0')}`;

const euros = (importe) => eurosDeCentimos(centimosDeEuros(importe));

// Un reembolso sin id de Stripe está a medias, o se dio por hecho desde el panel (se hizo fuera, en el
// Dashboard): la tarjeta lo distingue por `reembolso_a_medias`.
const textoReembolso = ({ importe, solicitado_en, stripe_refund_id }, aMedias) => {
  let estado = 'hecho en Stripe';
  if (!stripe_refund_id) estado = aMedias ? 'sin confirmar en Stripe' : 'dado por reembolsado (hecho fuera del panel)';
  return `${euros(importe)}, solicitado el ${momentoLegible(solicitado_en)}, ${estado}`;
};

// Lo que se sabe del pago de una reserva, junto al importe.
const textoPago = (r) => {
  if (r.pagado) return 'pagado';
  if (r.estado === 'pendiente') return 'pendiente de pago';
  if (r.estado === 'expirada') return 'no se pagó';
  return 'sin pago en la web';
};

// Las filas de datos de una tarjeta, [etiqueta, valor], solo las que tienen valor. Un alquiler
// enseña la entrega y la recogida previstas; un bloqueo o una venta, desde cuándo ocupa la pieza.
// `fecha_fin` y `fin_ocupacion` son exclusivos: el día que la pieza vuelve a estar libre.
export const datosReserva = (r) => {
  const fechas =
    r.tipo === 'alquiler'
      ? [
          ['Entrega prevista', momento(r.fecha_inicio, r.hora_entrega, r.modo_entrega)],
          ['Recogida prevista', momento(r.fecha_fin, r.hora_recogida, r.modo_devolucion)],
          // Una devuelta ocupa hasta el día real de la devolución (3.4): eso no es una ampliación.
          [
            'Ocupación ampliada hasta',
            r.estado !== 'devuelta' && r.fin_ocupacion && r.fin_ocupacion !== r.fecha_fin && fechaCorta(r.fin_ocupacion)
          ],
          ['Margen', r.dias_margen > 0 && `${textoDias(r.dias_margen)} después de la recogida`],
          ['Dirección de entrega', r.direccion_entrega]
        ]
      : [
          ['Desde', fechaCorta(r.fecha_inicio)],
          ['Libre de nuevo', r.fecha_fin && fechaCorta(r.fecha_fin)]
        ];
  return [
    ...fechas,
    ['Importe', r.importe_total != null && `${euros(r.importe_total)}, ${textoPago(r)}`],
    ['Reembolso', r.reembolso && textoReembolso(r.reembolso, r.reembolso_a_medias)],
    ['Motivo', r.motivo],
    ['Motivo de la cancelación', r.motivo_cancelacion],
    ['Entregada el', r.entregada_en && momentoLegible(r.entregada_en)],
    ['Recogida el', r.devuelta_en && momentoLegible(r.devuelta_en)]
  ].filter(([, valor]) => valor);
};

// El día en que se puede dar por recogida una reserva (8.3), como lo comprueba el servidor: desde el de
// la entrega real (el día de `entregada_en` en Madrid, o su fecha de inicio si es el mayor: entregarla
// antes de tiempo la mueve a hoy) hasta hoy. Sin saber qué día es hoy, sin máximo.
export const limitesRecogida = (reserva, hoy) => {
  const entrega = reserva.entregada_en ? diaEnMadrid(reserva.entregada_en) : reserva.fecha_inicio;
  return { minimo: entrega > reserva.fecha_inicio ? entrega : reserva.fecha_inicio, maximo: hoy };
};

// Comprueba el día de la recogida: el problema, o '' si vale.
export const validarRecogida = (fecha, { minimo, maximo }) => {
  if (maximo && minimo > maximo) return `Todavía no se puede recoger: la entrega es el ${fechaCorta(minimo)}.`;
  if (esFecha(fecha) && fecha >= minimo && !(maximo && fecha > maximo)) return '';
  if (!maximo) return `Elige el ${fechaCorta(minimo)} o un día posterior.`;
  if (minimo === maximo) return `Elige el ${fechaCorta(maximo)}.`;
  return `Elige un día entre el ${fechaCorta(minimo)} y el ${fechaCorta(maximo)}.`;
};

// Lo máximo que se puede reembolsar al cancelar, en céntimos: lo pagado en la web (0 si no se pagó
// nada en la web, p. ej. un alquiler registrado a mano). Una venta se cancela siempre sin reembolso:
// las compras se reembolsan desde el Dashboard de Stripe, y el servidor no acepta otro importe.
export const maximoReembolso = (r) =>
  r.tipo !== 'venta' && r.pagado && r.importe_total != null ? centimosDeEuros(r.importe_total) : 0;

// Comprueba el formulario de cancelación: { error } o { centimos } a reembolsar.
export const validarCancelacion = ({ motivo, reembolso }, maximo) => {
  if (!motivo.trim()) return { error: 'Escribe el motivo de la cancelación.' };
  const centimos = maximo === 0 ? 0 : centimosDeTexto(reembolso);
  if (centimos === null) return { error: 'El reembolso no es válido. Escríbelo así: 120 o 120,50.' };
  if (centimos > maximo) return { error: `El reembolso no puede pasar de ${eurosDeCentimos(maximo)}.` };
  return { centimos };
};

// Valores iniciales de los formularios de alta (bloqueo, alquiler o venta fuera de la web).
export const camposAlta = (hoy) => ({
  mueble_id: '',
  fecha_inicio: hoy ?? '',
  fecha_fin: '',
  motivo: '',
  hora_entrega: '10:00',
  hora_recogida: '10:00',
  modo_entrega: 'domicilio',
  modo_devolucion: 'domicilio',
  nombre: '',
  telefono: '',
  email: '',
  direccion: '',
  notas: '',
  importe: '',
  origen: 'manual',
  ya_entregado: false
});

// Los textos de los problemas de fechas de cada formulario, con los nombres de sus campos.
const FECHAS_ALTA = {
  bloqueo: {
    inicio: 'Elige el primer día bloqueado.',
    fin: 'Elige el día en que la pieza vuelve a estar libre.',
    orden: 'El día en que vuelve a estar libre tiene que ser posterior al primer día bloqueado.'
  },
  alquiler: {
    inicio: 'Elige el día de entrega.',
    fin: 'Elige el día de recogida.',
    orden: 'El día de recogida tiene que ser posterior al de entrega.'
  },
  venta: { inicio: 'Elige la fecha de la venta.' }
};

// Comprueba un alta antes de mandarla: el primer problema, o '' si está bien. Lo demás (que las
// fechas estén libres, la antelación...) lo decide el servidor, y su mensaje sale tal cual. `hoy`
// (si se sabe) evita un alquiler ya entregado que empiece en el futuro: no se podría recoger.
export const validarAlta = (tipo, c, hoy = null) => {
  const textos = FECHAS_ALTA[tipo];
  if (!c.mueble_id) return 'Elige la pieza.';
  if (!esFecha(c.fecha_inicio)) return textos.inicio;
  if (tipo !== 'venta') {
    if (!esFecha(c.fecha_fin)) return textos.fin;
    if (c.fecha_fin <= c.fecha_inicio) return textos.orden;
  }
  if (tipo !== 'alquiler') return c.motivo.trim() ? '' : 'Escribe el motivo.';
  if (c.ya_entregado && hoy && c.fecha_inicio > hoy) {
    return 'Un alquiler ya entregado no puede empezar después de hoy.';
  }
  if (!c.nombre.trim()) return 'Escribe el nombre del cliente.';
  if ((c.modo_entrega === 'domicilio' || c.modo_devolucion === 'domicilio') && !c.direccion.trim()) {
    return 'Escribe la dirección para la entrega o la recogida a domicilio.';
  }
  if (c.importe.trim() && centimosDeTexto(c.importe) === null) return 'El importe no es válido. Escríbelo así: 120 o 120,50.';
  return '';
};

// El cuerpo de POST /api/admin/reservas/{bloqueos|alquileres|ventas}. Los datos de contacto vacíos
// y el importe vacío no se mandan.
export const datosAlta = (tipo, c) => {
  const base = { mueble_id: c.mueble_id, fecha_inicio: c.fecha_inicio };
  if (tipo === 'venta') return { ...base, motivo: c.motivo.trim() };
  if (tipo === 'bloqueo') return { ...base, fecha_fin: c.fecha_fin, motivo: c.motivo.trim() };
  const contacto = { nombre: c.nombre.trim() };
  for (const campo of ['telefono', 'email', 'direccion', 'notas']) {
    if (c[campo].trim()) contacto[campo] = c[campo].trim();
  }
  return {
    ...base,
    hora_entrega: c.hora_entrega,
    fecha_fin: c.fecha_fin,
    hora_recogida: c.hora_recogida,
    modo_entrega: c.modo_entrega,
    modo_devolucion: c.modo_devolucion,
    contacto,
    ...(c.importe.trim() ? { importe_total_centimos: centimosDeTexto(c.importe) } : {}),
    origen: c.origen,
    ya_entregado: c.ya_entregado
  };
};
