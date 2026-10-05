# Correos de contacto y de confirmación al comprador (5 oct 2026)

Plantillas de `server/src/utils/email.js`, con datos de ejemplo inventados para la captura. No se ha
enviado ningún correo: el HTML se ha generado con el envío de Resend sustituido por una función
falsa y se ha abierto con Chromium.

| Archivo | Qué es |
|---|---|
| `contacto.html` | Aviso al equipo cuando alguien escribe desde el formulario de contacto |
| `contacto-800.png` / `contacto-375.png` | Su captura, a 800 px (escritorio) y a 375 px (móvil) |
| `confirmacion-cliente.html` | Confirmación al comprador tras pagar |
| `confirmacion-cliente-800.png` / `confirmacion-cliente-375.png` | Su captura, a 800 y a 375 px |

## Cómo están hechos

- **Maqueta de tablas con estilos en línea.** Sin `<style>`, sin `<div>`, sin flexbox ni grid.
  Ancho máximo de 600 px, centrado, sobre fondo blanco. Fuente Arial/Helvetica.
- **Colores de la web:** #221B16 (fondo oscuro de la cabecera y de los botones, el del hero),
  #F5F2EC (texto de los botones y fondo de los bloques de datos), #6E5D51 (texto secundario) y
  #E2DCD0 (bordes).
- **Cabecera:** "NAVE 5" en texto, sin imágenes. En `email.js` queda comentado cómo poner el logo como
  imagen cuando haya un PNG con URL pública.
- **Botones:** cada uno lleva debajo la dirección en texto, por si el cliente de correo no lo
  enseña. Los dos correos llevan además una versión en texto plano (`text`).
- **Pie:** "Nave 5 Barcelona · nave5barcelona.com", con enlace a la web.

## Contacto

- Nombre, email (como enlace `mailto`) y el mensaje.
- Botón "Responder al cliente": abre un correo nuevo al remitente con el asunto "Re: tu mensaje a
  Nave 5 Barcelona". El email del remitente sigue yendo también en `replyTo`, como antes.

## Confirmación al comprador

- **Título:** "Tu pedido está confirmado". Después, el mismo texto de antes.
- **Referencia del pedido:** la misma que ve el comprador en "Mis pedidos" (`#` y los 8 primeros
  caracteres del id).
- **Piezas:** cada una con su referencia de catálogo (`NAV-…`), además del total, la dirección y las
  notas. La referencia solo va al correo: los items guardados en `pedidos` no cambian.
- **Botón "Ver mi pedido"** (`/cuenta?tab=pedidos`): solo si el comprador tiene cuenta y si
  `CLIENT_URL` es una URL http(s). "Mis pedidos" pide iniciar sesión, así que a quien compra como
  invitado no le serviría.
