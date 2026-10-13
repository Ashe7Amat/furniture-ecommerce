-- ADVERTENCIA: borra la tabla de enlaces y las tres columnas de clientes, y con ellas qué cuentas han
-- confirmado su email y los cambios de email pendientes. Antes hay que retirar el código de H18: con las
-- columnas borradas, renovar la sesión (/api/auth/refresh), "Mis pedidos" y confirmar el email darían
-- error 500, porque leen email_verificado y email_pendiente por su nombre. Mientras ese código no esté en
-- producción, revertir no afecta a la web. Para corregir hacia delante, mejor otra migración que cambie
-- lo necesario.
DROP TABLE public.verificaciones_email;
ALTER TABLE public.clientes
  DROP COLUMN email_pendiente,
  DROP COLUMN email_verificado_en,
  DROP COLUMN email_verificado;