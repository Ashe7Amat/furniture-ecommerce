-- Activa RLS en las tablas que estaban totalmente abiertas a la clave anon (pública).
-- El servidor Express ahora usa la clave service_role, que se salta RLS por completo,
-- así que estas políticas solo afectan a quien llame directamente con la clave anon
-- (por ejemplo, desde el navegador o herramientas externas).

ALTER TABLE public.muebles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- muebles y categorias: el catálogo es información pública, cualquiera puede LEERLO.
-- No se crea ninguna política de INSERT/UPDATE/DELETE para "anon", así que esas
-- operaciones quedan denegadas por defecto para cualquiera que no sea el servidor.
CREATE POLICY "Catálogo de muebles visible públicamente"
  ON public.muebles FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Categorías visibles públicamente"
  ON public.categorias FOR SELECT
  TO anon, authenticated
  USING (true);

-- clientes: contiene emails y contraseñas cifradas. No se crea NINGUNA política para
-- "anon"/"authenticated" (ni de lectura ni de escritura) -- solo el servidor
-- (service_role) puede tocar esta tabla.
