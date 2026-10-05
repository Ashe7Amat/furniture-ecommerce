# Panel de mensajes de contacto

> **Estado (5 oct 2026): migración aplicada**, con autorización del usuario, como versión `20261005002322`
> (`create_mensajes_contacto`). El resultado de las comprobaciones está al final de este documento.

## Qué hace

- `POST /api/contacto` guarda cada mensaje en `mensajes_contacto` **antes** de mandar el correo.
  - Si se guardó, responde 200 aunque falle el correo: el mensaje ya no se pierde y se ve en el panel.
  - Si no se pudo guardar, lo apunta en el log, sin datos de quien escribió (H27), y sigue con el correo como
    hasta ahora.
  - Solo responde 502 si fallan las dos cosas.
- `GET /api/admin/mensajes` (administradores): los 500 más recientes, sin caché.
- `PATCH /api/admin/mensajes/:id/leido` (administradores): marca un mensaje como leído. Con `{ "leido": false }`
  lo vuelve a dejar como no leído. Responde 400 si el id no es un UUID y 404 si no existe.
- Panel: pestaña "Mensajes" (después de "Pedidos").
  - La pestaña lleva una insignia con los no leídos.
  - Tabla con el nombre, el email y el mensaje recortados, la fecha y el estado, y un filtro "Todos / No leídos".
  - Al pulsar una fila se abre el mensaje entero, con el email como enlace para responder y el botón "Marcar
    como leído".

## Si la tabla faltara

Ya no es el caso: la migración se aplicó antes del merge a `main`. Si la tabla faltara (por ejemplo, en una base
de datos nueva sin esta migración):
- **El formulario de contacto seguiría funcionando.** El guardado fallaría, se apuntaría en el log y el correo
  saldría como siempre.
- **La pestaña "Mensajes" diría "No se pudieron cargar los mensajes."**

## La migración

Archivo: `server/migrations/20261005002322_create_mensajes_contacto.sql`, y su reversión en `.down.sql`. Se
aplicó con `apply_migration`, que asignó la versión `20261005002322`. Después se renombraron los dos archivos
(antes llevaban el prefijo `PENDIENTE_`). La copia coincide byte a byte con
`supabase_migrations.schema_migrations`, como las demás.

```sql
CREATE TABLE public.mensajes_contacto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  email text NOT NULL,
  mensaje text NOT NULL,
  leido boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mensajes_contacto_leido_idx ON public.mensajes_contacto (leido);
CREATE INDEX mensajes_contacto_created_at_idx ON public.mensajes_contacto (created_at DESC);
ALTER TABLE public.mensajes_contacto ENABLE ROW LEVEL SECURITY;
```

**RLS activa y sin políticas:** con la clave pública no se puede leer ni escribir; solo el servidor, con la
`service_role`. Es el mismo patrón que `refresh_tokens`.

Ocupa 486 bytes. Las migraciones de más de unos 2 KB se colgaban con `apply_migration` (ver
`docs/agrupar-fichas-propuesta.md`), pero esta cabía y no lleva `DELETE`: entró a la primera.

## Comprobaciones después de aplicarla (solo lectura)

1. **La tabla existe y tiene RLS:**
   `SELECT relrowsecurity FROM pg_class WHERE oid = 'public.mensajes_contacto'::regclass;` → `true`.
2. **No tiene políticas:**
   `SELECT count(*) FROM pg_policies WHERE tablename = 'mensajes_contacto';` → `0`.
3. **Tiene sus dos índices:**
   `SELECT indexname FROM pg_indexes WHERE tablename = 'mensajes_contacto';` → la clave primaria y los dos
   índices.
4. **Se ha registrado bien:** `schema_migrations` tiene la versión con el nombre `create_mensajes_contacto`, y el
   MD5 coincide con el archivo del repositorio.
5. **Funciona de extremo a extremo** (después del merge): un mensaje de prueba desde `/contacto` aparece en la
   pestaña "Mensajes" sin leer, y al marcarlo como leído cambia la insignia.

**Resultado (5 oct 2026):**
- **RLS:** activa.
- **Políticas:** 0.
- **Índices:** `mensajes_contacto_pkey`, `mensajes_contacto_leido_idx` y `mensajes_contacto_created_at_idx`.
- **Columnas:** 6.
- **Registro:** consta en `schema_migrations` como `20261005002322` / `create_mensajes_contacto`. Su MD5,
  `142abae3532f1684e28c8a940acb3d9b`, es el mismo que el del archivo.
- **Prueba de extremo a extremo (punto 5):** queda para después del despliegue.
