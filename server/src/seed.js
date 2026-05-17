require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Conexión a tu Supabase usando las variables de tu .env
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const productosDeEjemplo = [
    {
        nombre: "Sofá Modular 'Lumina'",
        categoria: "Sofás",
        descripcion: "Sofá de tres plazas con tapizado en lino natural antimanchas. Estructura de madera maciza de fresno y cojines de alta densidad. Diseño escandinavo puro.",
        precio_venta: 1250.00,
        precio_alquiler_dia: 45.00,
        disponible: true,
        estado: "disponible",
        imagenes: ["https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?q=80&w=1000&auto=format&fit=crop"]
    },
    {
        nombre: "Butaca de Exterior 'Teca'",
        categoria: "Exterior",
        descripcion: "Butaca fabricada en madera de teca maciza resistente a la intemperie. Respaldo trenzado a mano y cojín repelente al agua.",
        precio_venta: 340.00,
        precio_alquiler_dia: 15.00,
        disponible: true,
        estado: "disponible",
        imagenes: ["https://images.unsplash.com/photo-1592078615290-033ee584e267?q=80&w=1000&auto=format&fit=crop"]
    },
    {
        nombre: "Mesa de Centro 'Monolith'",
        categoria: "Mesas",
        descripcion: "Mesa auxiliar esculpida en bloque de microcemento pulido. Acabado poroso natural que aporta textura a cualquier salón minimalista.",
        precio_venta: 289.00,
        precio_alquiler_dia: 12.00,
        disponible: true,
        estado: "disponible",
        imagenes: ["https://images.unsplash.com/photo-1533090481720-856c6e3c1fdc?q=80&w=1000&auto=format&fit=crop"]
    },
    {
        nombre: "Silla de Comedor 'Nordic'",
        categoria: "Sillas",
        descripcion: "Estructura de madera de roble tintado en negro con asiento de cuerda de papel kraft trenzada. Un clásico del diseño danés.",
        precio_venta: 175.00,
        precio_alquiler_dia: 8.00,
        disponible: true,
        estado: "disponible",
        imagenes: ["https://images.unsplash.com/photo-1506898667547-42e22a46e125?q=80&w=1000&auto=format&fit=crop"]
    },
    {
        nombre: "Lámpara de Pie 'Arco'",
        categoria: "Iluminación",
        descripcion: "Lámpara de pie con base de mármol blanco y estructura de acero inoxidable cepillado. Iluminación cálida e indirecta.",
        precio_venta: 450.00,
        precio_alquiler_dia: 20.00,
        disponible: true,
        estado: "disponible",
        imagenes: ["https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?q=80&w=1000&auto=format&fit=crop"]
    },
    {
        nombre: "Cama Matrimonio 'Ashe'",
        categoria: "Camas",
        descripcion: "Estructura de cama tapizada en algodón orgánico con cabecero mullido integrado. Somier de lamas de madera de pino incluido.",
        precio_venta: 890.00,
        precio_alquiler_dia: 35.00,
        disponible: true,
        estado: "disponible",
        imagenes: ["https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?q=80&w=1000&auto=format&fit=crop"]
    }
];

async function sembrarBaseDeDatos() {
    console.log("🌱 Iniciando la plantación de productos premium...");

    const { data, error } = await supabase
        .from('muebles')
        .insert(productosDeEjemplo)
        .select();

    if (error) {
        console.error("❌ Error al inyectar los productos:", error.message);
    } else {
        console.log(`✅ ¡Éxito! Se han añadido ${data.length} productos de alta gama al catálogo.`);
    }
}

sembrarBaseDeDatos();