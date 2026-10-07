// server/src/utils/email.js
//
// Envío de notificaciones por correo con Resend (https://resend.com).
//
// Variables de entorno necesarias (configúralas en Vercel > Project Settings > Environment
// Variables del proyecto "nave5-api", NUNCA las subas al repositorio):
//   RESEND_API_KEY   - API key de Resend (Dashboard > API Keys). Empieza por "re_...".
//   RESEND_FROM      - Dirección remitente verificada en Resend. Ver nota abajo.
//   ADMIN_EMAIL      - Dirección donde quieres recibir el aviso de cada venta.
//   CONTACT_EMAILS   - Opcional. Direcciones, separadas por comas, que reciben los mensajes
//                      del formulario de contacto. Si no está, se usa ADMIN_EMAIL.
//
// Nota sobre el remitente ("from"):
//   Con el plan gratuito de Resend, solo hay dos opciones para el campo "from":
//     1) El dominio sandbox de Resend, "onboarding@resend.dev" (usado aquí por defecto).
//        Funciona sin configuración extra, pero SOLO entrega correos a la dirección con la
//        que te registraste/verificaste en tu cuenta de Resend (no sirve para avisar a
//        clientes ni a terceros).
//     2) Un dominio propio verificado en Resend (Dashboard > Domains: añadir registros
//        DNS SPF/DKIM). Una vez verificado, puedes usar algo como
//        "Nave 5 Barcelona <ventas@nave5barcelona.com>" y enviar a cualquier destinatario.
//   Como este proyecto probablemente no tiene aún un dominio verificado, se deja
//   "onboarding@resend.dev" como valor por defecto. Verifica un dominio propio en cuanto
//   sea posible y cambia RESEND_FROM en Vercel -- el código no necesita tocarse.

const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const REMITENTE = process.env.RESEND_FROM || 'Nave 5 Barcelona <onboarding@resend.dev>';
const EMAIL_ADMIN = process.env.ADMIN_EMAIL || 'amatashenafi7@gmail.com';

// Modo simulación (sin RESEND_API_KEY): el correo no se envía y solo queda una línea en el log, sin
// su contenido (H27). Antes se escribían el pedido entero, el email y el nombre de las cuentas
// nuevas, los mensajes de contacto y los datos del comprador de las alertas, y en producción
// habrían quedado en los logs de Vercel. Para depurar en local, EMAIL_DEBUG_DATOS=true vuelve a
// escribirlos, pero nunca con NODE_ENV=production. Se lee en cada llamada, no al cargar el módulo.
const AVISO_SIMULADO = '[email simulado omitido: falta RESEND_API_KEY, contenido con datos personales]';
const registrarSimulacion = (tipo, volcarDatos) => {
  console.log(`${AVISO_SIMULADO} (${tipo})`);
  if (process.env.EMAIL_DEBUG_DATOS === 'true' && process.env.NODE_ENV !== 'production') {
    volcarDatos();
  }
};

// Escapa un texto para insertarlo en HTML. Los avisos operativos (enviarAlertaAdmin) llevan
// datos que escribe el comprador (nombre, dirección...), así que nunca se insertan crudos.
const escaparHtml = (texto) => String(texto ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

// ─── Maqueta de los correos rediseñados (contacto y confirmación al cliente) ─────────────────────
// HTML de tablas con estilos en línea: Outlook y Gmail ignoran o recortan <style>, flexbox y grid.
// Ancho máximo de 600 px, centrado, sobre fondo blanco. Colores de la web (client/src/styles/
// index.css): #221B16 (fondo oscuro, el del hero), #F5F2EC (blanco roto), #6E5D51 (texto
// secundario) y #E2DCD0 (bordes). La única imagen es el logo de la cabecera.
const WEB_PUBLICA = 'https://nave5barcelona.com';
const COLOR_OSCURO = '#221B16';
const COLOR_CLARO = '#F5F2EC';
const COLOR_SECUNDARIO = '#6E5D51';
const COLOR_BORDE = '#E2DCD0';
const FUENTE = 'Arial, Helvetica, sans-serif';

// El logo de la cabecera: el de la web (client/src/components/Logo.jsx) en PNG, fondo transparente y
// en blanco roto, en el almacenamiento público de Supabase (bucket imagenes, carpeta marca/). Lo
// generó y subió server/scripts/logo-email.js: 240 px de ancho, y 480 px para pantallas de alta
// densidad (srcset, que solo usan algunos clientes; los demás pintan el de 240 a 120 px).
// Si el cliente de correo bloquea las imágenes, sale el alt "NAVE 5" con el estilo de la celda.
const LOGO_EMAIL = 'https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/marca/logo-nave5.png';
const LOGO_EMAIL_2X = 'https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/marca/logo-nave5@2x.png';

const cabeceraEmail = () => `
          <tr>
            <td style="background-color: ${COLOR_OSCURO}; padding: 32px 40px; font-family: ${FUENTE}; font-size: 26px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; color: ${COLOR_CLARO};">
              <img src="${LOGO_EMAIL}" srcset="${LOGO_EMAIL_2X} 2x" alt="NAVE 5" width="120" style="display:block;border:0;outline:none;height:auto;max-width:120px;">
            </td>
          </tr>`;

const pieEmail = () => `
          <tr>
            <td style="padding: 24px 40px 32px 40px; border-top: 1px solid ${COLOR_BORDE}; font-family: ${FUENTE}; font-size: 12px; line-height: 18px; color: ${COLOR_SECUNDARIO};">
              Nave 5 Barcelona · <a href="${WEB_PUBLICA}" style="color: ${COLOR_SECUNDARIO}; text-decoration: underline;">nave5barcelona.com</a>
            </td>
          </tr>`;

// Botón "a prueba de Outlook": una celda con fondo y un enlace dentro. Debajo va la dirección
// en texto, por si el cliente de correo no enseña el botón.
const botonEmail = ({ href, texto, textoAlternativo }) => `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 28px 0 8px 0;">
                <tr>
                  <td style="background-color: ${COLOR_OSCURO};">
                    <a href="${href}" style="display: inline-block; padding: 14px 28px; font-family: ${FUENTE}; font-size: 13px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; color: ${COLOR_CLARO}; text-decoration: none;">${texto}</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0; font-family: ${FUENTE}; font-size: 12px; line-height: 18px; color: ${COLOR_SECUNDARIO};">${textoAlternativo}</p>`;

// Une cabecera, cuerpo y pie en la tabla de 600 px. `titulo` y `cuerpo` ya vienen escapados.
const maquetarEmail = ({ titulo, cuerpo }) => `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${titulo}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #FFFFFF;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FFFFFF;">
      <tr>
        <td align="center" style="padding: 24px 12px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 600px; background-color: #FFFFFF; border: 1px solid ${COLOR_BORDE};">${cabeceraEmail()}
          <tr>
            <td style="padding: 36px 40px 32px 40px; font-family: ${FUENTE}; font-size: 15px; line-height: 23px; color: ${COLOR_OSCURO};">
              <h1 style="margin: 0 0 20px 0; font-family: ${FUENTE}; font-size: 22px; line-height: 28px; font-weight: bold; color: ${COLOR_OSCURO};">${titulo}</h1>${cuerpo}
            </td>
          </tr>${pieEmail()}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

// Una fila "Etiqueta: valor" dentro de un bloque de datos (fondo blanco roto).
const filaDato = (etiqueta, valorHtml) => `
                <tr>
                  <td style="padding: 6px 0; width: 150px; vertical-align: top; font-family: ${FUENTE}; font-size: 13px; font-weight: bold; color: ${COLOR_SECUNDARIO};">${etiqueta}</td>
                  <td style="padding: 6px 0; vertical-align: top; font-family: ${FUENTE}; font-size: 15px; color: ${COLOR_OSCURO};">${valorHtml}</td>
                </tr>`;

const bloqueDatos = (filasHtml) => `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${COLOR_CLARO}; margin: 4px 0 0 0;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${filasHtml}
                    </table>
                  </td>
                </tr>
              </table>`;

// Referencia corta del pedido, la misma que ve el cliente en "Mis pedidos" (Profile.jsx):
// los 8 primeros caracteres del id, en mayúsculas.
const referenciaPedido = (id) => (id ? `#${String(id).slice(0, 8).toUpperCase()}` : null);

// mailto con el email del remitente: se codifica todo salvo la arroba, para que ninguna
// letra rara del email pueda romper el enlace ni añadir parámetros.
const enlaceMailto = (direccion, asunto) =>
  `mailto:${encodeURIComponent(String(direccion ?? '')).replace(/%40/g, '@')}?subject=${encodeURIComponent(asunto)}`;

// Construye el HTML del correo de aviso de venta. Estilos en línea (inline) porque
// la mayoría de clientes de correo ignoran o recortan <style> en el <head>.
const construirHtmlVenta = (pedido) => {
  const { items = [], clienteInfo = {}, total = 0, fecha = new Date() } = pedido;

  const fechaFormateada = new Date(fecha).toLocaleString('es-ES', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  const filasProductos = items.map(item => `
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #E2DCD0; color: #3E322A;">
        ${escaparHtml(item.nombre)}${item.modalidad === 'alquiler' ? ' (alquiler / día)' : ''}
      </td>
      <td style="padding: 8px 0; border-bottom: 1px solid #E2DCD0; color: #857468; text-align: right;">
        ${item.cantidad || 1} x ${Number(item.precio).toFixed(2)} €
      </td>
    </tr>
  `).join('');

  return `
    <div style="font-family: Helvetica, Arial, sans-serif; color: #3E322A; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #F5F2EC; border-radius: 8px;">
      <h2 style="color: #3E322A; border-bottom: 2px solid #E2DCD0; padding-bottom: 12px; margin-top: 0;">
        Nueva venta en Nave 5 Barcelona
      </h2>

      <p style="color: #857468;">Se ha completado una transacción con éxito. Aquí tienes los detalles:</p>

      <h3 style="color: #857468; margin-bottom: 6px;">Cliente</h3>
      <p style="margin: 4px 0;"><strong>Nombre:</strong> ${escaparHtml(clienteInfo.nombre) || 'No provisto'}</p>
      <p style="margin: 4px 0;"><strong>Email:</strong> ${escaparHtml(clienteInfo.email) || 'No provisto'}</p>
      <p style="margin: 4px 0;"><strong>Teléfono:</strong> ${escaparHtml(clienteInfo.telefono) || 'No provisto'}</p>
      <p style="margin: 4px 0;"><strong>Dirección de entrega:</strong> ${escaparHtml(clienteInfo.direccion) || 'No provista'}</p>
      <p style="margin: 4px 0;"><strong>Notas:</strong> ${escaparHtml(clienteInfo.notas) || 'Ninguna'}</p>
      <p style="margin: 4px 0;"><strong>Método de pago:</strong> ${escaparHtml(clienteInfo.metodoPago) || 'Tarjeta (Stripe)'}</p>

      <h3 style="color: #857468; margin-top: 24px; margin-bottom: 6px;">Productos</h3>
      <table style="width: 100%; border-collapse: collapse;">
        ${filasProductos}
      </table>

      <div style="margin-top: 24px; padding: 14px 16px; background-color: #FCFAF8; border: 1px solid #E2DCD0; border-radius: 4px; text-align: right;">
        <strong style="font-size: 1.1rem;">Total: ${Number(total).toFixed(2)} €</strong>
      </div>

      <p style="font-size: 0.85rem; color: #857468; margin-top: 32px; border-top: 1px solid #E2DCD0; padding-top: 10px; text-align: center;">
        ${fechaFormateada} · Nave 5 Barcelona · Almacén de ideas
      </p>
    </div>
  `;
};

// Envía al administrador un aviso por correo de que se ha completado una venta.
// `pedido` = { items: [{ nombre, modalidad, cantidad, precio }], clienteInfo: {...}, total, fecha }
//
// Importante: esta función nunca lanza (throw). Un fallo en el envío del correo se
// registra en consola pero jamás debe interrumpir el flujo de checkout del cliente.
const enviarNotificacionVenta = async (pedido) => {
  try {
    if (!resend) {
      registrarSimulacion('aviso de venta al administrador', () => {
        console.log('Para:', EMAIL_ADMIN);
        console.log('Pedido:', JSON.stringify(pedido, null, 2));
      });
      return;
    }

    const total = pedido.total ?? (pedido.items || []).reduce(
      (acc, item) => acc + Number(item.precio) * (item.cantidad || 1), 0
    );

    const { data, error } = await resend.emails.send({
      from: REMITENTE,
      to: EMAIL_ADMIN,
      subject: `Nueva venta en Nave 5 Barcelona - ${Number(total).toFixed(2)} €`,
      html: construirHtmlVenta({ ...pedido, total }),
    });

    if (error) {
      // La API de Resend devuelve el error en el propio objeto de respuesta en vez de
      // lanzar una excepción -- lo tratamos igual que un throw, pero sin romper el checkout.
      console.error('Error al enviar la notificación de venta (Resend):', error);
      return;
    }

    console.log('Correo de notificación de venta enviado. ID Resend:', data?.id);
  } catch (error) {
    console.error('Error al enviar la notificación de venta (Resend):', error.message || error);
  }
};

// Construye el HTML del correo de confirmación que recibe el propio comprador. Mismo texto que
// antes, con la maqueta común: referencia del pedido, piezas (con su referencia de catálogo si la
// hay), total, dirección de envío y, si el comprador tiene cuenta, un botón a "Mis pedidos".
const construirHtmlConfirmacionCliente = (pedido) => {
  const { id, items = [], clienteInfo = {}, total = 0, fecha = new Date(), urlMisPedidos = null } = pedido;

  const fechaFormateada = new Date(fecha).toLocaleString('es-ES', {
    dateStyle: 'long',
    timeStyle: 'short',
  });
  const referencia = referenciaPedido(id);

  const filasProductos = items.map(item => `
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid ${COLOR_BORDE}; font-family: ${FUENTE}; font-size: 15px; color: ${COLOR_OSCURO};">
                    ${escaparHtml(item.nombre)}${item.modalidad === 'alquiler' ? ' (alquiler / día)' : ''}${item.referencia ? `<br><span style="font-size: 12px; color: ${COLOR_SECUNDARIO};">Ref. ${escaparHtml(item.referencia)}</span>` : ''}
                  </td>
                  <td style="padding: 10px 0; border-bottom: 1px solid ${COLOR_BORDE}; font-family: ${FUENTE}; font-size: 15px; color: ${COLOR_SECUNDARIO}; text-align: right; white-space: nowrap; vertical-align: top;">
                    ${item.cantidad || 1} x ${Number(item.precio).toFixed(2)} €
                  </td>
                </tr>`).join('');

  const notas = clienteInfo.notas && clienteInfo.notas !== 'Ninguna'
    ? filaDato('Notas', escaparHtml(clienteInfo.notas))
    : '';

  const cuerpo = `
              <p style="margin: 0 0 8px 0;">¡Gracias por tu compra, ${escaparHtml(clienteInfo.nombre)}!</p>
              <p style="margin: 0 0 24px 0; color: ${COLOR_SECUNDARIO};">
                Hemos recibido tu pago correctamente. Aquí tienes el resumen de tu pedido en Nave 5 Barcelona.
              </p>
${bloqueDatos(`${referencia ? filaDato('Pedido', `<strong>${referencia}</strong>`) : ''}${filaDato('Fecha', escaparHtml(fechaFormateada))}`)}
              <h2 style="margin: 28px 0 4px 0; font-family: ${FUENTE}; font-size: 13px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; color: ${COLOR_SECUNDARIO};">Piezas</h2>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${filasProductos}
                <tr>
                  <td style="padding: 14px 0 0 0; font-family: ${FUENTE}; font-size: 16px; font-weight: bold; color: ${COLOR_OSCURO};">Total</td>
                  <td style="padding: 14px 0 0 0; font-family: ${FUENTE}; font-size: 16px; font-weight: bold; color: ${COLOR_OSCURO}; text-align: right; white-space: nowrap;">${Number(total).toFixed(2)} €</td>
                </tr>
              </table>
              <h2 style="margin: 28px 0 4px 0; font-family: ${FUENTE}; font-size: 13px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; color: ${COLOR_SECUNDARIO};">Envío a</h2>
${bloqueDatos(`${filaDato('Dirección', escaparHtml(clienteInfo.direccion) || 'Dirección no provista')}${notas}`)}
              <p style="margin: 24px 0 0 0; color: ${COLOR_SECUNDARIO};">
                Prepararemos tu pedido y nos pondremos en contacto contigo al teléfono o email indicados
                en cuanto esté listo para el envío. Si tienes cualquier duda, simplemente responde a este
                correo.
              </p>${urlMisPedidos ? botonEmail({
    href: escaparHtml(urlMisPedidos),
    texto: 'Ver mi pedido',
    textoAlternativo: `Si el botón no funciona, entra en ${escaparHtml(urlMisPedidos)}`
  }) : ''}`;

  return maquetarEmail({ titulo: 'Tu pedido está confirmado', cuerpo });
};

// Versión en texto plano del mismo correo, para los clientes que no enseñan HTML.
const construirTextoConfirmacionCliente = (pedido) => {
  const { id, items = [], clienteInfo = {}, total = 0, urlMisPedidos = null } = pedido;
  const referencia = referenciaPedido(id);
  const lineas = [
    'NAVE 5',
    '',
    'Tu pedido está confirmado',
    '',
    `¡Gracias por tu compra, ${clienteInfo.nombre || ''}!`,
    'Hemos recibido tu pago correctamente. Aquí tienes el resumen de tu pedido en Nave 5 Barcelona.',
    ''
  ];
  if (referencia) lineas.push(`Pedido: ${referencia}`, '');
  items.forEach(item => {
    const alquiler = item.modalidad === 'alquiler' ? ' (alquiler / día)' : '';
    const ref = item.referencia ? ` [Ref. ${item.referencia}]` : '';
    lineas.push(`- ${item.nombre}${alquiler}${ref}: ${item.cantidad || 1} x ${Number(item.precio).toFixed(2)} €`);
  });
  lineas.push(`Total: ${Number(total).toFixed(2)} €`, '', `Envío a: ${clienteInfo.direccion || 'Dirección no provista'}`);
  if (clienteInfo.notas && clienteInfo.notas !== 'Ninguna') lineas.push(`Notas: ${clienteInfo.notas}`);
  lineas.push(
    '',
    'Prepararemos tu pedido y nos pondremos en contacto contigo al teléfono o email indicados en cuanto esté listo para el envío. Si tienes cualquier duda, simplemente responde a este correo.'
  );
  if (urlMisPedidos) lineas.push('', `Ver mi pedido: ${urlMisPedidos}`);
  lineas.push('', `Nave 5 Barcelona · ${WEB_PUBLICA}`);
  return lineas.join('\n');
};

// Envía al COMPRADOR la confirmación de que su pedido se ha registrado con éxito.
// Igual de tolerante a fallos que enviarNotificacionVenta: nunca lanza, un fallo aquí
// no debe romper el checkout ni impedir que se guarde el pedido o se avise al admin.
//
// Aviso importante: con el dominio "sandbox" de Resend (onboarding@resend.dev, el valor
// por defecto si no se configura RESEND_FROM), Resend SOLO entrega correos a la dirección
// con la que se verificó la cuenta de Resend -- no a clientes reales con otro email. Para
// que este correo le llegue a cualquier comprador hace falta verificar un dominio propio
// en Resend (Dashboard > Domains) y apuntar RESEND_FROM a ese dominio.
const enviarConfirmacionCliente = async (pedido) => {
  try {
    const destinatario = pedido?.clienteInfo?.email;
    if (!destinatario) {
      console.warn('enviarConfirmacionCliente: el pedido no trae email de cliente, no se envía nada.');
      return;
    }

    if (!resend) {
      registrarSimulacion('confirmación de pedido al cliente', () => {
        console.log('Para:', destinatario);
        console.log('Pedido:', JSON.stringify(pedido, null, 2));
      });
      return;
    }

    const total = pedido.total ?? (pedido.items || []).reduce(
      (acc, item) => acc + Number(item.precio) * (item.cantidad || 1), 0
    );

    // El botón "Ver mi pedido" lleva a "Mis pedidos" de la web, que pide iniciar sesión: solo se
    // pone si el comprador tiene cuenta (pagos.js lo indica con `conCuenta`) y si se conoce la URL
    // pública de la web (CLIENT_URL, la misma que usan las páginas de vuelta de Stripe).
    const urlWeb = (process.env.CLIENT_URL || '').replace(/\/+$/, '');
    const urlMisPedidos = pedido.conCuenta && /^https?:\/\//.test(urlWeb) ? `${urlWeb}/cuenta?tab=pedidos` : null;
    const datos = { ...pedido, total, urlMisPedidos };

    const { data, error } = await resend.emails.send({
      from: REMITENTE,
      to: destinatario,
      subject: 'Hemos recibido tu pedido - Nave 5 Barcelona',
      html: construirHtmlConfirmacionCliente(datos),
      text: construirTextoConfirmacionCliente(datos),
    });

    if (error) {
      console.error('Error al enviar la confirmación al cliente (Resend):', error);
      return;
    }

    console.log('Correo de confirmación al cliente enviado. ID Resend:', data?.id);
  } catch (error) {
    console.error('Error al enviar la confirmación al cliente (Resend):', error.message || error);
  }
};

// Construye el HTML del correo de bienvenida para una cuenta nueva.
const construirHtmlBienvenida = (nombreCliente) => `
  <div style="font-family: Helvetica, Arial, sans-serif; color: #3E322A; max-width: 600px; margin: 0 auto; background-color: #FCFAF8; border: 1px solid #E2DCD0; border-radius: 6px; overflow: hidden;">
    <div style="background-color: #3E322A; padding: 40px 30px; text-align: center;">
      <h1 style="color: #FCFAF8; font-size: 1.5rem; font-weight: 300; text-transform: uppercase; letter-spacing: 3px; margin: 0 0 10px 0;">Nave 5 Barcelona</h1>
      <p style="color: #B38A70; font-size: 0.85rem; margin: 0; letter-spacing: 1px; font-style: italic;">Almacén de ideas</p>
    </div>
    <div style="padding: 40px 30px; line-height: 1.6;">
      <h2 style="font-size: 1.25rem; font-weight: 400; margin-top: 0; color: #3E322A;">¡Hola, ${escaparHtml(nombreCliente)}!</h2>
      <p style="font-size: 0.95rem; color: #857468; margin-bottom: 20px;">
        Te damos la bienvenida más cálida a <strong>Nave 5 Barcelona</strong>. Nos hace inmensamente felices que te unas a nuestra pequeña gran comunidad dedicada a la recuperación y restauración artesanal de piezas singulares.
      </p>
      <p style="font-size: 0.95rem; color: #857468; margin-bottom: 20px;">
        Creemos en un diseño sincero y sostenible, en piezas con alma y carácter que añaden calidez y una historia que contar a los hogares contemporáneos.
      </p>
      <div style="background-color: #F5F2EC; border-left: 3px solid #B38A70; padding: 20px; margin: 30px 0; border-radius: 4px;">
        <p style="margin: 0; font-style: italic; color: #3E322A; font-size: 0.92rem;">"La imperfección del paso del tiempo restaurada con respeto y pasión."</p>
      </div>
      <p style="font-size: 0.95rem; color: #857468; margin-bottom: 20px;">
        A partir de ahora tienes acceso a tu panel de compras, puedes guardar tus piezas favoritas y disfrutar de un proceso de compra fluido y seguro.
      </p>
      <div style="text-align: center; margin: 35px 0 15px 0;">
        <a href="https://nave5barcelona.com" style="background-color: #B38A70; color: #FCFAF8; text-decoration: none; padding: 14px 28px; font-size: 0.88rem; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 500; border-radius: 4px; display: inline-block;">Visitar Colección</a>
      </div>
    </div>
    <div style="background-color: #F5F2EC; border-top: 1px solid #E2DCD0; padding: 30px; text-align: center; font-size: 0.8rem; color: #857468;">
      <p style="margin: 4px 0;"><strong>Nave 5 Barcelona | Almacén de ideas</strong></p>
      <p style="margin: 4px 0;">Carrer del Plom, 32-34, interior, 08038 Barcelona</p>
      <p style="margin: 4px 0;">Sostenibilidad • Artesanía • Diseño Slow</p>
    </div>
  </div>
`;

// Envía el correo de bienvenida a una cuenta recién registrada. Antes esta web usaba
// Nodemailer con un SMTP de prueba (Ethereal) solo para este correo, mientras que las
// notificaciones de venta ya usaban Resend -- dos proveedores de email distintos para
// mantener. Ahora todo pasa por Resend, igual que el resto de correos de la tienda.
// Nunca lanza: un fallo aquí no debe impedir que la cuenta se cree con éxito.
const enviarEmailBienvenida = async (emailDestinatario, nombreCliente) => {
  try {
    if (!resend) {
      registrarSimulacion('bienvenida', () =>
        console.log(`Bienvenida para ${emailDestinatario} (${nombreCliente})`)
      );
      return;
    }

    const { data, error } = await resend.emails.send({
      from: REMITENTE,
      to: emailDestinatario,
      subject: '¡Te damos la bienvenida a Nave 5 Barcelona! 🤎',
      html: construirHtmlBienvenida(nombreCliente),
    });

    if (error) {
      console.error('Error al enviar el email de bienvenida (Resend):', error);
      return;
    }

    console.log('Correo de bienvenida enviado. ID Resend:', data?.id);
  } catch (error) {
    console.error('Error al enviar el email de bienvenida (Resend):', error.message || error);
  }
};

// Quién recibe los mensajes del formulario de contacto: las direcciones de CONTACT_EMAILS
// (separadas por comas, sin espacios ni huecos vacíos) o, si no hay ninguna, ADMIN_EMAIL, como
// antes. Se lee en cada llamada. Los avisos de venta y las alertas siguen yendo solo a ADMIN_EMAIL.
const destinatariosContacto = () => {
  const lista = (process.env.CONTACT_EMAILS || '')
    .split(',')
    .map(direccion => direccion.trim())
    .filter(Boolean);
  return lista.length > 0 ? lista : [EMAIL_ADMIN];
};

// Correo del formulario de contacto para el equipo: datos del remitente, el mensaje y un botón
// para responderle. El email del remitente también va en replyTo, así que "Responder" funciona igual.
const ASUNTO_RESPUESTA_CONTACTO = 'Re: tu mensaje a Nave 5 Barcelona';

const construirHtmlContacto = ({ nombre, email, mensaje }) => {
  const mailto = escaparHtml(enlaceMailto(email, ASUNTO_RESPUESTA_CONTACTO));
  const cuerpo = `
${bloqueDatos(`${filaDato('Nombre', escaparHtml(nombre))}${filaDato('Email', `<a href="${mailto}" style="color: ${COLOR_OSCURO}; text-decoration: underline;">${escaparHtml(email)}</a>`)}`)}
              <h2 style="margin: 28px 0 8px 0; font-family: ${FUENTE}; font-size: 13px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; color: ${COLOR_SECUNDARIO};">Mensaje</h2>
              <p style="margin: 0; white-space: pre-wrap; color: ${COLOR_OSCURO};">${escaparHtml(mensaje)}</p>${botonEmail({
    href: mailto,
    texto: 'Responder al cliente',
    textoAlternativo: `O escribe a ${escaparHtml(email)}`
  })}`;

  return maquetarEmail({ titulo: 'Nuevo mensaje desde el formulario de contacto', cuerpo });
};

const construirTextoContacto = ({ nombre, email, mensaje }) => [
  'NAVE 5',
  '',
  'Nuevo mensaje desde el formulario de contacto',
  '',
  `Nombre: ${nombre}`,
  `Email: ${email}`,
  '',
  'Mensaje:',
  mensaje,
  '',
  `Responder al cliente: ${enlaceMailto(email, ASUNTO_RESPUESTA_CONTACTO)}`,
  '',
  `Nave 5 Barcelona · ${WEB_PUBLICA}`
].join('\n');

// Envía a destinatariosContacto() el mensaje escrito en el formulario de "Contacto". A
// diferencia de los correos anteriores, aquí sí importa que el controlador sepa si el envío
// falló (para avisar al visitante de que lo intente de nuevo), así que devuelve
// true/false en vez de tragarse el error.
const enviarMensajeContacto = async ({ nombre, email, mensaje }) => {
  try {
    const destinatarios = destinatariosContacto();

    if (!resend) {
      registrarSimulacion('mensaje de contacto', () => {
        console.log('Para:', destinatarios.join(', '));
        console.log(`Contacto de ${nombre} <${email}>: ${mensaje}`);
      });
      return true;
    }

    const { data, error } = await resend.emails.send({
      from: REMITENTE,
      to: destinatarios,
      replyTo: email,
      subject: `Nuevo mensaje de contacto — ${nombre}`,
      html: construirHtmlContacto({ nombre, email, mensaje }),
      text: construirTextoContacto({ nombre, email, mensaje }),
    });

    if (error) {
      console.error('Error al enviar el mensaje de contacto (Resend):', error);
      return false;
    }

    console.log('Mensaje de contacto enviado. ID Resend:', data?.id);
    return true;
  } catch (error) {
    console.error('Error al enviar el mensaje de contacto (Resend):', error.message || error);
    return false;
  }
};

// Aviso operativo al administrador: algo que requiere que una persona intervenga (una
// doble venta, un pago cobrado que no se pudo registrar...). `detalles` es una lista de
// frases; todo se escapa antes de ir al HTML. Como los avisos de venta, nunca lanza: un
// fallo aquí solo se registra en consola.
const enviarAlertaAdmin = async ({ asunto, detalles = [] }) => {
  try {
    if (!resend) {
      registrarSimulacion('alerta al administrador', () => {
        console.log('Para:', EMAIL_ADMIN);
        console.log('Asunto:', asunto);
        detalles.forEach(detalle => console.log('-', detalle));
      });
      return;
    }

    const { data, error } = await resend.emails.send({
      from: REMITENTE,
      to: EMAIL_ADMIN,
      subject: `[Aviso] ${asunto}`,
      html: `
        <div style="font-family: Helvetica, Arial, sans-serif; color: #3E322A; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #F5F2EC; border-radius: 8px;">
          <h2 style="color: #3E322A; border-bottom: 2px solid #E2DCD0; padding-bottom: 12px; margin-top: 0;">
            ${escaparHtml(asunto)}
          </h2>
          <ul style="padding-left: 20px; line-height: 1.5;">
            ${detalles.map(detalle => `<li style="margin: 6px 0;">${escaparHtml(detalle)}</li>`).join('')}
          </ul>
          <p style="font-size: 0.85rem; color: #857468; margin-top: 24px; border-top: 1px solid #E2DCD0; padding-top: 10px;">
            Aviso automático de Nave 5 Barcelona.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('Error al enviar la alerta al administrador (Resend):', error);
      return;
    }

    console.log('Alerta al administrador enviada. ID Resend:', data?.id);
  } catch (error) {
    console.error('Error al enviar la alerta al administrador (Resend):', error.message || error);
  }
};

module.exports = {
  enviarNotificacionVenta, enviarConfirmacionCliente, enviarEmailBienvenida, enviarMensajeContacto, enviarAlertaAdmin
};
