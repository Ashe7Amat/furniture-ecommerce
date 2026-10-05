-- Fix data-consistency bug: `disponible` (boolean) and `estado` (varchar) on
-- `muebles` could drift apart because several write paths (e.g. the admin
-- panel's quick "cambiar estado" dropdown) update only `estado` and never
-- touch `disponible`. The public catalog and product-detail pages read
-- `estado` exclusively, so `estado` is the authoritative field; `disponible`
-- must always be a pure derivation of it: true only when estado = 'disponible'.
--
-- This trigger makes that derivation automatic and un-droppable: on every
-- INSERT or UPDATE, `disponible` is recomputed from `estado` server-side,
-- overriding whatever the application sent (or didn't send) for `disponible`.

CREATE OR REPLACE FUNCTION public.sync_disponible_desde_estado()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.disponible := (COALESCE(NEW.estado, 'disponible') = 'disponible');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_disponible_desde_estado ON public.muebles;

CREATE TRIGGER trg_sync_disponible_desde_estado
BEFORE INSERT OR UPDATE ON public.muebles
FOR EACH ROW
EXECUTE FUNCTION public.sync_disponible_desde_estado();

-- One-time backfill in case any existing rows were already out of sync
-- (defensive: a prior audit found 0, but this keeps the migration
-- self-contained and safe to re-run against a different environment).
UPDATE public.muebles
SET disponible = (COALESCE(estado, 'disponible') = 'disponible')
WHERE disponible IS DISTINCT FROM (COALESCE(estado, 'disponible') = 'disponible');
