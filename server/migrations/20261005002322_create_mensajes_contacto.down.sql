-- ADVERTENCIA: borra la tabla y con ella TODOS los mensajes del formulario de contacto guardados. Los
-- correos ya enviados no se pierden, pero los mensajes cuyo correo falló solo estaban aquí. Antes hay
-- que retirar el código que la usa: con la tabla borrada, el panel "Mensajes" daría error (el
-- formulario de contacto seguiría funcionando, porque si no puede guardar el mensaje sigue con el correo).
DROP TABLE public.mensajes_contacto;