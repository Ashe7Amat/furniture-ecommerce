# Verificación del bloque 3b (sesiones con refresh token)

Guía para comprobar a mano el bloque 3b antes de mergearlo a `main`: el secreto nuevo, las pruebas en el
navegador, la limpieza de la base de datos, y qué mirar después del despliegue. El diseño está en
`docs/tarea3-diseno.md` (sección 2), y el estado y las decisiones, en `docs/mejoras-tecnicas.md` ("Estado del
bloque 3b").

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
- **Si falta:** el servidor arranca igual, pero el inicio de sesión funciona sin refresh token (sesiones de
  1 hora), `/api/auth/refresh` y `/api/auth/logout` responden 503, y queda un error en el log. Detalle en
  `docs/env-vars.md`.
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

**Lo que no cubre esta guía:** la comprobación de concurrencia contra la base de datos real (dos renovaciones
simultáneas con el mismo token, sección 2 del diseño). Necesita un permiso aparte y se hará por separado. Los
tests ya la cubren con un doble de la base de datos (`refreshTokens.test.js`).

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
- **H22 (CSP de Google):** en `/login`, la consola del navegador no debería tener ningún aviso de
  Content-Security-Policy sobre `accounts.google.com/gsi/style`. Solo se puede ver en producción, porque la CSP
  la pone Vercel.
- **Las sesiones abiertas antes del despliegue** (con el token antiguo de 7 días, `kaveToken`) siguen valiendo
  hasta que caduquen, y después se pide iniciar sesión otra vez. Es lo esperado (decisión 8 de C2/C3).

## 5. Cómo reabrir H20 si un pedido real llega sin `cliente_id`

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
