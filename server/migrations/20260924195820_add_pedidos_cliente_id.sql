ALTER TABLE public.pedidos
  ADD COLUMN cliente_id uuid NULL REFERENCES public.clientes(id) ON DELETE SET NULL;
