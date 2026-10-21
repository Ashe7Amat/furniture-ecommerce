CREATE TABLE public.password_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);
CREATE UNIQUE INDEX password_resets_token_hash_key ON public.password_resets(token_hash);
CREATE INDEX password_resets_email_idx ON public.password_resets(email);
ALTER TABLE public.password_resets ENABLE ROW LEVEL SECURITY;
