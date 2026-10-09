// Genera el logo de la cabecera de los correos (PNG, fondo transparente, en blanco roto) a partir del
// SVG de client/src/components/Logo.jsx, y opcionalmente lo sube a Supabase Storage.
//
// USO (desde server/):
//   node scripts/logo-email.js <carpeta-de-salida>           -> solo genera los dos PNG
//   node scripts/logo-email.js <carpeta-de-salida> --subir   -> además los sube a imagenes/marca/
//
// Salen dos archivos: logo-nave5.png (240 px de ancho) y logo-nave5@2x.png (480 px), para pintarlo
// a 120 px en el correo (ver cabeceraEmail en src/utils/email.js). Al subir, si
// ya existen en el bucket, los sustituye (upsert): así se actualizan los PNG al cambiar el logo, y
// solo toca esos dos archivos. Supabase los sirve con Cache-Control de 1 hora, así que los correos pueden
// seguir enseñando el logo anterior hasta que caduque la caché. El script no borra ningún archivo.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const LOGO_JSX = path.resolve(__dirname, '../../client/src/components/Logo.jsx');
const COLOR = '#F5F2EC'; // blanco roto, el claro de la web (client/src/styles/index.css)
const ANCHOS = { 'logo-nave5.png': 240, 'logo-nave5@2x.png': 480 };
const BUCKET = 'imagenes';
const CARPETA = 'marca';

// Pasa el SVG del componente de React a un SVG suelto: los atributos de JSX a los de SVG y
// currentColor al color fijo (en el correo no hay tema claro u oscuro que seguir).
const svgDelLogo = (ancho) => {
  const jsx = fs.readFileSync(LOGO_JSX, 'utf8');
  const viewBox = /viewBox="([^"]+)"/.exec(jsx)?.[1];
  const caminos = jsx.match(/<path\b[^>]*\/>/g);
  if (!viewBox || !caminos) throw new Error(`No se encuentra el SVG en ${LOGO_JSX}`);
  const [, , anchoCaja, altoCaja] = viewBox.split(/\s+/).map(Number);
  const alto = Math.round((ancho * altoCaja) / anchoCaja);
  const cuerpo = caminos
    .join('\n')
    .replace(/fillRule=/g, 'fill-rule=')
    .replace(/strokeWidth=/g, 'stroke-width=')
    .replace(/currentColor/g, COLOR);
  return {
    alto,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="${viewBox}" fill="${COLOR}">\n${cuerpo}\n</svg>`
  };
};

const generar = async (salida) => {
  fs.mkdirSync(salida, { recursive: true });
  const archivos = [];
  for (const [nombre, ancho] of Object.entries(ANCHOS)) {
    const { svg, alto } = svgDelLogo(ancho);
    const destino = path.join(salida, nombre);
    await sharp(Buffer.from(svg)).png().toFile(destino);
    const meta = await sharp(destino).metadata();
    console.log(
      `${nombre}: ${meta.width}x${meta.height} (esperado ${ancho}x${alto}), alfa: ${meta.hasAlpha}`
    );
    archivos.push({ nombre, destino });
  }
  return archivos;
};

const subir = async (archivos) => {
  const supabase = require('../src/data/supabase');
  for (const { nombre, destino } of archivos) {
    const ruta = `${CARPETA}/${nombre}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(ruta, fs.readFileSync(destino), { contentType: 'image/png', upsert: true });
    if (error) throw new Error(`No se pudo subir ${ruta}: ${error.message}`);
    console.log(`Subido: ${supabase.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl}`);
  }
};

const main = async () => {
  const [salida, opcion] = process.argv.slice(2);
  if (!salida) throw new Error('Uso: node scripts/logo-email.js <carpeta-de-salida> [--subir]');
  const archivos = await generar(path.resolve(salida));
  if (opcion === '--subir') await subir(archivos);
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
