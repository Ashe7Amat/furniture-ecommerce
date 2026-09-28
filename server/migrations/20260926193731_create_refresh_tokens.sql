CREATE TABLE public.refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  family_id uuid NOT NULL,
  token_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  replaced_by uuid REFERENCES public.refresh_tokens(id) ON DELETE SET NULL,
  user_agent text,
  ip inet
);
CREATE UNIQUE INDEX refresh_tokens_token_hash_key ON public.refresh_tokens(token_hash);
CREATE INDEX refresh_tokens_user_id_idx ON public.refresh_tokens(user_id);
CREATE INDEX refresh_tokens_family_id_idx ON public.refresh_tokens(family_id);
ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;
