-- ROLLBACK DE EMERGENCIA, NO RECOMENDADO: restaura el comportamiento anterior, que era INSEGURO.
-- Esta política dejaba leer todos los pedidos (nombre, email, teléfono, dirección) a cualquiera
-- con la clave pública (anon) de Supabase, a través de su API REST (H9). El servidor no la
-- necesita: usa service_role, que se salta RLS. Solo tiene sentido si algo dependiera de leer
-- pedidos con la clave anon, y hoy nada lo hace.
CREATE POLICY "Admins pueden ver todos los pedidos" ON public.pedidos FOR SELECT TO public USING (true);
