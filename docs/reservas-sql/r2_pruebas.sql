-- Prueba desechable de R1 y R2 (docs/reservas-diseno.md, 4.2, 4.3 y 3.4). Se ejecuta DESPUÉS del SQL
-- de R1 y R2 y en la misma transacción. Termina SIEMPRE con un error a propósito ("PRUEBA SUPERADA"),
-- para que Postgres deshaga todo, también la extensión y la tabla: si el resultado es ese error, todo
-- ha ido bien y no queda rastro. Cualquier otro error es un fallo de verdad (y tampoco deja rastro).
-- No usa DELETE (el MCP de Supabase se cuelga con ellos) y no toca ninguna fila existente: solo crea
-- reservas de prueba sobre dos muebles y dos clientes que ya existen.
DO $$
DECLARE
  m1 uuid := (SELECT id FROM public.muebles ORDER BY id LIMIT 1);
  m2 uuid := (SELECT id FROM public.muebles ORDER BY id LIMIT 1 OFFSET 1);
  c1 uuid := (SELECT id FROM public.clientes ORDER BY id LIMIT 1);
  c2 uuid := (SELECT id FROM public.clientes ORDER BY id LIMIT 1 OFFSET 1);
  r uuid;
  v uuid;
  fin date;
  rango daterange;
  antes timestamptz;
  despues timestamptz;
BEGIN
  IF m2 IS NULL OR c2 IS NULL THEN
    RAISE EXCEPTION 'FALLO: hacen falta al menos dos muebles y dos clientes';
  END IF;

  ---------------------------------------------------------------------------------------------------
  -- 1. Solapes entre alquileres, y el margen. A: del 10 al 13 de junio con 2 días de margen, así que
  --    ocupa del 10 al 15 (exclusivo).
  INSERT INTO public.reservas (mueble_id, tipo, estado, fecha_inicio, fecha_fin, fin_ocupacion, dias_margen, hora_entrega, hora_recogida)
  VALUES (m1, 'alquiler', 'confirmada', '2030-06-10', '2030-06-13', '2030-06-13', 2, '10:00', '10:00');

  BEGIN
    INSERT INTO public.reservas (mueble_id, tipo, estado, fecha_inicio, fecha_fin, fin_ocupacion, dias_margen, hora_entrega, hora_recogida)
    VALUES (m1, 'alquiler', 'confirmada', '2030-06-12', '2030-06-20', '2030-06-20', 2, '10:00', '10:00');
    RAISE EXCEPTION 'FALLO 1a: se aceptó un alquiler solapado';
  EXCEPTION WHEN exclusion_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.reservas (mueble_id, tipo, estado, fecha_inicio, fecha_fin, fin_ocupacion, dias_margen, hora_entrega, hora_recogida)
    VALUES (m1, 'alquiler', 'confirmada', '2030-06-14', '2030-06-16', '2030-06-16', 2, '10:00', '10:00');
    RAISE EXCEPTION 'FALLO 1b: se aceptó un alquiler dentro del margen';
  EXCEPTION WHEN exclusion_violation THEN NULL;
  END;

  -- Justo después del margen, sí. Y antes de A: termina el 8 + 2 de margen = 10, sin tocar a A.
  INSERT INTO public.reservas (mueble_id, tipo, estado, fecha_inicio, fecha_fin, fin_ocupacion, dias_margen, hora_entrega, hora_recogida)
  VALUES (m1, 'alquiler', 'confirmada', '2030-06-15', '2030-06-17', '2030-06-17', 2, '10:00', '10:00');
  INSERT INTO public.reservas (mueble_id, tipo, estado, fecha_inicio, fecha_fin, fin_ocupacion, dias_margen, hora_entrega, hora_recogida)
  VALUES (m1, 'alquiler', 'confirmada', '2030-06-05', '2030-06-08', '2030-06-08', 2, '10:00', '10:00');

  -- Otra pieza, mismas fechas: sin problema.
  INSERT INTO public.reservas (mueble_id, tipo, estado, fecha_inicio, fecha_fin, fin_ocupacion, dias_margen, hora_entrega, hora_recogida)
  VALUES (m2, 'alquiler', 'confirmada', '2030-06-10', '2030-06-13', '2030-06-13', 2, '10:00', '10:00');

  -- Las canceladas y expiradas no ocupan el calendario.
  INSERT INTO public.reservas (mueble_id, tipo, estado, fecha_inicio, fecha_fin, fin_ocupacion, dias_margen, hora_entrega, hora_recogida)
  VALUES (m1, 'alquiler', 'cancelada', '2030-06-10', '2030-06-13', '2030-06-13', 2, '10:00', '10:00'),
         (m1, 'alquiler', 'expirada', '2030-06-10', '2030-06-13', '2030-06-13', 2, '10:00', '10:00');

  ---------------------------------------------------------------------------------------------------
  -- 2. Una venta (rango abierto por arriba) contra un alquiler futuro, en los dos órdenes.
  BEGIN
    INSERT INTO public.reservas (mueble_id, tipo, estado, fecha_inicio)
    VALUES (m1, 'venta', 'confirmada', '2030-01-01');
    RAISE EXCEPTION 'FALLO 2a: se aceptó una venta con alquileres futuros';
  EXCEPTION WHEN exclusion_violation THEN NULL;
  END;

  -- Entrega diferida: la venta empieza donde acaba lo ocupado por el último alquiler (17 + 2 = 19).
  INSERT INTO public.reservas (mueble_id, tipo, estado, fecha_inicio)
  VALUES (m1, 'venta', 'confirmada', '2030-06-19');
  SELECT rango_ocupado INTO rango FROM public.reservas WHERE mueble_id = m1 AND tipo = 'venta';
  IF NOT upper_inf(rango) THEN
    RAISE EXCEPTION 'FALLO 2b: el rango de una venta tendría que estar abierto, y es %', rango;
  END IF;

  BEGIN
    INSERT INTO public.reservas (mueble_id, tipo, estado, fecha_inicio, fecha_fin, fin_ocupacion, dias_margen, hora_entrega, hora_recogida)
    VALUES (m1, 'alquiler', 'confirmada', '2031-01-10', '2031-01-12', '2031-01-12', 2, '10:00', '10:00');
    RAISE EXCEPTION 'FALLO 2c: se aceptó un alquiler de una pieza vendida';
  EXCEPTION WHEN exclusion_violation THEN NULL;
  END;

  ---------------------------------------------------------------------------------------------------
  -- 3. Un bloqueo contra un alquiler.
  BEGIN
    INSERT INTO public.reservas (mueble_id, tipo, estado, fecha_inicio, fecha_fin, fin_ocupacion, motivo)
    VALUES (m2, 'bloqueo', 'confirmada', '2030-06-14', '2030-06-16', '2030-06-16', 'prueba');
    RAISE EXCEPTION 'FALLO 3: se aceptó un bloqueo dentro del margen de un alquiler';
  EXCEPTION WHEN exclusion_violation THEN NULL;
  END;

  ---------------------------------------------------------------------------------------------------
  -- 4. Una provisional caducada estorba hasta que se marca expirada; después, no.
  INSERT INTO public.reservas (mueble_id, tipo, estado, fecha_inicio, fecha_fin, fin_ocupacion, dias_margen, cliente_id, expira_en, hora_entrega, hora_recogida)
  VALUES (m2, 'alquiler', 'pendiente', '2030-07-01', '2030-07-03', '2030-07-03', 2, c1, now() - interval '1 minute', '10:00', '10:00')
  RETURNING id INTO r;

  BEGIN
    INSERT INTO public.reservas (mueble_id, tipo, estado, fecha_inicio, fecha_fin, fin_ocupacion, dias_margen, hora_entrega, hora_recogida)
    VALUES (m2, 'alquiler', 'confirmada', '2030-07-02', '2030-07-04', '2030-07-04', 2, '10:00', '10:00');
    RAISE EXCEPTION 'FALLO 4a: una provisional sin marcar como expirada tendría que estorbar';
  EXCEPTION WHEN exclusion_violation THEN NULL;
  END;

  UPDATE public.reservas SET estado = 'expirada'
  WHERE mueble_id = m2 AND estado = 'pendiente' AND expira_en < now();
  INSERT INTO public.reservas (mueble_id, tipo, estado, fecha_inicio, fecha_fin, fin_ocupacion, dias_margen, hora_entrega, hora_recogida)
  VALUES (m2, 'alquiler', 'confirmada', '2030-07-02', '2030-07-04', '2030-07-04', 2, '10:00', '10:00');

  -- Pagada tarde: volver de expirada a confirmada choca con la que ya ocupó esas fechas.
  BEGIN
    UPDATE public.reservas SET estado = 'confirmada' WHERE id = r;
    RAISE EXCEPTION 'FALLO 4b: se confirmó una provisional caducada cuyas fechas ya tenía otra';
  EXCEPTION WHEN exclusion_violation THEN NULL;
  END;

  ---------------------------------------------------------------------------------------------------
  -- 5. Una provisional por cliente.
  INSERT INTO public.reservas (mueble_id, tipo, estado, fecha_inicio, fecha_fin, fin_ocupacion, dias_margen, cliente_id, expira_en, hora_entrega, hora_recogida)
  VALUES (m2, 'alquiler', 'pendiente', '2030-08-01', '2030-08-03', '2030-08-03', 2, c2, now() + interval '45 minutes', '10:00', '10:00');
  BEGIN
    INSERT INTO public.reservas (mueble_id, tipo, estado, fecha_inicio, fecha_fin, fin_ocupacion, dias_margen, cliente_id, expira_en, hora_entrega, hora_recogida)
    VALUES (m2, 'alquiler', 'pendiente', '2030-09-01', '2030-09-03', '2030-09-03', 2, c2, now() + interval '45 minutes', '10:00', '10:00');
    RAISE EXCEPTION 'FALLO 5: se aceptaron dos provisionales del mismo cliente';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- 6. La misma sesión de Stripe no registra dos veces la misma pieza.
  INSERT INTO public.reservas (mueble_id, tipo, estado, fecha_inicio, fecha_fin, fin_ocupacion, stripe_session_id)
  VALUES (m2, 'bloqueo', 'confirmada', '2030-10-01', '2030-10-02', '2030-10-02', 'cs_prueba');
  BEGIN
    INSERT INTO public.reservas (mueble_id, tipo, estado, fecha_inicio, fecha_fin, fin_ocupacion, stripe_session_id)
    VALUES (m2, 'bloqueo', 'confirmada', '2030-11-01', '2030-11-02', '2030-11-02', 'cs_prueba');
    RAISE EXCEPTION 'FALLO 6: se repitió la misma sesión para la misma pieza';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- 6b. La venta repetida de una sesión (el reintento del pago de una compra, 6.7). Mientras su venta
  --     ocupa el calendario, la repetición choca antes con la exclusión (23P01) que con la unicidad,
  --     porque la exclusión se creó antes. Ya cancelada, choca con la unicidad (23505). Y una pieza
  --     que no existe da la clave ajena (23503). registrarVenta (calendarioReservas.js) y el doble de
  --     los tests (fakeSupabase.js) dependen de este orden. Va en 2035, después de todo lo de m2.
  INSERT INTO public.reservas (mueble_id, tipo, estado, fecha_inicio, stripe_session_id)
  VALUES (m2, 'venta', 'confirmada', '2035-01-01', 'cs_venta') RETURNING id INTO v;
  BEGIN
    INSERT INTO public.reservas (mueble_id, tipo, estado, fecha_inicio, stripe_session_id)
    VALUES (m2, 'venta', 'confirmada', '2035-01-01', 'cs_venta');
    RAISE EXCEPTION 'FALLO 6b: se repitió la venta de una sesión';
  EXCEPTION
    WHEN exclusion_violation THEN NULL;
    WHEN unique_violation THEN
      RAISE EXCEPTION 'FALLO 6b: la venta repetida chocó con la unicidad antes que con la exclusión (ha cambiado el orden de las restricciones: revisar registrarVenta y fakeSupabase.js)';
  END;
  UPDATE public.reservas SET estado = 'cancelada', cancelada_en = now(), cancelada_por = 'admin' WHERE id = v;
  BEGIN
    INSERT INTO public.reservas (mueble_id, tipo, estado, fecha_inicio, stripe_session_id)
    VALUES (m2, 'venta', 'confirmada', '2035-01-01', 'cs_venta');
    RAISE EXCEPTION 'FALLO 6c: se repitió una venta cancelada de la misma sesión';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.reservas (mueble_id, tipo, estado, fecha_inicio, stripe_session_id)
    VALUES (gen_random_uuid(), 'venta', 'confirmada', '2035-01-01', 'cs_venta_sin_pieza');
    RAISE EXCEPTION 'FALLO 6d: se aceptó la venta de una pieza que no existe';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  ---------------------------------------------------------------------------------------------------
  -- 7. Las CHECK que impiden filas que ocuparían mal el calendario.
  BEGIN
    INSERT INTO public.reservas (mueble_id, tipo, estado, fecha_inicio, fecha_fin, hora_entrega, hora_recogida)
    VALUES (m2, 'alquiler', 'confirmada', '2032-01-01', '2032-01-03', '10:00', '10:00');
    RAISE EXCEPTION 'FALLO 7a: se aceptó un alquiler sin fin_ocupacion (ocuparía la pieza para siempre)';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.reservas (mueble_id, tipo, estado, fecha_inicio, fecha_fin, fin_ocupacion)
    VALUES (m2, 'bloqueo', 'confirmada', '2032-01-01', '2032-01-01', '2032-01-01');
    RAISE EXCEPTION 'FALLO 7b: se aceptó un bloqueo vacío (no bloquearía nada)';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.reservas (mueble_id, tipo, estado, fecha_inicio, fecha_fin, fin_ocupacion, expira_en, hora_entrega, hora_recogida)
    VALUES (m2, 'alquiler', 'pendiente', '2032-01-01', '2032-01-03', '2032-01-03', now(), '10:00', '10:00');
    RAISE EXCEPTION 'FALLO 7c: se aceptó una provisional sin cliente';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.reservas (mueble_id, tipo, estado, fecha_inicio, fecha_fin)
    VALUES (m2, 'venta', 'confirmada', '2032-01-01', '2032-02-01');
    RAISE EXCEPTION 'FALLO 7d: se aceptó una venta con fecha de fin';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.reservas (mueble_id, tipo, estado, fecha_inicio, fecha_fin, fin_ocupacion)
    VALUES (m2, 'bloqueo', 'en_curso', '2032-01-01', '2032-01-03', '2032-01-03');
    RAISE EXCEPTION 'FALLO 7e: se aceptó un bloqueo en curso';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.reservas (mueble_id, tipo, estado, fecha_inicio, fecha_fin, fin_ocupacion, hora_entrega, hora_recogida)
    VALUES (m2, 'alquiler', 'confirmada', '2032-01-05', '2032-01-03', '2032-01-03', '10:00', '10:00');
    RAISE EXCEPTION 'FALLO 7f: se aceptó un alquiler que acaba antes de empezar';
  EXCEPTION WHEN data_exception OR check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.reservas (mueble_id, tipo, estado, fecha_inicio, fecha_fin, fin_ocupacion)
    VALUES (m2, 'alquiler', 'confirmada', '2032-01-01', '2032-01-03', '2032-01-03');
    RAISE EXCEPTION 'FALLO 7g: se aceptó un alquiler sin hora de entrega ni de recogida';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.reservas
      (mueble_id, tipo, estado, fecha_inicio, fecha_fin, fin_ocupacion, hora_entrega, hora_recogida)
    VALUES (m2, 'bloqueo', 'confirmada', '2032-01-01', '2032-01-03', '2032-01-03', '10:00', '10:00');
    RAISE EXCEPTION 'FALLO 7h: se aceptó un bloqueo con horas';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  ---------------------------------------------------------------------------------------------------
  -- 8. Al devolver, fin_ocupacion pasa a ser el día de devolución en hora de Madrid (3.4). Las tres
  --    reservas van del 1 al 10 de octubre de 2030 en m2, cada una en un año distinto para no chocar.
  --    a) A tiempo, a las 23:30 UTC del 9 (en Madrid ya es el 10: horario de verano, UTC+2).
  INSERT INTO public.reservas (mueble_id, tipo, estado, fecha_inicio, fecha_fin, fin_ocupacion, dias_margen, entregada_en, hora_entrega, hora_recogida)
  VALUES (m2, 'alquiler', 'en_curso', '2033-10-01', '2033-10-10', '2033-10-10', 2, '2033-10-01 09:00+00', '10:00', '10:00')
  RETURNING id INTO r;
  UPDATE public.reservas SET estado = 'devuelta', devuelta_en = '2033-10-09 23:30+00' WHERE id = r;
  SELECT fin_ocupacion, rango_ocupado INTO fin, rango FROM public.reservas WHERE id = r;
  IF fin <> '2033-10-10' OR rango <> daterange('2033-10-01', '2033-10-12') THEN
    RAISE EXCEPTION 'FALLO 8a: devolución a tiempo, fin_ocupacion % y rango %', fin, rango;
  END IF;

  --    b) Antes de tiempo, el 4: los días sobrantes se liberan, menos el margen.
  INSERT INTO public.reservas (mueble_id, tipo, estado, fecha_inicio, fecha_fin, fin_ocupacion, dias_margen, entregada_en, hora_entrega, hora_recogida)
  VALUES (m2, 'alquiler', 'en_curso', '2034-10-01', '2034-10-10', '2034-10-10', 2, '2034-10-01 09:00+00', '10:00', '10:00')
  RETURNING id INTO r;
  UPDATE public.reservas SET estado = 'devuelta', devuelta_en = '2034-10-04 10:00+00' WHERE id = r;
  SELECT fin_ocupacion INTO fin FROM public.reservas WHERE id = r;
  IF fin <> '2034-10-04' THEN
    RAISE EXCEPTION 'FALLO 8b: devolución anticipada, fin_ocupacion %', fin;
  END IF;
  INSERT INTO public.reservas (mueble_id, tipo, estado, fecha_inicio, fecha_fin, fin_ocupacion, dias_margen, hora_entrega, hora_recogida)
  VALUES (m2, 'alquiler', 'confirmada', '2034-10-06', '2034-10-08', '2034-10-08', 2, '10:00', '10:00');
  BEGIN
    INSERT INTO public.reservas (mueble_id, tipo, estado, fecha_inicio, fecha_fin, fin_ocupacion, dias_margen, hora_entrega, hora_recogida)
    VALUES (m2, 'alquiler', 'confirmada', '2034-10-05', '2034-10-06', '2034-10-06', 0, '10:00', '10:00');
    RAISE EXCEPTION 'FALLO 8b: el margen de una devuelta tendría que seguir protegido';
  EXCEPTION WHEN exclusion_violation THEN NULL;
  END;

  --    c) Tarde, el 26 de octubre a las 23:30 UTC: ya en horario de invierno (UTC+1), en Madrid es el
  --       27 a las 00:30. Antes se había ampliado fin_ocupacion por el retraso.
  INSERT INTO public.reservas (mueble_id, tipo, estado, fecha_inicio, fecha_fin, fin_ocupacion, dias_margen, entregada_en, hora_entrega, hora_recogida)
  VALUES (m2, 'alquiler', 'en_curso', '2031-10-01', '2031-10-10', '2031-10-10', 2, '2031-10-01 09:00+00', '10:00', '10:00')
  RETURNING id INTO r;
  UPDATE public.reservas SET fin_ocupacion = '2031-10-20' WHERE id = r;
  UPDATE public.reservas SET estado = 'devuelta', devuelta_en = '2031-10-26 23:30+00' WHERE id = r;
  SELECT fin_ocupacion INTO fin FROM public.reservas WHERE id = r;
  IF fin <> '2031-10-27' THEN
    RAISE EXCEPTION 'FALLO 8c: devolución tardía, fin_ocupacion %', fin;
  END IF;

  --    d) Una devuelta no deja cambiar fin_ocupacion a mano: el disparador lo vuelve a poner.
  UPDATE public.reservas SET fin_ocupacion = '2031-12-31' WHERE id = r;
  SELECT fin_ocupacion INTO fin FROM public.reservas WHERE id = r;
  IF fin <> '2031-10-27' THEN
    RAISE EXCEPTION 'FALLO 8d: una devuelta quedó con fin_ocupacion %', fin;
  END IF;

  --    e) Sin fecha de devolución no se puede marcar devuelta.
  BEGIN
    UPDATE public.reservas SET estado = 'devuelta', devuelta_en = NULL WHERE id = r;
    RAISE EXCEPTION 'FALLO 8e: se marcó devuelta sin fecha de devolución';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  ---------------------------------------------------------------------------------------------------
  -- 9. updated_at se actualiza solo, y la tabla tiene RLS activada.
  SELECT updated_at INTO antes FROM public.reservas WHERE id = r;
  -- now() no cambia dentro de una transacción: se fuerza un valor viejo y se comprueba que lo pisa.
  UPDATE public.reservas SET updated_at = '2000-01-01', motivo = 'prueba' WHERE id = r;
  SELECT updated_at INTO despues FROM public.reservas WHERE id = r;
  IF despues <> antes THEN
    RAISE EXCEPTION 'FALLO 9a: updated_at quedó en % (esperado %)', despues, antes;
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.reservas'::regclass) THEN
    RAISE EXCEPTION 'FALLO 9b: la tabla reservas no tiene RLS activada';
  END IF;

  RAISE EXCEPTION 'PRUEBA SUPERADA: todo correcto; este error deshace la prueba sin dejar rastro';
END;
$$;
