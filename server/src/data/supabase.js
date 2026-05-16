// 1. Forzamos a dotenv a buscar el archivo en la carpeta principal del servidor
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { createClient } = require('@supabase/supabase-js');

// 2. Ponemos los chivatos para ver qué lee Node.js
console.log("----------------------------------------");
console.log("🔍 COMPROBANDO VARIABLES DE ENTORNO:");
console.log("URL detectada:", process.env.SUPABASE_URL);
console.log("Clave detectada:", process.env.SUPABASE_ANON_KEY ? "Sí (oculta por seguridad)" : "No detectada");
console.log("----------------------------------------");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

// 3. Evitamos que la app "crashee" si falla, dándonos un mensaje claro
if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
  console.error("❌ ERROR CRÍTICO: La URL está vacía o no es válida. Revisa el archivo .env");
  // Usamos variables de mentira solo para que el servidor no explote y podamos ver el error
  module.exports = createClient('https://error.supabase.co', 'error');
} else {
  const supabase = createClient(supabaseUrl, supabaseKey);
  module.exports = supabase;
}