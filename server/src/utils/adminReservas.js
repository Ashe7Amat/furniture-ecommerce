// Panel de reservas (docs/reservas-diseno.md, 8.1, 8.3, 8.4, 8.6 y 8.7; bloque R-d, commit 14): la
// lista por vistas, lo que el administrador hace con cada reserva (entregar, recoger, ampliar,
// cancelar con reembolso, levantar un bloqueo) y lo que da de alta sin pago web (bloqueos, alquileres
// pactados fuera de la web y ventas).
//
// Como en el resto de las reservas, lo que impide los solapes es la base de datos (23P01). Aquí se
// limpian las provisionales caducadas antes de escribir (escribirEnCalendario, 4.6), cada reserva se
// cambia solo si sigue como se leyó (actualizarReserva) y, si algo choca, se busca con qué para
// decírselo al administrador.
const supabase = require('../data/supabase');
const stripeUtil = require('./stripe');
const { ErrorValidacion, ErrorConflicto, ErrorNoEncontrado } = require('./errores');
const { ESTADOS_QUE_OCUPAN, ocupaElCalendario } = require('./disponibilidad');
const { REGLAS_ALQUILER } = require('./reglasAlquiler');
const { hoyEnMadrid, sumarDias, diasEntre, fechaLegible } = require('./fechasMadrid');
const {
  CODIGO_CLAVE_AJENA,
  chocaEnCalendario,
  escribirEnCalendario,
  actualizarReserva,
  referenciaDeReserva,
  horaCorta
} = require('./calendarioReservas');

// Lo que lee el panel de cada reserva, sin las cuatro columnas que actualizarReserva añade siempre
// (id, mueble_id, historial y updated_at). Las listas las piden aparte.
const COLUMNAS_PANEL =
  'pedido_id, tipo, estado, origen, fecha_inicio, hora_entrega, fecha_fin, hora_recogida, ' +
  'fin_ocupacion, dias_margen, expira_en, modo_entrega, modo_devolucion, direccion_entrega, ' +
  'datos_contacto, conflicto_en, importe_total, stripe_payment_intent_id, ' +
  'reembolso_solicitado_en, reembolso_importe, stripe_refund_id, motivo, motivo_cancelacion, ' +
  'entregada_en, devuelta_en, created_at';
const COLUMNAS_LISTA = `id, mueble_id, ${COLUMNAS_PANEL}, historial`;

// "Todas": las 200 más recientes. El resto de vistas son listas de trabajo, cortas por naturaleza.
const MAX_TODAS = 200;

// Una venta ya hecha se puede registrar con fecha de hasta 30 días atrás: basta para apuntar una
// venta de tienda que se olvidó, y frena un año mal escrito (2006 por 2026), que dejaría una venta
// sin fin escondida en el pasado. Las ventas más antiguas entran con la migración de datos (9.2).
const DIAS_ATRAS_VENTA = 30;

// La marca del reembolso de una cancelación en Stripe (8.6): en la metadata, para encontrarlo al
// reintentar, y en la clave de idempotencia. Sin datos personales.
const TIPO_REEMBOLSO = 'reembolso_cancelacion';
const claveDeReembolso = (id) => `reserva_${id}_${TIPO_REEMBOLSO}`;

const MENSAJE_RESERVA_NO_ENCONTRADA = 'Reserva no encontrada.';
const MENSAJE_PIEZA_NO_ENCONTRADA = 'Mueble no encontrado.';
const MENSAJE_REEMBOLSO_EN_CURSO = 'Ya hay un reembolso en curso o hecho para esta reserva.';
const MENSAJE_REEMBOLSO_A_MEDIAS =
  'La reserva está cancelada, pero el reembolso no se ha podido hacer. Usa «Reintentar reembolso».';
const MENSAJE_REINTENTO_FALLIDO =
  'El reembolso todavía no se ha podido hacer. Vuelve a intentarlo en un momento.';
// Un 23P01 cuya causa ya no está cuando se busca (se canceló o se movió entre medias).
const MENSAJE_CHOQUE_DESAPARECIDO =
  'Esas fechas chocaban con otra reserva de la pieza que acaba de cambiar. Vuelve a intentarlo.';

const dias = (n) => (n === 1 ? '1 día' : `${n} días`);
const euros = (centimos) => centimos / 100;
const centimosDe = (importe) => Math.round(Number(importe) * 100);
const eurosLegibles = (centimos) => `${(centimos / 100).toFixed(2).replace('.', ',')} €`;
const porInicio = (a, b) => {
  if (a.fecha_inicio === b.fecha_inicio) return 0;
  return a.fecha_inicio < b.fecha_inicio ? -1 : 1;
};
const contextoDe = (ahora) => ({ ahora, hoy: hoyEnMadrid(ahora) });

// ─── Cómo se enseña cada reserva (8.7) ───────────────────────────────────────────────────────────

// "A medias" (8.6): se reclamó el reembolso (la marca está puesta) pero no consta hecho en Stripe.
const reembolsoAMedias = (fila) => Boolean(fila.reembolso_solicitado_en) && !fila.stripe_refund_id;

// Retrasada = entregada y con la recogida prevista ya pasada (3.4). Se calcula al leer (T5).
const estaRetrasada = (fila, hoy) =>
  fila.tipo === 'alquiler' && fila.estado === 'en_curso' && fila.fecha_fin < hoy;

// La solicitud de cancelación que el cliente envía desde "Mis reservas" queda en el historial.
const cancelacionSolicitada = (fila) =>
  (fila.historial || []).some((linea) => linea.tipo === 'cancelacion_solicitada');

// La etiqueta legible de cada combinación y las acciones que tienen sentido en ella (8.7). La fianza
// (fianza_estado) no cuenta todavía: llega con R-e. Las acciones que se ofrecen aquí son las únicas
// que el servidor acepta (comprobarAccion), así la lista y las acciones nunca se contradicen.
const situacion = (fila, { hoy, ahora }) => {
  // Pagada sin poder confirmarse (6.4): el reembolso se hace desde el Dashboard de Stripe, como dice
  // el email de aviso al administrador.
  if (fila.conflicto_en) return { etiqueta: 'No se pudo confirmar', acciones: [] };
  switch (`${fila.tipo}:${fila.estado}`) {
    case 'alquiler:pendiente':
      return {
        etiqueta: new Date(fila.expira_en) < ahora ? 'No pagada' : 'Esperando pago',
        acciones: []
      };
    case 'alquiler:expirada':
      return { etiqueta: 'No pagada', acciones: [] };
    case 'alquiler:confirmada':
      return { etiqueta: 'Confirmada', acciones: ['entregar', 'cancelar'] };
    case 'alquiler:en_curso':
      return {
        etiqueta: estaRetrasada(fila, hoy) ? 'Retrasada' : 'Entregada',
        acciones: ['recoger', 'ampliar']
      };
    case 'alquiler:devuelta':
      return { etiqueta: 'Devuelta', acciones: [] };
    case 'alquiler:cancelada':
      return reembolsoAMedias(fila)
        ? { etiqueta: 'Cancelada · reembolso a medias', acciones: ['reintentar-reembolso'] }
        : { etiqueta: 'Cancelada', acciones: [] };
    case 'bloqueo:confirmada':
      return { etiqueta: 'Bloqueo', acciones: ['levantar-bloqueo'] };
    case 'bloqueo:cancelada':
      return { etiqueta: 'Bloqueo levantado', acciones: [] };
    case 'venta:confirmada':
      return { etiqueta: 'Venta', acciones: ['cancelar'] };
    case 'venta:cancelada':
      return { etiqueta: 'Venta cancelada', acciones: [] };
    default:
      // Combinaciones que las CHECK de R2 no permiten.
      return { etiqueta: fila.estado, acciones: [] };
  }
};

// Una reserva tal como la recibe el panel. `pieza` es { id, nombre, referencia }, o undefined si ya
// no está en el catálogo.
const presentar = (fila, pieza, contexto) => {
  const { etiqueta, acciones } = situacion(fila, contexto);
  const contacto = fila.datos_contacto;
  return {
    id: fila.id,
    referencia: referenciaDeReserva(fila),
    tipo: fila.tipo,
    estado: fila.estado,
    origen: fila.origen,
    etiqueta,
    retrasada: estaRetrasada(fila, contexto.hoy),
    en_conflicto: Boolean(fila.conflicto_en),
    cancelacion_solicitada: cancelacionSolicitada(fila),
    pieza: {
      id: fila.mueble_id,
      nombre: pieza ? pieza.nombre : '(pieza eliminada)',
      referencia: pieza?.referencia ?? null
    },
    fecha_inicio: fila.fecha_inicio,
    hora_entrega: horaCorta(fila.hora_entrega),
    fecha_fin: fila.fecha_fin ?? null,
    hora_recogida: horaCorta(fila.hora_recogida),
    fin_ocupacion: fila.fin_ocupacion ?? null,
    dias_margen: fila.dias_margen ?? 0,
    modo_entrega: fila.modo_entrega ?? null,
    modo_devolucion: fila.modo_devolucion ?? null,
    direccion_entrega: fila.direccion_entrega ?? null,
    contacto: contacto
      ? {
          nombre: contacto.nombre ?? null,
          email: contacto.email ?? null,
          telefono: contacto.telefono ?? null,
          direccion: contacto.direccion ?? null,
          notas: contacto.notas ?? null
        }
      : null,
    importe_total: fila.importe_total == null ? null : Number(fila.importe_total),
    pagado: Boolean(fila.stripe_payment_intent_id),
    reembolso: fila.reembolso_solicitado_en
      ? {
          solicitado_en: fila.reembolso_solicitado_en,
          importe: Number(fila.reembolso_importe),
          stripe_refund_id: fila.stripe_refund_id ?? null
        }
      : null,
    reembolso_a_medias: reembolsoAMedias(fila),
    motivo: fila.motivo ?? null,
    motivo_cancelacion: fila.motivo_cancelacion ?? null,
    entregada_en: fila.entregada_en ?? null,
    devuelta_en: fila.devuelta_en ?? null,
    created_at: fila.created_at ?? null,
    acciones
  };
};

// Las piezas de las reservas, con una segunda consulta (no con un embed de PostgREST).
const leerPiezas = async (ids) => {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return new Map();
  const { data, error } = await supabase
    .from('muebles')
    .select('id, nombre, referencia')
    .in('id', unicos);
  if (error) throw error;
  return new Map(data.map((pieza) => [pieza.id, pieza]));
};

const presentarFilas = async (filas, ahora = new Date()) => {
  const contexto = contextoDe(ahora);
  const piezas = await leerPiezas(filas.map((fila) => fila.mueble_id));
  return filas.map((fila) => presentar(fila, piezas.get(fila.mueble_id), contexto));
};

// ─── La lista (8.1) ──────────────────────────────────────────────────────────────────────────────

const leer = async (consulta) => {
  const { data, error } = await consulta;
  if (error) throw error;
  return data;
};

// Las filas de cada vista. `hoy` es el de Madrid (3.6).
const leerVista = async (vista, { muebleId, hoy, ahora }) => {
  const base = () => {
    const consulta = supabase.from('reservas').select(COLUMNAS_LISTA);
    return muebleId ? consulta.eq('mueble_id', muebleId) : consulta;
  };
  const manana = sumarDias(hoy, 1);
  switch (vista) {
    case 'proximas': {
      // Lo que ocupa el calendario de hoy en adelante, menos las ventas que empezaron antes de hoy:
      // cada compra de la web deja una venta sin fin, y llenarían la lista para siempre. Más los
      // alquileres entregados aunque su ocupación ya haya pasado: un retraso que nadie ha ampliado
      // todavía (8.5) sigue teniendo la pieza fuera.
      const [enCalendario, entregadas] = await Promise.all([
        leer(
          base()
            .in('estado', ESTADOS_QUE_OCUPAN)
            .overlaps('rango_ocupado', `[${hoy},)`)
            .or(`tipo.neq.venta,fecha_inicio.gte.${hoy}`)
            .order('fecha_inicio', { ascending: true })
        ),
        leer(base().eq('estado', 'en_curso').order('fecha_inicio', { ascending: true }))
      ]);
      // Una provisional caducada no ocupa nada, como en la ficha (ocupaElCalendario).
      const filas = enCalendario.filter((fila) => ocupaElCalendario(fila, ahora));
      const vistas = new Set(filas.map((fila) => fila.id));
      return [...filas, ...entregadas.filter((fila) => !vistas.has(fila.id))].sort(porInicio);
    }
    case 'entregas':
      // Hoy y mañana, y las que tenían que haberse entregado ya y siguen sin entregar.
      return leer(
        base()
          .eq('tipo', 'alquiler')
          .eq('estado', 'confirmada')
          .lte('fecha_inicio', manana)
          .order('fecha_inicio', { ascending: true })
      );
    case 'recogidas':
      return leer(
        base()
          .eq('tipo', 'alquiler')
          .eq('estado', 'en_curso')
          .gte('fecha_fin', hoy)
          .lte('fecha_fin', manana)
          .order('fecha_fin', { ascending: true })
      );
    case 'retrasadas':
      return leer(
        base()
          .eq('tipo', 'alquiler')
          .eq('estado', 'en_curso')
          .lt('fecha_fin', hoy)
          .order('fecha_fin', { ascending: true })
      );
    case 'conflicto':
      return leer(
        base().not('conflicto_en', 'is', null).order('conflicto_en', { ascending: false })
      );
    case 'reembolsos':
      return leer(
        base()
          .not('reembolso_solicitado_en', 'is', null)
          .is('stripe_refund_id', null)
          .order('reembolso_solicitado_en', { ascending: true })
      );
    case 'legacy':
      return leer(
        base()
          .eq('origen', 'legacy')
          .neq('estado', 'cancelada')
          .order('fecha_inicio', { ascending: true })
      );
    case 'todas':
      return leer(base().order('created_at', { ascending: false }).limit(MAX_TODAS));
    default:
      throw new ErrorValidacion('Esa vista de la lista de reservas no existe.');
  }
};

// GET /api/admin/reservas: { hoy, reservas }.
const listarReservas = async ({ vista = 'proximas', muebleId, ahora = new Date() }) => {
  const contexto = contextoDe(ahora);
  const filas = await leerVista(vista, { muebleId, ...contexto });
  return { hoy: contexto.hoy, reservas: await presentarFilas(filas, ahora) };
};

// ─── Choques en el calendario (4.3) ──────────────────────────────────────────────────────────────

// Lo que ocupa el calendario de la pieza en el rango propuesto [desde, hasta) (hasta null = sin fin),
// sin la propia reserva y sin las provisionales caducadas, que no cuentan (como ocupacionDesdeHoy).
// Por fecha de inicio.
const buscarChoques = async ({ muebleId, desde, hasta, excluir = null, ahora }) => {
  const filas = await leer(
    supabase
      .from('reservas')
      .select(
        'id, pedido_id, tipo, estado, fecha_inicio, fecha_fin, fin_ocupacion, dias_margen, expira_en'
      )
      .eq('mueble_id', muebleId)
      .in('estado', ESTADOS_QUE_OCUPAN)
      .overlaps('rango_ocupado', `[${desde},${hasta ?? ''})`)
  );
  return filas
    .filter((fila) => fila.id !== excluir && ocupaElCalendario(fila, ahora))
    .sort(porInicio);
};

// Con qué choca, para el administrador: el tipo, la referencia que conoce (la del pedido si lo hay) y
// las fechas. Nunca los datos del otro cliente ni el detalle de Postgres (4.3).
const describirReserva = (fila) => {
  const referencia = `#${referenciaDeReserva(fila)}`;
  if (fila.tipo === 'venta') {
    return `la venta ${referencia} (desde el ${fechaLegible(fila.fecha_inicio)})`;
  }
  const fechas = `del ${fechaLegible(fila.fecha_inicio)} al ${fechaLegible(fila.fin_ocupacion ?? fila.fecha_fin)}`;
  if (fila.tipo === 'bloqueo') return `el bloqueo ${referencia} (${fechas})`;
  const margen = fila.dias_margen > 0 ? `, más ${dias(fila.dias_margen)} de margen` : '';
  return `el alquiler ${referencia} (${fechas}${margen})`;
};

// El 409 de una escritura que la base de datos rechazó por solaparse: `mensaje(choques)` lo redacta
// con las filas encontradas.
const errorDeChoque = async (rango, mensaje) => {
  const choques = await buscarChoques(rango);
  return new ErrorConflicto(choques.length > 0 ? mensaje(choques) : MENSAJE_CHOQUE_DESAPARECIDO);
};

const chocanLasFechas = (choques) => `Esas fechas chocan con ${describirReserva(choques[0])}.`;

// El primer día libre después de una fila (su final exclusivo, margen incluido), o null sin fin.
const finalDe = (fila) =>
  fila.fin_ocupacion == null ? null : sumarDias(fila.fin_ocupacion, fila.dias_margen ?? 0);

// Una venta no tiene fin: choca con todo lo que ocupe la pieza desde su fecha. Se nombra lo último, y
// el día desde el que podría empezar (la entrega diferida del 6.7).
const chocaLaVenta = (choques) => {
  const sinFin = choques.find((fila) => finalDe(fila) === null);
  if (sinFin) return `La venta choca con ${describirReserva(sinFin)}.`;
  const ultima = choques.reduce((a, b) => (finalDe(b) > finalDe(a) ? b : a));
  return (
    `La venta choca con ${describirReserva(ultima)}. ` +
    `Puede empezar, como pronto, el ${fechaLegible(finalDe(ultima))}.`
  );
};

const ANTES_DE_AMPLIAR = {
  alquiler: 'avisa a ese cliente antes de ampliar',
  bloqueo: 'levanta ese bloqueo antes de ampliar',
  venta: 'avisa a ese comprador antes de ampliar'
};
const HASTA_QUE = {
  alquiler: 'se mueva o se cancele ese alquiler',
  bloqueo: 'se mueva o se levante ese bloqueo',
  venta: 'se mueva o se cancele esa venta'
};

// ─── muebles.estado mientras no lo derive el calendario (3.3) ────────────────────────────────────

// Hasta que el disparador de R5 derive muebles.estado de esta tabla (en el lanzamiento, R-f), las
// acciones del panel lo mantienen al día ellas mismas. Cada una cambia la pieza solo si está en el
// estado que la acción deja atrás (entregar: de disponible a alquilado; recoger: de alquilado a
// disponible; cancelar una venta: de vendido a disponible), así que nunca pisan un estado puesto a
// mano: una pieza marcada vendida no pasa a alquilada por entregar un alquiler. Registrar una venta
// ya empezada la marca vendida sin mirar, porque vendida es lo que manda en la derivación del 3.3.
// Si este paso falla, la acción ya está hecha y guardada: se deja en el log y no se rompe la
// respuesta (el estado se corrige a mano en el panel; desde R5 lo hará la base de datos).
const moverPieza = async (muebleId, nuevo, desde = null) => {
  let consulta = supabase.from('muebles').update({ estado: nuevo }).eq('id', muebleId);
  if (desde) consulta = consulta.eq('estado', desde);
  const { error } = await consulta;
  if (error) {
    console.error(`No se pudo poner la pieza ${muebleId} en "${nuevo}":`, error.message || error);
  }
};

// ─── Acciones sobre una reserva (8.3) ────────────────────────────────────────────────────────────

const NO_SE_PUEDE = {
  entregar: 'Solo se puede marcar como entregado un alquiler confirmado.',
  recoger: 'Solo se puede marcar como recogido un alquiler entregado.',
  ampliar: 'Solo se puede ampliar un alquiler entregado que todavía no se ha recogido.',
  cancelar: 'Solo se puede cancelar un alquiler confirmado (antes de entregarlo) o una venta.',
  'reintentar-reembolso': 'Esta reserva no tiene ningún reembolso a medias.',
  'levantar-bloqueo': 'Solo se puede levantar un bloqueo activo.'
};

// 409 si la acción no es una de las que el panel ofrece para esta reserva (situacion), con el motivo
// más concreto que se pueda dar.
const comprobarAccion = (fila, accion, contexto) => {
  if (situacion(fila, contexto).acciones.includes(accion)) return;
  if (fila.conflicto_en) {
    throw new ErrorConflicto(
      'Esta reserva no se pudo confirmar: el reembolso se hace desde el Dashboard de Stripe.'
    );
  }
  if (fila.estado === 'cancelada' && accion !== 'reintentar-reembolso') {
    throw new ErrorConflicto(
      fila.tipo === 'bloqueo'
        ? 'Este bloqueo ya está levantado.'
        : 'Esta reserva ya está cancelada.'
    );
  }
  if (accion === 'entregar' && fila.estado === 'en_curso') {
    throw new ErrorConflicto('Este alquiler ya está marcado como entregado.');
  }
  if (accion === 'recoger' && fila.estado === 'devuelta') {
    throw new ErrorConflicto('Este alquiler ya está marcado como recogido.');
  }
  throw new ErrorConflicto(NO_SE_PUEDE[accion]);
};

// Marcar entregada (8.3): solo desde la fecha prevista, o antes con confirmación explícita.
const entregar = async (id, { antes_de_tiempo: antesDeTiempo = false }, ahora) => {
  const contexto = contextoDe(ahora);
  const { reserva } = await actualizarReserva(id, {
    columnas: COLUMNAS_PANEL,
    ahora,
    decidir: (fila) => {
      comprobarAccion(fila, 'entregar', contexto);
      const anticipada = fila.fecha_inicio > contexto.hoy;
      if (anticipada && !antesDeTiempo) {
        const error = new ErrorConflicto(
          `La entrega está prevista para el ${fechaLegible(fila.fecha_inicio)}. ¿Seguro que la entregas antes?`
        );
        error.codigo = 'entrega_anticipada';
        throw error;
      }
      return {
        cambios: { estado: 'en_curso', entregada_en: ahora.toISOString() },
        entrada: {
          tipo: 'entregada',
          detalle: anticipada
            ? `Entregada antes de la fecha prevista (${fechaLegible(fila.fecha_inicio)}).`
            : 'Entregada.',
          por: 'admin'
        }
      };
    }
  });
  await moverPieza(reserva.mueble_id, 'alquilado', 'disponible');
  return { reserva };
};

// Marcar recogida (8.3). El disparador de R2 pone fin_ocupacion = día real de la devolución (3.4), así
// que una devolución tardía ocupa más calendario: con su margen puede alcanzar a la reserva siguiente.
// Ese choque es real (la pieza no estaba), y hay que resolverlo antes de darla por devuelta.
const recoger = async (id, _datos, ahora) => {
  const contexto = contextoDe(ahora);
  const resultado = await actualizarReserva(id, {
    columnas: COLUMNAS_PANEL,
    ahora,
    ocupa: true,
    decidir: (fila) => {
      comprobarAccion(fila, 'recoger', contexto);
      const retraso = diasEntre(fila.fecha_fin, contexto.hoy);
      return {
        cambios: { estado: 'devuelta', devuelta_en: ahora.toISOString() },
        entrada: {
          tipo: 'recogida',
          detalle: retraso > 0 ? `Recogida con ${dias(retraso)} de retraso.` : 'Recogida.',
          por: 'admin'
        }
      };
    }
  });
  if (resultado.choque) {
    const fila = resultado.choque;
    throw await errorDeChoque(
      {
        muebleId: fila.mueble_id,
        desde: fila.fecha_inicio,
        hasta: sumarDias(contexto.hoy, fila.dias_margen ?? 0),
        excluir: fila.id,
        ahora
      },
      ([siguiente]) =>
        `La devolución de hoy, con su margen, choca con ${describirReserva(siguiente)}. ` +
        `No se puede marcar como recogida hasta que ${HASTA_QUE[siguiente.tipo]}.`
    );
  }
  await moverPieza(resultado.reserva.mueble_id, 'disponible', 'alquilado');
  return { reserva: resultado.reserva };
};

// Ampliar un retraso (8.3, 8.5): la nueva fecha prevista de recogida, que ocupa el calendario.
const ampliar = async (id, { fin_ocupacion: nuevaFecha }, ahora) => {
  const contexto = contextoDe(ahora);
  const resultado = await actualizarReserva(id, {
    columnas: COLUMNAS_PANEL,
    ahora,
    ocupa: true,
    decidir: (fila) => {
      comprobarAccion(fila, 'ampliar', contexto);
      if (nuevaFecha < fila.fecha_fin) {
        throw new ErrorValidacion(
          `La nueva fecha no puede ser anterior a la recogida pactada (${fechaLegible(fila.fecha_fin)}).`
        );
      }
      if (nuevaFecha < contexto.hoy) {
        throw new ErrorValidacion('La nueva fecha no puede ser anterior a hoy.');
      }
      return {
        cambios: { fin_ocupacion: nuevaFecha },
        entrada: {
          tipo: 'ampliada',
          detalle: `Recogida prevista para el ${fechaLegible(nuevaFecha)} (antes, el ${fechaLegible(fila.fin_ocupacion)}).`,
          por: 'admin'
        }
      };
    }
  });
  if (resultado.choque) {
    const fila = resultado.choque;
    throw await errorDeChoque(
      {
        muebleId: fila.mueble_id,
        desde: fila.fecha_inicio,
        hasta: sumarDias(nuevaFecha, fila.dias_margen ?? 0),
        excluir: fila.id,
        ahora
      },
      ([siguiente]) =>
        `La nueva fecha choca con ${describirReserva(siguiente)}: ${ANTES_DE_AMPLIAR[siguiente.tipo]}.`
    );
  }
  return { reserva: resultado.reserva };
};

// El reembolso que se pide al cancelar (8.4, política 'manual': decide el administrador), en céntimos.
const comprobarReembolso = (fila, centimos) => {
  if (centimos === 0) return;
  if (fila.tipo === 'venta') {
    throw new ErrorValidacion(
      'Las compras se reembolsan desde el Dashboard de Stripe, como hasta ahora.'
    );
  }
  if (!fila.stripe_payment_intent_id) {
    throw new ErrorValidacion(
      'Este alquiler no se pagó en la web: el reembolso, si lo hay, se hace a mano.'
    );
  }
  const pagado = fila.importe_total == null ? 0 : centimosDe(fila.importe_total);
  if (centimos > pagado) {
    throw new ErrorValidacion(
      `El reembolso no puede pasar de lo pagado (${eurosLegibles(pagado)}).`
    );
  }
};

// Otra petición (un «Reintentar» a la vez) ya guardó el reembolso: no se añade otra línea.
class ReembolsoYaGuardado extends Error {
  constructor(fila) {
    super('El reembolso ya estaba guardado.');
    this.fila = fila;
  }
}

// 8.6, capa 3: el id del reembolso, con su línea en el historial, solo si no estaba ya.
const guardarReembolso = async (id, refundId, ahora) => {
  try {
    const { reserva } = await actualizarReserva(id, {
      columnas: COLUMNAS_PANEL,
      ahora,
      decidir: (fila) => {
        if (fila.stripe_refund_id) throw new ReembolsoYaGuardado(fila);
        return {
          cambios: { stripe_refund_id: refundId },
          entrada: {
            tipo: 'reembolso',
            detalle: `Reembolso de ${eurosLegibles(centimosDe(fila.reembolso_importe))} hecho en Stripe (${refundId}).`,
            por: 'admin'
          }
        };
      }
    });
    return reserva;
  } catch (error) {
    if (error instanceof ReembolsoYaGuardado) return error.fila;
    throw error;
  }
};

// 8.6, capas 2 y 3, con la marca ya reclamada: el reembolso en Stripe, con su clave de idempotencia
// fija, y su id en la reserva. Al reintentar (`buscarAntes`), primero se busca en Stripe por si se
// hizo y no llegó a guardarse: la clave solo dura 24 horas, y pasado ese plazo crearía otro.
const hacerReembolso = async (fila, { buscarAntes, ahora }) => {
  const stripe = stripeUtil.getStripe();
  if (!stripe) throw new Error('Stripe no está configurado (falta STRIPE_SECRET_KEY).');
  let refundId = null;
  if (buscarAntes) {
    const { data } = await stripe.refunds.list({
      payment_intent: fila.stripe_payment_intent_id,
      limit: 100
    });
    const hecho = data.find(
      (refund) =>
        refund.metadata?.reserva_id === fila.id && refund.metadata?.tipo === TIPO_REEMBOLSO
    );
    refundId = hecho?.id ?? null;
  }
  if (!refundId) {
    const refund = await stripe.refunds.create(
      {
        payment_intent: fila.stripe_payment_intent_id,
        amount: centimosDe(fila.reembolso_importe),
        metadata: { reserva_id: fila.id, tipo: TIPO_REEMBOLSO }
      },
      { idempotencyKey: claveDeReembolso(fila.id) }
    );
    refundId = refund.id;
  }
  return guardarReembolso(fila.id, refundId, ahora);
};

// Cancelar (8.4) un alquiler confirmado o una venta, con el reembolso que decide el administrador.
// El dinero se mueve en las tres capas del 8.6. La primera es este UPDATE: cancela y reclama la marca
// del reembolso a la vez, y solo vale si la fila sigue como se leyó (actualizarReserva), así que una
// segunda petición simultánea vuelve a leer y se encuentra la marca puesta, o la reserva cancelada.
// Si Stripe falla después, la reserva queda cancelada con el reembolso "a medias", y se dice.
const cancelar = async (id, { motivo, reembolso_centimos: reembolso }, ahora) => {
  const contexto = contextoDe(ahora);
  const { reserva } = await actualizarReserva(id, {
    columnas: COLUMNAS_PANEL,
    ahora,
    decidir: (fila) => {
      if (fila.reembolso_solicitado_en) throw new ErrorConflicto(MENSAJE_REEMBOLSO_EN_CURSO);
      comprobarAccion(fila, 'cancelar', contexto);
      comprobarReembolso(fila, reembolso);
      const cambios = {
        estado: 'cancelada',
        cancelada_en: ahora.toISOString(),
        cancelada_por: 'admin',
        motivo_cancelacion: motivo
      };
      if (reembolso > 0) {
        cambios.reembolso_solicitado_en = ahora.toISOString();
        cambios.reembolso_importe = euros(reembolso);
      }
      return {
        cambios,
        entrada: {
          tipo: 'cancelada',
          detalle: `Motivo: ${motivo}. ${reembolso > 0 ? `Reembolso pedido: ${eurosLegibles(reembolso)}.` : 'Sin reembolso.'}`,
          por: 'admin'
        }
      };
    }
  });
  if (reserva.tipo === 'venta') await moverPieza(reserva.mueble_id, 'disponible', 'vendido');
  if (!reembolsoAMedias(reserva)) return { reserva };
  try {
    return { reserva: await hacerReembolso(reserva, { buscarAntes: false, ahora }) };
  } catch (error) {
    console.error(
      `[ALERTA] Reserva ${id} cancelada con el reembolso a medias:`,
      error.message || error
    );
    return { reserva, avisoReembolso: MENSAJE_REEMBOLSO_A_MEDIAS };
  }
};

const leerReserva = async (id) => {
  const fila = await leer(
    supabase.from('reservas').select(COLUMNAS_LISTA).eq('id', id).maybeSingle()
  );
  if (!fila) throw new ErrorNoEncontrado(MENSAJE_RESERVA_NO_ENCONTRADA);
  return fila;
};

// «Reintentar reembolso» (8.6, capa 3): solo para las que se quedaron a medias.
const reintentarReembolso = async (id, _datos, ahora) => {
  const fila = await leerReserva(id);
  comprobarAccion(fila, 'reintentar-reembolso', contextoDe(ahora));
  try {
    return { reserva: await hacerReembolso(fila, { buscarAntes: true, ahora }) };
  } catch (error) {
    console.error(
      `[ALERTA] No se pudo reintentar el reembolso de la reserva ${id}:`,
      error.message || error
    );
    return { reserva: fila, avisoReembolso: MENSAJE_REINTENTO_FALLIDO };
  }
};

const levantarBloqueo = async (id, _datos, ahora) => {
  const contexto = contextoDe(ahora);
  const { reserva } = await actualizarReserva(id, {
    columnas: COLUMNAS_PANEL,
    ahora,
    decidir: (fila) => {
      comprobarAccion(fila, 'levantar-bloqueo', contexto);
      return {
        cambios: { estado: 'cancelada', cancelada_en: ahora.toISOString(), cancelada_por: 'admin' },
        entrada: { tipo: 'levantado', detalle: 'Bloqueo levantado.', por: 'admin' }
      };
    }
  });
  return { reserva };
};

const ACCIONES = {
  entregar,
  recoger,
  ampliar,
  cancelar,
  'reintentar-reembolso': reintentarReembolso,
  'levantar-bloqueo': levantarBloqueo
};

// POST /api/admin/reservas/:id/:accion, con el cuerpo ya validado (schemas/adminReservas.js).
// Devuelve { reserva } con la fila tal como queda, y `avisoReembolso` si la reserva se canceló pero
// el reembolso no se pudo hacer (502). Lanza ErrorConflicto (409), ErrorValidacion (400) o
// ErrorNoEncontrado (404) con un mensaje que se puede enseñar; cualquier otro error es interno.
const ejecutarAccion = (id, accion, datos, ahora = new Date()) =>
  ACCIONES[accion](id, datos ?? {}, ahora);

// ─── Altas sin pago web (8.3) ────────────────────────────────────────────────────────────────────

const leerPieza = async (muebleId) => {
  const pieza = await leer(
    supabase
      .from('muebles')
      .select('id, nombre, referencia, estado')
      .eq('id', muebleId)
      .maybeSingle()
  );
  if (!pieza) throw new ErrorNoEncontrado(MENSAJE_PIEZA_NO_ENCONTRADA);
  return pieza;
};

const lineaCreada = (detalle, ahora) => [
  { fecha: ahora.toISOString(), tipo: 'creada', detalle, por: 'admin' }
];

// Inserta una fila en el calendario por el mismo camino que todo lo demás (4.6): limpieza, inserción
// y, si choca, el 409 que dice con qué.
const insertarEnCalendario = async (fila, { ahora, mensaje }) => {
  const { data, error } = await escribirEnCalendario(fila.mueble_id, () =>
    supabase.from('reservas').insert(fila).select(COLUMNAS_LISTA).single()
  );
  if (!error) return data;
  // La pieza se borró entre la lectura y la inserción.
  if (error.code === CODIGO_CLAVE_AJENA) throw new ErrorNoEncontrado(MENSAJE_PIEZA_NO_ENCONTRADA);
  if (!chocaEnCalendario(error)) throw error;
  throw await errorDeChoque(
    {
      muebleId: fila.mueble_id,
      desde: fila.fecha_inicio,
      hasta: finalDe(fila),
      ahora
    },
    mensaje
  );
};

// Bloquear fechas (8.3): mantenimiento, una exposición... Devuelven { reserva, pieza }.
const crearBloqueo = async (datos, ahora = new Date()) => {
  if (datos.fecha_inicio < hoyEnMadrid(ahora)) {
    throw new ErrorValidacion('Un bloqueo no puede empezar antes de hoy.');
  }
  const pieza = await leerPieza(datos.mueble_id);
  const reserva = await insertarEnCalendario(
    {
      mueble_id: pieza.id,
      tipo: 'bloqueo',
      estado: 'confirmada',
      fecha_inicio: datos.fecha_inicio,
      fecha_fin: datos.fecha_fin,
      fin_ocupacion: datos.fecha_fin,
      dias_margen: 0,
      origen: 'manual',
      motivo: datos.motivo,
      historial: lineaCreada(`Bloqueo: ${datos.motivo}`, ahora)
    },
    { ahora, mensaje: chocanLasFechas }
  );
  return { reserva, pieza };
};

// Registrar un alquiler fuera de la web (8.3): pactado por teléfono o en la tienda ('manual'), o un
// contrato antiguo ('legacy', 9.2), sin pago de Stripe y con el mismo margen que los de la web. Un
// contrato antiguo, o uno que ya está en casa del cliente, puede haber empezado antes de hoy; uno que
// todavía hay que entregar, no. La duración no tiene los límites de la web: se pactó fuera.
const crearAlquiler = async (datos, ahora = new Date(), reglas = REGLAS_ALQUILER) => {
  const hoy = hoyEnMadrid(ahora);
  if (datos.origen === 'manual' && !datos.ya_entregado && datos.fecha_inicio < hoy) {
    throw new ErrorValidacion(
      'Un alquiler que todavía no se ha entregado no puede empezar antes de hoy.'
    );
  }
  const pieza = await leerPieza(datos.mueble_id);
  if (pieza.estado === 'vendido') {
    throw new ErrorValidacion('Esta pieza está vendida: no se puede alquilar.');
  }

  const { contacto } = datos;
  const aDomicilio = datos.modo_entrega === 'domicilio' || datos.modo_devolucion === 'domicilio';
  const comoEs =
    datos.origen === 'legacy'
      ? 'Contrato antiguo dado de alta desde el panel.'
      : 'Alquiler pactado fuera de la web.';
  const reserva = await insertarEnCalendario(
    {
      mueble_id: pieza.id,
      tipo: 'alquiler',
      estado: datos.ya_entregado ? 'en_curso' : 'confirmada',
      fecha_inicio: datos.fecha_inicio,
      hora_entrega: datos.hora_entrega,
      fecha_fin: datos.fecha_fin,
      hora_recogida: datos.hora_recogida,
      fin_ocupacion: datos.fecha_fin,
      dias_margen: reglas.diasMargen,
      modo_entrega: datos.modo_entrega,
      modo_devolucion: datos.modo_devolucion,
      direccion_entrega: aDomicilio ? contacto.direccion : null,
      datos_contacto: {
        nombre: contacto.nombre,
        email: contacto.email ?? null,
        telefono: contacto.telefono ?? null,
        direccion: contacto.direccion ?? null,
        notas: contacto.notas ?? null
      },
      importe_total:
        datos.importe_total_centimos == null ? null : euros(datos.importe_total_centimos),
      ...(datos.ya_entregado && { entregada_en: ahora.toISOString() }),
      origen: datos.origen,
      historial: lineaCreada(datos.ya_entregado ? `${comoEs} Ya estaba entregado.` : comoEs, ahora)
    },
    { ahora, mensaje: chocanLasFechas }
  );
  if (datos.ya_entregado) await moverPieza(pieza.id, 'alquilado', 'disponible');
  return { reserva, pieza };
};

// Registrar una venta fuera de la web (8.3): ya hecha (desde hoy o desde hace unos días) o con entrega
// diferida, que empieza cuando la pieza queda libre (6.7). Sin fin, como todas las ventas.
const crearVenta = async (datos, ahora = new Date()) => {
  const hoy = hoyEnMadrid(ahora);
  const limite = sumarDias(hoy, -DIAS_ATRAS_VENTA);
  if (datos.fecha_inicio < limite) {
    throw new ErrorValidacion(
      `Una venta ya hecha se puede registrar con fecha de hasta ${DIAS_ATRAS_VENTA} días atrás ` +
        `(desde el ${fechaLegible(limite)}).`
    );
  }
  const pieza = await leerPieza(datos.mueble_id);
  const reserva = await insertarEnCalendario(
    {
      mueble_id: pieza.id,
      tipo: 'venta',
      estado: 'confirmada',
      fecha_inicio: datos.fecha_inicio,
      dias_margen: 0,
      origen: 'manual',
      motivo: datos.motivo,
      historial: lineaCreada(`Venta fuera de la web: ${datos.motivo}`, ahora)
    },
    { ahora, mensaje: chocaLaVenta }
  );
  if (datos.fecha_inicio <= hoy) await moverPieza(pieza.id, 'vendido');
  return { reserva, pieza };
};

module.exports = {
  COLUMNAS_LISTA,
  MAX_TODAS,
  DIAS_ATRAS_VENTA,
  MENSAJE_RESERVA_NO_ENCONTRADA,
  MENSAJE_REEMBOLSO_EN_CURSO,
  MENSAJE_REEMBOLSO_A_MEDIAS,
  MENSAJE_REINTENTO_FALLIDO,
  MENSAJE_CHOQUE_DESAPARECIDO,
  claveDeReembolso,
  situacion,
  presentar,
  presentarFilas,
  listarReservas,
  ejecutarAccion,
  crearBloqueo,
  crearAlquiler,
  crearVenta
};
