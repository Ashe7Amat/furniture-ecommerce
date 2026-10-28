const express = require('express');
const router = express.Router();
const { obtenerSitemap } = require('../controllers/sitemapController');

// GET /sitemap.xml -- Generación dinámica de sitemap con home, catálogo, categorías y todas las fichas
router.get('/', obtenerSitemap);

module.exports = router;
