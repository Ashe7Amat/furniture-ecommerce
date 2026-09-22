ALTER TABLE public.muebles
  ADD COLUMN categoria_id integer NULL REFERENCES public.categorias(id) ON DELETE SET NULL;
