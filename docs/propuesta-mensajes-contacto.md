# Panel de mensajes de contacto — migración pendiente

> **Estado (4 oct 2026): código hecho y probado en la rama; migración SIN aplicar.** No se ha tocado la base de
> datos. Hace falta la autorización expresa del usuario para aplicarla.

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

## Qué pasa si se despliega sin la migración

- **El formulario de contacto funciona igual que hoy.** El guardado falla, se apunta en el log y el correo sale
  como siempre.
- **La pestaña "Mensajes" dice "No se pudieron cargar los mensajes."** Cada vez que se abre el panel hay una
  petición que responde 500 (con un error en el log de Vercel).

Por eso **conviene aplicar la migración antes del merge a `main`**.

## La migración

Archivo: `server/migrations/PENDIENTE_create_mensajes_contacto.sql`, y su reversión en `.down.sql`. Al
aplicarla con `apply_migration`, Supabase pone la versión. Después hay que renombrar los dos archivos a
`<versión>_create_mensajes_contacto.sql` y comprobar que la copia coincide byte a byte con
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
`docs/agrupar-fichas-propuesta.md`), pero esta cabe y no lleva `DELETE`.

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
