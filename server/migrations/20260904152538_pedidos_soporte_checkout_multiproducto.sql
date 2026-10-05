-- El checkout real (Stripe) es un carrito de invitado: no hay usuario de Supabase Auth
-- detrás, así que user_id no se puede rellenar. Y una compra puede tener varios muebles
-- a la vez, así que mueble_id (un solo FK) ya no basta como fuente de verdad: se guarda
-- el detalle completo en la nueva columna items (jsonb).
alter table public.pedidos
  alter column user_id drop not null,
  alter column mueble_id drop not null;

alter table public.pedidos
  add column if not exists items jsonb,
  add column if not exists stripe_session_id text;

comment on column public.pedidos.items is 'Líneas del pedido: [{productId, nombre, modalidad, cantidad, precio}]. Fuente de verdad para pedidos con varios productos.';
comment on column public.pedidos.stripe_session_id is 'ID de la sesión de Stripe Checkout que generó este pedido. Evita duplicar el pedido si se confirma la sesión más de una vez.';

-- Único pero permitiendo NULL (pedidos antiguos o de otras vías de pago)
create unique index if not exists pedidos_stripe_session_id_key
  on public.pedidos (stripe_session_id)
  where stripe_session_id is not null;

create index if not exists pedidos_created_at_idx on public.pedidos (created_at desc);
