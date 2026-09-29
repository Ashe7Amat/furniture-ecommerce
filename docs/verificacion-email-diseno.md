# Verificación del email de las cuentas (H18) — diseño para decidir

**Estado:** solo diseño (29 sep 2026). No hay nada implementado. Las partes 1 a 3 son para decidir con el
cliente; las partes 4 a 8, para quien lo implemente.

---

## Parte 1 · Resumen para el cliente

### El problema

Hoy cualquiera puede crear una cuenta con un email que no es suyo: la web no comprueba que el email exista ni
que sea de quien se registra. Eso tiene tres consecuencias:

1. **Ver compras ajenas.** "Mis pedidos" enseña las compras hechas con el email de la cuenta, también las
   hechas como invitado. Quien registre el email de otra persona ve lo que esa persona compró sin cuenta:
   nombre, dirección, teléfono y piezas.
2. **Quedarse con las compras futuras.** Cuando alguien compra como invitado, el pedido se asocia a la cuenta
   que tenga ese email. Si la cuenta la creó otra persona, las compras van a parar a ella.
3. **Adelantarse a la cuenta de Google de otra persona.** Si alguien registra con contraseña el email de otra
   persona, y esa persona entra después con "Continuar con Google", las dos acaban en **la misma cuenta**. Y
   quien la creó sigue sabiendo la contraseña.

La solución es la habitual: mandar un correo con un enlace, y no dar por buena la cuenta hasta que se pulse.

### Lo que hay que decidir

| # | Decisión | Propuesta |
|---|---|---|
| 1 | **Dominio propio en Resend** (el servicio de correo). Sin él, los correos solo llegan a la dirección del dueño de la cuenta de Resend, no a los clientes | **Imprescindible antes de nada.** Es verificar un dominio (por ejemplo nave5barcelona.com) en Resend, añadiendo unos registros DNS |
| 2 | **Cuándo se pide verificar** (parte 2) | En el registro y al cambiar el email |
| 3 | **Qué puede hacer una cuenta sin verificar** | Iniciar sesión, guardar favoritos y comprar; **no** ver "Mis pedidos" hasta verificar |
| 4 | **Las cuentas que ya existen** (hoy hay 3, una es la del administrador) | Pedir que verifiquen al entrar la próxima vez; la del administrador se marca como verificada a mano |
| 5 | **Los pedidos ya asociados a una cuenta** (hoy 2 de 3) | Revisarlos juntos: con 3 pedidos se hace a mano en un momento |
| 6 | **Los textos de los correos** (parte 3) | Los de la parte 3, o los que se prefieran |
| 7 | **Cuánto dura el enlace** | 24 horas, con un botón para pedir otro |

---

## Parte 2 · Cuándo se pide verificar el email

| Opción | Qué significa | A favor | En contra |
|---|---|---|---|
| **A. Solo en el registro** | Al crear la cuenta llega un correo con un enlace. Hasta pulsarlo, la cuenta funciona, pero con límites (decisión 3) | Poca fricción: se puede comprar enseguida | Si no se verifica también el cambio de email (opción C), el hueco sigue abierto: se registra con un email propio, se verifica, y después se cambia por uno ajeno |
| **B. En cada inicio de sesión** | Cada vez que se entra, llega un código o un enlace por correo | La más estricta | Mucha fricción para una tienda: cada visita, un correo. Es lo que se hace en banca o en paneles de administración, no en un catálogo |
| **C. Al cambiar el email** | El email nuevo no se aplica hasta que se confirma desde él; al antiguo le llega un aviso | Cierra el hueco de la opción A | No sirve sola: no cubre el registro |

**Propuesta: A + C.**
- se verifica al registrarse y al cambiar el email;
- una cuenta sin verificar puede comprar, pero no ve "Mis pedidos" ni se le asocian pedidos;
- quien entra con Google ya viene verificado: Google solo entrega emails que ha comprobado, y el servidor ya lo
  exige hoy.

**Variante más estricta de A:** no dejar ni iniciar sesión hasta verificar. Es más segura, pero quien acaba de
registrarse para comprar tendría que ir a su correo antes de pagar. Con la propuesta, ese riesgo ya lo cubre
no enseñar "Mis pedidos".

### Qué pasa con las compras de invitado

- **Se sigue pudiendo comprar sin cuenta,** y ese email no se verifica: tendría que ir al correo antes de
  pagar. Es el riesgo aceptado de H6: cada correo de confirmación mal dirigido cuesta un pago real a quien lo
  provoca.
- **Esas compras no se asocian a ninguna cuenta hasta que haya una verificada con ese email.** Cuando alguien
  verifica su cuenta, se le asocian las compras que hizo antes como invitado con ese email (parte 6).
- **Con sesión y email verificado, el checkout usa el email de la cuenta,** sin dejar cambiarlo. Eso cierra H6
  para las compras con cuenta.

---

## Parte 3 · Textos de los correos (propuesta)

Mismo estilo que los correos de hoy (el de bienvenida y el de confirmación de pedido): tono cercano, sin
tecnicismos.

**1. Confirmar el email (al registrarse).** Sustituye al correo de bienvenida de hoy, para no mandar dos.
- **Asunto:** Confirma tu email y bienvenido a Nave 5 Barcelona
- **Texto:**
  > ¡Hola, {nombre}!
  >
  > Gracias por unirte a Nave 5 Barcelona. Para activar tu cuenta, confirma que este email es tuyo:
  >
  > **[Confirmar mi email]**
  >
  > El enlace caduca en 24 horas. Si ha caducado, entra en tu cuenta y pide otro.
  >
  > Si no has creado tú esta cuenta, ignora este correo: sin confirmarla, nadie podrá ver tus compras.

**2. Cuenta activada** (después de confirmar; es el correo de bienvenida de hoy, un poco adaptado).
- **Asunto:** Tu cuenta de Nave 5 Barcelona ya está activa 🤎
- **Texto:** el de bienvenida actual, cambiando la última frase por: "Ya puedes ver tu historial de compras en
  Mi cuenta, guardar tus piezas favoritas y comprar en un momento."

**3. Confirmar el email nuevo** (al cambiar el email; se manda a la dirección nueva).
- **Asunto:** Confirma tu nuevo email en Nave 5 Barcelona
- **Texto:**
  > Hola, {nombre}:
  >
  > Has pedido usar este email en tu cuenta de Nave 5 Barcelona. Para terminar el cambio, confírmalo:
  >
  > **[Confirmar el nuevo email]**
  >
  > Hasta que lo confirmes, tu cuenta sigue usando el email anterior. El enlace caduca en 24 horas.

**4. Aviso al email antiguo** (al pedir el cambio).
- **Asunto:** Se ha pedido cambiar el email de tu cuenta
- **Texto:**
  > Hola, {nombre}:
  >
  > Se ha pedido cambiar el email de tu cuenta de Nave 5 Barcelona por {email nuevo, con parte oculta:
  > a***@gmail.com}.
  >
  > Si has sido tú, no hace falta hacer nada. Si no, entra en tu cuenta y cambia la contraseña: el cambio no
  > se aplicará hasta que se confirme desde el email nuevo.

**5. Cuenta protegida** (el caso 3 de la parte 1: alguien entra con Google en una cuenta sin verificar que
tenía contraseña).
- **Asunto:** Hemos protegido tu cuenta de Nave 5 Barcelona
- **Texto:**
  > Hola, {nombre}:
  >
  > Has entrado con Google en una cuenta que se había creado con tu email y una contraseña, sin confirmar.
  > Por seguridad, hemos anulado esa contraseña y cerrado las demás sesiones. A partir de ahora, entra con
  > Google. Si quieres volver a tener contraseña, pídela desde Mi cuenta.

---

## Parte 4 · Qué hay hoy (comprobado el 29 sep 2026)

- **Tabla `clientes`:** `id`, `email`, `nombre`, `rol`, `creado_en` y `password`. No hay nada que diga si el
  email está verificado, ni cómo se creó la cuenta (con contraseña o con Google).
- **Datos:** 3 cuentas (1 de administrador) y 3 pedidos, 2 de ellos con `cliente_id`.
- **"Mis pedidos"** (`pedidosController.obtenerMisPedidos`) busca por el email del pedido
  (`cliente_info->>email`, con ILIKE escapado desde H17), no por `cliente_id`.
- **Al registrar un pedido,** `pagos.buscarClienteIdPorEmail` le pone el `cliente_id` de la cuenta que tenga
  ese email, esté verificada o no (migración B).
- **Google** (`authController.loginConGoogle`):
  - exige `email_verified` en el token de Google;
  - si ya existe una cuenta con ese email, entra en ella sin más. Es el caso 3 de la parte 1.
- **Correos:** Resend, con `RESEND_FROM` en el dominio de pruebas (`onboarding@resend.dev`), que solo entrega
  al dueño de la cuenta de Resend (ver `server/.env.example`).
- **Relacionados:**
  - H6: el correo de confirmación va al email tecleado;
  - H17: ILIKE en "Mis pedidos", ya cerrado;
  - H20: el código de B, sin comprobar de extremo a extremo;
  - H21: cambiar la contraseña cierra las demás sesiones;
  - H28: `perfil-update` sin límite de intentos.

## Parte 5 · Migración (necesita permiso aparte, como todas)

```sql
-- up
ALTER TABLE public.clientes
  ADD COLUMN email_verificado boolean NOT NULL DEFAULT false,
  ADD COLUMN email_verificado_en timestamptz,
  ADD COLUMN email_pendiente varchar;  -- el email nuevo, mientras no se confirme (opción C)

CREATE TABLE public.verificaciones_email (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  email varchar NOT NULL,          -- a qué dirección se mandó: la de la cuenta o la pendiente
  motivo varchar NOT NULL,         -- 'registro' | 'cambio_email'
  token_hash text NOT NULL,        -- HMAC-SHA256 del token, como en refresh_tokens; nunca el token
  creado_en timestamptz NOT NULL DEFAULT now(),
  expira_en timestamptz NOT NULL,
  usado_en timestamptz
);
CREATE UNIQUE INDEX verificaciones_email_token_hash_key ON public.verificaciones_email(token_hash);
CREATE INDEX verificaciones_email_cliente_id_idx ON public.verificaciones_email(cliente_id);
ALTER TABLE public.verificaciones_email ENABLE ROW LEVEL SECURITY;  -- sin políticas: solo el servidor

-- down
DROP TABLE public.verificaciones_email;
ALTER TABLE public.clientes
  DROP COLUMN email_pendiente,
  DROP COLUMN email_verificado_en,
  DROP COLUMN email_verificado;
```

- **Las cuentas existentes** quedan con `email_verificado = false` (decisión 4). La del administrador se marca
  a mano, con el SQL aparte que haga el usuario:
  `UPDATE clientes SET email_verificado = true, email_verificado_en = now() WHERE rol = 'admin';`
- **Las cuentas de Google** existentes se verifican solas la próxima vez que entren con Google.
- **Secreto:** el HMAC puede reutilizar `REFRESH_TOKEN_HASH_SECRET` o tener uno propio. La propuesta es uno
  propio (`EMAIL_TOKEN_HASH_SECRET`), para que rotar uno no invalide el otro.

## Parte 6 · Cambios en el servidor

1. **Registro** (`registrarCliente`):
   - crea la cuenta sin verificar;
   - manda el correo 1 (sustituye a `enviarEmailBienvenida`);
   - devuelve la sesión como hoy, con `email_verificado: false` en el usuario.
2. **`POST /api/auth/verificar-email`** con `{ token }`:
   - busca el HMAC, sin usar y sin caducar;
   - en una transacción, o con un `UPDATE` condicional sobre `usado_en IS NULL` como en la rotación de 3b:
     - marca el token como usado;
     - si el motivo es `registro`, pone `email_verificado = true`;
     - si es `cambio_email`, pasa `email_pendiente` a `email` (comprobando que sigue libre);
   - **asocia los pedidos de invitado** de ese email. No hace falta la condición de unicidad de B3: aquí ya se
     sabe qué cuenta es, y quien confirma demuestra que el buzón es suyo:
     ```sql
     UPDATE pedidos SET cliente_id = $1
     WHERE cliente_id IS NULL AND lower(cliente_info->>'email') = lower($2);
     ```
   - manda el correo 2 y devuelve el usuario actualizado;
   - si el token no vale, la misma respuesta genérica en todos los casos: "El enlace no es válido o ha caducado".
3. **`POST /api/auth/reenviar-verificacion`:** con sesión y con límite (3 cada hora por cuenta). Invalida los
   tokens anteriores sin usar de esa cuenta.
4. **Login, refresh y perfil** devuelven `email_verificado` en el usuario.
5. **`perfil-update` con email nuevo** (opción C):
   - no cambia `email`: guarda `email_pendiente`;
   - manda el correo 3 al email nuevo y el 4 al antiguo;
   - H21 (revocar las demás sesiones) se aplica al confirmar, no al pedirlo;
   - de paso, conviene resolver H28 aquí: el límite de intentos de la contraseña actual.
6. **"Mis pedidos":** busca por `cliente_id` y no por email, y solo si la cuenta está verificada. Si no lo está,
   responde 403 con "Confirma tu email para ver tus pedidos".
7. **Al registrar un pedido** (`buscarClienteIdPorEmail`): solo asocia cuentas verificadas.
8. **Google:**
   - al crear una cuenta nueva, `email_verificado = true`;
   - al entrar en una cuenta existente sin verificar, se protege:
     - se marca como verificada, porque Google acaba de comprobar el email;
     - la contraseña se sustituye por una inservible, como las de las cuentas de Google;
     - se revocan todos sus refresh tokens (`refreshTokens.revocarTodasDelUsuario`);
     - se manda el correo 5.
9. **El enlace del correo** lleva a `CLIENT_URL/verificar-email?token=...`, una página del cliente que hace el
   `POST` al pulsar un botón. Si fuera un `GET` directo a la API, algunos filtros de correo, que abren los
   enlaces para analizarlos, gastarían el token antes que la persona.

## Parte 7 · Cambios en el cliente

- **Página `/verificar-email`:** un botón "Confirmar mi email" hace el `POST`, y luego enseña el resultado ("Tu
  cuenta ya está activa", o "El enlace no es válido o ha caducado" con un botón para pedir otro si hay sesión).
- **Aviso en Mi cuenta** mientras no esté verificada: "Te hemos enviado un correo para confirmar tu email", con
  el botón "Enviar otro".
- **"Historial de Pedidos"** sin verificar: el mismo aviso en vez de la lista.
- **Checkout con sesión verificada:** el email es el de la cuenta, sin poder cambiarlo (H6).
- **Perfil, al cambiar el email:** "Te hemos enviado un enlace a {email nuevo}. Hasta que lo confirmes, tu cuenta
  sigue con {email actual}."

## Parte 8 · Orden de trabajo y pruebas

1. **Migración** (con permiso) y la marca manual de la cuenta del administrador.
2. **Servidor** (un commit por punto): verificar y reenviar; el registro; "Mis pedidos" y los pedidos nuevos;
   Google; el cambio de email.
3. **Cliente:** la página, los avisos y el checkout.
4. **Tests**, con `fakeSupabase` como los de 3b:
   - un token caducado, usado o inventado da la misma respuesta;
   - dos confirmaciones a la vez: solo una gana, y no se repite nada;
   - los pedidos de invitado se asocian al verificar, y no antes;
   - una cuenta sin verificar no ve pedidos (403);
   - Google protege una cuenta sin verificar (contraseña anulada, sesiones revocadas);
   - el cambio de email no se aplica hasta confirmarlo, y el email ya ocupado se rechaza.
5. **Prueba de extremo a extremo** con el dominio de Resend ya verificado: registrarse, recibir el correo,
   confirmar y ver los pedidos.

**Tamaño estimado:** una migración y unos 8 a 10 commits. Lo que más tiempo lleva son los tests de los casos
de carrera y el cambio de email.
