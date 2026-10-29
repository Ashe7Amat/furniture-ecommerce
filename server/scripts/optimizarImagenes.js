/**
 * server/scripts/optimizarImagenes.js
 *
 * Script de optimización de imágenes para catálogo y fichas de producto.
 * Convierte imágenes JPEG/PNG a formato WebP moderno (calidad 82) en 3 tamaños responsivos:
 *   - 400w  (miniatura para tarjetas del catálogo / listados)
 *   - 800w  (vista de ficha de producto en móvil / tablet)
 *   - 1200w (pantallas de alta resolución / zoom de detalle)
 *
 * Modo de ejecución:
 *   1. Remoto (Supabase Storage): Si hay credenciales activas en .env, lee el bucket "imagenes"
 *      y sube las variantes optimizadas con formato `<base>-<ancho>.webp`.
 *   2. Local / Fixtures: Si no hay acceso a Supabase o se pasa el flag `--local`,
 *      procesa las imágenes en `server/scripts/__fixtures__/input/` y guarda en `.../output/`.
 *
 * Idempotencia: Si la variante WebP ya existe, se omite para evitar re-procesamiento innecesario.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const CALIDAD_WEBP = 82;
const TAMANOS = [
  { sufijo: '-400.webp', ancho: 400 },
  { sufijo: '-800.webp', ancho: 800 },
  { sufijo: '-1200.webp', ancho: 1200 }
];

/**
 * Procesa un buffer de imagen y genera las 3 variantes WebP.
 * @param {Buffer} bufferOrigen
 * @param {string} nombreBase
 * @returns {Promise<Array<{ sufijo: string, buffer: Buffer, ancho: number, peso: number }>>}
 */
const generarVariantesWebp = async (bufferOrigen, nombreBase) => {
  const metadata = await sharp(bufferOrigen).metadata();
  const anchoOriginal = metadata.width || 1600;

  const resultados = [];
  for (const { sufijo, ancho } of TAMANOS) {
    // Si la imagen original es más pequeña que el tamaño objetivo, no agrandar
    const anchoFinal = Math.min(ancho, anchoOriginal);
    const bufferWebp = await sharp(bufferOrigen)
      .resize({
        width: anchoFinal,
        withoutEnlargement: true,
        fit: 'inside'
      })
      .webp({ quality: CALIDAD_WEBP })
      .toBuffer();

    resultados.push({
      sufijo,
      nombreArchivo: `${nombreBase}${sufijo}`,
      buffer: bufferWebp,
      ancho: anchoFinal,
      peso: bufferWebp.length
    });
  }

  return resultados;
};

/**
 * Procesa imágenes en un directorio local de backup o fixtures.
 * @param {string} inputDir
 * @param {string} outputDir
 */
const optimizarDirectorioLocal = async (inputDir, outputDir) => {
  if (!fs.existsSync(inputDir)) {
    fs.mkdirSync(inputDir, { recursive: true });
  }
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const archivos = fs.readdirSync(inputDir).filter((f) => /\.(jpe?g|png)$/i.test(f));
  if (archivos.length === 0) {
    return {
      procesados: 0,
      omitidos: 0,
      bytesOriginales: 0,
      bytesNuevos: 0,
      ahorroBytes: 0,
      ahorroPorcentaje: 0
    };
  }

  let totalOriginal = 0;
  let totalOptimizado = 0;
  let procesados = 0;
  let omitidos = 0;

  for (const archivo of archivos) {
    const rutaEntrada = path.join(inputDir, archivo);
    const base = archivo.replace(/\.(jpe?g|png)$/i, '');
    const statOriginal = fs.statSync(rutaEntrada);

    // Verificar si ya existen los 3 tamaños (idempotencia)
    const existenTodos = TAMANOS.every((t) =>
      fs.existsSync(path.join(outputDir, `${base}${t.sufijo}`))
    );
    if (existenTodos) {
      omitidos++;
      continue;
    }

    const bufferOrigen = fs.readFileSync(rutaEntrada);
    const variantes = await generarVariantesWebp(bufferOrigen, base);

    let pesoVariantes = 0;
    for (const v of variantes) {
      const rutaSalida = path.join(outputDir, v.nombreArchivo);
      fs.writeFileSync(rutaSalida, v.buffer);
      pesoVariantes += v.peso;
    }

    totalOriginal += statOriginal.size;
    totalOptimizado += pesoVariantes;
    procesados++;
  }

  const ahorroBytes = Math.max(0, totalOriginal - totalOptimizado);
  const ahorroPorcentaje = totalOriginal > 0 ? ((ahorroBytes / totalOriginal) * 100).toFixed(1) : 0;

  return {
    procesados,
    omitidos,
    bytesOriginales: totalOriginal,
    bytesNuevos: totalOptimizado,
    ahorroBytes,
    ahorroPorcentaje: Number(ahorroPorcentaje)
  };
};

/**
 * Procesa imágenes directamente en el bucket de Supabase Storage.
 * @param {object} supabaseClient
 * @param {string} bucketName
 * @param {string} carpeta Prefijo dentro del bucket ('muebles' o 'uploads')
 */
const optimizarBucketSupabase = async (
  supabaseClient,
  bucketName = 'imagenes',
  carpeta = 'muebles'
) => {
  const { data: archivos, error } = await supabaseClient.storage.from(bucketName).list(carpeta, {
    limit: 500,
    sortBy: { column: 'name', order: 'asc' }
  });

  if (error) {
    throw new Error(
      `Error al listar archivos de Supabase Storage en ${bucketName}/${carpeta}: ${error.message}`
    );
  }

  const imagenes = (archivos || []).filter((f) => /\.(jpe?g|png)$/i.test(f.name));
  let procesados = 0;
  let omitidos = 0;
  let totalOriginal = 0;
  let totalOptimizado = 0;

  for (const img of imagenes) {
    const base = img.name.replace(/\.(jpe?g|png)$/i, '');

    // Comprobar idempotencia: si ya existe el -800.webp, consideramos procesada
    const { data: yaExiste } = await supabaseClient.storage.from(bucketName).list(carpeta, {
      search: `${base}-800.webp`
    });

    if (yaExiste && yaExiste.length > 0) {
      omitidos++;
      continue;
    }

    // Descargar imagen original
    const rutaOrigen = carpeta ? `${carpeta}/${img.name}` : img.name;
    const { data: blob, error: errDescarga } = await supabaseClient.storage
      .from(bucketName)
      .download(rutaOrigen);

    if (errDescarga || !blob) {
      console.warn(`No se pudo descargar ${rutaOrigen}:`, errDescarga?.message);
      continue;
    }

    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const variantes = await generarVariantesWebp(buffer, base);

    let pesoVariantes = 0;
    for (const v of variantes) {
      const rutaDestino = carpeta ? `${carpeta}/${v.nombreArchivo}` : v.nombreArchivo;
      const { error: errSubida } = await supabaseClient.storage
        .from(bucketName)
        .upload(rutaDestino, v.buffer, {
          contentType: 'image/webp',
          upsert: true
        });

      if (!errSubida) {
        pesoVariantes += v.peso;
      }
    }

    totalOriginal += buffer.length;
    totalOptimizado += pesoVariantes;
    procesados++;
  }

  const ahorroBytes = Math.max(0, totalOriginal - totalOptimizado);
  const ahorroPorcentaje = totalOriginal > 0 ? ((ahorroBytes / totalOriginal) * 100).toFixed(1) : 0;

  return {
    procesados,
    omitidos,
    bytesOriginales: totalOriginal,
    bytesNuevos: totalOptimizado,
    ahorroBytes,
    ahorroPorcentaje: Number(ahorroPorcentaje)
  };
};

/**
 * Función principal autoejecutable.
 */
const main = async () => {
  const usarLocal = process.argv.includes('--local');
  const inputDir = path.resolve(__dirname, '__fixtures__/input');
  const outputDir = path.resolve(__dirname, '__fixtures__/output');

  console.log('--- Iniciando Optimización de Imágenes WebP (400w, 800w, 1200w) ---');

  let resultado;
  let modo = 'local';

  if (!usarLocal && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const supabase = require('../src/data/supabase');
      console.log('Conectando con Supabase Storage (bucket "imagenes")...');
      resultado = await optimizarBucketSupabase(supabase, 'imagenes');
      modo = 'Supabase Storage';
    } catch (err) {
      console.warn(
        `Aviso de conexión con Supabase: ${err.message}. Pasando a procesamiento local...`
      );
      resultado = await optimizarDirectorioLocal(inputDir, outputDir);
    }
  } else {
    console.log(`Ejecutando en modo local sobre ${inputDir}...`);
    resultado = await optimizarDirectorioLocal(inputDir, outputDir);
  }

  console.log('====================================================');
  console.log(`Resultados de Optimización (${modo}):`);
  console.log(`  - Imágenes procesadas: ${resultado.procesados}`);
  console.log(`  - Imágenes omitidas (ya existían): ${resultado.omitidos}`);
  console.log(`  - Peso original: ${(resultado.bytesOriginales / 1024).toFixed(1)} KiB`);
  console.log(`  - Peso optimizado WebP: ${(resultado.bytesNuevos / 1024).toFixed(1)} KiB`);
  console.log(
    `  - Ahorro de espacio: ${(resultado.ahorroBytes / 1024).toFixed(1)} KiB (${resultado.ahorroPorcentaje}%)`
  );
  console.log('====================================================');

  return resultado;
};

if (require.main === module) {
  main().catch((err) => {
    console.error('Error fatal durante la optimización de imágenes:', err);
    process.exitCode = 1;
  });
}

module.exports = {
  generarVariantesWebp,
  optimizarDirectorioLocal,
  optimizarBucketSupabase,
  main,
  TAMANOS,
  CALIDAD_WEBP
};
