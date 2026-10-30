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
const { BRAND } = require('../config/brand.config');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const REMITENTE = process.env.RESEND_FROM || BRAND.email.remitentePorDefecto;
const EMAIL_ADMIN = process.env.ADMIN_EMAIL || BRAND.email.avisosPorDefecto;

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
// Nombre, web, logo y colores salen de la marca (src/config/brand.config.js).
const MARCA = BRAND.nombre;
const NOMBRE_LOGO = BRAND.nombreLogo;
const ESLOGAN = BRAND.eslogan;
const WEB_PUBLICA = `https://${BRAND.dominio}`;
const {
  oscuro: COLOR_OSCURO,
  claro: COLOR_CLARO,
  secundario: COLOR_SECUNDARIO,
  borde: COLOR_BORDE,
  texto: COLOR_TEXTO,
  textoSuave: COLOR_TEXTO_SUAVE,
  acento: COLOR_ACENTO,
  superficie: COLOR_SUPERFICIE,
  blanco: COLOR_BLANCO
} = BRAND.email.colores;
const FUENTE = 'Arial, Helvetica, sans-serif';

// El logo de la cabecera: el de la web (client/src/components/Logo.jsx) en PNG, fondo transparente y
// en blanco roto, en el almacenamiento público de Supabase (bucket imagenes, carpeta marca/). Lo
// generó y subió server/scripts/logo-email.js: 240 px de ancho, y 480 px para pantallas de alta
// densidad (srcset, que solo usan algunos clientes; los demás pintan el de 240 a 120 px).
// Si el cliente de correo bloquea las imágenes, sale el alt "NAVE 5" con el estilo de la celda.
const LOGO_EMAIL = BRAND.email.logo;
const LOGO_EMAIL_2X = BRAND.email.logo2x;

const cabeceraEmail = () => `
          <tr>
            <td style="background-color: ${COLOR_OSCURO}; padding: 32px 40px; font-family: ${FUENTE}; font-size: 26px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; color: ${COLOR_CLARO};">
              <img src="${LOGO_EMAIL}" srcset="${LOGO_EMAIL_2X} 2x" alt="${NOMBRE_LOGO}" width="120" style="display:block;border:0;outline:none;height:auto;max-width:120px;">
            </td>
          </tr>`;

const pieEmail = () => `
          <tr>
            <td style="padding: 24px 40px 32px 40px; border-top: 1px solid ${COLOR_BORDE}; font-family: ${FUENTE}; font-size: 12px; line-height: 18px; color: ${COLOR_SECUNDARIO};">
              ${MARCA} · <a href="${WEB_PUBLICA}" style="color: ${COLOR_SECUNDARIO}; text-decoration: underline;">${BRAND.dominio}</a>
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
  <body style="margin: 0; padding: 0; background-color: ${COLOR_BLANCO};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${COLOR_BLANCO};">
      <tr>
        <td align="center" style="padding: 24px 12px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 600px; background-color: ${COLOR_BLANCO}; border: 1px solid ${COLOR_BORDE};">${cabeceraEmail()}
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
      <td style="padding: 8px 0; border-bottom: 1px solid ${COLOR_BORDE}; color: ${COLOR_TEXTO};">
        ${escaparHtml(item.nombre)}${item.modalidad === 'alquiler' ? ' (alquiler / día)' : ''}
      </td>
      <td style="padding: 8px 0; border-bottom: 1px solid ${COLOR_BORDE}; color: ${COLOR_TEXTO_SUAVE}; text-align: right;">
        ${item.cantidad || 1} x ${Number(item.precio).toFixed(2)} €
      </td>
    </tr>
  `).join('');

  return `
    <div style="font-family: Helvetica, Arial, sans-serif; color: ${COLOR_TEXTO}; max-width: 600px; margin: 0 auto; padding: 24px; background-color: ${COLOR_CLARO}; border-radius: 8px;">
      <h2 style="color: ${COLOR_TEXTO}; border-bottom: 2px solid ${COLOR_BORDE}; padding-bottom: 12px; margin-top: 0;">
        Nueva venta en ${MARCA}
      </h2>

      <p style="color: ${COLOR_TEXTO_SUAVE};">Se ha completado una transacción con éxito. Aquí tienes los detalles:</p>

      <h3 style="color: ${COLOR_TEXTO_SUAVE}; margin-bottom: 6px;">Cliente</h3>
      <p style="margin: 4px 0;"><strong>Nombre:</strong> ${escaparHtml(clienteInfo.nombre) || 'No provisto'}</p>
      <p style="margin: 4px 0;"><strong>Email:</strong> ${escaparHtml(clienteInfo.email) || 'No provisto'}</p>
      <p style="margin: 4px 0;"><strong>Teléfono:</strong> ${escaparHtml(clienteInfo.telefono) || 'No provisto'}</p>
      <p style="margin: 4px 0;"><strong>Dirección de entrega:</strong> ${escaparHtml(clienteInfo.direccion) || 'No provista'}</p>
      <p style="margin: 4px 0;"><strong>Notas:</strong> ${escaparHtml(clienteInfo.notas) || 'Ninguna'}</p>
      <p style="margin: 4px 0;"><strong>Método de pago:</strong> ${escaparHtml(clienteInfo.metodoPago) || 'Tarjeta (Stripe)'}</p>

      <h3 style="color: ${COLOR_TEXTO_SUAVE}; margin-top: 24px; margin-bottom: 6px;">Productos</h3>
      <table style="width: 100%; border-collapse: collapse;">
        ${filasProductos}
      </table>

      <div style="margin-top: 24px; padding: 14px 16px; background-color: ${COLOR_SUPERFICIE}; border: 1px solid ${COLOR_BORDE}; border-radius: 4px; text-align: right;">
        <strong style="font-size: 1.1rem;">Total: ${Number(total).toFixed(2)} €</strong>
      </div>

      <p style="font-size: 0.85rem; color: ${COLOR_TEXTO_SUAVE}; margin-top: 32px; border-top: 1px solid ${COLOR_BORDE}; padding-top: 10px; text-align: center;">
        ${fechaFormateada} · ${MARCA} · ${ESLOGAN}
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
      subject: `Nueva venta en ${MARCA} - ${Number(total).toFixed(2)} €`,
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
                Hemos recibido tu pago correctamente. Aquí tienes el resumen de tu pedido en ${MARCA}.
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
    NOMBRE_LOGO,
    '',
    'Tu pedido está confirmado',
    '',
    `¡Gracias por tu compra, ${clienteInfo.nombre || ''}!`,
    `Hemos recibido tu pago correctamente. Aquí tienes el resumen de tu pedido en ${MARCA}.`,
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
  lineas.push('', `${MARCA} · ${WEB_PUBLICA}`);
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
      subject: `Hemos recibido tu pedido - ${MARCA}`,
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
  <div style="font-family: Helvetica, Arial, sans-serif; color: ${COLOR_TEXTO}; max-width: 600px; margin: 0 auto; background-color: ${COLOR_SUPERFICIE}; border: 1px solid ${COLOR_BORDE}; border-radius: 6px; overflow: hidden;">
    <div style="background-color: ${COLOR_TEXTO}; padding: 40px 30px; text-align: center;">
      <h1 style="color: ${COLOR_SUPERFICIE}; font-size: 1.5rem; font-weight: 300; text-transform: uppercase; letter-spacing: 3px; margin: 0 0 10px 0;">${MARCA}</h1>
      <p style="color: ${COLOR_ACENTO}; font-size: 0.85rem; margin: 0; letter-spacing: 1px; font-style: italic;">${ESLOGAN}</p>
    </div>
    <div style="padding: 40px 30px; line-height: 1.6;">
      <h2 style="font-size: 1.25rem; font-weight: 400; margin-top: 0; color: ${COLOR_TEXTO};">¡Hola, ${escaparHtml(nombreCliente)}!</h2>
      <p style="font-size: 0.95rem; color: ${COLOR_TEXTO_SUAVE}; margin-bottom: 20px;">
        Te damos la bienvenida más cálida a <strong>${MARCA}</strong>. Nos hace inmensamente felices que te unas a nuestra pequeña gran comunidad dedicada a la recuperación y restauración artesanal de piezas singulares.
      </p>
      <p style="font-size: 0.95rem; color: ${COLOR_TEXTO_SUAVE}; margin-bottom: 20px;">
        Creemos en un diseño sincero y sostenible, en piezas con alma y carácter que añaden calidez y una historia que contar a los hogares contemporáneos.
      </p>
      <div style="background-color: ${COLOR_CLARO}; border-left: 3px solid ${COLOR_ACENTO}; padding: 20px; margin: 30px 0; border-radius: 4px;">
        <p style="margin: 0; font-style: italic; color: ${COLOR_TEXTO}; font-size: 0.92rem;">"La imperfección del paso del tiempo restaurada con respeto y pasión."</p>
      </div>
      <p style="font-size: 0.95rem; color: ${COLOR_TEXTO_SUAVE}; margin-bottom: 20px;">
        A partir de ahora tienes acceso a tu panel de compras, puedes guardar tus piezas favoritas y disfrutar de un proceso de compra fluido y seguro.
      </p>
      <div style="text-align: center; margin: 35px 0 15px 0;">
        <a href="${WEB_PUBLICA}" style="background-color: ${COLOR_ACENTO}; color: ${COLOR_SUPERFICIE}; text-decoration: none; padding: 14px 28px; font-size: 0.88rem; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 500; border-radius: 4px; display: inline-block;">Visitar Colección</a>
      </div>
    </div>
    <div style="background-color: ${COLOR_CLARO}; border-top: 1px solid ${COLOR_BORDE}; padding: 30px; text-align: center; font-size: 0.8rem; color: ${COLOR_TEXTO_SUAVE};">
      <p style="margin: 4px 0;"><strong>${MARCA} | ${ESLOGAN}</strong></p>
      <p style="margin: 4px 0;">${BRAND.contacto.direccion}, ${BRAND.contacto.codigoPostal} ${BRAND.contacto.ciudad}</p>
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
      subject: `¡Te damos la bienvenida a ${MARCA}! 🤎`,
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

// ─── Correos de la verificación del email (H18, docs/verificacion-email-diseno.md, parte 3) ──────
// Con la maqueta común. Como los demás correos a clientes, nunca lanzan: un fallo se registra y la
// cuenta sigue su curso (desde Mi cuenta se puede pedir otro enlace).

// Oculta la parte local del email para el aviso al email antiguo: "ana@gmail.com" -> "a***@gmail.com".
const ocultarEmail = (direccion) => {
  const texto = String(direccion ?? '');
  const arroba = texto.lastIndexOf('@');
  if (arroba < 1) return '***';
  return `${texto[0]}***${texto.slice(arroba)}`;
};

const parrafo = (html, { secundario = false } = {}) =>
  `\n              <p style="margin: 0 0 16px 0;${secundario ? ` color: ${COLOR_SECUNDARIO};` : ''}">${html}</p>`;

// Envía un correo de cuenta ya construido. `tipo` solo sirve para el log.
const enviarCorreoCuenta = async ({ tipo, para, asunto, html, texto }) => {
  try {
    if (!resend) {
      registrarSimulacion(tipo, () => {
        console.log('Para:', para);
        console.log(texto);
      });
      return;
    }

    const { data, error } = await resend.emails.send({
      from: REMITENTE,
      to: para,
      subject: asunto,
      html,
      text: texto,
    });

    if (error) {
      console.error(`Error al enviar el correo de ${tipo} (Resend):`, error);
      return;
    }

    console.log(`Correo de ${tipo} enviado. ID Resend:`, data?.id);
  } catch (error) {
    console.error(`Error al enviar el correo de ${tipo} (Resend):`, error.message || error);
  }
};

const textoPlano = (titulo, lineas) =>
  [NOMBRE_LOGO, '', titulo, '', ...lineas, '', `${MARCA} · ${WEB_PUBLICA}`].join('\n');

// 1. Confirmar el email (al registrarse). Sustituye al de bienvenida, para no mandar dos.
const construirConfirmarRegistro = ({ nombre, url }) => {
  const titulo = 'Confirma tu email';
  const cuerpo = `${parrafo(`¡Hola, ${escaparHtml(nombre)}!`)}${parrafo(
    `Gracias por unirte a ${MARCA}. Para activar tu cuenta, confirma que este email es tuyo:`
  )}${botonEmail({
    href: escaparHtml(url),
    texto: 'Confirmar mi email',
    textoAlternativo: `Si el botón no funciona, entra en ${escaparHtml(url)}`
  })}${parrafo('<br>El enlace caduca en 24 horas. Si ha caducado, entra en tu cuenta y pide otro.', { secundario: true })}${parrafo(
    'Si no has creado tú esta cuenta, ignora este correo: sin confirmarla, nadie podrá ver tus compras.',
    { secundario: true }
  )}`;
  return {
    asunto: `Confirma tu email y bienvenido a ${MARCA}`,
    html: maquetarEmail({ titulo, cuerpo }),
    texto: textoPlano(titulo, [
      `¡Hola, ${nombre || ''}!`,
      `Gracias por unirte a ${MARCA}. Para activar tu cuenta, confirma que este email es tuyo:`,
      '',
      `Confirmar mi email: ${url}`,
      '',
      'El enlace caduca en 24 horas. Si ha caducado, entra en tu cuenta y pide otro.',
      'Si no has creado tú esta cuenta, ignora este correo: sin confirmarla, nadie podrá ver tus compras.'
    ])
  };
};

const enviarConfirmarRegistro = ({ email, nombre, url }) =>
  enviarCorreoCuenta({ tipo: 'confirmar email (registro)', para: email, ...construirConfirmarRegistro({ nombre, url }) });

// 2. Cuenta activada (después de confirmar): el de bienvenida de siempre, con la última frase
// cambiada.
const construirCuentaActivada = ({ nombre }) => ({
  asunto: `Tu cuenta de ${MARCA} ya está activa 🤎`,
  html: construirHtmlBienvenida(nombre).replace(
    'A partir de ahora tienes acceso a tu panel de compras, puedes guardar tus piezas favoritas y disfrutar de un proceso de compra fluido y seguro.',
    'Ya puedes ver tu historial de compras en Mi cuenta, guardar tus piezas favoritas y comprar en un momento.'
  ),
  texto: textoPlano('Tu cuenta ya está activa', [
    `¡Hola, ${nombre || ''}!`,
    `Te damos la bienvenida más cálida a ${MARCA}.`,
    'Ya puedes ver tu historial de compras en Mi cuenta, guardar tus piezas favoritas y comprar en un momento.'
  ])
});

const enviarCuentaActivada = ({ email, nombre }) =>
  enviarCorreoCuenta({ tipo: 'cuenta activada', para: email, ...construirCuentaActivada({ nombre }) });

// 3. Confirmar el email nuevo (al cambiarlo; va a la dirección nueva).
const construirConfirmarCambio = ({ nombre, url }) => {
  const titulo = 'Confirma tu nuevo email';
  const cuerpo = `${parrafo(`Hola, ${escaparHtml(nombre)}:`)}${parrafo(
    `Has pedido usar este email en tu cuenta de ${MARCA}. Para terminar el cambio, confírmalo:`
  )}${botonEmail({
    href: escaparHtml(url),
    texto: 'Confirmar el nuevo email',
    textoAlternativo: `Si el botón no funciona, entra en ${escaparHtml(url)}`
  })}${parrafo(
    '<br>Hasta que lo confirmes, tu cuenta sigue usando el email anterior. El enlace caduca en 24 horas.',
    { secundario: true }
  )}`;
  return {
    asunto: `Confirma tu nuevo email en ${MARCA}`,
    html: maquetarEmail({ titulo, cuerpo }),
    texto: textoPlano(titulo, [
      `Hola, ${nombre || ''}:`,
      `Has pedido usar este email en tu cuenta de ${MARCA}. Para terminar el cambio, confírmalo:`,
      '',
      `Confirmar el nuevo email: ${url}`,
      '',
      'Hasta que lo confirmes, tu cuenta sigue usando el email anterior. El enlace caduca en 24 horas.'
    ])
  };
};

const enviarConfirmarCambioEmail = ({ email, nombre, url }) =>
  enviarCorreoCuenta({ tipo: 'confirmar email nuevo', para: email, ...construirConfirmarCambio({ nombre, url }) });

// 4. Aviso al email antiguo (al pedir el cambio). El nuevo va con la parte local oculta.
const construirAvisoCambio = ({ nombre, emailNuevo }) => {
  const titulo = 'Se ha pedido cambiar el email de tu cuenta';
  const oculto = ocultarEmail(emailNuevo);
  const cuerpo = `${parrafo(`Hola, ${escaparHtml(nombre)}:`)}${parrafo(
    `Se ha pedido cambiar el email de tu cuenta de ${MARCA} por <strong>${escaparHtml(oculto)}</strong>.`
  )}${parrafo(
    'Si has sido tú, no hace falta hacer nada. Si no, entra en tu cuenta y cambia la contraseña: el cambio no se aplicará hasta que se confirme desde el email nuevo.',
    { secundario: true }
  )}`;
  return {
    asunto: 'Se ha pedido cambiar el email de tu cuenta',
    html: maquetarEmail({ titulo, cuerpo }),
    texto: textoPlano(titulo, [
      `Hola, ${nombre || ''}:`,
      `Se ha pedido cambiar el email de tu cuenta de ${MARCA} por ${oculto}.`,
      'Si has sido tú, no hace falta hacer nada. Si no, entra en tu cuenta y cambia la contraseña: el cambio no se aplicará hasta que se confirme desde el email nuevo.'
    ])
  };
};

const enviarAvisoCambioEmail = ({ email, nombre, emailNuevo }) =>
  enviarCorreoCuenta({ tipo: 'aviso de cambio de email', para: email, ...construirAvisoCambio({ nombre, emailNuevo }) });

// 5. Cuenta protegida: alguien entra con Google en una cuenta sin verificar que tenía contraseña.
const construirCuentaProtegida = ({ nombre }) => {
  const titulo = 'Hemos protegido tu cuenta';
  const frases = [
    'Has entrado con Google en una cuenta que se había creado con tu email y una contraseña, sin confirmar.',
    'Por seguridad, hemos anulado esa contraseña y cerrado las demás sesiones. A partir de ahora, entra con Google.'
  ];
  const cuerpo = `${parrafo(`Hola, ${escaparHtml(nombre)}:`)}${frases.map((f) => parrafo(f)).join('')}`;
  return {
    asunto: `Hemos protegido tu cuenta de ${MARCA}`,
    html: maquetarEmail({ titulo, cuerpo }),
    texto: textoPlano(titulo, [`Hola, ${nombre || ''}:`, ...frases])
  };
};

const enviarCuentaProtegida = ({ email, nombre }) =>
  enviarCorreoCuenta({ tipo: 'cuenta protegida', para: email, ...construirCuentaProtegida({ nombre }) });

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
const ASUNTO_RESPUESTA_CONTACTO = `Re: tu mensaje a ${MARCA}`;

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
  NOMBRE_LOGO,
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
  `${MARCA} · ${WEB_PUBLICA}`
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

// ─── Reservas por fechas (docs/reservas-diseno.md, 6.4) ───────────────────────────────────────────
// `reserva` = { pedidoId, pieza, fechaInicio, horaEntrega, fechaFin, horaRecogida, dias, modoEntrega,
// modoRecogida, direccion, total }: fechas 'YYYY-MM-DD', horas 'HH:MM' de Madrid y total en euros.
// Todo lo que escribe el cliente (nombre, dirección) se escapa, como en los demás correos.
const fechaHoraReserva = (fecha, hora) => `${String(fecha).split('-').reverse().join('/')} a las ${hora}`;
const dondeTrayecto = (modo) => (modo === 'tienda' ? 'en la tienda' : 'a domicilio');
const eurosReserva = (importe) => `${Number(importe).toFixed(2).replace('.', ',')} €`;
const diasReserva = (n) => (n === 1 ? '1 día' : `${n} días`);

const construirConfirmacionReserva = ({ nombre, reserva }) => {
  const titulo = 'Tu reserva está confirmada';
  const datos = [
    ['Reserva', referenciaPedido(reserva.pedidoId)],
    ['Pieza', reserva.pieza],
    ['Entrega', `${fechaHoraReserva(reserva.fechaInicio, reserva.horaEntrega)}, ${dondeTrayecto(reserva.modoEntrega)}`],
    ['Recogida', `${fechaHoraReserva(reserva.fechaFin, reserva.horaRecogida)}, ${dondeTrayecto(reserva.modoRecogida)}`],
    ['Duración', diasReserva(reserva.dias)],
    ['Fianza (reembolsable)', reserva.fianza > 0 ? eurosReserva(reserva.fianza) : null],
    ['Total pagado', `${eurosReserva(reserva.total)} (IVA incluido)`],
    ['Dirección', reserva.direccion]
  ].filter(([, valor]) => valor);
  const saludo = `¡Gracias, ${nombre || ''}! Hemos recibido el pago y la pieza queda reservada para ti en estas fechas.`;
  const despedida = `${reserva.fianza > 0 ? 'La fianza te la devolvemos en la misma tarjeta después de la recogida, cuando revisemos la pieza. ' : ''}Te escribiremos antes de la entrega para concretar los detalles. Si necesitas cambiar algo, escríbenos desde la página de contacto.`;
  const cuerpo = `${parrafo(escaparHtml(saludo))}${bloqueDatos(
    datos.map(([etiqueta, valor]) => filaDato(etiqueta, escaparHtml(valor))).join('')
  )}${parrafo(`<br>${escaparHtml(despedida)}`)}`;
  return {
    asunto: `Reserva confirmada: ${reserva.pieza}`,
    html: maquetarEmail({ titulo, cuerpo }),
    texto: textoPlano(titulo, [saludo, '', ...datos.map(([etiqueta, valor]) => `${etiqueta}: ${valor}`), '', despedida])
  };
};

const enviarConfirmacionReserva = ({ email, nombre, reserva }) =>
  enviarCorreoCuenta({ tipo: 'confirmación de reserva', para: email, ...construirConfirmacionReserva({ nombre, reserva }) });

// Pago cobrado de una reserva que no se pudo confirmar (las fechas ya eran de otra persona, T12). El
// reembolso lo hace el administrador, al que avisa enviarAlertaAdmin.
const construirConflictoReserva = ({ nombre, reserva }) => {
  const titulo = 'No hemos podido confirmar tu reserva';
  const frases = [
    `Hola, ${nombre || ''}:`,
    `Hemos recibido tu pago por ${reserva.pieza}, pero esas fechas ya no estaban libres cuando nos llegó. Lo sentimos mucho.`,
    `Te devolveremos el importe completo (${eurosReserva(reserva.total)}) en la misma tarjeta, y te escribiremos para ayudarte a encontrar otras fechas.`
  ];
  return {
    asunto: titulo,
    html: maquetarEmail({ titulo, cuerpo: frases.map((frase) => parrafo(escaparHtml(frase))).join('') }),
    texto: textoPlano(titulo, frases)
  };
};

const enviarConflictoReserva = ({ email, nombre, reserva }) =>
  enviarCorreoCuenta({ tipo: 'reserva sin confirmar', para: email, ...construirConflictoReserva({ nombre, reserva }) });

// ─── El resto del ciclo de la reserva (R-e, paso 20) ─────────────────────────────────────────────
// Los recordatorios y el aviso de retraso los envía la tarea diaria (utils/tareaDiariaReservas.js);
// la cancelación y el reembolso, las acciones del panel (utils/adminReservas.js). `reserva` lleva lo
// mismo que en la confirmación; cada correo usa solo lo que necesita. Nada de la fianza ni de la
// penalización por retraso: llegan con su parte de R-e, cuando el cliente las confirme.
const CONTACTO_RESERVA = 'Si necesitas cambiar algo, escríbenos desde la página de contacto o responde a este correo.';

// Un correo de texto con su bloque de datos: frases antes, filas [etiqueta, valor] y frases después.
const construirCorreoReserva = ({ titulo, asunto, antes, datos = [], despues = [] }) => {
  const filas = datos.filter(([, valor]) => valor);
  const cuerpo = [
    ...antes.map((frase) => parrafo(escaparHtml(frase))),
    filas.length > 0
      ? bloqueDatos(filas.map(([etiqueta, valor]) => filaDato(etiqueta, escaparHtml(valor))).join(''))
      : '',
    ...despues.map((frase, i) => parrafo(`${i === 0 && filas.length > 0 ? '<br>' : ''}${escaparHtml(frase)}`))
  ].join('');
  return {
    asunto,
    html: maquetarEmail({ titulo, cuerpo }),
    texto: textoPlano(titulo, [
      ...antes,
      ...(filas.length > 0 ? ['', ...filas.map(([etiqueta, valor]) => `${etiqueta}: ${valor}`)] : []),
      ...(despues.length > 0 ? ['', ...despues] : [])
    ])
  };
};

const construirRecordatorioEntrega = ({ nombre, reserva }) => {
  const enTienda = reserva.modoEntrega === 'tienda';
  return construirCorreoReserva({
    titulo: 'Tu alquiler empieza pronto',
    asunto: `Recordatorio: ${reserva.pieza}, el ${fechaHoraReserva(reserva.fechaInicio, reserva.horaEntrega)}`,
    antes: [
      `Hola, ${nombre || ''}:`,
      enTienda
        ? `Te esperamos en la tienda el ${fechaHoraReserva(reserva.fechaInicio, reserva.horaEntrega)} para que recojas ${reserva.pieza}.`
        : `Te llevaremos ${reserva.pieza} el ${fechaHoraReserva(reserva.fechaInicio, reserva.horaEntrega)} a la dirección que nos diste.`
    ],
    datos: [
      ['Reserva', referenciaPedido(reserva.pedidoId)],
      ['Pieza', reserva.pieza],
      ['Entrega', `${fechaHoraReserva(reserva.fechaInicio, reserva.horaEntrega)}, ${dondeTrayecto(reserva.modoEntrega)}`],
      ['Dirección', enTienda ? null : reserva.direccion],
      ['Devolución', `${fechaHoraReserva(reserva.fechaFin, reserva.horaRecogida)}, ${dondeTrayecto(reserva.modoRecogida)}`]
    ],
    despues: [CONTACTO_RESERVA]
  });
};

const enviarRecordatorioEntrega = ({ email, nombre, reserva }) =>
  enviarCorreoCuenta({ tipo: 'recordatorio de entrega', para: email, ...construirRecordatorioEntrega({ nombre, reserva }) });

const construirRecordatorioRecogida = ({ nombre, reserva }) => {
  const enTienda = reserva.modoRecogida === 'tienda';
  return construirCorreoReserva({
    titulo: 'Tu alquiler termina pronto',
    asunto: `Recordatorio: devolución de ${reserva.pieza}, el ${fechaHoraReserva(reserva.fechaFin, reserva.horaRecogida)}`,
    antes: [
      `Hola, ${nombre || ''}:`,
      enTienda
        ? `Te recordamos que tienes que devolver ${reserva.pieza} en la tienda el ${fechaHoraReserva(reserva.fechaFin, reserva.horaRecogida)}.`
        : `Pasaremos a recoger ${reserva.pieza} el ${fechaHoraReserva(reserva.fechaFin, reserva.horaRecogida)} en la dirección de la entrega.`
    ],
    datos: [
      ['Reserva', referenciaPedido(reserva.pedidoId)],
      ['Pieza', reserva.pieza],
      ['Devolución', `${fechaHoraReserva(reserva.fechaFin, reserva.horaRecogida)}, ${dondeTrayecto(reserva.modoRecogida)}`]
    ],
    despues: [
      'Si quieres alargar el alquiler, escríbenos cuanto antes y miramos si las fechas siguen libres.',
      CONTACTO_RESERVA
    ]
  });
};

const enviarRecordatorioRecogida = ({ email, nombre, reserva }) =>
  enviarCorreoCuenta({ tipo: 'recordatorio de devolución', para: email, ...construirRecordatorioRecogida({ nombre, reserva }) });

const construirAvisoRetraso = ({ nombre, reserva }) =>
  construirCorreoReserva({
    titulo: 'Tu alquiler ha terminado',
    asunto: `Devolución pendiente: ${reserva.pieza}`,
    antes: [
      `Hola, ${nombre || ''}:`,
      `El alquiler de ${reserva.pieza} terminaba el ${fechaHoraReserva(reserva.fechaFin, reserva.horaRecogida)} y todavía no nos consta la devolución.`,
      'Escríbenos o llámanos hoy para acordar cuándo la devuelves. Puede que otra persona la tenga reservada para los próximos días.'
    ],
    datos: [
      ['Reserva', referenciaPedido(reserva.pedidoId)],
      ['Pieza', reserva.pieza]
    ],
    despues: ['Si ya la has devuelto, no hagas caso de este correo: lo apuntaremos enseguida.']
  });

const enviarAvisoRetraso = ({ email, nombre, reserva }) =>
  enviarCorreoCuenta({ tipo: 'aviso de retraso', para: email, ...construirAvisoRetraso({ nombre, reserva }) });

// `reembolso`: lo que se devolverá, en euros (0 si la cancelación no lleva reembolso). El motivo que
// escribe el administrador no sale en el correo: es una nota del panel.
const construirCancelacionReserva = ({ nombre, reserva, reembolso }) =>
  construirCorreoReserva({
    titulo: 'Tu reserva está cancelada',
    asunto: `Reserva cancelada: ${reserva.pieza}`,
    antes: [
      `Hola, ${nombre || ''}:`,
      `Hemos cancelado tu reserva de ${reserva.pieza}.`,
      reembolso > 0
        ? `Te devolveremos ${eurosReserva(reembolso)} en la misma tarjeta con la que pagaste. Te escribiremos cuando el reembolso esté hecho.`
        : 'Esta cancelación no lleva reembolso.'
    ],
    datos: [
      ['Reserva', referenciaPedido(reserva.pedidoId)],
      ['Pieza', reserva.pieza],
      ['Fechas', `del ${fechaHoraReserva(reserva.fechaInicio, reserva.horaEntrega)} al ${fechaHoraReserva(reserva.fechaFin, reserva.horaRecogida)}`]
    ],
    despues: ['Si tienes cualquier duda, escríbenos desde la página de contacto o responde a este correo.']
  });

const enviarCancelacionReserva = ({ email, nombre, reserva, reembolso }) =>
  enviarCorreoCuenta({ tipo: 'cancelación de reserva', para: email, ...construirCancelacionReserva({ nombre, reserva, reembolso }) });

const construirReembolsoReserva = ({ nombre, reserva, reembolso }) =>
  construirCorreoReserva({
    titulo: 'Reembolso hecho',
    asunto: `Reembolso de tu reserva: ${reserva.pieza}`,
    antes: [
      `Hola, ${nombre || ''}:`,
      `Ya hemos hecho el reembolso de ${eurosReserva(reembolso)} de tu reserva de ${reserva.pieza}, en la misma tarjeta con la que pagaste.`,
      'Según el banco, puede tardar entre 5 y 10 días hábiles en aparecer en tu cuenta.'
    ],
    datos: [
      ['Reserva', referenciaPedido(reserva.pedidoId)],
      ['Importe devuelto', eurosReserva(reembolso)]
    ]
  });

// La fianza resuelta tras la recogida (R-e, paso 18): lo devuelto y, si se retuvo algo, cuánto y
// por qué (el motivo lo escribe el administrador para el cliente, y se escapa como lo demás).
const construirDevolucionFianza = ({ nombre, reserva, fianza, devuelto, retenido, motivo }) => {
  const frases = [`Hola, ${nombre || ''}:`, `Ya hemos revisado ${reserva.pieza}. Gracias por cuidarla.`];
  if (retenido === 0) {
    frases.push(`Te hemos devuelto la fianza entera, ${eurosReserva(devuelto)}, en la misma tarjeta con la que pagaste.`);
  } else if (devuelto > 0) {
    frases.push(
      `Te hemos devuelto ${eurosReserva(devuelto)} de la fianza en la misma tarjeta con la que pagaste, y nos quedamos con ${eurosReserva(retenido)}.`
    );
  } else {
    frases.push(`Esta vez nos quedamos con la fianza entera (${eurosReserva(retenido)}).`);
  }
  if (retenido > 0 && motivo) frases.push(`Motivo: ${motivo}`);
  return construirCorreoReserva({
    titulo: retenido === 0 ? 'Fianza devuelta' : 'Tu fianza',
    asunto: `Fianza de tu alquiler: ${reserva.pieza}`,
    antes: frases,
    datos: [
      ['Reserva', referenciaPedido(reserva.pedidoId)],
      ['Fianza', eurosReserva(fianza)],
      ['Devuelto', eurosReserva(devuelto)],
      ['Retenido', retenido > 0 ? eurosReserva(retenido) : null]
    ],
    despues: [
      ...(devuelto > 0 ? ['Según el banco, puede tardar entre 5 y 10 días hábiles en aparecer en tu cuenta.'] : []),
      'Si tienes cualquier duda, escríbenos desde la página de contacto o responde a este correo.'
    ]
  });
};

const enviarDevolucionFianza = ({ email, nombre, reserva, fianza, devuelto, retenido, motivo }) =>
  enviarCorreoCuenta({
    tipo: 'fianza de reserva',
    para: email,
    ...construirDevolucionFianza({ nombre, reserva, fianza, devuelto, retenido, motivo })
  });

const enviarReembolsoReserva = ({ email, nombre, reserva, reembolso }) =>
  enviarCorreoCuenta({ tipo: 'reembolso de reserva', para: email, ...construirReembolsoReserva({ nombre, reserva, reembolso }) });

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
        <div style="font-family: Helvetica, Arial, sans-serif; color: ${COLOR_TEXTO}; max-width: 600px; margin: 0 auto; padding: 24px; background-color: ${COLOR_CLARO}; border-radius: 8px;">
          <h2 style="color: ${COLOR_TEXTO}; border-bottom: 2px solid ${COLOR_BORDE}; padding-bottom: 12px; margin-top: 0;">
            ${escaparHtml(asunto)}
          </h2>
          <ul style="padding-left: 20px; line-height: 1.5;">
            ${detalles.map(detalle => `<li style="margin: 6px 0;">${escaparHtml(detalle)}</li>`).join('')}
          </ul>
          <p style="font-size: 0.85rem; color: ${COLOR_TEXTO_SUAVE}; margin-top: 24px; border-top: 1px solid ${COLOR_BORDE}; padding-top: 10px;">
            Aviso automático de ${MARCA}.
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

// ─── Recuperación de contraseña ───────────────────────────────────────────────────
const construirEmailRecuperacion = ({ url }) => {
  const titulo = 'Recuperar contraseña';
  const cuerpo = `${parrafo(
    `Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en ${MARCA}.`
  )}${parrafo(
    'Si has sido tú, haz clic en el siguiente botón para elegir una nueva contraseña:'
  )}${botonEmail({
    href: escaparHtml(url),
    texto: 'Restablecer contraseña',
    textoAlternativo: `Si el botón no funciona, entra en ${escaparHtml(url)}`
  })}${parrafo(
    '<br>Este enlace caducará en 1 hora por motivos de seguridad.',
    { secundario: true }
  )}${parrafo(
    'Si no has solicitado este cambio, puedes ignorar este correo con total tranquilidad: tu contraseña seguirá siendo la misma.',
    { secundario: true }
  )}`;
  return {
    asunto: `Recuperar contraseña - ${MARCA}`,
    html: maquetarEmail({ titulo, cuerpo }),
    texto: textoPlano(titulo, [
      `Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en ${MARCA}.`,
      'Si has sido tú, usa el siguiente enlace para elegir una nueva contraseña:',
      '',
      `Restablecer contraseña: ${url}`,
      '',
      'Este enlace caducará en 1 hora por motivos de seguridad.',
      'Si no has solicitado este cambio, puedes ignorar este correo con total tranquilidad: tu contraseña seguirá siendo la misma.'
    ])
  };
};

const enviarEmailRecuperacion = async (destinatario, urlOpciones) => {
  let email;
  let url;
  if (typeof destinatario === 'object' && destinatario !== null) {
    email = destinatario.email;
    url = destinatario.url || destinatario.enlace;
  } else {
    email = destinatario;
    url = typeof urlOpciones === 'string' ? urlOpciones : urlOpciones?.url || urlOpciones?.enlace;
  }
  return enviarCorreoCuenta({
    tipo: 'recuperación de contraseña',
    para: email,
    ...construirEmailRecuperacion({ url })
  });
};

module.exports = {
  enviarNotificacionVenta, enviarConfirmacionCliente, enviarEmailBienvenida, enviarMensajeContacto, enviarAlertaAdmin,
  enviarConfirmarRegistro, enviarCuentaActivada, enviarConfirmarCambioEmail, enviarAvisoCambioEmail,
  enviarCuentaProtegida, ocultarEmail, enviarConfirmacionReserva, enviarConflictoReserva,
  enviarRecordatorioEntrega, enviarRecordatorioRecogida, enviarAvisoRetraso, enviarCancelacionReserva,
  enviarReembolsoReserva, enviarDevolucionFianza, enviarEmailRecuperacion
};

