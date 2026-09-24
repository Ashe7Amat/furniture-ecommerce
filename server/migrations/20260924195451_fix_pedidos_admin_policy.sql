ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
DROP POLICY "Admins pueden ver todos los pedidos" ON public.pedidos;
