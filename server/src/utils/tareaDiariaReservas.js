// La tarea diaria de las reservas (docs/reservas-diseno.md, 8.5; bloque R-e, paso 19). La lanza Vercel
// Cron una vez al día (GET /api/cron/reservas, server/vercel.json) y hace tres cosas:
//   1. Recordatorio de entrega a los alquileres confirmados que empiezan mañana o pasado.
//   2. Recordatorio de devolución a los entregados que terminan mañana o pasado.
//   3. Los retrasados (entregados con la devolución pactada ya pasada): amplía su ocupación hasta
//      mañana, para que la pieza siga ocupando el calendario, y avisa al cliente una vez. Si la
//      ampliación choca con la reserva siguiente, aviso urgente al administrador (cada día que siga).
// "Retrasada" no es un estado guardado (T5): se sigue calculando al leer, y el panel la enseña igual
// aunque esta tarea no se ejecute un día. Ninguna garantía depende de ella (8.5): sin ella solo se
// retrasan los avisos y la ampliación.
//
// Cada correo se envía una sola vez por reserva: antes de enviarlo se apunta en su historial con
// actualizarReserva (que solo escribe si la fila sigue como se leyó), y solo envía quien lo apunta. Así
// dos ejecuciones a la vez (Vercel puede repetir una invocación) no mandan dos correos.
// Fuera de la tarea quedan los alquileres de contratos antiguos (origen 'legacy'): sus clientes no
// han aceptado nada en la web y el administrador los lleva a mano.
const supabase = require('../data/supabase');
const email = require('./email');
const { hoyEnMadrid, sumarDias, fechaLegible } = require('./fechasMadrid');
const { actualizarReserva } = require('./calendarioReservas');
const { buscarChoques, describirReserva, datosDelCorreo } = require('./adminReservas');

const ORIGENES_CON_AVISOS = ['web', 'manual'];
// Los recordatorios salen 2 días antes, o 1 si la tarea no se ejecutó el día que tocaba o la reserva
// se hizo con menos antelación.
const DIAS_RECORDATORIO = 2;

const TIPO_RECORDATORIO_ENTREGA = 'recordatorio_entrega';
const TIPO_RECORDATORIO_RECOGIDA = 'recordatorio_recogida';
const TIPO_AVISO_RETRASO = 'aviso_retraso';
const TIPO_AMPLIADA = 'ampliada';

const COLUMNAS =
  'pedido_id, tipo, estado, origen, fecha_inicio, hora_entrega, fecha_fin, hora_recogida, ' +
  'fin_ocupacion, dias_margen, modo_entrega, modo_devolucion, direccion_entrega, datos_contacto';

// La fila ya no está como para hacer esto (otra ejecución lo hizo, o cambió entre medias).
class YaNoToca extends Error {}

const tiene = (fila, tipo) => (fila.historial || []).some((linea) => linea.tipo === tipo);

const leer = async (consulta) => {
  const { data, error } = await consulta;
  if (error) throw error;
  return data;
};

const alquileres = (estado) =>
  supabase
    .from('reservas')
    .select(`${COLUMNAS}, id, mueble_id, historial`)
    .eq('tipo', 'alquiler')
    .eq('estado', estado)
    .in('origen', ORIGENES_CON_AVISOS);

const nombresDePiezas = async (filas) => {
  const ids = [...new Set(filas.map((fila) => fila.mueble_id))];
  if (ids.length === 0) return new Map();
  const piezas = await leer(supabase.from('muebles').select('id, nombre').in('id', ids));
  return new Map(piezas.map((pieza) => [pieza.id, pieza.nombre]));
};

// Apunta `tipo` en el historial si `sigueTocando(fila)` y no estaba ya. true solo para quien lo apunta.
const apuntar = async (id, { tipo, detalle, sigueTocando, ahora }) => {
  try {
    const resultado = await actualizarReserva(id, {
      columnas: COLUMNAS,
      ahora,
      decidir: (fila) => {
        if (tiene(fila, tipo) || !sigueTocando(fila)) throw new YaNoToca();
        return { cambios: {}, entrada: { tipo, detalle, por: 'sistema' } };
      }
    });
    // Sin ampliar nada no debería chocar; si la base de datos lo rechaza igual, no queda apuntado y
    // no se envía (se intentará mañana).
    if (resultado.choque) throw new Error('la base de datos rechazó la línea del historial');
    return true;
  } catch (error) {
    if (error instanceof YaNoToca) return false;
    throw error;
  }
};

// Un recordatorio por fila: lo apunta y, si lo ha apuntado esta ejecución, lo envía.
const recordar = async (filas, { tipo, detalle, sigueTocando, enviar, piezas, ahora, resumen }) => {
  for (const fila of filas) {
    if (tiene(fila, tipo) || !fila.datos_contacto?.email) continue;
    try {
      if (await apuntar(fila.id, { tipo, detalle, sigueTocando, ahora })) {
        await enviar(datosDelCorreo(fila, piezas.get(fila.mueble_id)));
        resumen.enviados += 1;
      }
    } catch (error) {
      resumen.errores += 1;
      console.error(
        `Tarea diaria: no se pudo apuntar ${tipo} en la reserva ${fila.id}:`,
        error.message || error
      );
    }
  }
};

// Amplía la ocupación de un retrasado hasta mañana. Devuelve 'ampliada', 'ya' (ya llegaba) o 'choque'.
const ampliarRetraso = async (fila, { manana, ahora }) => {
  if (fila.fin_ocupacion >= manana) return 'ya';
  try {
    const resultado = await actualizarReserva(fila.id, {
      columnas: COLUMNAS,
      ahora,
      ocupa: true,
      decidir: (actual) => {
        if (actual.estado !== 'en_curso' || actual.fin_ocupacion >= manana) throw new YaNoToca();
        return {
          cambios: { fin_ocupacion: manana },
          entrada: {
            tipo: TIPO_AMPLIADA,
            detalle:
              `Sin devolver: la pieza sigue ocupada hasta el ${fechaLegible(manana)} ` +
              `(antes, el ${fechaLegible(actual.fin_ocupacion)}).`,
            por: 'sistema'
          }
        };
      }
    });
    return resultado.choque ? 'choque' : 'ampliada';
  } catch (error) {
    if (error instanceof YaNoToca) return 'ya';
    throw error;
  }
};

const avisarChoque = async (fila, pieza, { manana, ahora }) => {
  const choques = await buscarChoques({
    muebleId: fila.mueble_id,
    desde: fila.fecha_inicio,
    hasta: sumarDias(manana, fila.dias_margen ?? 0),
    excluir: fila.id,
    ahora
  });
  const contacto = fila.datos_contacto || {};
  await email.enviarAlertaAdmin({
    asunto: 'Alquiler sin devolver que choca con la reserva siguiente',
    detalles: [
      `Pieza: ${pieza || '(pieza eliminada del catálogo)'} (${fila.mueble_id})`,
      `Devolución pactada: ${fechaLegible(fila.fecha_fin)}. La pieza sigue fuera.`,
      `Cliente: ${contacto.nombre || 'sin nombre'} <${contacto.email || 'sin email'}> · ${contacto.telefono || 'sin teléfono'}`,
      choques.length > 0
        ? `Choca con ${describirReserva(choques[0])}: avisa a ese cliente.`
        : 'Choca con otra reserva de la pieza: revísala en el panel.',
      `Reserva ${fila.id}`
    ]
  });
};

// Ejecuta la tarea. Devuelve el resumen de lo hecho (sin datos personales), que la ruta devuelve y
// queda en los logs de Vercel. Un fallo con una reserva no corta el resto; uno al leer, sí (lanza).
const ejecutarTareaDiaria = async ({ ahora = new Date() } = {}) => {
  const hoy = hoyEnMadrid(ahora);
  const manana = sumarDias(hoy, 1);
  const limite = sumarDias(hoy, DIAS_RECORDATORIO);

  const [porEntregar, porDevolver, retrasados] = await Promise.all([
    leer(alquileres('confirmada').gte('fecha_inicio', manana).lte('fecha_inicio', limite)),
    leer(alquileres('en_curso').gte('fecha_fin', manana).lte('fecha_fin', limite)),
    leer(alquileres('en_curso').lt('fecha_fin', hoy))
  ]);
  const piezas = await nombresDePiezas([...porEntregar, ...porDevolver, ...retrasados]);

  const entregas = { enviados: 0, errores: 0 };
  await recordar(porEntregar, {
    tipo: TIPO_RECORDATORIO_ENTREGA,
    detalle: 'Recordatorio de entrega enviado al cliente.',
    sigueTocando: (fila) => fila.estado === 'confirmada',
    enviar: email.enviarRecordatorioEntrega,
    piezas,
    ahora,
    resumen: entregas
  });

  const devoluciones = { enviados: 0, errores: 0 };
  await recordar(porDevolver, {
    tipo: TIPO_RECORDATORIO_RECOGIDA,
    detalle: 'Recordatorio de devolución enviado al cliente.',
    sigueTocando: (fila) => fila.estado === 'en_curso',
    enviar: email.enviarRecordatorioRecogida,
    piezas,
    ahora,
    resumen: devoluciones
  });

  const retrasos = { total: retrasados.length, ampliados: 0, choques: 0, avisos: 0, errores: 0 };
  for (const fila of retrasados) {
    const pieza = piezas.get(fila.mueble_id);
    try {
      const resultado = await ampliarRetraso(fila, { manana, ahora });
      if (resultado === 'ampliada') retrasos.ampliados += 1;
      if (resultado === 'choque') {
        retrasos.choques += 1;
        console.error(
          `[ALERTA] Tarea diaria: la reserva ${fila.id}, sin devolver, choca con la siguiente.`
        );
        await avisarChoque(fila, pieza, { manana, ahora });
      }
    } catch (error) {
      retrasos.errores += 1;
      console.error(
        `Tarea diaria: no se pudo ampliar la reserva ${fila.id}:`,
        error.message || error
      );
    }
  }
  const avisosRetraso = { enviados: 0, errores: 0 };
  await recordar(retrasados, {
    tipo: TIPO_AVISO_RETRASO,
    detalle: 'Aviso de retraso enviado al cliente.',
    sigueTocando: (fila) => fila.estado === 'en_curso' && fila.fecha_fin < hoy,
    enviar: email.enviarAvisoRetraso,
    piezas,
    ahora,
    resumen: avisosRetraso
  });
  retrasos.avisos = avisosRetraso.enviados;
  retrasos.errores += avisosRetraso.errores;

  return {
    hoy,
    recordatoriosEntrega: entregas,
    recordatoriosDevolucion: devoluciones,
    retrasos
  };
};

module.exports = {
  ejecutarTareaDiaria,
  DIAS_RECORDATORIO,
  TIPO_RECORDATORIO_ENTREGA,
  TIPO_RECORDATORIO_RECOGIDA,
  TIPO_AVISO_RETRASO
};
