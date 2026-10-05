-- La extensión "http" vivía en el esquema public (aviso de seguridad: las extensiones no
-- deberían compartir esquema con las tablas de la app, ya que sus funciones quedan
-- expuestas en el mismo espacio de nombres). No hay ninguna función propia del proyecto
-- que la use (comprobado por su código fuente en pg_proc), así que se puede recrear sin
-- riesgo en el esquema "extensions" ya usado por Supabase para este mismo propósito.
DROP EXTENSION IF EXISTS http;
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;