// Forzamos a dotenv a buscar el archivo en la carpeta principal del servidor
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { createClient } = require('@supabase/supabase-js');

// El servidor es un backend de confianza que ya hace su propia comprobación de permisos
// (verificarAdmin / verificarToken) antes de tocar la base de datos, así que necesita la clave
// "service_role": esta clave se salta las políticas de Row Level Security de Supabase, que están
// pensadas para frenar a quien llame directamente desde el navegador con la clave pública
// ("anon"). Ya NO hay respaldo a la clave "anon": dejar que el servidor arrancara con ella (como
// hacía antes si faltaba la service_role) lo sujetaba en silencio a esas mismas políticas RLS
// pensadas para el navegador, sin que nadie se diera cuenta hasta que algo fallara de forma rara
// en producción. Mejor fallar aquí mismo, al cargar el módulo, con un mensaje que diga
// exactamente qué falta.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
  throw new Error(
    'Falta SUPABASE_URL (o no es una URL http/https válida) en las variables de entorno del ' +
    'servidor. Revisa server/.env en local, o las variables de entorno del proyecto en Vercel.'
  );
}
if (!supabaseKey) {
  throw new Error(
    'Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno del servidor. Cópiala desde ' +
    'Supabase (Project Settings > API Keys > service_role) -- la clave "anon" ya no sirve como ' +
    'respaldo aquí, porque deja al servidor sujeto a las políticas de Row Level Security ' +
    'pensadas para el navegador. Revisa server/.env en local, o las variables de entorno del ' +
    'proyecto en Vercel.'
  );
}

// Solo se registra en desarrollo local -- en producción (Vercel) este log se repetiría en cada
// arranque en frío y no aporta nada si todo está bien configurado.
if (process.env.NODE_ENV !== 'production') {
  console.log(`[Supabase] URL: ${supabaseUrl} · Clave: service_role`);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

module.exports = supabase;
