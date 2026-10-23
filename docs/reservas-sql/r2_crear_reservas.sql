CREATE TABLE public.reservas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mueble_id uuid NOT NULL REFERENCES public.muebles(id) ON DELETE RESTRICT,
  tipo text NOT NULL CHECK (tipo IN ('alquiler', 'bloqueo', 'venta')),
  estado text NOT NULL
    CHECK (estado IN ('pendiente', 'confirmada', 'en_curso', 'devuelta', 'cancelada', 'expirada')),
  fecha_inicio date NOT NULL,
  fecha_fin date,
  -- Hora de entrega y de recogida, en hora de Madrid (solo alquiler): el precio se cobra en bloques de
  -- 24 h desde la hora de entrega. El calendario sigue ocupándose por días.
  hora_entrega time,
  hora_recogida time,
  fin_ocupacion date,
  dias_margen smallint NOT NULL DEFAULT 0 CHECK (dias_margen >= 0),
  rango_ocupado daterange GENERATED ALWAYS AS
    (daterange(fecha_inicio, fin_ocupacion + dias_margen, '[)')) STORED,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  pedido_id uuid REFERENCES public.pedidos(id) ON DELETE RESTRICT,
  stripe_session_id text,
  stripe_payment_intent_id text,
  expira_en timestamptz,
  modo_entrega text CHECK (modo_entrega IN ('domicilio', 'tienda')),
  modo_devolucion text CHECK (modo_devolucion IN ('domicilio', 'tienda')),
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
  fianza_estado text CHECK (fianza_estado IN
    ('pendiente', 'garantizada', 'en_resolucion', 'liberada', 'cobrada_parcial', 'cobrada', 'no_aplica')),
  fianza_stripe_ref text,
  stripe_customer_id text,
  entregada_en timestamptz,
  devuelta_en timestamptz,
  cancelada_en timestamptz,
  cancelada_por text CHECK (cancelada_por IN ('cliente', 'admin', 'sistema')),
  motivo_cancelacion text,
  reembolso_solicitado_en timestamptz,
  reembolso_importe numeric(10,2),
  stripe_refund_id text,
  origen text NOT NULL DEFAULT 'web' CHECK (origen IN ('web', 'manual', 'legacy')),
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Cada clase con sus fechas. Con IS NOT NULL explícito: una CHECK que da NULL se da por cumplida,
  -- y un fin_ocupacion nulo en un alquiler ocuparía el calendario de la pieza para siempre.
  CONSTRAINT reservas_alquiler_fechas CHECK (tipo <> 'alquiler' OR (
    fecha_fin IS NOT NULL AND fin_ocupacion IS NOT NULL AND fecha_fin > fecha_inicio
    AND hora_entrega IS NOT NULL AND hora_recogida IS NOT NULL
    AND (fin_ocupacion >= fecha_fin OR estado = 'devuelta'))),
  CONSTRAINT reservas_bloqueo_fechas CHECK (tipo <> 'bloqueo' OR (
    fecha_fin IS NOT NULL AND fin_ocupacion IS NOT NULL AND fecha_fin > fecha_inicio
    AND fin_ocupacion = fecha_fin AND dias_margen = 0 AND cliente_id IS NULL
    AND hora_entrega IS NULL AND hora_recogida IS NULL)),
  CONSTRAINT reservas_venta_sin_fin CHECK (tipo <> 'venta' OR (
    fecha_fin IS NULL AND fin_ocupacion IS NULL AND dias_margen = 0
    AND hora_entrega IS NULL AND hora_recogida IS NULL)),
  CONSTRAINT reservas_pendiente_completa CHECK (estado <> 'pendiente' OR (
    expira_en IS NOT NULL AND tipo = 'alquiler' AND cliente_id IS NOT NULL)),
  CONSTRAINT reservas_estados_por_tipo CHECK (tipo = 'alquiler' OR estado IN ('confirmada', 'cancelada')),
  CONSTRAINT reservas_entregada_con_fecha CHECK (
    estado NOT IN ('en_curso', 'devuelta') OR entregada_en IS NOT NULL),
  CONSTRAINT reservas_devuelta_con_fecha CHECK (estado <> 'devuelta' OR devuelta_en IS NOT NULL),
  CONSTRAINT reservas_fianza_tras_devolucion CHECK (
    fianza_estado IS NULL
    OR fianza_estado NOT IN ('en_resolucion', 'liberada', 'cobrada_parcial', 'cobrada')
    OR estado IN ('devuelta', 'cancelada')),

  -- Lo que garantiza que nada se solapa en el calendario de una pieza, margen incluido.
  CONSTRAINT reservas_sin_solape EXCLUDE USING gist (mueble_id WITH =, rango_ocupado WITH &&)
    WHERE (estado IN ('pendiente', 'confirmada', 'en_curso', 'devuelta')),

  -- Idempotencia del webhook y de la página de éxito (una sesión de compra puede llevar varias piezas).
  CONSTRAINT reservas_sesion_mueble_key UNIQUE (stripe_session_id, mueble_id)
);

-- Una sola reserva provisional por cliente.
CREATE UNIQUE INDEX reservas_una_pendiente_por_cliente
  ON public.reservas (cliente_id) WHERE estado = 'pendiente';
CREATE INDEX reservas_cliente_id_idx ON public.reservas (cliente_id);
CREATE INDEX reservas_pedido_id_idx ON public.reservas (pedido_id);
CREATE INDEX reservas_estado_fecha_inicio_idx ON public.reservas (estado, fecha_inicio);

ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.reservas_actualizar_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reservas_updated_at
BEFORE UPDATE ON public.reservas
FOR EACH ROW
EXECUTE FUNCTION public.reservas_actualizar_updated_at();

-- Una reserva devuelta ocupa el calendario hasta el día real de devolución (en hora de Madrid), más
-- su margen. Lo mantiene la base de datos para que ninguna escritura deje las dos columnas
-- desincronizadas. Solo toca su propia fila (NEW), así que no se dispara a sí mismo.
CREATE FUNCTION public.reservas_fin_ocupacion_al_devolver()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.fin_ocupacion := (NEW.devuelta_en AT TIME ZONE 'Europe/Madrid')::date;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reservas_fin_ocupacion_al_devolver
BEFORE INSERT OR UPDATE ON public.reservas
FOR EACH ROW
WHEN (NEW.estado = 'devuelta' AND NEW.devuelta_en IS NOT NULL)
EXECUTE FUNCTION public.reservas_fin_ocupacion_al_devolver();
