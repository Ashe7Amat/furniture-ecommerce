const Stripe = require('stripe');

let cliente = null;

// Cliente de la API de Stripe, o null si no hay STRIPE_SECRET_KEY. Se crea la primera vez
// que se pide (no al cargar el módulo) y los controladores lo piden siempre a través de
// este objeto, así los tests pueden sustituirlo sin tocar la red.
const getStripe = () => {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!cliente) cliente = new Stripe(process.env.STRIPE_SECRET_KEY);
  return cliente;
};

// Verifica la firma de un webhook y devuelve el evento ya parseado. Lanza si la firma no
// coincide, si el cuerpo se ha alterado o si el timestamp está fuera de tolerancia (5 min,
// lo que impide reenviar una petición capturada). `cuerpoCrudo` debe ser el Buffer exacto
// que llegó por la red: la firma se calcula sobre esos bytes, no sobre el JSON parseado.
// Usa el método estático de la librería, que no necesita STRIPE_SECRET_KEY.
const construirEventoWebhook = (cuerpoCrudo, firma, secreto) =>
  Stripe.webhooks.constructEvent(cuerpoCrudo, firma, secreto);

module.exports = { getStripe, construirEventoWebhook };
