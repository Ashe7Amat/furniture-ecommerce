const supabase = require('../data/supabase');

const BASE_URL = 'https://www.nave5barcelona.com';

const escaparXml = (cadena = '') =>
  String(cadena)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const fechaIso = (fecha) => {
  try {
    return new Date(fecha).toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
};

const generarSitemapXml = async (req, res) => {
  try {
    const hoy = new Date().toISOString().split('T')[0];

    // Consultamos categorías y muebles activos en paralelo
    const [categoriasResult, mueblesResult] = await Promise.all([
      supabase.from('categorias').select('nombre').order('nombre', { ascending: true }),
      supabase.from('muebles').select('id, updated_at, created_at, estado').eq('estado', 'disponible')
    ]);

    const categorias = categoriasResult.data || [];
    const muebles = mueblesResult.data || [];

    const urls = [
      // 1. Home
      {
        loc: `${BASE_URL}/`,
        lastmod: hoy,
        changefreq: 'daily',
        priority: '1.0'
      },
      // 2. Catálogo
      {
        loc: `${BASE_URL}/catalogo`,
        lastmod: hoy,
        changefreq: 'daily',
        priority: '0.9'
      }
    ];

    // 3. Categorías activas
    for (const cat of categorias) {
      urls.push({
        loc: `${BASE_URL}/catalogo?categoria=${encodeURIComponent(cat.nombre)}`,
        lastmod: hoy,
        changefreq: 'weekly',
        priority: '0.8'
      });
    }

    // 4. Fichas de muebles activos
    for (const m of muebles) {
      urls.push({
        loc: `${BASE_URL}/mueble/${m.id}`,
        lastmod: fechaIso(m.updated_at || m.created_at || hoy),
        changefreq: 'weekly',
        priority: '0.7'
      });
    }

    // 5. Páginas institucionales estáticas
    const paginasEstaticas = [
      { ruta: '/sobre-nosotros', priority: '0.5' },
      { ruta: '/sostenibilidad', priority: '0.5' },
      { ruta: '/contacto', priority: '0.5' },
      { ruta: '/legal', priority: '0.3' },
      { ruta: '/privacidad', priority: '0.3' },
      { ruta: '/terminos', priority: '0.3' }
    ];

    for (const p of paginasEstaticas) {
      urls.push({
        loc: `${BASE_URL}${p.ruta}`,
        lastmod: hoy,
        changefreq: 'monthly',
        priority: p.priority
      });
    }

    const xmlItems = urls
      .map(
        (u) => `  <url>
    <loc>${escaparXml(u.loc)}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
      )
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlItems}
</urlset>`.trim();

    res.header('Content-Type', 'application/xml; charset=utf-8');
    res.header('Cache-Control', 'public, max-age=3600, s-maxage=14400');
    return res.status(200).send(xml);
  } catch (error) {
    console.error('Error al generar sitemap.xml:', error.message);
    return res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><error>Error al generar sitemap</error>');
  }
};

module.exports = {
  generarSitemapXml,
  escaparXml,
  BASE_URL
};
