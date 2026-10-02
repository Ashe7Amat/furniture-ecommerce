INSERT INTO public.categorias (nombre, codigo, categoria_padre_id)
SELECT 'Espejos', 'ESP', 18
WHERE NOT EXISTS (SELECT 1 FROM public.categorias WHERE codigo = 'ESP');