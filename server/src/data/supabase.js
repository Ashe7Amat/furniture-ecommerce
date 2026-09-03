// Forzamos a dotenv a buscar el archivo en la carpeta principal del servidor
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { createClient } = require('@supabase/supabase-js');

// El servidor es un backend de confianza que ya hace su propia comprobación de permisos
// (verificarAdmin / verificarToken) antes de tocar la base de datos, así que usa la
// service_role key: esta clave se salta las políticas de Row Level Security de Supabase,
// que están pensadas para frenar a quien llame directamente desde el navegador con la
// clave pública (anon). Si no hay service_role configurada, caemos a la anon key para
// no romper entornos antiguos, pero eso deja el servidor sujeto a las mismas políticas
// RLS que el público.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

console.log("----------------------------------------");
console.log("🔍 COMPROBANDO VARIABLES DE ENTORNO:");
console.log("URL detectada:", supabaseUrl);
console.log("Clave detectada:", supabaseKey ? (process.env.SUPABASE_SERVICE_ROLE_KEY ? "service_role (oculta)" : "anon (oculta)") : "No detectada");
console.log("----------------------------------------");

if (!supabaseUrl || !supabaseUrl.startsWith('http') || !supabaseKey) {
  console.error("❌ ERROR CRÍTICO: Falta SUPABASE_URL o una clave de Supabase válida. Revisa el archivo .env");
  // Usamos variables de mentira solo para que el servidor no explote y podamos ver el error
  module.exports = createClient('https://error.supabase.co', 'error');
} else {
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });
  module.exports = supabase;
}
