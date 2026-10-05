-- Limpieza de la base de datos según auditoría técnica (sep 2026).
--
-- pedidos.user_id / pedidos.mueble_id son columnas "fantasma": vestigios de un diseño
-- anterior basado en Supabase Auth que el proyecto ya no usa (ahora usa JWT propio +
-- tabla clientes, y las líneas de cada pedido viven en la columna items jsonb). Se
-- comprobó antes de este cambio que las 2 filas existentes en pedidos tienen ambas
-- columnas en null, así que no hay datos que perder.
--
-- Dos políticas RLS dependían de user_id (comparaban auth.uid() = user_id, que nunca
-- puede coincidir porque el servidor no usa sesiones de Supabase Auth: usa la
-- service_role key, que se salta RLS). Hay que borrarlas antes de poder borrar la
-- columna.
DROP POLICY IF EXISTS "Usuarios pueden ver sus propios pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Usuarios pueden crear sus propios pedidos" ON public.pedidos;

ALTER TABLE public.pedidos DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.pedidos DROP COLUMN IF EXISTS mueble_id;
-- (Al borrar las columnas se borran también sus FKs sin índice: pedidos_user_id_fkey y
-- pedidos_mueble_id_fkey, resolviendo esos dos avisos de rendimiento del linter.)

-- Índice que faltaba en la FK de categorías (categoria_padre_id -> categorias.id), usada
-- en cada carga del catálogo para agrupar categorías generales/específicas.
CREATE INDEX IF NOT EXISTS idx_categorias_categoria_padre_id
  ON public.categorias (categoria_padre_id);