// Espera a unos envíos de correo antes de responder, con un tope. Lo usan los pagos (pagos.js) y
// las cuentas (authController.js).

// Tiempo máximo que se espera a los emails antes de responder. Resend suele tardar menos de
// un segundo, pero sin este tope una caída lenta del proveedor dejaría colgadas las respuestas:
// el webhook (Stripe acabaría dándolo por fallido y lo reintentaría), la página de éxito del
// comprador o el registro.
const TIEMPO_MAXIMO_EMAILS_MS = 8000;

// Ninguna función de email lanza (capturan sus errores), pero se esperan aquí con allSettled
// por si una lo hiciera: un fallo de correo nunca debe tumbar el pago ni la petición. Se espera a
// que terminen porque en Vercel la función se congela al responder y un envío pendiente podría
// no completarse; por eso solo se deja de esperar pasado TIEMPO_MAXIMO_EMAILS_MS.
const enviarTodos = async (envios) => {
  let temporizador;
  const limite = new Promise((resolver) => {
    temporizador = setTimeout(() => resolver('limite'), TIEMPO_MAXIMO_EMAILS_MS);
  });
  const enviados = Promise.allSettled(envios.map((envio) => (async () => envio())())).then(
    () => 'enviados'
  );

  const resultado = await Promise.race([enviados, limite]);
  clearTimeout(temporizador);
  if (resultado === 'limite') {
    console.warn(
      `Los emails tardan más de ${TIEMPO_MAXIMO_EMAILS_MS / 1000} s: se responde sin esperar a que terminen.`
    );
  }
};

module.exports = { enviarTodos, TIEMPO_MAXIMO_EMAILS_MS };
