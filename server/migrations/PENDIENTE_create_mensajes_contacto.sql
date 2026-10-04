CREATE TABLE public.mensajes_contacto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  email text NOT NULL,
  mensaje text NOT NULL,
  leido boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mensajes_contacto_leido_idx ON public.mensajes_contacto (leido);
CREATE INDEX mensajes_contacto_created_at_idx ON public.mensajes_contacto (created_at DESC);
ALTER TABLE public.mensajes_contacto ENABLE ROW LEVEL SECURITY;