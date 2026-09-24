UPDATE public.muebles m SET categoria_id = c.id FROM public.categorias c WHERE c.nombre = m.categoria AND m.categoria_id IS NULL;
