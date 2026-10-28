const supabase = require('../data/supabase');

// Sitemap de la web pública (GET /sitemap.xml; la web lo sirve en su dominio con un rewrite en
// client/vercel.json). Las páginas fijas, una página por categoría con piezas y una por ficha,
// sacadas de la base de datos en cada petición. Solo lee id y categoría: ni precios ni nada que
// no se vea ya en el catálogo público.
// SEO del catálogo (28 oct 2026): la versión anterior pedía `updated_at`, que `muebles` no tiene;
// la consulta fallaba en silencio y el sitemap salía sin ninguna ficha. Además sacaba todas las
// categorías de la tabla, también las que no tienen piezas.
const WEB_PUBLICA = 'https://www.nave5barcelona.com';

const PAGINAS_FIJAS = [
  { ruta: '/', prioridad: '1.0' },
  { ruta: '/catalogo', prioridad: '0.9' },
  { ruta: '/sobre-nosotros', prioridad: '0.5' },
  { ruta: '/sostenibilidad', prioridad: '0.5' },
  { ruta: '/contacto', prioridad: '0.5' },
  { ruta: '/legal', prioridad: '0.3' },
  { ruta: '/privacidad', prioridad: '0.3' },
  { ruta: '/terminos', prioridad: '0.3' }
];

const escaparXml = (texto) =>
  String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const entrada = ({ ruta, prioridad }) =>
  `  <url><loc>${escaparXml(`${WEB_PUBLICA}${ruta}`)}</loc><priority>${prioridad}</priority></url>`;

const generarSitemap = (muebles) => {
  const categorias = [...new Set(muebles.map((m) => m.categoria).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'es')
  );
  const entradas = [
    ...PAGINAS_FIJAS,
    ...categorias.map((categoria) => ({
      ruta: `/catalogo?categoria=${encodeURIComponent(categoria)}`,
      prioridad: '0.7'
    })),
    ...muebles.map((m) => ({ ruta: `/mueble/${encodeURIComponent(m.id)}`, prioridad: '0.8' }))
  ];
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entradas.map(entrada),
    '</urlset>',
    ''
  ].join('\n');
};

// GET /sitemap.xml. Si la base de datos falla, se sirven al menos las páginas fijas con un
// 200: un sitemap a medias es mejor para Google que un error, y se vuelve a pedir pronto (sin la
// caché larga de la respuesta buena).
const obtenerSitemap = async (req, res) => {
  let muebles = [];
  let completo = true;
  try {
    const { data, error } = await supabase
      .from('muebles')
      .select('id, categoria')
      .order('created_at', { ascending: false });
    if (error) throw error;
    muebles = data || [];
  } catch (error) {
    console.error('Error al generar el sitemap:', error.message);
    completo = false;
  }

  res.set('Content-Type', 'application/xml; charset=utf-8');
  res.set(
    'Cache-Control',
    completo
      ? 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400'
      : 'public, max-age=300'
  );
  res.status(200).send(generarSitemap(muebles));
};

module.exports = { obtenerSitemap, generarSitemap, WEB_PUBLICA };
