# Verificación antes del merge: bloque 3b, panel y límites

Guía para comprobar a mano la rama antes de mergearla a `main`, y después del despliegue:
- el bloque 3b: el secreto nuevo, las pruebas en el navegador y la limpieza de la base de datos;
- el panel con sesión (sección 5);
- los límites de peticiones de H28 y H29 en producción (sección 6).

El resumen, con los tiempos, está en el README ("Cómo verificar antes del merge"). El diseño está en
`docs/tarea3-diseno.md` (sección 2), y el estado y las decisiones, en `docs/mejoras-tecnicas.md` ("Estado del
bloque 3b").

**Qué se ha comprobado de esta guía (29 sep 2026):**
- **las consultas SQL**, contra la base de datos real:
  - las de solo lectura, ejecutándolas con un email que no existe (y la de H20 tal cual: sale vacía);
  - las dos escrituras (el `DELETE` de la limpieza y la corrección de H20), solo con `EXPLAIN` sin `ANALYZE`,
    que enseña el plan sin ejecutar nada;
- **cada paso contra el código**, con una revisión aparte (claves de `localStorage`, rutas, códigos de estado,
  textos y qué dispara cada petición).

**Lo que no se ha podido probar desde aquí:** los pasos en el navegador (secciones 2 y 5) y los de producción
(secciones 4 y 6). Necesitan el secreto, que pone el usuario, una cuenta real con la que iniciar sesión y el
despliegue. Las secciones 5 y 6 se revisaron contra el código el 29 sep: rutas, textos, orden de las pestañas, y
que en `crear-sesion-pago` una pieza que no existe se rechaza antes de llamar a Stripe.

**Resumen de lo que cambia:** el access token dura 1 hora y vive solo en memoria. El refresh token dura 7 días,
se guarda en `localStorage` (`kaveRefreshToken`) y rota en cada uso. En la tabla `refresh_tokens` solo queda su
HMAC, nunca el token.

## 1. El secreto `REFRESH_TOKEN_HASH_SECRET`

- **Generarlo**, uno distinto para local y para producción. Desde Git Bash:
  ```bash
  openssl rand -hex 32
  ```
  O, si no hay `openssl`:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
  Salen 64 caracteres hexadecimales. No se pega en ningún chat, issue ni commit.
- **En local:** en `server/.env` (que no se sube al repositorio), una línea
  `REFRESH_TOKEN_HASH_SECRET=<el valor>`, y se reinicia el servidor.
- **En producción:** Vercel, proyecto **`nave5-api`**, Settings, Environment Variables:
  - clave `REFRESH_TOKEN_HASH_SECRET`, con el valor de producción;
  - entorno **Production**. Si se usan despliegues de vista previa del servidor, también Preview, con otro
    valor;
  - marcarla como *Sensitive*.

  **Tiene que estar antes del despliegue del bloque 3b.** Vercel solo aplica una variable nueva a los despliegues
  que se hagan después, y el merge a `main` crea uno.
- **Si falta:** el servidor arranca igual, pero:
  - el inicio de sesión funciona sin refresh token. La sesión dura como mucho 1 hora, y **se pierde al recargar
    la página o al abrir otra pestaña**, porque el access token solo vive en la memoria de esa pestaña;
  - `/api/auth/refresh` y `/api/auth/logout` responden 503;
  - queda un error en el log. Detalle en `docs/env-vars.md`.
- **Cambiarlo más adelante** cierra todas las sesiones a la vez. Es la medida de emergencia si se sospecha que se
  ha filtrado.

## 2. Comprobación en el navegador (en local)

**Ojo: el servidor local usa la base de datos de producción** (la de `server/.env`). Las filas que se creen en
`refresh_tokens` son reales, y se borran al final (sección 3).

**Preparación:**
1. `REFRESH_TOKEN_HASH_SECRET` en `server/.env` (sección 1).
2. Arrancar los dos:
   ```bash
   cd server && npm run dev
   ```
   ```bash
   cd client && npm run dev
   ```
3. Abrir `http://localhost:5173` con las herramientas de desarrollo del navegador (F12), pestañas **Red** y
   **Aplicación → Almacenamiento local**.

**Consulta para seguir las filas** (solo lectura), en el SQL Editor de Supabase, con el email de la cuenta de
prueba:
```sql
SELECT id, family_id, created_at, expires_at, revoked_at, replaced_by
FROM refresh_tokens
WHERE user_id = (SELECT id FROM clientes WHERE lower(email) = lower('<email de la cuenta>'))
ORDER BY created_at;
```

**Pasos:**

1. **Iniciar sesión** con email y contraseña.
   - En el almacenamiento local aparece `kaveRefreshToken`, y ya no hay `kaveToken`.
   - La consulta da **1 fila**, con `revoked_at` vacío.
   - En la tabla no está el token, solo su HMAC. Esta consulta tiene que dar 0:
     ```sql
     SELECT count(*) FROM refresh_tokens WHERE token_hash = '<valor de kaveRefreshToken>';
     ```
2. **Recargar la página (F5): la sesión sigue abierta sin pedir la contraseña.**
   - En Red sale un `POST /api/auth/refresh` con respuesta 200.
   - `kaveRefreshToken` ha cambiado de valor.
   - La consulta da **2 filas con el mismo `family_id`**. La primera tiene `revoked_at` y `replaced_by` (el id de la
     segunda); la segunda sigue activa. Cada recarga añade una fila más a la familia.
3. **Un 401 simulado, que tiene que arreglarse solo.** El access token dura 1 hora. Para no esperar:
   1. con la sesión abierta, entrar en **Mi cuenta** y quedarse en **Mis Datos**;
   2. en `server/.env`, cambiar `JWT_SECRET` por otro valor cualquiera y reiniciar el servidor. El access token
      que tiene el navegador deja de valer, pero el refresh token no, porque depende del otro secreto;
   3. **sin recargar la página**, pulsar **Historial de Pedidos**, que es lo que pide los pedidos al servidor
      (`GET /api/pedidos/mios`, con sesión);
   4. en Red tiene que salir, en este orden: `GET /api/pedidos/mios` con **401**, un `POST /api/auth/refresh`
      con **200**, y el mismo `GET /api/pedidos/mios` repetido con **200**. La lista sale sin pedir nada.
   5. **Volver a poner el `JWT_SECRET` de antes** en `server/.env` y reiniciar.
4. **Cerrar sesión.**
   - En Red sale un `POST /api/auth/logout` con 200.
   - `kaveRefreshToken` desaparece del almacenamiento local.
   - En la consulta, **todas las filas de esa familia tienen `revoked_at`**.
5. **Opcional: el estado "reconectando".** Con la sesión abierta y en Mi cuenta (una ruta protegida; las
   páginas públicas no esperan a la sesión), parar el servidor y recargar.
   Tiene que salir el aviso de reconexión con "Reintentar" y "Cerrar sesión", **sin cerrar la sesión**.
   Arrancar el servidor y pulsar "Reintentar": la sesión vuelve.
6. **Opcional: detección de reuso.** Copiar el valor de `kaveRefreshToken`, recargar (rota) y **esperar más de
   60 segundos**, que es el margen de gracia. Después, presentar el token viejo:
   ```bash
   curl -X POST http://localhost:5000/api/auth/refresh -H "Content-Type: application/json" -d "{\"refreshToken\":\"<token viejo>\"}"
   ```
   Tiene que responder 401 (`Sesión no válida, vuelve a iniciar sesión.`), y en la consulta **todas las filas de
   la familia quedan revocadas**, incluida la activa. Al recargar el navegador, la sesión se cierra: es lo que
   pasaría si alguien hubiera robado el token.

**La comprobación de concurrencia contra la base de datos real** (dos renovaciones simultáneas con el mismo
token, sección 2 del diseño) ya está hecha: el 29 sep, con permiso, con resultado correcto y sin dejar filas.
Detalle en `docs/mejoras-tecnicas.md` ("Comprobación de concurrencia contra la base de datos real"). No hace
falta repetirla aquí.

## 3. Limpieza de `refresh_tokens` después de la comprobación

Borra las filas de la cuenta de prueba. También cierra sus sesiones en cualquier otro navegador, que tendrá que
volver a iniciar sesión.

1. **Mirar antes qué se va a borrar:**
   ```sql
   SELECT count(*) FROM refresh_tokens
   WHERE user_id = (SELECT id FROM clientes WHERE lower(email) = lower('<email de la cuenta>'));
   ```
2. **Borrar:**
   ```sql
   DELETE FROM refresh_tokens
   WHERE user_id = (SELECT id FROM clientes WHERE lower(email) = lower('<email de la cuenta>'));
   ```
3. **Comprobar:** la consulta del paso 1 tiene que dar 0.

Más adelante, para el mantenimiento normal (filas caducadas hace más de 30 días), está la consulta de
"Mantenimiento de `refresh_tokens`" en `docs/mejoras-tecnicas.md`.

## 4. Después del despliegue a producción

- **Iniciar sesión en la web publicada y recargar:** la sesión sigue abierta. La consulta de la sección 2, con
  tu email, enseña las filas de producción.
- **Fotos de móvil (H24), ahora sí con el límite de Vercel:** crear en el panel publicado un mueble de prueba con
  3 fotos del móvil (juntas pasarían de 4,5 MB). Tiene que guardarse bien. Después se borra.
- **Las sesiones abiertas antes del despliegue** (con el token antiguo de 7 días, `kaveToken`) siguen valiendo
  hasta que caduquen, y después se pide iniciar sesión otra vez. Es lo esperado (decisión 8 de C2/C3).

### 4.1. H22: `/login` sin avisos de CSP

La CSP la pone Vercel (`client/vercel.json`), así que solo se puede comprobar en la web desplegada, no en local.
Hoy va en modo *report-only*: el navegador avisa en la consola, pero no bloquea nada.

1. **Que el despliegue lleva la CSP nueva:** en la web de producción (`https://nave5-demo.vercel.app`, o el
   dominio propio si lo hay), herramientas de desarrollo (F12), pestaña **Red**. Se recarga `/login`, se abre la
   petición del documento y, en sus cabeceras de respuesta, `Content-Security-Policy-Report-Only` tiene que
   incluir `https://accounts.google.com/gsi/style` dentro de `style-src`. Si no está, el despliegue no es el
   de esta rama.
2. **Que no queda ningún aviso:** pestaña **Consola**, se recarga `/login` y se escribe `Content-Security` en el
   filtro. No debe salir ningún aviso. Antes del arreglo salía uno que decía que cargar la hoja de estilos
   `https://accounts.google.com/gsi/style` viola `style-src`.
3. **Que el botón de Google se ve bien:** "Continuar con Google" sale con su estilo (borde, logo y texto
   alineados), no como un enlace sin formato.

**Si aparece un aviso de CSP en `/login`:**
- anotarlo en `docs/mejoras-tecnicas.md` como **H22b**, debajo de H22, con:
  - el texto exacto del aviso, copiado de la consola;
  - la directiva que se viola (`style-src`, `script-src`, `frame-src`, `connect-src`...);
  - la URL bloqueada;
  - la fecha y el navegador;
- no pasar la CSP a modo bloqueante (quitar el `-Report-Only`) hasta que H22b esté resuelto: con la política
  aplicada de verdad, eso que avisa dejaría de cargar.

Si el aviso es de otra página (no de `/login`) o de otro origen distinto de Google, también se anota, pero como
hallazgo nuevo, no como H22b.

## 5. El panel con sesión (en local, con la cuenta de administrador)

Con los dos servidores arrancados, como en la sección 2, se inicia sesión con la cuenta de administrador y se
abre `http://localhost:5173/admin`. **El servidor local usa la base de datos de producción:** lo que se cree aquí
(una categoría o un mueble de prueba) es real. Se borra al final, desde el propio panel.

1. **El orden del panel.**
   - Abre en **Resumen** ("Dashboard"), con seis tarjetas en este orden: productos totales, disponibles,
     vendidos, alquilados, valor en stock y pedidos por procesar. Si hay piezas sin foto o sin categoría, salen
     sus avisos, y debajo, "Avisos / Últimas Ventas".
   - La barra lateral, de arriba abajo: Resumen, Añadir Mueble, Gestionar Inventario, Pedidos (con la insignia
     de pendientes, si los hay) y Gestionar Categorías. La pestaña abierta es la única marcada.
2. **Las estadísticas de las categorías (H26).**
   - En **Gestionar Categorías**, cada tarjeta enseña "Productos totales", "Stock: ... disponibles · ...
     vendidos · ... alquilados" y "Valor del catálogo", no "Cargando analíticas...". En **Red** sale
     `GET /api/admin/categorias/con-stats` con 200.
   - En la web pública (la portada, sin el panel), la respuesta de `GET /api/categorias` ya no trae `stats`.
3. **Cada formulario, su propio estado (H14).**
   - En Gestionar Categorías, se crea una categoría de prueba con un **doble clic** rápido en "Crear Categoría".
     Tiene que crearse **una sola**, y el botón se desactiva mientras se crea.
   - El mensaje de progreso sale junto a su formulario, y no en otra pestaña.
   - Al terminar, se borra la categoría de prueba.
4. **Fotos de móvil (H24).**
   - En **Añadir Mueble**, se crea un mueble de prueba con **2 o 3 fotos hechas con el móvil**, a poder ser
     alguna en vertical.
   - Mientras guarda, el mensaje dice "Optimizando imágenes... 1/3", "2/3" y "3/3", y después "Guardando
     producto...".
   - En **Red**, la petición `POST /api/muebles` pesa bastante menos de 4,5 MB (columna de tamaño).
   - En el catálogo, las fotos salen bien orientadas: la vertical, en vertical.
   - En local no hay límite de 4,5 MB (ese lo pone Vercel), así que la prueba de verdad es la de la sección 4,
     después del despliegue.
   - Al terminar, se borra el mueble de prueba desde Gestionar Inventario.
5. **La cesta, pieza única (H25).** En el catálogo, se abre la vista rápida de una pieza disponible y se pulsa
   dos veces "Añadir a la cesta". La
   segunda vez tiene que salir "Lo sentimos, esta es una pieza única restaurada y solo hay 1 unidad
   disponible.", y no "Producto añadido a la cesta.". En la cesta, el "+" de una línea da el mismo aviso.
6. **"Panel Admin" en el pie de página (H30):** sin sesión no sale, con sesión de cliente tampoco, y con la del
   administrador, sí.

## 6. Los límites de H28 y H29, en producción (después del despliegue)

Cada instancia de Vercel lleva su propia cuenta (H4). Con poco tráfico suele haber una sola, así que los
números salen exactos. Si alguno tarda un poco más en saltar, es eso, no un fallo.

**H28, intentos de cambiar la contraseña.** Se hace con una cuenta de cliente de prueba, **no con la del
administrador**, porque la deja 15 minutos sin poder cambiar la contraseña.
1. En la web publicada, con esa cuenta: Mi cuenta, Mis Datos. Se escribe una contraseña actual **incorrecta**,
   una nueva y su confirmación, y se pulsa "Guardar cambios" **11 veces**.
2. Las 10 primeras dicen "La contraseña actual es incorrecta.". La 11 dice "Demasiados intentos con una
   contraseña incorrecta. Espera 15 minutos antes de volver a intentarlo.".
3. Con la contraseña **buena**, también sale ese aviso, hasta que pasen 15 minutos. Después, funciona.
4. En los logs de `nave5-api` en Vercel quedan 10 líneas "perfil-update: contraseña actual incorrecta (cuenta
   ...)" y una "límite de intentos alcanzado", con el id de la cuenta y sin la contraseña.

**H29, sesiones de pago.** Se comprueba **sin crear ninguna sesión en Stripe**: las peticiones mal formadas, o las
de una pieza que no existe, se rechazan con 400 antes de llegar a Stripe, pero cuentan para el límite. Desde Git
Bash, y desde una red desde la que no se vaya a comprar en los próximos 15 minutos (la IP queda bloqueada ese
rato):
1. **Por email** (10 cada 15 min): la misma dirección inventada, con una pieza que no existe, 11 veces.
   ```bash
   for i in $(seq 1 11); do curl -s -o /dev/null -w "%{http_code} " -X POST https://nave5-api.vercel.app/api/muebles/crear-sesion-pago -H "Content-Type: application/json" -d '{"items":[{"productId":"00000000-0000-4000-8000-000000000000"}],"clienteInfo":{"email":"prueba-limite@example.com"}}'; done; echo
   ```
   Tienen que salir diez `400` y un `429`.
2. **Por IP** (20 cada 15 min): esas 11 ya cuentan, así que faltan 9 para llegar a 20.
   ```bash
   for i in $(seq 1 10); do curl -s -o /dev/null -w "%{http_code} " -X POST https://nave5-api.vercel.app/api/muebles/crear-sesion-pago -H "Content-Type: application/json" -d '{"items":[]}'; done; echo
   ```
   Tienen que salir nueve `400` y un `429`.
3. **En el Dashboard de Stripe no ha aparecido ninguna sesión nueva.**

**H27:** en Vercel, `nave5-api`, Settings, Environment Variables, `RESEND_API_KEY` tiene que estar puesta en
Production. Sin ella los clientes no reciben ningún correo, aunque ya no se escriban sus datos en el log.

## 7. Cómo reabrir H20 si un pedido real llega sin `cliente_id`

H20 es la deuda aceptada de que el código que rellena `pedidos.cliente_id` no se ha visto funcionar con un
pedido real. **Después de cada pedido real**, o de vez en cuando, lanzar esta consulta (solo lectura):
```sql
SELECT id, created_at FROM pedidos
WHERE created_at > '2026-09-24T20:08:03Z' AND cliente_id IS NULL
  AND lower(cliente_info->>'email') IN (SELECT lower(email) FROM clientes);
```
**Tiene que salir vacía.** Si sale algún pedido:
1. **Anotar** el id y la fecha del pedido, y el email del comprador tal y como está en `cliente_info`.
2. **Mirar si ese email es de una sola cuenta.** Si coincide con dos cuentas que solo cambian en mayúsculas, el
   `NULL` es correcto (es ambiguo a propósito), y no hay que reabrir nada.
3. **Buscar en los logs de `nave5-api` en Vercel**, a la hora del pedido, el mensaje `No se pudo buscar la
   cuenta del comprador`. Si está, falló la consulta, y el error dice por qué.
4. **Reabrir H20** en `docs/mejoras-tecnicas.md`: cambiar su estado a REABIERTO, con la fecha, el id del pedido y
   lo que se haya visto en los pasos 2 y 3.
5. **El pedido se puede corregir a mano** con la misma condición que se usó en B3
   (`server/migrations/20260926192617_backfill_pedidos_cliente_id.sql`), añadiendo `AND p.id = '<id del
   pedido>'` para no tocar nada más. Es una escritura en producción: la hace el usuario, no un asistente.
