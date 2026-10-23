CREATE TABLE public.ajustes_home (
  id int PRIMARY KEY CHECK (id = 1),
  hero_imagenes jsonb NOT NULL DEFAULT '[]'::jsonb,
  productos_destacados jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.ajustes_home ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ajustes_home_lectura_publica"
  ON public.ajustes_home
  FOR SELECT
  TO anon, authenticated
  USING (true);

INSERT INTO public.ajustes_home (id, hero_imagenes, productos_destacados)
VALUES (1, '[]'::jsonb, '[]'::jsonb)
ON CONFLICT (id) DO NOTHING;
