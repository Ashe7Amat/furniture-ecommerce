-- ADVERTENCIA: borra la tabla y con ella TODOS los refresh tokens emitidos. Mientras C2 (el código del
-- servidor que la usa) no esté desplegado, está vacía y no tiene efecto. Después de C2, obliga a todo el
-- mundo a volver a iniciar sesión cuando caduque su access token (1 h), y antes hay que retirar ese código:
-- con la tabla borrada, /api/auth/refresh y /api/auth/logout fallarían.
DROP TABLE public.refresh_tokens;
