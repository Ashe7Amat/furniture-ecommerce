// server/src/utils/email.js
//
// Envío de notificaciones por correo con Resend (https://resend.com).
//
// Variables de entorno necesarias (configúralas en Vercel > Project Settings > Environment
// Variables del proyecto "nave5-api", NUNCA las subas al repositorio):
//   RESEND_API_KEY   - API key de Resend (Dashboard > API Keys). Empieza por "re_...".
//   RESEND_FROM      - Dirección remitente verificada en Resend. Ver nota abajo.
//   ADMIN_EMAIL      - Dirección donde quieres recibir el aviso de cada venta.
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
        ${item.nombre}${item.modalidad === 'alquiler' ? ' (alquiler / día)' : ''}
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
      <p style="margin: 4px 0;"><strong>Nombre:</strong> ${clienteInfo.nombre || 'No provisto'}</p>
      <p style="margin: 4px 0;"><strong>Email:</strong> ${clienteInfo.email || 'No provisto'}</p>
      <p style="margin: 4px 0;"><strong>Teléfono:</strong> ${clienteInfo.telefono || 'No provisto'}</p>
      <p style="margin: 4px 0;"><strong>Dirección de entrega:</strong> ${clienteInfo.direccion || 'No provista'}</p>
      <p style="margin: 4px 0;"><strong>Notas:</strong> ${clienteInfo.notas || 'Ninguna'}</p>
      <p style="margin: 4px 0;"><strong>Método de pago:</strong> ${clienteInfo.metodoPago || 'Tarjeta (Stripe)'}</p>

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
      console.log('\n--- SIMULACIÓN DE EMAIL (RESEND_API_KEY no configurada) ---');
      console.log('Para:', EMAIL_ADMIN);
      console.log('Pedido:', JSON.stringify(pedido, null, 2));
      console.log('-------------------------------------------------------------\n');
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

// Construye el HTML del correo de confirmación que recibe el propio comprador.
// Mismo estilo visual que el aviso al admin, pero con tono y contenido de cara al cliente.
const construirHtmlConfirmacionCliente = (pedido) => {
  const { items = [], clienteInfo = {}, total = 0, fecha = new Date() } = pedido;

  const fechaFormateada = new Date(fecha).toLocaleString('es-ES', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  const filasProductos = items.map(item => `
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #E2DCD0; color: #3E322A;">
        ${item.nombre}${item.modalidad === 'alquiler' ? ' (alquiler / día)' : ''}
      </td>
      <td style="padding: 8px 0; border-bottom: 1px solid #E2DCD0; color: #857468; text-align: right;">
        ${item.cantidad || 1} x ${Number(item.precio).toFixed(2)} €
      </td>
    </tr>
  `).join('');

  return `
    <div style="font-family: Helvetica, Arial, sans-serif; color: #3E322A; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #F5F2EC; border-radius: 8px;">
      <h2 style="color: #3E322A; border-bottom: 2px solid #E2DCD0; padding-bottom: 12px; margin-top: 0;">
        ¡Gracias por tu compra, ${clienteInfo.nombre || ''}!
      </h2>

      <p style="color: #857468;">
        Hemos recibido tu pago correctamente. Aquí tienes el resumen de tu pedido en Nave 5 Barcelona.
      </p>

      <h3 style="color: #857468; margin-bottom: 6px;">Productos</h3>
      <table style="width: 100%; border-collapse: collapse;">
        ${filasProductos}
      </table>

      <div style="margin-top: 16px; padding: 14px 16px; background-color: #FCFAF8; border: 1px solid #E2DCD0; border-radius: 4px; text-align: right;">
        <strong style="font-size: 1.1rem;">Total: ${Number(total).toFixed(2)} €</strong>
      </div>

      <h3 style="color: #857468; margin-top: 24px; margin-bottom: 6px;">Envío a</h3>
      <p style="margin: 4px 0;">${clienteInfo.direccion || 'Dirección no provista'}</p>
      ${clienteInfo.notas && clienteInfo.notas !== 'Ninguna' ? `<p style="margin: 4px 0; color: #857468;"><strong>Notas:</strong> ${clienteInfo.notas}</p>` : ''}

      <p style="color: #857468; margin-top: 24px;">
        Prepararemos tu pedido y nos pondremos en contacto contigo al teléfono o email indicados
        en cuanto esté listo para el envío. Si tienes cualquier duda, simplemente responde a este
        correo.
      </p>

      <p style="font-size: 0.85rem; color: #857468; margin-top: 32px; border-top: 1px solid #E2DCD0; padding-top: 10px; text-align: center;">
        ${fechaFormateada} · Nave 5 Barcelona · Almacén de ideas
      </p>
    </div>
  `;
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
      console.log('\n--- SIMULACIÓN DE EMAIL AL CLIENTE (RESEND_API_KEY no configurada) ---');
      console.log('Para:', destinatario);
      console.log('Pedido:', JSON.stringify(pedido, null, 2));
      console.log('-------------------------------------------------------------\n');
      return;
    }

    const total = pedido.total ?? (pedido.items || []).reduce(
      (acc, item) => acc + Number(item.precio) * (item.cantidad || 1), 0
    );

    const { data, error } = await resend.emails.send({
      from: REMITENTE,
      to: destinatario,
      subject: 'Hemos recibido tu pedido - Nave 5 Barcelona',
      html: construirHtmlConfirmacionCliente({ ...pedido, total }),
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
      <h2 style="font-size: 1.25rem; font-weight: 400; margin-top: 0; color: #3E322A;">¡Hola, ${nombreCliente}!</h2>
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
      console.log(`[SIMULACIÓN EMAIL] Bienvenida enviada a ${emailDestinatario} (${nombreCliente})`);
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

module.exports = { enviarNotificacionVenta, enviarConfirmacionCliente, enviarEmailBienvenida };
