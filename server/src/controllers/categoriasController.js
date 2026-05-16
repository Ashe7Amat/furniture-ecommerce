const supabase = require('../data/supabase');

// 1. Obtener todas las categorías con sus estadísticas de inventario completas
const obtenerCategorias = async (req, res) => {
    try {
        // Traemos las categorías ordenadas
        const { data: categorias, error: errCat } = await supabase
            .from('categorias')
            .select('*')
            .order('nombre', { ascending: true });

        if (errCat) throw errCat;

        // Traemos todos los muebles para cruzarlos en memoria de forma segura
        const { data: muebles, error: errMue } = await supabase
            .from('muebles')
            .select('*');

        if (errMue) throw errMue;

        // Calculamos los KPIs para cada categoría
        const categoriasConStats = categorias.map(cat => {
            const mueblesDeCat = muebles.filter(m => m.categoria === cat.nombre);

            const totalProductos = mueblesDeCat.length;
            const disponibles = mueblesDeCat.filter(m => m.estado === 'disponible').length;
            const vendidos = mueblesDeCat.filter(m => m.estado === 'vendido').length;
            const alquilados = mueblesDeCat.filter(m => m.estado === 'alquilado').length;

            // Valor económico total de la categoría en el catálogo
            const valorTotalVenta = mueblesDeCat.reduce((sum, m) => sum + (m.precio_venta || 0), 0);

            return {
                ...cat,
                stats: {
                    totalProductos,
                    disponibles,
                    vendidos,
                    alquilados,
                    valorTotalVenta: valorTotalVenta.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
                }
            };
        });

        res.status(200).json(categoriasConStats);
    } catch (error) {
        console.error('Error al calcular estadísticas de categorías:', error.message);
        res.status(500).json({ error: 'Error al obtener las categorías con analíticas.' });
    }
};

// 2. Crear una nueva categoría
const crearCategoria = async (req, res) => {
    try {
        const { nombre, imagen_url } = req.body;
        const { data, error } = await supabase
            .from('categorias')
            .insert([{ nombre, imagen_url: imagen_url || 'https://images.unsplash.com/photo-1540518614846-7eded433c457?q=80&w=200' }])
            .select();

        if (error) throw error;
        res.status(201).json({ success: true, data });
    } catch (error) {
        res.status(500).json({ error: 'Error al crear la categoría.' });
    }
};

// 3. Eliminar una categoría
const eliminarCategoria = async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase.from('categorias').delete().eq('id', id);
        if (error) throw error;
        res.status(200).json({ success: true, message: 'Categoría eliminada.' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar la categoría.' });
    }
};

module.exports = {
    obtenerCategorias,
    crearCategoria,
    eliminarCategoria
};