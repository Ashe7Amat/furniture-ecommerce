-- ADVERTENCIA: deja sin verificar TODAS las cuentas de administrador, también una que hubiera confirmado
-- su email después por su cuenta (con el enlace o entrando con Google), y sin la marca un administrador
-- que entre con Google pierde su contraseña (punto 8 de la parte 6 de docs/verificacion-email-diseno.md).
-- No hace falta para volver atrás el código de H18: el de antes no lee estas columnas. Para corregir una
-- cuenta concreta, mejor otra migración con su id.
UPDATE clientes SET email_verificado = false, email_verificado_en = NULL WHERE rol = 'admin';
