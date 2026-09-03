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

module.exports = { enviarNotificacionVenta };
