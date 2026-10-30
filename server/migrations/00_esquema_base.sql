-- ESQUEMA BASE para una base de datos NUEVA (starter kit, 30 oct 2026)
--
-- Qué es: el esquema entero que usa la API (server/src), en un solo archivo, para montar la base de
-- datos de otro cliente en un proyecto de Supabase vacío. Es el estado tras la última migración de
-- esta carpeta (20261022190000_add_ajustes_home_imagenes_secciones).
--
-- De dónde sale: copia del esquema real de Nave 5, contrastado el 30 oct 2026 (solo lectura) con
-- information_schema y pg_catalog de su base de datos: columnas con tipo, longitud, nulos y valores por
-- defecto, restricciones, índices, disparadores, funciones, políticas, RLS y comentarios. Coinciden las
-- 228 piezas del esquema salvo los nombres de abajo. Además, en un PostgreSQL 16 local pasa la prueba de
-- las reservas (docs/reservas-sql/r2_pruebas.sql) y `anon` lee el catálogo pero no clientes ni pedidos.
--
-- Única diferencia de nombres con Nave 5: allí 11 restricciones de reservas acaban en "1"
-- (reservas_estado_check1, reservas_mueble_id_fkey1...), porque la tabla R2 se creó cuando aún
-- existía el borrador con los nombres sin número. Aquí van sin el "1". La API no depende de esos
-- nombres: reconoce los errores por su código (23P01 el solape, 23505 el duplicado), y la única
-- restricción con nombre propio que se cita, reservas_sin_solape, se llama igual en los dos sitios.
--
-- Las cuatro tablas base (categorias, muebles, clientes, pedidos) no tienen CREATE TABLE en esta carpeta
-- (README.md, "Lo que no está aquí"): aquí van tal como están en Nave 5. Tampoco coinciden con su copia
-- en esta carpeta password_resets (en Nave 5 lleva created_at y sus índices se llaman idx_*) ni el
-- nombre de la política de ajustes_home: aquí manda lo que hay en la base de datos.
--
-- Lo que NO lleva, porque es historia de Nave 5 y no sirve a otro cliente: la tabla reservas_borrador
-- (el borrador de reservas sustituido por la R2), la copia respaldo_agrupacion_muebles_20261002, los
-- arreglos de datos (rellenos de categoria_id, cliente_id, códigos, referencias, agrupación de fichas,
-- categoría Espejos, admins verificados), la extensión http (no la usa nada), el bucket
-- muebles-fotos (no lo usa nada) y las políticas de Storage que dejan subir archivos a anon (la API sube
-- con service_role). Las extensiones de serie de Supabase (pgcrypto, uuid-ossp...) ya vienen con el proyecto.
--
-- NO se ejecuta en la base de datos de Nave 5: ya tiene todo esto.
--
-- Cómo se usa, en un proyecto nuevo:
--   1. SQL Editor de Supabase (o psql con la cadena de conexión): pegar y ejecutar este archivo entero.
--      Va en una transacción: si algo falla, no queda nada a medias.
--   2. NO ejecutar después las migraciones con versión 20261022190000 o anterior: ya están aquí. Las que
--      lleguen más tarde (versión posterior), sí, en orden.
--   3. El bucket público "imagenes" se crea al final si existe storage.buckets (siempre en Supabase).
--   4. Primer administrador: ver docs/DEPLOY.md, sección 1.

BEGIN;

-- ─── Extensiones ───────────────────────────────────────────────────────────────────────────────────
-- btree_gist: la restricción de exclusión de reservas (pieza = y rango de fechas &&).
-- gen_random_uuid() viene con PostgreSQL 13 o posterior, sin extensión.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

-- ─── Catálogo ──────────────────────────────────────────────────────────────────────────────────────

-- Categorías en dos niveles: las generales (sin padre) y sus específicas (categoria_padre_id).
-- `codigo` (tres letras: SIL, MES...) forma la referencia de las piezas: PREFIJO-SIL-001.
CREATE TABLE public.categorias (
  id serial PRIMARY KEY,
  nombre varchar(100) NOT NULL UNIQUE,
  imagen_url text,
  categoria_padre_id integer REFERENCES public.categorias(id) ON DELETE SET NULL,
  codigo text UNIQUE
);

-- Las piezas. `categoria` (el nombre) y `categoria_id` se escriben las dos (doble escritura,
-- docs/tarea3-diseno.md); el catálogo filtra por el nombre. `disponible` no la escribe nadie: la
-- calcula el disparador de abajo a partir de `estado`. `referencia` la pone la API al crear la pieza.
-- `estado` (disponible, vendido, alquilado) no lleva CHECK en Nave 5: lo valida la API.
CREATE TABLE public.muebles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  categoria text NOT NULL,
  descripcion text,
  precio_venta numeric(10,2),
  precio_alquiler_dia numeric(10,2),
  disponible boolean DEFAULT true,
  imagenes text[] DEFAULT '{}'::text[],
  created_at timestamptz DEFAULT now(),
  estado varchar(20) DEFAULT 'disponible',
  categoria_id integer REFERENCES public.categorias(id) ON DELETE SET NULL,
  referencia text UNIQUE
);

-- ─── Cuentas ───────────────────────────────────────────────────────────────────────────────────────

-- Clientes y administradores (rol = 'admin'). La contraseña va cifrada con bcrypt; las cuentas de
-- Google llevan una contraseña aleatoria que no sirve para entrar.
CREATE TABLE public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(255) NOT NULL UNIQUE,
  nombre varchar(100),
  rol varchar(20) DEFAULT 'cliente',
  creado_en timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  password text,
  email_verificado boolean NOT NULL DEFAULT false,
  email_verificado_en timestamptz,
  email_pendiente varchar
);

-- Sesiones: solo el HMAC del refresh token (REFRESH_TOKEN_HASH_SECRET). Cada uso lo rota dentro de su
-- familia; presentar uno ya revocado revoca la familia entera.
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

-- Enlaces de verificación de email y de cambio de email (de un solo uso, como HMAC).
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

-- Enlaces de "he olvidado la contraseña" (de un solo uso, como HMAC).
CREATE TABLE public.password_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── Ventas ────────────────────────────────────────────────────────────────────────────────────────

-- Un pedido por sesión de Stripe Checkout pagada. El id es un UUID v5 sacado del id de la sesión
-- (lo pone la API), así que el webhook y la página de éxito no pueden registrar el mismo pago dos veces.
CREATE TYPE public.metodo_entrega_type AS ENUM ('domicilio', 'recogida');

-- `estado` (procesando, enviado, entregado, cancelado) no lleva CHECK en Nave 5: lo valida la API.
CREATE TABLE public.pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  total numeric(10,2) NOT NULL,
  metodo_entrega public.metodo_entrega_type NOT NULL,
  direccion_envio text,
  estado text NOT NULL DEFAULT 'procesando',
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  cliente_info jsonb,
  items jsonb,
  stripe_session_id text,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL
);
COMMENT ON COLUMN public.pedidos.items IS 'Líneas del pedido: [{productId, nombre, modalidad, cantidad, precio}]. Fuente de verdad para pedidos con varios productos.';
COMMENT ON COLUMN public.pedidos.stripe_session_id IS 'ID de la sesión de Stripe Checkout que generó este pedido. Evita duplicar el pedido si se confirma la sesión más de una vez.';

-- ─── Reservas por fechas (docs/reservas-diseno.md) ─────────────────────────────────────────────────
-- Copia de la R2 (migración 20261019233700). Detrás de RESERVAS_ACTIVAS: con el interruptor apagado la
-- tabla existe pero la API no la toca.
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

-- ─── Panel, contacto y portada ─────────────────────────────────────────────────────────────────────

-- Registro de lo que hace cada administrador en el panel (H63).
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

-- Mensajes del formulario de contacto (pestaña Mensajes del panel).
CREATE TABLE public.mensajes_contacto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  email text NOT NULL,
  mensaje text NOT NULL,
  leido boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Ajustes de la portada (fotos del hero y de las secciones, piezas destacadas): una sola fila, id = 1.
CREATE TABLE public.ajustes_home (
  id integer PRIMARY KEY CHECK (id = 1),
  hero_imagenes jsonb NOT NULL DEFAULT '[]'::jsonb,
  productos_destacados jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- 2 o 3 URLs para "Espacios que inspiran", y 1 para la sección final (NULL = foto de siempre).
  imagenes_seccion_inspiracion jsonb NOT NULL DEFAULT '[]'::jsonb,
  imagen_seccion_sostenibilidad text
);
INSERT INTO public.ajustes_home (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ─── Índices ───────────────────────────────────────────────────────────────────────────────────────
CREATE INDEX idx_categorias_categoria_padre_id ON public.categorias (categoria_padre_id);
CREATE INDEX idx_muebles_categoria_id ON public.muebles (categoria_id);

CREATE UNIQUE INDEX refresh_tokens_token_hash_key ON public.refresh_tokens (token_hash);
CREATE INDEX refresh_tokens_user_id_idx ON public.refresh_tokens (user_id);
CREATE INDEX refresh_tokens_family_id_idx ON public.refresh_tokens (family_id);
CREATE UNIQUE INDEX verificaciones_email_token_hash_key ON public.verificaciones_email (token_hash);
CREATE INDEX verificaciones_email_cliente_id_idx ON public.verificaciones_email (cliente_id);
CREATE INDEX idx_password_resets_token_hash ON public.password_resets (token_hash);
CREATE INDEX idx_password_resets_email ON public.password_resets (email);

-- Único pero permitiendo NULL (pedidos de otras vías de pago)
CREATE UNIQUE INDEX pedidos_stripe_session_id_key
  ON public.pedidos (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;
CREATE INDEX pedidos_created_at_idx ON public.pedidos (created_at DESC);
CREATE INDEX idx_pedidos_cliente_id ON public.pedidos (cliente_id);

-- Una sola reserva provisional por cliente.
CREATE UNIQUE INDEX reservas_una_pendiente_por_cliente
  ON public.reservas (cliente_id) WHERE estado = 'pendiente';
CREATE INDEX reservas_cliente_id_idx ON public.reservas (cliente_id);
CREATE INDEX reservas_pedido_id_idx ON public.reservas (pedido_id);
CREATE INDEX reservas_estado_fecha_inicio_idx ON public.reservas (estado, fecha_inicio);

CREATE INDEX audit_log_created_at_idx ON public.audit_log (created_at DESC);
CREATE INDEX audit_log_entidad_entidad_id_idx ON public.audit_log (entidad, entidad_id);
CREATE INDEX audit_log_admin_id_idx ON public.audit_log (admin_id);

CREATE INDEX mensajes_contacto_leido_idx ON public.mensajes_contacto (leido);
CREATE INDEX mensajes_contacto_created_at_idx ON public.mensajes_contacto (created_at DESC);

-- ─── Disparadores ──────────────────────────────────────────────────────────────────────────────────

-- `disponible` es siempre una derivación de `estado` (el campo que manda): true solo si
-- estado = 'disponible', escriba lo que escriba la aplicación.
CREATE FUNCTION public.sync_disponible_desde_estado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.disponible := (COALESCE(NEW.estado, 'disponible') = 'disponible');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_disponible_desde_estado
BEFORE INSERT OR UPDATE ON public.muebles
FOR EACH ROW
EXECUTE FUNCTION public.sync_disponible_desde_estado();

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
-- su margen. Solo toca su propia fila (NEW), así que no se dispara a sí mismo.
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

-- ─── Seguridad a nivel de fila (RLS) ───────────────────────────────────────────────────────────────
-- La API entra con la clave service_role, que se salta RLS. Estas políticas son la segunda barrera
-- para quien llame a Supabase con la clave pública (anon): puede LEER el catálogo y los ajustes de la
-- portada, y nada más. El resto de tablas tienen RLS sin ninguna política: con la clave anon no se
-- lee ni se escribe nada (PostgREST devuelve una lista vacía).
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.muebles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verificaciones_email ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_resets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensajes_contacto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ajustes_home ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Catálogo de muebles visible públicamente"
  ON public.muebles FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Categorías visibles públicamente"
  ON public.categorias FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Permitir lectura pública de ajustes"
  ON public.ajustes_home FOR SELECT
  TO anon, authenticated
  USING (true);

-- ─── Fotos: bucket público "imagenes" ──────────────────────────────────────────────────────────────
-- Solo en Supabase (en un PostgreSQL sin Supabase no hay storage.buckets y se salta). La API sube y
-- borra con service_role; las fotos se sirven por su URL pública.
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('imagenes', 'imagenes', true)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END;
$$;

COMMIT;
