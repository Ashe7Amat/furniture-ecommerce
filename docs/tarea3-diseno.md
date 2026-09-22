# Tarea 3 — Diseño (aprobado 22 sep 2026)

Diseño de la tarea 3 (migraciones SQL + JWT con refresh y rotación), revisado en dos rondas y aprobado con
los cambios que aparecen marcados inline como "*(corrección/añadido/renombrada tras revisión...)*". Se
guarda en el repo, no solo en el historial de la conversación, para que dentro de meses la respuesta a
"¿por qué esta columna se llama así?" o "¿por qué este orden de commits?" esté aquí. Se actualizará al
cerrar el bloque 3a y otra vez al cerrar el 3b (ver Sección 3).

Estado real de la BD comprobado en su momento (solo lectura, proyecto `gdrmpxcpucmaxvtpljge`), no supuesto:
columnas/tipos de las 4 tablas, constraints, índices, triggers, funciones, políticas RLS e historial de
migraciones ya aplicadas (7, vía la herramienta nativa de Supabase, desde `enable_rls_public_read_only`
hasta `move_http_extension_out_of_public`).

## 0. Dos cosas que ya estaban resueltas (y una que no se sabía)

- **`disponible`/`estado` ya están unificados.** Migración `sync_disponible_from_estado_trigger` (3 sep):
  `BEFORE INSERT OR UPDATE ON muebles EXECUTE FUNCTION sync_disponible_desde_estado()`, que hace
  `NEW.disponible := (COALESCE(NEW.estado, 'disponible') = 'disponible')`. `disponible` ya es una columna
  derivada, no independiente. No hace falta ninguna migración nueva para esto.
- **`pedidos.stripe_session_id` ya tiene índice único.** `pedidos_stripe_session_id_key`, `UNIQUE (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL`. También ya existe.
- **Hallazgo nuevo, no pedido:** la política RLS `"Admins pueden ver todos los pedidos"` en `pedidos` tiene
  `roles: {public}` y `qual: true` — es decir, con la clave `anon` cualquiera podría leer todos los pedidos
  (nombre, email, teléfono, dirección) vía la API REST de Supabase. Hoy no es explotable porque nada del
  código usa la `anon` key para leer `pedidos` (el servidor siempre usa `service_role`), pero la política
  está mal etiquetada: dice "Admins" y no comprueba nada de admin. Lo llamo **H9**.

  *(Ampliación tras tu confirmación de que H9 entra en la tarea 3: comprobé cuál de las 7 migraciones
  trackeadas la creó, leyendo el SQL real de cada una en `supabase_migrations.schema_migrations`.
  Ninguna la creó. `enable_rls_public_read_only` (3 sep, la primera) solo activa RLS y crea políticas en
  `muebles`, `categorias` y `clientes` — no toca `pedidos` en absoluto. Las únicas otras dos políticas que
  ha tenido `pedidos` (`"Usuarios pueden ver sus propios pedidos"` y `"Usuarios pueden crear sus propios
  pedidos"`, ambas comparando `auth.uid() = user_id`) se crearon y se borraron fuera de ese historial
  también: la migración `cleanup_pedidos_phantom_columns_and_indexes` (5 sep) las borra, pero no hay
  ninguna migración anterior que las cree. Conclusión: activar RLS en `pedidos` y crear estas políticas se
  hizo a mano, probablemente desde el panel de Supabase, antes de que el proyecto empezara a trackear todo
  con `apply_migration`. Con esto, tu pregunta "¿la creó una migración previa?" tiene respuesta: no — así
  que, como tú mismo planteabas para ese caso, la corrección es una migración nueva de todas formas (ver
  más abajo, Extra — H9), y de paso deja esa política bajo control de versiones por primera vez.)*

  *(Nota relacionada, no pedida: al leer el SQL de `cleanup_pedidos_phantom_columns_and_indexes` para lo
  anterior, veo que `pedidos` **ya tuvo una columna `user_id`** antes, y se borró hace justo 2-3 semanas
  (5 sep) por considerarse "vestigio de un diseño anterior basado en Supabase Auth que el proyecto ya no
  usa" — nunca se rellenaba porque las políticas que dependían de ella comparaban `auth.uid()`, que nunca
  coincide (el servidor usa `service_role`, no sesiones de Supabase Auth). La Migración B de este mismo
  documento (más abajo) reintroduce la misma relación con `clientes`, pero **con el nombre `cliente_id`, no
  `user_id`**, decisión tuya tras ver este hallazgo: describe mejor la relación real (FK a `clientes`, no a
  ningún concepto de "usuario" de auth), no choca visualmente con el historial de migraciones, y el código
  que la use (`pedido.cliente_id`) es más legible que `pedido.user_id`, que obligaría a recordar que aquí
  "user" significa "cliente". Sin coste: la columna todavía no existe, no hay código que la referencie
  todavía.)*

## 1. Migraciones

### Herramienta: la misma que ya usa el proyecto

El proyecto ya tiene 7 migraciones aplicadas por la propia herramienta de Supabase (`apply_migration`,
con historial en `list_migrations`). No hay ninguna herramienta externa (node-pg-migrate/umzug/knex) en
juego. Seguir con node-pg-migrate u otra cosa fragmentaría el historial en dos sistemas que no se hablan
entre sí.

**Decisión:** seguir usando `apply_migration` (yo la ejecuto, y solo cuando tú lo autorices explícitamente,
migración por migración), y además guardar cada SQL en `server/migrations/<mismo-nombre-y-timestamp>.sql`
en el repo. Así se cumple lo que pediste (archivos versionados en `server/migrations/`, revisables en el
diff) sin inventar un segundo mecanismo de tracking que compita con el que ya usa Supabase.

**Rollback por migración:** cada `NNN_nombre.sql` va acompañado de `NNN_nombre.down.sql` con el SQL de
reversión, escrito a mano (no hay reversión automática en `apply_migration`). Se aplica solo si hace falta,
con el mismo permiso explícito.

**`CREATE INDEX CONCURRENTLY`: probado contra la base real, NO se puede usar con `apply_migration`.**
*(Confirmado, no ya una previsión: antes de aplicar A1/A2 se probó exactamente esto contra la base real, con
una tabla desechable (`_test_probe_h8`, creada, probada y borrada en el mismo turno, sin dejar rastro ni en
el esquema ni en `list_migrations` — la transacción fallida deshizo también su propio registro de historial).
`apply_migration` SÍ envuelve el SQL en una transacción implícita, y Postgres rechazó `CREATE INDEX
CONCURRENTLY` con exactamente el error esperado: `ERROR: 25001: CREATE INDEX CONCURRENTLY cannot run inside
a transaction block`.)*

**Decisión (Plan B del propio diseño):** en `muebles` y `pedidos` (114 y unas pocas filas respectivamente),
un `CREATE INDEX` normal sin `CONCURRENTLY` tarda milisegundos y su lock de escritura es imperceptible —
`CONCURRENTLY` está pensado para tablas de millones de filas, donde ese lock duraría minutos; aquí sería
sobre-ingeniería que además no se puede aplicar con la herramienta que ya usa el proyecto. Todos los índices
de esta tarea (A2, B2) se crean con `CREATE INDEX` normal, dentro del mismo archivo de migración si se quiere
(ya no hace falta aislarlos en uno propio por la restricción de `CONCURRENTLY`, aunque se mantienen separados
por claridad). **Si `muebles` o `pedidos` llegaran a crecer a decenas de miles de filas**, este punto hay que
revisarlo: la alternativa entonces sería ejecutar el `CREATE INDEX CONCURRENTLY` a mano desde el SQL Editor
de Supabase (que sí ejecuta fuera de una transacción), no con `apply_migration`. Documentado también en
`docs/mejoras-tecnicas.md`.

### Migración A — `muebles.categoria_id` (FK a `categorias`)

Comprobado: las 114 filas de `muebles.categoria` (texto) coinciden todas con un `categorias.nombre` — cero
huérfanos, el backfill será limpio.

1. **`A1_add_muebles_categoria_id.sql`** (DDL): `ALTER TABLE muebles ADD COLUMN categoria_id integer NULL
   REFERENCES categorias(id) ON DELETE SET NULL;` — nullable, sin tocar código todavía. Reversión: `ALTER
   TABLE muebles DROP COLUMN categoria_id;`
2. **`A2_index_muebles_categoria_id.sql`**: `CREATE INDEX idx_muebles_categoria_id ON muebles(categoria_id);`
   *(sin `CONCURRENTLY` — ver arriba: probado y confirmado que `apply_migration` no lo admite; con 114 filas
   el lock es imperceptible)*. Reversión: `DROP INDEX idx_muebles_categoria_id;`
3. **Commit de código (no DB):** `mueblesController.js`/`categoriasController.js` escriben `categoria_id`
   además de `categoria` (doble escritura) en crear/editar; siguen leyendo `categoria` en todos los sitios
   que ya la leen. `Admin.jsx` ya conoce el `id` de cada categoría (el selector jerárquico se alimenta de
   `getCategorias()`), así que puede empezar a mandar `categoria_id` sin cambios grandes en la UI.

   *(Corrección tras tu revisión: en la versión anterior de este documento el backfill (A3) aparecía como
   paso 3, ANTES de este commit de código como paso 4 — el mismo orden equivocado que señalaste para la
   migración B, solo que aquí nadie lo había visto todavía. Reordenado para que el código de doble
   escritura quede desplegado antes del backfill, igual que en B.)*
4. **Pausa explícita de despliegue** *(añadida tras tu petición — no basta con el orden de los commits,
   hace falta comprobar que el código de verdad está desplegado antes de tocar la BD)*:
   - Push del commit 3 a `main` (el único paso de esta tarea que sí toca `main`, porque es lo que dispara
     el deploy de Vercel — la propia rama `feature/mejoras-tecnicas` no despliega nada).
   - Verificar en el panel de Vercel que el deploy de ese commit terminó en estado "Ready" en producción.
   - Esperar 24-48h en producción (para que cualquier mueble creado o editado en ese margen ya escriba
     `categoria_id`).
   - Confirmar con un `SELECT count(*) FROM muebles WHERE categoria_id IS NOT NULL AND created_at > <fecha
     del deploy>` (o `updated_at`, si existe) que los muebles tocados en esa ventana ya tienen
     `categoria_id` relleno — no solo confiar en que "el código ya está", comprobarlo con datos.
   - Solo entonces, pedir permiso para aplicar A3.
5. **`A3_backfill_muebles_categoria_id.sql`** (datos, no DDL), aplicado después de la pausa anterior:
   `UPDATE muebles m SET categoria_id = c.id FROM categorias c WHERE c.nombre = m.categoria AND
   m.categoria_id IS NULL;` A este volumen (114 filas) es una sola instrucción; si el catálogo creciera a
   decenas de miles convendría hacerlo por lotes (`WHERE id IN (SELECT id ... LIMIT 500)` en bucle) para no
   mantener un lock de fila largo — lo anoto, no lo implemento porque no hace falta a este tamaño.
6. **Periodo de convivencia:** ambas columnas activas. Antes de cerrar, vuelvo a correr el `SELECT`
   de huérfanos (por si algo se creó mientras tanto sin `categoria_id`) y repito el backfill si hiciera
   falta.
7. **`A4_muebles_categoria_id_not_null.sql`** (más adelante, tras verificar en producción que el doble
   escritura funciona): `ALTER TABLE muebles ALTER COLUMN categoria_id SET NOT NULL;` A 114 filas es
   instantáneo; en una tabla grande se evitaría el escaneo completo con
   `ADD CONSTRAINT ... CHECK (categoria_id IS NOT NULL) NOT VALID` + `VALIDATE CONSTRAINT` por separado. Lo
   documento como técnica general aunque aquí no haga falta.
8. **`A5_drop_muebles_categoria.sql`** (al final, solo cuando el código ya no lea/escriba `categoria` en
   ningún sitio — verificado con `grep`): `ALTER TABLE muebles DROP COLUMN categoria;`

### `disponible`/`estado`: sin migración SQL nueva

Ya resuelto por el trigger de septiembre. Lo único que propongo es un **commit de código** (sin tocar el
esquema): quitar de `mueblesController.js`/`utils/pagos.js` las líneas que fijan `disponible` a mano
(`disponible: false`, `disponible: true`, `disponible !== undefined ? disponible : true`), porque el
trigger ya lo recalcula siempre desde `estado` y escribirlo desde la app es puro código muerto que además
podría llegar a contradecir al trigger si algún día diverge. Test: confirmar contra la BD real (con permiso)
que insertar/actualizar sin mandar `disponible` da el `disponible` correcto según `estado`.

### Migración B — `pedidos.cliente_id`

*(Renombrada tras tu revisión: `user_id` → `cliente_id` en toda esta sección, en los commits y en los
tests — ver la nota de la Sección 0 sobre por qué.)*

1. **`B1_add_pedidos_cliente_id.sql`**: `ALTER TABLE pedidos ADD COLUMN cliente_id uuid NULL REFERENCES
   clientes(id) ON DELETE SET NULL;` Reversión: `DROP COLUMN cliente_id`.
2. **`B2_index_pedidos_cliente_id.sql`**: `CREATE INDEX idx_pedidos_cliente_id ON pedidos(cliente_id);`
   *(sin `CONCURRENTLY`, mismo motivo que A2: probado y confirmado que `apply_migration` no lo admite)*.
   Reversión: `DROP INDEX idx_pedidos_cliente_id;`
3. **Commit de código (ANTES del backfill, mismo orden que la migración A):**
   `procesarSesionPagada`/`registrarPedido` (`utils/pagos.js`) buscan si `clienteInfo.email` coincide con un
   `clientes.email` y rellenan `cliente_id` en el `INSERT` cuando hay coincidencia; si no, lo dejan `NULL`
   (invitado). `obtenerMisPedidos` **no se toca** en esta tarea: seguir funcionando por email es válido y
   cambiarlo es un refactor aparte, no pedido.

   *(Corrección tras revisión: la primera versión de este documento tenía el backfill (B3) como paso 3,
   ANTES de este commit de código, al revés que en la migración A —donde sí se hacía bien: código primero,
   backfill después—. Con el orden invertido, cualquier pedido creado en la ventana entre aplicar el
   backfill y desplegar el código se quedaría con `cliente_id NULL` para siempre sin que nadie lo notara.
   Con solo 3 pedidos en toda la tabla hoy el riesgo real es mínimo, pero el documento debe ser coherente
   con su propio criterio. Reordenado: el backfill pasa a ser el paso 5, después de este commit y de la
   pausa.)*
4. **Pausa explícita de despliegue**, igual que en la migración A *(añadida tras tu petición)*:
   - Push del commit anterior a `main`, verificar "Ready" en Vercel.
   - Esperar 24-48h en producción.
   - `SELECT count(*) FROM pedidos WHERE created_at > <fecha del deploy> AND cliente_id IS NULL AND
     lower(cliente_info->>'email') IN (SELECT lower(email) FROM clientes)` — esto tiene que dar 0: cualquier
     pedido nuevo de alguien con cuenta ya debe tener `cliente_id` relleno por el código del paso 3. Si da
     más de 0, el código tiene un bug y se corrige antes de tocar la BD, no después.
   - Solo entonces, pedir permiso para aplicar B3.
5. **`B3_backfill_pedidos_cliente_id.sql`** (datos, no DDL), aplicado después de la pausa anterior:
   `UPDATE pedidos p SET cliente_id = c.id FROM clientes c WHERE p.cliente_id IS NULL AND
   lower(p.cliente_info->>'email') = lower(c.email);` Mismo criterio de coincidencia que ya usa
   `obtenerMisPedidos` (por email), así que el backfill es consistente con el comportamiento actual. Los
   pedidos de invitado sin cuenta se quedan con `cliente_id NULL` a propósito: es un caso válido, no un
   error.

### Extra — H8 (validar `https://` en `SUPABASE_URL`)

No es una migración SQL, es el mismo archivo que ya tocó la tarea 2. `data/supabase.js`: cambiar
`!supabaseUrl.startsWith('http')` por `!supabaseUrl.startsWith('https://') && process.env.NODE_ENV ===
'production'` (exige `https://` **solo en producción**), con un mensaje de error que diga exactamente qué
se esperaba. Un test nuevo junto a `supabaseFailFast.test.js`. Un solo commit, aprovechando que ya tocamos
fail-fast en la tarea 2 — mismo sitio, misma lógica, como dijiste.

*(Corrección tras revisión: la primera versión de este párrafo comparaba contra `NODE_ENV === 'development'`,
copiando el borrador original de H8 en `mejoras-tecnicas.md`. Ese valor no se fija en ningún sitio del
proyecto —ni en `.env.example` ni en los scripts `start`/`dev`/`test`—, así que la excepción nunca se habría
activado y `http://` habría quedado bloqueado también en local, contradiciendo el propio propósito de la
excepción. El resto del código ya usa la convención `=== 'production'` / `!== 'production'` (`index.js:30`,
y esta misma comprobación en `supabase.js:37`); usarla aquí también hace que la excepción funcione de
verdad sin añadir ninguna variable de entorno nueva.)*

### Extra — H9 (política RLS de `pedidos` mal etiquetada)

*(Añadido tras tu confirmación de que H9 entra en esta tarea.)* Migración nueva (confirmado arriba en la
Sección 0: ninguna de las 7 migraciones trackeadas creó esta política, así que no hay una migración previa
que "corregir" — se documenta como alta nueva):

**`D1_fix_pedidos_admin_policy.sql`**:
```sql
-- Ya comprobado (solo lectura, para este documento): relrowsecurity = true en pedidos,
-- así que RLS ya está activo hoy. Este ENABLE es idempotente (no falla si ya lo está) y
-- deja la migración autocontenida: si algún día se recrea la tabla o se corre este SQL
-- contra otro entorno donde RLS no estuviera ya activo, no se queda sin esta protección.
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

DROP POLICY "Admins pueden ver todos los pedidos" ON public.pedidos;
-- Sin política de sustitución: pedidos contiene datos personales (nombre, email,
-- teléfono, dirección), igual que clientes hoy. Ninguna de las dos tablas necesita
-- política para anon/authenticated porque el servidor siempre las usa con
-- service_role, que se salta RLS. RLS sigue activo (fail-closed): cualquier acceso
-- con la clave anon a pedidos queda denegado por defecto, como ya pasa con clientes.
```
Reversión (`D1_fix_pedidos_admin_policy.down.sql`): recrear la política tal cual estaba —
`CREATE POLICY "Admins pueden ver todos los pedidos" ON public.pedidos FOR SELECT TO public USING (true);`
— documentada como "restaura el comportamiento anterior (inseguro)", para que quede claro que es un
rollback de emergencia, no una opción recomendada.

**Verificación pedida (antes/después con `pg_policies`):**
- **Antes** (ya hecho, solo lectura, para este documento): `SELECT schemaname, tablename, policyname,
  roles, cmd, qual FROM pg_policies WHERE tablename = 'pedidos';` → una sola fila, la política de arriba,
  `roles: {public}`, `qual: true`.
- **Uso real:** no hay ninguna llamada en el código (servidor ni cliente) que use `SUPABASE_ANON_KEY` para
  leer `pedidos` — el servidor siempre usa `service_role` (`server/src/data/supabase.js`), y el frontend no
  llama a Supabase directamente en ningún sitio, solo a la API propia. La única forma de explotar esta
  política sería alguien con la `anon key` (pública, está en `client/.env`) llamando directamente a la API
  REST de Supabase desde fuera de la app — no algo que la propia aplicación haga nunca.
- **Después** de aplicar D1 (en el momento de aplicarlo, no ahora): repetir el mismo `SELECT` a
  `pg_policies` y confirmar que ya no aparece ninguna fila para `pedidos`; confirmar con
  `pg_class.relrowsecurity` que RLS sigue activo (`true`); y probar con la `anon key` real (una llamada de
  un momento, sin guardar nada) que `GET /rest/v1/pedidos` devuelve `[]` o 401/403 en vez del listado.
- **Confirmar también que `service_role` sigue pudiendo leer `pedidos` con normalidad tras el cambio**
  *(añadido tras tu revisión, para no romper el panel de admin por accidente)* — `service_role` se salta
  RLS por definición, así que esto ya debería seguir funcionando sin tocar nada, pero lo compruebo con una
  llamada real de todas formas: `GET /api/pedidos` (el endpoint de admin) antes y después de aplicar D1,
  mismo resultado.
- Commit propio: `fix(db): corregir política RLS de pedidos (H9)` — con test de que `anon` no puede leer
  `pedidos` (igual que ya hay uno para `clientes`) y test de que `obtenerPedidos`/`GET /api/pedidos`
  (que usa `service_role`) sigue funcionando igual.

Va en el bloque 3a (ver Sección 3), no en el bloque de `refresh_tokens`: no tiene nada que ver con auth de
la app, es una corrección de RLS que puede entrar y verificarse independiente de todo lo del JWT.

## 2. JWT con refresh y rotación

### Esquema `refresh_tokens`

```sql
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
CREATE UNIQUE INDEX refresh_tokens_token_hash_key ON public.refresh_tokens(token_hash);
CREATE INDEX refresh_tokens_user_id_idx ON public.refresh_tokens(user_id);
CREATE INDEX refresh_tokens_family_id_idx ON public.refresh_tokens(family_id);
```

- `family_id`: agrupa toda la cadena de rotación de una misma sesión (se genera una vez, al primer login, y
  se copia sin cambiar en cada rotación posterior). Es la clave para detectar reuso: revocar por
  `family_id` tumba TODA la sesión, no solo el token concreto.
- `token_hash`: `HMAC-SHA256(REFRESH_TOKEN_HASH_SECRET, token)`, no bcrypt. El token en sí ya es aleatorio de
  alta entropía (256 bits, `crypto.randomBytes(32)`), así que no necesita un hash lento pensado para
  contraseñas de baja entropía —un `SHA-256` simple ya sería inviable de romper por fuerza bruta, con o sin
  HMAC, precisamente por esa entropía—. La razón real para usar HMAC con un secreto de servidor (nuevo,
  distinto de `JWT_SECRET`) es otra: si alguien consiguiera solo acceso de ESCRITURA a esta tabla (p. ej.
  una inyección SQL limitada a INSERT/UPDATE, sin llegar al código ni a las variables de entorno), con un
  hash simple podría calcular `sha256(token_que_él_elija)` e insertar una fila "válida" para un refresh
  token inventado por él mismo, sin necesitar robar ningún token real. Con HMAC, no puede calcular ese hash
  sin conocer también el secreto del servidor. *(Corrección tras revisión: la primera versión de este punto
  daba como razón la resistencia a fuerza bruta sobre una fuga de la tabla, que ya está cubierta por la
  entropía del token en sí, con o sin HMAC — la decisión de usar HMAC seguía siendo la correcta, pero por
  esta otra razón.)*
- `user_agent`/`ip`: opcionales, solo para que el admin pueda ver "sesiones activas" si algún día se
  construye esa pantalla. No se usan para ninguna decisión de seguridad en esta tarea (evita depender de
  cabeceras falseables).
- Sin `ON DELETE CASCADE` en `replaced_by` (usa `SET NULL`): borrar un token viejo (limpieza) no debe
  romper la cadena de auditoría de uno más nuevo.

### `REFRESH_TOKEN_HASH_SECRET` — dónde vive

*(Añadido tras tu revisión: el diseño usaba esta variable sin decir dónde se documenta ni cuándo se
despliega.)*

- **`server/.env.example`**: nueva línea, con placeholder y el comando para generarla —
  `REFRESH_TOKEN_HASH_SECRET=` seguido de un comentario `# Genera con: openssl rand -hex 32`. Esto entra en
  el commit de C1/refresh (bloque 3b), no antes: en 3a no se usa para nada.
- **Vercel (proyecto del servidor):** se añade como variable de entorno de producción **antes del deploy
  del bloque 3b**, no antes del de 3a — 3a no toca autenticación, así que no la necesita. Te avisaré en
  ese momento para que la generes y la pongas tú misma (no debo generar ni ver secretos de producción por
  ti sin que pase por tus manos, igual que con `SUPABASE_SERVICE_ROLE_KEY` en la tarea 2).
- **Distinta de `JWT_SECRET`**, como ya decía el diseño: cada una protege una cosa distinta.
- **Documentación en `mejoras-tecnicas.md`** (se añade en el commit de docs del bloque 3b): rotar
  `REFRESH_TOKEN_HASH_SECRET` invalida de golpe el `token_hash` de todos los refresh tokens ya emitidos
  (deja de coincidir con lo guardado en la BD), forzando a todo el mundo a volver a iniciar sesión —
  exactamente el mismo efecto que ya tiene rotar `JWT_SECRET` con los access tokens, y sirve como la misma
  mitigación de emergencia si algún día se sospecha que esta clave se filtró.

### Endpoint `POST /api/auth/refresh`

Entrada: `{ refreshToken }`. Salida: `{ accessToken, refreshToken }` (el refresh SIEMPRE rota, incluso si
todo va bien).

1. `hash = HMAC-SHA256(REFRESH_TOKEN_HASH_SECRET, refreshToken)`.
2. `UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $hash AND revoked_at IS NULL RETURNING
   id, user_id, family_id, expires_at;` — un único `UPDATE ... RETURNING` hace la comprobación y la
   revocación del token viejo en una sola operación atómica (evita la condición de carrera de "leer, decidir,
   escribir" en dos pasos: si dos peticiones llegan a la vez con el mismo token, Postgres re-evalúa el
   `WHERE` de cada una tras liberar el lock de fila, así que solo una consigue el `UPDATE`; la otra afecta
   0 filas).
   - **0 filas afectadas** → o el token no existe, o ya estaba revocado. Para distinguirlo (y decidir si es
     reuso): `SELECT family_id FROM refresh_tokens WHERE token_hash = $hash`.
     - No existe ninguna fila → token nunca emitido, o ya limpiado por caducidad.
     - Existe pero ya revocado → **reuso detectado**: `UPDATE refresh_tokens SET revoked_at = now() WHERE
       family_id = $family_id AND revoked_at IS NULL;` (tumba toda la sesión). Se registra en el log
       (sin el token) para poder investigar si se repite.
   - **1 fila afectada** pero `expires_at < now()` → caducado (el token ya ha quedado revocado por el
     `UPDATE` anterior, así que no hace falta nada más).
   - **1 fila afectada y vigente** → rotar: generar un refresh nuevo (mismo `family_id`, `user_id`),
     `INSERT` con su hash y `expires_at = now() + 7 días`; `UPDATE` de la fila vieja con
     `replaced_by = <id nuevo>`. Leer `clientes` por `user_id` (no fiarse del payload viejo: si cambió el
     nombre o el rol desde el último login, el access token nuevo debe reflejarlo) y firmar un access token
     de 1 h con `{email, nombre, rol}`, igual que hoy. Devolver ambos.
   - **Respuesta al cliente en los tres casos de fallo (token inexistente, reuso, caducado): el mismo 401
     con el mismo texto genérico**, `"Sesión no válida, vuelve a iniciar sesión."` *(Corrección tras
     revisión: la primera versión de este documento usaba un texto distinto para cada caso —"Sesión no
     válida" / "Sesión revocada" / "La sesión ha caducado"—, y aunque los tres compartían el código 401,
     el texto "revocada" solo puede salir cuando ya se ha detectado un reuso, así que confirmaba a quien
     hiciera la petición que el token que presentó era uno legítimo ya usado por otra parte. El detalle de
     cuál de los tres casos fue —para poder investigarlo— se guarda solo en el log del servidor, nunca en
     la respuesta.)*
3. **Carrera legítima: margen de gracia de 60s + sincronización entre pestañas** *(rediseñado tras tu
   revisión — la versión anterior no tenía margen de gracia y tú señalaste un caso peor que el que yo había
   considerado: no solo un reintento de red, sino dos pestañas del mismo usuario con el mismo refresh token
   en `localStorage` pero cada una con su propia copia en memoria)*.

   **Mecanismo principal — sincronizar pestañas, no solo tolerar el fallo:** cuando la pestaña A rota su
   refresh token y escribe el nuevo en `localStorage.kaveRefreshToken`, el navegador dispara el evento
   `storage` en TODAS las demás pestañas del mismo origen (nunca en la que escribió, por diseño del propio
   evento — encaja perfecto aquí). La pestaña B escucha ese evento y actualiza su copia en memoria del
   refresh token al vuelo, así que la próxima vez que B necesite refrescar usará el token nuevo, no el que
   ya quedó revocado. Esto evita la mayoría de las carreras entre pestañas sin tocar el servidor en
   absoluto. Detalle en la Migración del frontend, más abajo.

   **Red de seguridad — margen de gracia de 60s, por si el evento `storage` no llega a tiempo** (pestaña en
   segundo plano con el bucle de eventos ralentizado por el navegador, o una carrera de milisegundos real):
   cuando la comprobación atómica del paso 2 afecta 0 filas porque el token YA estaba revocado, antes de
   tratarlo como reuso se comprueba si la revocación fue una rotación normal reciente (no un borrado
   masivo por reuso):
   ```sql
   SELECT id, revoked_at, replaced_by FROM refresh_tokens WHERE token_hash = $hash;
   -- si revoked_at no es null Y replaced_by no es null Y (now() - revoked_at) <= interval '60 seconds':
   SELECT id, revoked_at, expires_at FROM refresh_tokens WHERE id = $replaced_by;
   -- si esa fila existe, revoked_at IS NULL y expires_at > now(): es la sucesora activa, un solo salto.
   ```
   Si la sucesora activa existe (un solo salto desde el token presentado EN ESTA petición, no se recorren
   varios saltos en una sola comprobación), se trata como si el cliente hubiera presentado *esa* sucesora:
   se reclama atómicamente igual que en el paso 2
   (`UPDATE ... WHERE id = $replaced_by AND revoked_at IS NULL RETURNING ...`) y se emite una rotación
   nueva a partir de ella (par fresco, mismo `family_id`). No se puede simplemente "devolver el mismo par
   que ya se emitió" a la pestaña A, porque el servidor nunca guarda el refresh token en texto plano —solo
   su `token_hash`— así que no hay nada que devolver literalmente igual; en vez de eso, se le da a la
   pestaña B una rotación más, igual de válida. Si esa reclamación atómica también falla (0 filas — alguien
   más la reclamó en el mismo instante) o la sucesora no existe/está caducada/ya revocada, se cae al camino
   normal de reuso (paso 2, revocar `family_id` entero).

   **Aclaración explícita, señalada tras tu revisión, para que nadie lo reimplemente mal:** "un solo
   salto" es por petición, no un límite global sobre cuántas rotaciones puede haber en la cadena. Con 3+
   pestañas presentando tokens fuera de orden, cada petición individual solo mira un salto hacia adelante
   desde el token que ELLA presentó, pero el efecto acumulado es una cadena de varias rotaciones seguidas
   (T1→T2→T3→T4...), cada una legítima porque cada salto concreto ocurrió dentro de los 60s de la
   revocación anterior. El límite real no es "cuántos saltos en la cadena", es "cuántos segundos entre
   cada revocación consecutiva y el siguiente intento de usarla" — cada eslabón se juzga por su propia
   ventana de 60s, no por la distancia al token original. Si se implementara como "solo se permite un
   salto desde el primer token", el caso de 3+ pestañas fallaría después del segundo salto sin necesidad.

   **Riesgo aceptado, documentado explícitamente porque reduce la detección de reuso:** este margen
   estrecha la ventana en la que un atacante que robó un token y lo presenta justo después de que la
   víctima rotara legítimamente (dentro de esos 60s, y solo un salto) conseguiría una rotación en vez de
   disparar la revocación de toda la familia — en vez de perder el acceso al instante, el atacante y la
   víctima competirían por seguir rotando la misma cadena hasta que uno de los dos presente un token con
   más de un salto de antigüedad, momento en el que sí se corta. Es una ventana de 60 segundos y un solo
   salto, no indefinida, y es el coste explícito que tú mismo has pedido asumir a cambio de que dos
   pestañas legítimas no se expulsen mutuamente. Lo dejo escrito aquí para que quede claro que no es un
   descuido: es la contrapartida directa del punto que señalaste.

   **Test de concurrencia real** *(pedido explícitamente, no vale mockear el `UPDATE`)*: dos peticiones
   simultáneas a `/api/auth/refresh` con el mismo refresh token, contra un servidor Express real levantado
   en el test (como ya hace `supertest` con los tests existentes) y un doble de Supabase reforzado para
   este caso concreto: `fakeSupabase.js` gana una versión de `.update()` que aplica el patrón
   "leer-y-marcar en un único paso síncrono por llamada" en vez de "buscar coincidencias, luego mutar" (que
   es exactamente el tipo de fallo TOCTOU que se está probando) — así, cuando dos llamadas a esa `.update()`
   se disparan con `Promise.all`, el propio doble garantiza que como máximo una vea la fila sin revocar,
   igual que garantizaría Postgres con el `UPDATE ... RETURNING` real.

   **Límite del doble, señalado tras tu revisión para no invalidar el test sin querer:** lo único que el
   doble simula es esa atomicidad del `UPDATE ... WHERE revoked_at IS NULL RETURNING` — nada más. El
   margen de gracia, la detección de reuso, la firma del access token: todo eso lo sigue ejecutando el
   código real del endpoint, tal cual se ejecutaría en producción. Si el doble llegara a incluir lógica de
   negocio (por ejemplo, decidir él mismo si aplica el margen de gracia), el test dejaría de probar
   nuestro código y empezaría a probar el doble — se vigila esto explícitamente al escribirlo.

   El test comprueba: (a) exactamente una de las dos respuestas trae un par nuevo válido y la otra, dentro
   del margen de 60s, trae también un par válido (por el margen de gracia) — nunca las dos un 401 de golpe
   salvo fuera del margen; (b) no quedan dos filas activas (`revoked_at IS NULL`) a la vez para el mismo
   `family_id`; (c) fuera del margen de 60s (fecha de revocación simulada más antigua), la segunda
   petición sí recibe el 401 genérico y toda la familia queda revocada. **Lo que este test demuestra y lo
   que no:** prueba que el código de la aplicación depende únicamente del
   `UPDATE ... WHERE revoked_at IS NULL RETURNING` como única puerta —sin una comprobación previa por
   separado que pudiera perder la carrera—, que es la parte que depende de nuestro código. NO prueba que
   Postgres en sí bloquee filas correctamente bajo concurrencia real: eso ya lo garantiza el propio motor
   (MVCC), no algo que necesitemos reverificar.

   Para esa capa, antes de dar la tarea por cerrada, haré además **una comprobación manual única contra la
   base real**, con limpieza garantizada *(detalle añadido tras tu revisión)*:
   - La fila de prueba usa un `user_id` que apunte a un `clientes.id` que exista de verdad (si no, el
     `INSERT` falla por la FK) — cojo el mío propio de administrador, o creo un cliente de prueba
     desechable si prefieres no usar una cuenta real.
   - `family_id` propio, generado con `gen_random_uuid()` en el momento, para no poder colisionar nunca
     con uno real.
   - El borrado de la fila de prueba va en un `finally` (o equivalente en el script de la comprobación),
     para que si algo falla a mitad, no se quede huérfana.
   - Si aun así algo queda mal, dejo documentado en `mejoras-tecnicas.md` el `DELETE FROM refresh_tokens
     WHERE id = '<el id de prueba>'` exacto para limpiarlo a mano.
   - Te aviso antes de tocar la BD real para esta comprobación, como con cualquier otra escritura, y te
     confirmo cuando la fila de prueba ya esté borrada.

### Endpoint `POST /api/auth/logout`

*(Añadido tras revisión: el borrador original no tenía ningún cierre de sesión en el servidor. `logout()`
en `AuthContext.jsx` hoy —y en el diseño original de más abajo— solo borra `localStorage`; el refresh token
seguiría siendo válido en el servidor hasta su caducidad natural o hasta que saltara la detección de reuso.
Si a alguien le roban el refresh token y la víctima "cierra sesión" pensando que eso lo invalida, el token
robado seguiría funcionando. Un cierre de sesión de verdad necesita revocar en el servidor.)*

Entrada: `{ refreshToken }` (el que tenga el cliente en `localStorage` en ese momento). Acción:
`UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = (SELECT family_id FROM refresh_tokens WHERE
token_hash = $hash) AND revoked_at IS NULL;` — revoca toda la familia, igual que en el camino de reuso.
Responde 200 siempre (aunque el token ya estuviera revocado o no existiera: cerrar sesión dos veces no es un
error). El cliente borra su `localStorage` DESPUÉS de que esta llamada responda (o de todos modos, incluso
si falla por red: perder la conexión no debe impedir cerrar sesión localmente, aunque el servidor no llegue
a enterarse hasta que el token caduque solo).

### Detección de reuso

Cubierta arriba: presentar un token ya revocado tumba su `family_id` entero.

### Limpieza de tokens expirados

No hay `pg_cron` ni ninguna tarea programada en este proyecto todavía, y montar una es más alcance del que
pediste. Propongo una consulta de mantenimiento, documentada en `docs/mejoras-tecnicas.md`, para correr a
mano de vez en cuando (o dejarla para cuando la tarea 7 monte algo programado):
```sql
DELETE FROM refresh_tokens WHERE expires_at < now() - interval '30 days';
```
(se guardan 30 días más allá de la caducidad por si hace falta auditar un reuso reciente). Alternativa para
más adelante: activar la extensión `pg_cron` de Supabase y programar esta misma consulta — lo anoto, no lo
monto ahora.

### Migración C — la propia tabla `refresh_tokens`

**`C1_create_refresh_tokens.sql`** con el esquema de arriba (tabla + 3 índices). Reversión:
`DROP TABLE refresh_tokens;`. RLS: se activa (`ENABLE ROW LEVEL SECURITY`) **sin políticas** para
anon/authenticated (el servidor la usa siempre con `service_role`, que se salta RLS) — mismo patrón que
`clientes` hoy, que es justo el que el linter de seguridad no señala como problema real cuando es
intencional.

### Migración a los tokens de 7 días ya firmados

Tres formas de tratar los tokens ya emitidos (7 días, sin rotación) cuando esto se despliegue:

1. **Dejarlos caducar solos (recomendado).** `verificarToken` no cambia de forma: sigue siendo
   `jwt.verify` con el mismo `JWT_SECRET` y la misma forma de payload. Un token viejo sigue funcionando
   hasta su caducidad natural (máximo 7 días desde que se emitió), sin refresh, exactamente como hoy. Todo
   login/registro *nuevo* a partir del despliegue ya emite el par access+refresh. No hay que tocar
   `verificarToken`, no hay expulsión forzosa, y la ventana de exposición ya está acotada por el propio
   diseño actual (7 días). Dado que esta tienda apenas tiene usuarios reales activos ahora mismo, el coste
   de esta opción es prácticamente cero.

   **Riesgo aceptado, señalado tras revisión (no es exclusivo de esta opción, es de cómo funciona
   `verificarToken` hoy):** ni `verificarToken` ni `verificarAdmin` consultan la base de datos en cada
   petición (`server/src/middleware/auth.js`), así que si algún día hay que quitarle el rol de admin a una
   cuenta (salida de la empresa, cuenta comprometida...), un JWT de acceso ya emitido para esa cuenta sigue
   dando `rol: 'admin'` hasta que caduque —hasta 7 días con los tokens viejos, hasta 1 hora con los nuevos,
   una vez desplegado este diseño—. El nuevo `refresh_tokens` no ayuda aquí: ese usuario no necesita rotar
   nada si su access token todavía no ha caducado. **Mitigación de emergencia, sin cambiar el diseño:**
   cambiar `JWT_SECRET` invalida de golpe TODOS los access tokens ya firmados, de cualquier usuario (fuerza
   a todo el mundo a volver a iniciar sesión, incluido tú); es la única forma de cerrar ese hueco antes de
   que caduque solo, y ya está disponible hoy sin escribir código nuevo. Para un caso puntual y urgente,
   sigue siendo más barato que añadir una consulta a la BD en cada petición autenticada (que es lo que se
   quiere evitar precisamente al usar JWT sin estado).
2. **Expulsión forzosa.** Cambiar `JWT_SECRET` (o añadir un claim `v: 2` que `verificarToken` exija) al
   desplegar: todo el que tenga sesión abierta, tú incluido como admin, tiene que volver a iniciar sesión
   inmediatamente. Más limpio conceptualmente, pero molesto sin necesidad real aquí.
3. **Upgrade silencioso.** Si `verificarToken` acepta un token viejo (sin claim de versión) con éxito, se le
   emite de regalo un par de refresh tokens nuevo en esa misma respuesta, sin que el usuario tenga que volver
   a loguearse. Más código (un camino especial en el middleware) para un problema que la opción 1 ya
   resuelve solo, con paciencia de 7 días.

Recomiendo la opción 1, como ya habíamos hablado. La dejo explícita aquí por si prefieres otra.

### Migración del frontend

- `AuthContext.jsx`: el **access token deja de guardarse en `localStorage`** (solo vive en memoria, en el
  propio estado de React) — así una vulnerabilidad XSS no puede robar un token de larga vida leyendo
  `localStorage`. El **refresh token sí sigue en `localStorage`** (bajo una clave nueva, p. ej.
  `kaveRefreshToken`): tiene que sobrevivir a cerrar la pestaña o recargar la página para no obligar a
  reintroducir la contraseña cada hora. `kaveUser` sigue igual (no es sensible).
- Al cargar la app: si hay `kaveRefreshToken` guardado, llamar a `/api/auth/refresh` de inmediato para
  conseguir un access token fresco en memoria, en vez de intentar reutilizar uno guardado (que ya no
  existe). **Distinguir el motivo del fallo, no tratar "la llamada no salió bien" como "sesión cerrada" sin
  más** *(corrección tras revisión: la primera versión no distinguía esto, y una app abierta con mala
  conexión, o justo cuando el servidor se está reiniciando tras un deploy, habría desconectado a un usuario
  con un refresh token perfectamente válido)*:
  - Respuesta 401 real del servidor → el token es inválido/caducado/revocado de verdad: se borra
    `kaveRefreshToken` y se trata como sesión cerrada.
  - Cualquier otro fallo (sin red, timeout, 5xx) → NO se borra nada ni se cierra sesión; se deja un estado
    de "no se ha podido confirmar la sesión todavía" (se puede reintentar, o mostrar un aviso de conexión),
    sin tocar `kaveRefreshToken`.
- **Sincronización entre pestañas** *(añadido tras tu revisión, ~15 líneas en `AuthContext.jsx`)*: un
  listener `window.addEventListener('storage', handler)` donde `handler` comprueba
  `event.key === 'kaveRefreshToken'` y, si cambió, actualiza el módulo en memoria que guarda el refresh
  token (el mismo que lee el wrapper de abajo) con `event.newValue`. El evento `storage` solo llega a
  pestañas *distintas* de la que escribió — la que rotó no se dispara a sí misma, así que no hay bucle.
  Si `event.newValue` es `null` (otra pestaña hizo `logout()` y borró la clave), se limpia también el
  estado local (`setUser(null)`) para que esa pestaña se cierre también, no solo deje de tener un token
  válido en silencio.
- `services/api.js`: hoy cada función (`getMisPedidos`, `getPedidos`, `createMueble`...) llama a `fetch`
  directamente y añade `authHeaders()` por su cuenta; no hay un punto único de entrada. Pasan todas a usar
  un `apiFetch(url, opciones)` compartido (nuevo, en el mismo archivo) que:
  1. Lee el access token de un módulo en memoria (`authToken.js`, nuevo — no de `localStorage`; lo
     actualiza `AuthContext` en `login()` y en cada refresh).
  2. Hace la petición. Si responde 401 y la petición no se había reintentado ya (flag `retried` interno,
     por petición, para no reintentar dos veces si el segundo intento también da 401 — p. ej. el access
     token nuevo caduca justo en medio, improbable pero posible):
     - Pide un refresh — pero **de-duplicado**: si ya hay un refresh en curso (otra petición concurrente
       también recibió 401 al mismo tiempo), todas esperan la MISMA promesa en vez de llamar cada una a
       `/api/auth/refresh` por separado (esto es lo que de verdad evita que dos peticiones concurrentes de
       la misma pestaña se coman el margen de gracia entre sí — la sincronización entre pestañas cubre el
       caso entre pestañas, esto cubre el caso dentro de una misma pestaña).
     - Si el refresh devuelve un par nuevo: guarda el access token nuevo en el módulo en memoria, guarda el
       refresh nuevo en `localStorage.kaveRefreshToken` (esto es lo que dispara el evento `storage` en las
       demás pestañas), y repite la petición original una única vez con el access token nuevo — sea lo que
       sea lo que responda esa repetición (incluso otro 401), se devuelve tal cual, sin volver a refrescar.
     - Si el refresh devuelve 401 (de verdad, no genérico-por-red): se limpia `kaveRefreshToken` y el
       access token en memoria, se llama a `logout()` de `AuthContext` (cierra sesión local, sin llamar de
       nuevo al servidor: si el refresh ya dijo que la sesión no es válida, no hace falta el paso de
       `/api/auth/logout`), y se deja que la petición original falle con su error tal cual — no se
       inventa un error distinto.
     - Si el refresh falla por red o 5xx (no un 401 del servidor): **no se toca `kaveRefreshToken` ni se
       cierra sesión** — podría ser una sesión perfectamente válida con mala conexión o el servidor
       reiniciándose tras un deploy. Se deja que la petición original falle con su propio error; quien la
       llamó decide cómo mostrarlo (igual que hoy, cuando cualquier `fetch` falla por red).
  3. Si no hay 401, se devuelve la respuesta tal cual — el comportamiento actual de cada función no cambia
     para el camino feliz.

  *(Corrección tras revisión: la primera versión de este documento describía el envoltorio en una sola
  frase — "si responde 401, se intenta refresh una vez y se repite" — sin el detalle de qué pasa cuando el
  propio refresh falla de forma distinta, ni cómo evitar que dos peticiones concurrentes de la misma
  pestaña disparen dos refresh a la vez y se coman el margen de gracia del punto anterior entre sí. Con el
  detalle de arriba, el margen de gracia y la sincronización entre pestañas de hecho no hacen falta casi
  nunca dentro de una misma pestaña — la de-duplicación ya lo evita ahí — y solo entran en juego para el
  caso real que señalaste: pestañas distintas.)*
- `login()` en `AuthContext.jsx` pasa a guardar el par completo (access en memoria, refresh en
  `localStorage`). `logout()` pasa a llamar primero a `POST /api/auth/logout` (revoca en el servidor) y
  DESPUÉS borra el `localStorage` local, en vez de ser una operación puramente local como hoy *(corrección
  tras revisión: sin esto, "cerrar sesión" no revocaba nada en el servidor — ver el nuevo endpoint
  `/api/auth/logout` más arriba)*.

## 3. Orden de commits propuesto (cada uno con su gate de lint+test)

*(Reestructurado tras tu revisión: partido en 3a/3b como pediste — migraciones y RLS primero, sin tocar
nada de autenticación; `refresh_tokens`/JWT/frontend después, solo cuando 3a lleve 48h estable en
producción. Motivo, con tus propias palabras: un fallo en el refresh (login roto) no debe coincidir con
migraciones en vuelo — separar da bisect limpio y rollback independiente. Dentro de 3a también reordené el
commit de `disponible` (antes en medio de las migraciones, ahora al final del bloque, porque es una
limpieza de código sin relación con ninguna migración concreta y enterrarlo entre A y B oscurecía la
secuencia) y adelanté H8 al principio (es un fix de una línea + test, y así queda fuera del camino desde
el principio, como sugeriste — aunque dijiste que esto no era importante).*

### Bloque 3a — migraciones y RLS, sin autenticación

1. `fix(server): exigir https:// en producción en SUPABASE_URL (H8)` — código + test, sin tocar BD
   (condición `NODE_ENV === 'production'`, corregido tras la primera revisión).
2. `feat(db): añadir muebles.categoria_id (nullable) + índice` — migración A1+A2 aplicada (con tu permiso),
   archivos en `server/migrations/`. *(Sin `CONCURRENTLY`: probado y confirmado que `apply_migration` no lo
   admite — ver Sección 1.)*
3. `feat(server): escribir categoria_id junto a categoria durante la transición` — código, sin tocar BD.
4. **Pausa de despliegue** (push a `main`, verificar deploy, esperar 24-48h, `SELECT` de verificación —
   detallado en la Sección 1, Migración A).
5. `feat(db): backfill de muebles.categoria_id` — migración A3 aplicada (con permiso), tras la pausa.
6. `feat(db): añadir pedidos.cliente_id (nullable) + índice` — migraciones B1+B2 (sin el backfill todavía).
   *(Renombrada de `user_id` a `cliente_id` tras tu confirmación — ver la nota en la Sección 0. Índice sin
   `CONCURRENTLY`, mismo motivo que A2.)*
7. `feat(server): rellenar pedidos.cliente_id al registrar un pedido nuevo cuando hay cuenta` — código,
   **antes** del backfill (mismo orden que la migración A).
8. **Pausa de despliegue**, igual que en el paso 4.
9. `feat(db): backfill de pedidos.cliente_id` — migración B3, ya con el código del paso 7 desplegado y la
   pausa cumplida.
10. `fix(db): corregir política RLS de pedidos (H9)` — migración D1 (con tu permiso) + test de que `anon`
    ya no puede leer `pedidos`, + `SELECT` a `pg_policies` antes/después.
11. `chore(server): dejar de fijar disponible a mano (ya lo calcula el trigger)` — código, sin tocar BD;
    movido aquí (antes estaba entre las migraciones A y B) porque no depende de ninguna de las dos.
12. `docs: estado y decisiones del bloque 3a` — cierra 3a en `mejoras-tecnicas.md`; de paso corrige una
    línea de la tarea 2 que todavía dice que el índice único de `pedidos.stripe_session_id` está pendiente
    de aplicarse en producción (ya estaba aplicado desde antes de la tarea 1, detectado en esta revisión).

**Cierre de 3a:** no se empieza 3b hasta que estos commits lleven 48h en producción sin incidentes y las
comprobaciones de las pausas de despliegue hayan salido limpias.

### Bloque 3b — refresh_tokens, JWT y frontend (arranca solo cuando 3a esté estable)

13. `feat(db): tabla refresh_tokens` — migración C1. Antes de este deploy: generar
    `REFRESH_TOKEN_HASH_SECRET` (`openssl rand -hex 32`) y ponerla en Vercel (proyecto del servidor) y en
    `server/.env` local; documentar el placeholder en `server/.env.example` como parte de este commit.
14. `feat(server): JWT de 1h + endpoints /api/auth/refresh y /api/auth/logout, con rotación, detección de
    reuso y margen de gracia de 60s` — código + tests, incluido el test de concurrencia real (Sección 2).
15. `feat(client): access token en memoria, refresh en localStorage, sincronización entre pestañas,
    reintento automático en 401 con de-duplicación, logout que revoca en el servidor` — cliente.
16. `docs: estado y decisiones del bloque 3b` — cierra la tarea 3 en `mejoras-tecnicas.md`.
17. *(más adelante, tras el periodo de convivencia de la migración A — no forma parte de 3a ni 3b)*
    `feat(db): categoria_id NOT NULL` y `feat(db): eliminar muebles.categoria` — A4 y A5, cada uno en su
    momento.
