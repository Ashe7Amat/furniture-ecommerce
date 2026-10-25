const express = require('express');
const router = express.Router();
const { generarSitemapXml } = require('../controllers/sitemapController');

// GET /sitemap.xml -- Generación dinámica de sitemap con home, catálogo, categorías y muebles activos
router.get('/', generarSitemapXml);

module.exports = router;
