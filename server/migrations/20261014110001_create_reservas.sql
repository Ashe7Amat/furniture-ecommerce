CREATE TABLE public.reservas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mueble_id uuid NOT NULL REFERENCES public.muebles(id) ON DELETE RESTRICT,
  tipo text NOT NULL CHECK (tipo IN ('alquiler', 'bloqueo', 'venta')),
  estado text NOT NULL CHECK (estado IN ('pendiente', 'confirmada', 'en_curso', 'devuelta', 'cancelada', 'expirada')),
  fecha_inicio date NOT NULL,
  fecha_fin date,
  fin_ocupacion date,
  dias_margen smallint NOT NULL DEFAULT 0 CHECK (dias_margen >= 0),
  rango_ocupado daterange GENERATED ALWAYS AS
    (daterange(fecha_inicio, fin_ocupacion + dias_margen, '[)')) STORED,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  pedido_id uuid REFERENCES public.pedidos(id) ON DELETE RESTRICT,
  stripe_session_id text,
  stripe_payment_intent_id text,
  expira_en timestamptz,
  modo_entrega text CHECK (modo_entrega IS NULL OR modo_entrega IN ('domicilio', 'tienda')),
  modo_devolucion text CHECK (modo_devolucion IS NULL OR modo_devolucion IN ('domicilio', 'tienda')),
  direccion_entrega text,
  datos_contacto jsonb,
  conflicto_en timestamptz,
  confirmacion_enviada_en timestamptz,
  historial jsonb NOT NULL DEFAULT '[]'::jsonb,
  importe_alquiler numeric(10,2),
  importe_envio numeric(10,2),
  importe_total numeric(10,2),
  precio_desglose jsonb,
  condiciones jsonb,
  fianza_importe numeric(10,2),
  fianza_estado text CHECK (fianza_estado IS NULL OR fianza_estado IN ('pendiente', 'garantizada', 'en_resolucion', 'liberada', 'cobrada_parcial', 'cobrada', 'no_aplica')),
  fianza_stripe_ref text,
  stripe_customer_id text,
  entregada_en timestamptz,
  devuelta_en timestamptz,
  cancelada_en timestamptz,
  cancelada_por text CHECK (cancelada_por IS NULL OR cancelada_por IN ('cliente', 'admin', 'sistema')),
  motivo_cancelacion text,
  reembolso_solicitado_en timestamptz,
  reembolso_importe numeric(10,2),
  stripe_refund_id text,
  origen text NOT NULL DEFAULT 'web' CHECK (origen IN ('web', 'manual', 'legacy')),
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reservas_sin_solape EXCLUDE USING gist (
    mueble_id WITH =,
    rango_ocupado WITH &&
  ) WHERE (estado IN ('pendiente', 'confirmada', 'en_curso', 'devuelta')),
  CONSTRAINT chk_reservas_alquiler CHECK (
    tipo != 'alquiler' OR (
      fecha_fin IS NOT NULL AND
      fin_ocupacion IS NOT NULL AND
      fecha_fin > fecha_inicio AND
      (fin_ocupacion >= fecha_fin OR estado = 'devuelta')
    )
  ),
  CONSTRAINT chk_reservas_bloqueo CHECK (
    tipo != 'bloqueo' OR (
      fecha_fin IS NOT NULL AND
      fin_ocupacion IS NOT NULL AND
      fecha_fin > fecha_inicio AND
      fin_ocupacion = fecha_fin AND
      dias_margen = 0 AND
      cliente_id IS NULL
    )
  ),
  CONSTRAINT chk_reservas_venta CHECK (
    tipo != 'venta' OR (
      fecha_fin IS NULL AND
      fin_ocupacion IS NULL AND
      dias_margen = 0
    )
  ),
  CONSTRAINT chk_reservas_pendiente CHECK (
    estado != 'pendiente' OR (
      expira_en IS NOT NULL AND
      tipo = 'alquiler' AND
      cliente_id IS NOT NULL
    )
  ),
  CONSTRAINT chk_reservas_estados_tipo CHECK (
    (tipo = 'alquiler') OR
    (tipo IN ('bloqueo', 'venta') AND estado IN ('confirmada', 'cancelada'))
  ),
  CONSTRAINT chk_reservas_entregada CHECK (
    estado NOT IN ('en_curso', 'devuelta') OR entregada_en IS NOT NULL
  ),
  CONSTRAINT chk_reservas_devuelta CHECK (
    estado != 'devuelta' OR devuelta_en IS NOT NULL
  ),
  CONSTRAINT chk_reservas_fianza_resolucion CHECK (
    fianza_estado NOT IN ('en_resolucion', 'liberada', 'cobrada_parcial', 'cobrada') OR
    estado IN ('devuelta', 'cancelada')
  )
);
CREATE UNIQUE INDEX idx_reservas_stripe_session_mueble
  ON public.reservas (stripe_session_id, mueble_id);
CREATE UNIQUE INDEX idx_reservas_un_pendiente_por_cliente
  ON public.reservas (cliente_id) WHERE (estado = 'pendiente');
CREATE INDEX idx_reservas_cliente_id ON public.reservas (cliente_id);
CREATE INDEX idx_reservas_pedido_id ON public.reservas (pedido_id);
CREATE INDEX idx_reservas_estado_fecha_inicio ON public.reservas (estado, fecha_inicio);
ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.set_reservas_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
ALTER FUNCTION public.set_reservas_updated_at() SET search_path = public;
CREATE TRIGGER trg_reservas_updated_at
BEFORE UPDATE ON public.reservas
FOR EACH ROW
EXECUTE FUNCTION public.set_reservas_updated_at();
CREATE OR REPLACE FUNCTION public.sincronizar_fin_ocupacion_devuelta()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.estado = 'devuelta' AND (OLD.estado IS DISTINCT FROM 'devuelta' OR NEW.devuelta_en IS DISTINCT FROM OLD.devuelta_en) THEN
    IF NEW.devuelta_en IS NOT NULL THEN
      NEW.fin_ocupacion := (NEW.devuelta_en AT TIME ZONE 'Europe/Madrid')::date;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
ALTER FUNCTION public.sincronizar_fin_ocupacion_devuelta() SET search_path = public;
CREATE TRIGGER trg_sincronizar_fin_ocupacion_devuelta
BEFORE UPDATE OF estado, devuelta_en ON public.reservas
FOR EACH ROW
EXECUTE FUNCTION public.sincronizar_fin_ocupacion_devuelta();
