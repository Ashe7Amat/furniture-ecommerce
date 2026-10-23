// server/src/utils/audit.js
const supabase = require('../data/supabase');

/**
 * Compara dos valores para determinar si son equivalentes.
 * Maneja valores primitivos, arrays y objetos.
 */
const sonValoresIguales = (a, b) => {
  if (a === b) return true;
  if (a === null || a === undefined || b === null || b === undefined) {
    return a === b;
  }
  if (typeof a !== typeof b) {
    return false;
  }
  if (typeof a === 'object') {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  return false;
};

/**
 * Calcula la diferencia entre datos anteriores y nuevos.
 * - En creación: diffAnteriores es null, diffNuevos son los datos nuevos.
 * - En eliminación: diffAnteriores son los datos anteriores, diffNuevos es null.
 * - En edición: solo incluye las propiedades que cambiaron de valor.
 *   Si un campo no cambia, no se incluye.
 *   Si no hay ningún cambio, hayCambios es false.
 */
const calcularDiff = (datosAnteriores, datosNuevos) => {
  // Caso creación o duplicación (sin datos anteriores):
  if (!datosAnteriores && datosNuevos) {
    return { diffAnteriores: null, diffNuevos: { ...datosNuevos }, hayCambios: true };
  }

  // Caso eliminación (sin datos nuevos):
  if (datosAnteriores && !datosNuevos) {
    return { diffAnteriores: { ...datosAnteriores }, diffNuevos: null, hayCambios: true };
  }

  // Caso sin datos en ninguno:
  if (!datosAnteriores && !datosNuevos) {
    return { diffAnteriores: null, diffNuevos: null, hayCambios: false };
  }

  // Caso edición: ambos objetos presentes
  const diffAnteriores = {};
  const diffNuevos = {};
  let hayCambios = false;

  const claves = new Set([...Object.keys(datosAnteriores), ...Object.keys(datosNuevos)]);

  const CAMPOS_SISTEMA = new Set(['updated_at', 'created_at', 'disponible']);

  for (const clave of claves) {
    if (CAMPOS_SISTEMA.has(clave)) continue;

    // Si la clave no está en datosNuevos (actualización parcial que no la toca), la omitimos
    if (!(clave in datosNuevos)) continue;

    const valAnt = datosAnteriores[clave];
    const valNue = datosNuevos[clave];

    if (!sonValoresIguales(valAnt, valNue)) {
      diffAnteriores[clave] = valAnt !== undefined ? valAnt : null;
      diffNuevos[clave] = valNue !== undefined ? valNue : null;
      hayCambios = true;
    }
  }

  return { diffAnteriores, diffNuevos, hayCambios };
};

/**
 * Registra una actividad administrativa en la tabla audit_log.
 * REGLA DE ORO: Nunca lanza errores hacia la acción principal.
 */
const registrarActividad = async (
  req,
  accion,
  entidad,
  entidadId,
  datosAnteriores = null,
  datosNuevos = null
) => {
  try {
    const { diffAnteriores, diffNuevos, hayCambios } = calcularDiff(datosAnteriores, datosNuevos);

    // Si ambos objetos estaban definidos (edición) pero no hubo ningún cambio, no se guarda nada.
    if (datosAnteriores && datosNuevos && !hayCambios) {
      return null;
    }

    const adminId = req?.usuario?.sub || req?.usuario?.id || req?.user?.id || null;
    const adminEmail = req?.usuario?.email || req?.user?.email || null;

    const registro = {
      admin_id: adminId ? String(adminId) : null,
      admin_email: adminEmail ? String(adminEmail) : null,
      accion,
      entidad,
      entidad_id: entidadId != null ? String(entidadId) : '',
      datos_anteriores: diffAnteriores,
      datos_nuevos: diffNuevos
    };

    const { data, error } = await supabase.from('audit_log').insert([registro]).select();

    if (error) {
      console.error('Error al insertar en audit_log:', error.message || error);
      return null;
    }

    return data?.[0] || data;
  } catch (error) {
    console.error('Error no controlado en registrarActividad:', error.message || error);
    return null;
  }
};

module.exports = {
  registrarActividad,
  calcularDiff,
  sonValoresIguales
};
