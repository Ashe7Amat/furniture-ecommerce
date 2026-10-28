/**
 * server/scripts/miniaturasFotosAntiguas.js
 *
 * Pone en el formato de hoy las fotos de muebles subidas antes de las miniaturas (H61): las que no
 * terminan en -full.webp. En el catálogo, cada tarjeta pide la miniatura de 400 px de su foto
 * (client/src/utils/images.js, miniatura), pero estas fotos no tienen: la tarjeta descarga la foto
 * entera (JPG de 250-500 KB o WebP de hasta 490 KB) para pintarla a unos 300 px. A 28 oct 2026 son
 * 50 de las 83 piezas: bajando el catálogo entero se descargan unos 15 MB solo por ellas.
 *
 * Para cada foto antigua de un mueble:
 *   1. la descarga del bucket "imagenes";
 *   2. crea <nombre>-thumb.webp (400 px) y <nombre>-full.webp (1600 px de lado mayor), con los mismos
 *      ajustes que una subida desde el panel (src/utils/upload.js), y los sube (la miniatura primero);
 *   3. cambia la URL en muebles.imagenes por la de <nombre>-full.webp.
 * No borra nada: los archivos antiguos se quedan en el bucket, y el script guarda en un JSON las listas
 * de fotos de antes y de después de cada mueble, para poder volver atrás.
 *
 * Por defecto solo dice lo que haría (no sube ni cambia nada). Para hacerlo:
 *   node scripts/miniaturasFotosAntiguas.js --aplicar
 * Necesita SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (server/.env). Se puede repetir: los nombres nuevos
 * salen del nombre antiguo, y una foto que ya termina en -full.webp no se toca.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { LADO_MAXIMO, CALIDAD_WEBP, ANCHO_MINIATURA } = require('../src/utils/upload');

const BUCKET = 'imagenes';
const SUFIJO_GRANDE = '-full.webp';
const SUFIJO_MINIATURA = '-thumb.webp';

// Ruta dentro del bucket de una URL pública de una foto del bucket, o null si la foto es de otro sitio.
const rutaEnBucket = (url, supabaseUrl) => {
  const prefijo = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${BUCKET}/`;
  if (typeof url !== 'string' || !url.startsWith(prefijo)) return null;
  return decodeURIComponent(url.slice(prefijo.length).split('?')[0]);
};

// Solo las fotos de muebles del bucket que aún no tienen el formato -full.webp + -thumb.webp.
const esAntigua = (ruta) => Boolean(ruta) && ruta.startsWith('muebles/') && !ruta.endsWith(SUFIJO_GRANDE);

const rutasNuevas = (ruta) => {
  const base = ruta.replace(/\.[a-z0-9]+$/i, '');
  return { grande: `${base}${SUFIJO_GRANDE}`, miniatura: `${base}${SUFIJO_MINIATURA}` };
};

// Los mismos pasos que optimizarImagen y la miniatura de uploadToSupabase (src/utils/upload.js).
const generarVersiones = async (buffer) => {
  const grande = await sharp(buffer)
    .rotate()
    .resize({ width: LADO_MAXIMO, height: LADO_MAXIMO, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: CALIDAD_WEBP })
    .toBuffer();
  const miniatura = await sharp(grande)
    .resize({ width: ANCHO_MINIATURA, withoutEnlargement: true })
    .webp({ quality: CALIDAD_WEBP })
    .toBuffer();
  return { grande, miniatura };
};

/**
 * Hace el trabajo sobre un cliente de Supabase (el real o uno de prueba).
 * @returns {Promise<{ muebles: Array, fotos: number, bytesAntes: number, bytesDespues: number, errores: Array }>}
 */
const procesar = async (supabase, { supabaseUrl, aplicar = false, log = () => {} }) => {
  const { data: muebles, error } = await supabase.from('muebles').select('id, referencia, imagenes');
  if (error) throw new Error(`No se pudieron leer los muebles: ${error.message}`);

  const hechas = new Map(); // ruta antigua -> URL nueva (una foto puede estar en más de un mueble)
  const cambios = [];
  const errores = [];
  let fotos = 0;
  let bytesAntes = 0;
  let bytesDespues = 0;

  for (const mueble of muebles || []) {
    const antes = Array.isArray(mueble.imagenes) ? mueble.imagenes : [];
    const despues = [];
    let fallo = false;

    for (const url of antes) {
      const ruta = rutaEnBucket(url, supabaseUrl);
      if (!esAntigua(ruta)) {
        despues.push(url);
        continue;
      }
      if (hechas.has(ruta)) {
        despues.push(hechas.get(ruta));
        continue;
      }
      const { grande, miniatura } = rutasNuevas(ruta);
      const urlNueva = supabase.storage.from(BUCKET).getPublicUrl(grande).data.publicUrl;
      fotos++;

      if (aplicar) {
        try {
          const { data: blob, error: errDescarga } = await supabase.storage.from(BUCKET).download(ruta);
          if (errDescarga || !blob) throw new Error(errDescarga?.message || 'descarga vacía');
          const original = Buffer.from(await blob.arrayBuffer());
          const versiones = await generarVersiones(original);
          for (const [destino, buffer] of [[miniatura, versiones.miniatura], [grande, versiones.grande]]) {
            const { error: errSubida } = await supabase.storage
              .from(BUCKET)
              .upload(destino, buffer, { contentType: 'image/webp', upsert: true });
            if (errSubida) throw new Error(`no se pudo subir ${destino}: ${errSubida.message}`);
          }
          bytesAntes += original.length;
          bytesDespues += versiones.grande.length;
          log(`  ${ruta}: ${Math.round(original.length / 1024)} KB -> ${Math.round(versiones.grande.length / 1024)} KB + miniatura ${Math.round(versiones.miniatura.length / 1024)} KB`);
        } catch (e) {
          errores.push({ id: mueble.id, referencia: mueble.referencia, ruta, error: e.message });
          log(`  ERROR ${ruta}: ${e.message}`);
          fallo = true;
          despues.push(url);
          continue;
        }
      }
      hechas.set(ruta, urlNueva);
      despues.push(urlNueva);
    }

    const cambia = despues.some((u, i) => u !== antes[i]);
    if (!cambia) continue;
    cambios.push({ id: mueble.id, referencia: mueble.referencia, antes, despues, parcial: fallo });

    if (aplicar) {
      const { error: errUpdate } = await supabase.from('muebles').update({ imagenes: despues }).eq('id', mueble.id);
      if (errUpdate) {
        errores.push({ id: mueble.id, referencia: mueble.referencia, error: `no se pudo guardar: ${errUpdate.message}` });
        cambios[cambios.length - 1].guardado = false;
      } else {
        cambios[cambios.length - 1].guardado = true;
      }
    }
  }

  return { muebles: cambios, fotos, bytesAntes, bytesDespues, errores };
};

const main = async () => {
  const aplicar = process.argv.includes('--aplicar');
  const supabase = require('../src/data/supabase');
  console.log(aplicar ? 'Aplicando (sube fotos y cambia muebles.imagenes)...' : 'Simulación: no se sube ni se cambia nada (añade --aplicar para hacerlo).');

  const resultado = await procesar(supabase, { supabaseUrl: process.env.SUPABASE_URL, aplicar, log: console.log });
  const archivo = path.resolve(__dirname, `miniaturas-${aplicar ? 'aplicado' : 'simulacion'}-${Date.now()}.json`);
  fs.writeFileSync(archivo, JSON.stringify(resultado, null, 2));

  console.log(`Muebles con fotos antiguas: ${resultado.muebles.length}. Fotos: ${resultado.fotos}.`);
  if (aplicar) {
    console.log(`Peso de las fotos grandes: ${(resultado.bytesAntes / 1048576).toFixed(1)} MB -> ${(resultado.bytesDespues / 1048576).toFixed(1)} MB.`);
  }
  console.log(`Errores: ${resultado.errores.length}. Detalle (antes y después de cada mueble) en ${archivo}`);
  if (resultado.errores.length) process.exitCode = 1;
};

if (require.main === module) {
  main().catch((err) => {
    console.error('Error:', err.message);
    process.exitCode = 1;
  });
}

module.exports = { procesar, rutaEnBucket, esAntigua, rutasNuevas, generarVersiones };
