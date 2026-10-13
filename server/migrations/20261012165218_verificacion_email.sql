ALTER TABLE public.clientes
  ADD COLUMN email_verificado boolean NOT NULL DEFAULT false,
  ADD COLUMN email_verificado_en timestamptz,
  ADD COLUMN email_pendiente varchar;
CREATE TABLE public.verificaciones_email (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  email varchar NOT NULL,
  motivo varchar NOT NULL,
  token_hash text NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  expira_en timestamptz NOT NULL,
  usado_en timestamptz
);
CREATE UNIQUE INDEX verificaciones_email_token_hash_key ON public.verificaciones_email(token_hash);
CREATE INDEX verificaciones_email_cliente_id_idx ON public.verificaciones_email(cliente_id);
ALTER TABLE public.verificaciones_email ENABLE ROW LEVEL SECURITY;