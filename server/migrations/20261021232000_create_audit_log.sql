CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id text,
  admin_email text,
  accion text NOT NULL,
  entidad text NOT NULL,
  entidad_id text NOT NULL,
  datos_anteriores jsonb,
  datos_nuevos jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_created_at_idx ON public.audit_log(created_at DESC);
CREATE INDEX audit_log_entidad_entidad_id_idx ON public.audit_log(entidad, entidad_id);
CREATE INDEX audit_log_admin_id_idx ON public.audit_log(admin_id);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
