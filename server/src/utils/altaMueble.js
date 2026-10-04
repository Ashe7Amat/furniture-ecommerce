const supabase = require('../data/supabase');
const {
  obtenerCodigoCategoria,
  calcularSiguienteReferencia,
  MAX_REINTENTOS
} = require('./referencia');

// Inserta un mueble con su referencia automática (A4). Lo usan crearMueble (POST /api/muebles) y la
// importación desde CSV, para que las dos altas sigan exactamente el mismo camino.
// `payload` son las columnas del mueble (sin `referencia`); `origen` solo cambia los avisos del log.
// Devuelve las filas insertadas (como .insert().select()). Lanza el error de la base de datos si no
// se puede guardar.
const insertarMuebleConReferencia = async (payload, { origen = 'crearMueble' } = {}) => {
  // A4: referencia automática si la categoría tiene código (las 12 ya lo tienen tras A3).
  // El código se obtiene UNA VEZ fuera del bucle — no cambia entre reintentos.
  // Si la categoría no tiene código (nueva categoría aún sin código, o categoria_id null),
  // codigoCategoria queda null y el mueble se crea sin referencia — no bloquea.
  let codigoCategoria = null;
  if (payload.categoria_id) {
    try {
      codigoCategoria = await obtenerCodigoCategoria(payload.categoria_id);
    } catch (errRef) {
      // SIN_CODIGO es esperado para categorías nuevas aún sin código asignado.
      // Cualquier otro error (categoría no encontrada, fallo de red) sí debe subir.
      if (errRef.code !== 'SIN_CODIGO') throw errRef;
      console.warn(
        `[${origen}] Categoría ${payload.categoria_id} sin código: mueble sin referencia.`
      );
    }
  }

  // Bucle de inserción. Con código: MAX_REINTENTOS intentos con recálculo de referencia en
  // cada iteración (calcularSiguienteReferencia siempre ve el MAX actualizado en la BD).
  // Sin código: una sola inserción, sin bucle efectivo.
  // 23505 = unique_violation en Postgres: dos admins coincidieron en el mismo MAX+1.
  // El siguiente intento llama de nuevo a calcularSiguienteReferencia y ve la referencia
  // del primero → devuelve MAX+1 correcto → la colisión se resuelve sola.
  const intentosMaximos = codigoCategoria ? MAX_REINTENTOS : 1;
  for (let intento = 0; intento < intentosMaximos; intento++) {
    // Se recalcula en cada iteración: en el reintento por 23505, la BD ya tiene la referencia
    // del admin que ganó la carrera, así que este verá un MAX más alto y no volverá a chocar.
    const referencia = codigoCategoria ? await calcularSiguienteReferencia(codigoCategoria) : null;

    const { data, error } = await supabase
      .from('muebles')
      .insert([{ ...payload, referencia }])
      .select();

    if (!error) return data;

    // 23505 + mención al constraint de referencia = colisión concurrente en muebles.referencia.
    // Se recalcula en el siguiente intento (calcularSiguienteReferencia verá el MAX actualizado).
    // Si el 23505 es de otro constraint UNIQUE futuro (nombre, etc.), no reintentamos: throw.
    if (
      error.code === '23505' &&
      error.message?.includes('referencia') &&
      intento < intentosMaximos - 1
    ) {
      console.warn(
        `[${origen}] Colisión en referencia ${referencia} (intento ${intento + 1}/${intentosMaximos}). Recalculando...`
      );
      continue; // siguiente iteración recalcula desde la BD
    }

    // Cualquier otro error de BD, o colisión con reintentos agotados
    throw error;
  }
};

module.exports = { insertarMuebleConReferencia };
