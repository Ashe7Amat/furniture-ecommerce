const supabase = require('../data/supabase');

// A4 (ver docs/tarea3-diseno.md): genera la referencia única de un mueble a partir del código
// de su categoría. Formato: NAV-COD-NNN (p. ej. NAV-SIL-001, NAV-MES-042).
//
// Usa ORDER BY referencia DESC LIMIT 1 en lugar de traer todas las filas: con padStart(3, '0')
// fijo, el orden lexicográfico coincide exactamente con el numérico ('099' < '100'). Una fila,
// no 999. El índice UNIQUE de muebles.referencia hace este ORDER BY prácticamente gratis.
//
// No reutiliza huecos: si NAV-SIL-001 y NAV-SIL-003 existen (hueco en 002), la última es
// NAV-SIL-003 y el siguiente será NAV-SIL-004 ✅. Nunca reutiliza NAV-SIL-002.
//
// Concurrencia: si dos admins coinciden en el mismo siguiente número, la constraint UNIQUE
// rechaza al segundo (código Postgres 23505). crearMueble captura ese código, itera de nuevo
// (MAX_REINTENTOS veces), y en cada iteración recalcula llamando a calcularSiguienteReferencia
// — que en ese momento ya ve la referencia del primero y devuelve la correcta.

const PREFIJO = 'NAV';
const MAX_REINTENTOS = 3;

/**
 * Obtiene el código de 3 letras de una categoría (p. ej. 'SIL').
 * @param {number} categoriaId
 * @returns {Promise<string>}
 * @throws {Error} con err.code === 'SIN_CODIGO' si la categoría no tiene código.
 * @throws {Error} genérico si la categoría no existe o hay fallo de BD.
 */
const obtenerCodigoCategoria = async (categoriaId) => {
  const { data, error } = await supabase
    .from('categorias')
    .select('codigo')
    .eq('id', categoriaId)
    .maybeSingle();

  if (error) throw new Error(`Error al leer la categoría ${categoriaId}: ${error.message}`);
  if (!data) throw new Error(`Categoría ${categoriaId} no encontrada.`);
  if (!data.codigo) {
    const err = new Error(`La categoría ${categoriaId} no tiene código asignado.`);
    err.code = 'SIN_CODIGO';
    throw err;
  }

  return data.codigo;
};

/**
 * Calcula el siguiente número de referencia para el código dado.
 * Trae una sola fila (ORDER BY DESC LIMIT 1); no trae todo el catálogo.
 * El sufijo siempre lleva padStart(3, '0'), así el orden lexicográfico === numérico.
 * @param {string} codigo  Código de categoría (p. ej. 'SIL').
 * @returns {Promise<string>}  Referencia completa (p. ej. 'NAV-SIL-007').
 */
const calcularSiguienteReferencia = async (codigo) => {
  const prefijoCodigo = `${PREFIJO}-${codigo}`;

  const { data, error } = await supabase
    .from('muebles')
    .select('referencia')
    .like('referencia', `${prefijoCodigo}-%`)
    .order('referencia', { ascending: false })
    .limit(1);

  if (error) throw new Error(`Error al calcular referencia para ${codigo}: ${error.message}`);

  const ultima = data?.[0]?.referencia;
  const siguiente = ultima
    ? String(Number(ultima.slice(-3)) + 1).padStart(3, '0')
    : '001';

  return `${prefijoCodigo}-${siguiente}`;
};

/**
 * Combina obtenerCodigoCategoria + calcularSiguienteReferencia en un solo paso.
 * Útil cuando solo se necesita la referencia sin acceder al código por separado.
 * @param {number} categoriaId
 * @returns {Promise<string>}
 */
const generarReferencia = async (categoriaId) => {
  const codigo = await obtenerCodigoCategoria(categoriaId);
  return calcularSiguienteReferencia(codigo);
};

module.exports = {
  generarReferencia,
  obtenerCodigoCategoria,
  calcularSiguienteReferencia,
  MAX_REINTENTOS
};
