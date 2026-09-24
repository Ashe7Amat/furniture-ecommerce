-- ⚠️ ROLLBACK DE EMERGENCIA ÚNICAMENTE
-- Restaura la política que permitía a cualquiera con la clave pública leer TODOS los pedidos
-- (nombres, emails, teléfonos, direcciones). Solo para usar si el fix de H9 rompe algo crítico
-- y hay que volver al estado anterior mientras se investiga. Documentar en mejoras-tecnicas.md
-- por qué se ejecutó, si se ejecuta.
--
-- El servidor no la necesita: usa service_role, que se salta RLS (comprobado el 24 sep 2026: el
-- panel sigue listando los pedidos con H9 aplicado). Solo tendría sentido si algo dependiera de
-- leer pedidos con la clave anon, y hoy nada lo hace.
CREATE POLICY "Admins pueden ver todos los pedidos" ON public.pedidos FOR SELECT TO public USING (true);
