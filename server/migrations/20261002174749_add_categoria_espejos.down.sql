-- ADVERTENCIA: solo borra la categoría si no tiene ningún mueble. Si ya hay espejos dados de alta,
-- no hace nada: antes hay que moverlos a otra categoría (sus referencias NAV-ESP-NNN se quedan).
DELETE FROM public.categorias c
WHERE c.codigo = 'ESP'
  AND NOT EXISTS (SELECT 1 FROM public.muebles m WHERE m.categoria_id = c.id);