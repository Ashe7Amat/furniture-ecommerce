// Eventos y sesiones de Stripe de mentira para los tests, y firma real de webhooks: se usa
// la propia librería de Stripe (Stripe.webhooks.generateTestHeaderString), así que la
// verificación de firma que se prueba es la de verdad, no un mock.
const Stripe = require('stripe');

const SECRETO_WEBHOOK = 'whsec_secreto_de_prueba';

const MUEBLES_DE_PRUEBA = () => [
  { id: 'mueble-1', nombre: 'Sofá Lumina', precio_venta: 1250, precio_alquiler_dia: null, estado: 'disponible', disponible: true },
  { id: 'mueble-2', nombre: 'Butaca de cine', precio_venta: null, precio_alquiler_dia: 40, estado: 'disponible', disponible: true },
  { id: 'mueble-3', nombre: 'Mesa de comedor', precio_venta: 600, precio_alquiler_dia: 25, estado: 'disponible', disponible: true }
];

// Sesión de Checkout ya pagada, con la misma metadata que escribe crearSesionPago.
const crearSesion = (cambios = {}) => ({
  id: 'cs_test_123',
  object: 'checkout.session',
  payment_status: 'paid',
  amount_total: 125000,
  metadata: {
    items: JSON.stringify([{ productId: 'mueble-1', modalidad: 'compra' }]),
    clienteNombre: 'Ana Prueba',
    clienteEmail: 'ana@example.com',
    clienteTelefono: '600000000',
    clienteDireccion: 'Calle Falsa 123, Barcelona',
    clienteNotas: ''
  },
  ...cambios
});

const crearEventoCompletado = (session, cambios = {}) => ({
  id: 'evt_test_1',
  object: 'event',
  type: 'checkout.session.completed',
  data: { object: session },
  ...cambios
});

// Serializa el evento y calcula la cabecera Stripe-Signature. Por defecto usa el secreto y
// la hora actual; se pueden cambiar para probar firmas ajenas o antiguas.
const firmarEvento = (evento, { secreto = SECRETO_WEBHOOK, timestamp } = {}) => {
  const payload = JSON.stringify(evento);
  const cabecera = Stripe.webhooks.generateTestHeaderString({ payload, secret: secreto, timestamp });
  return { payload, cabecera };
};

module.exports = { SECRETO_WEBHOOK, MUEBLES_DE_PRUEBA, crearSesion, crearEventoCompletado, firmarEvento };
