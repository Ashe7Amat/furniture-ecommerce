// Textos de las reservas que comparten la ficha, el paso de confirmación y "Mis reservas".

// Cómo va la pieza en cada trayecto (entrega y recogida).
export const MODO_TRAYECTO = { domicilio: 'a domicilio', tienda: 'en la tienda' };

// El estado de una reserva del cliente (GET /api/reservas/mias), con la clase de su etiqueta (las de
// los pedidos de Mi cuenta, en pages/Profile.css).
export const ESTADO_RESERVA = {
  esperando_pago: ['Esperando pago', 'badge-warning'],
  confirmada: ['Confirmada', 'badge-success'],
  en_curso: ['En curso', 'badge-info'],
  devuelta: ['Devuelta', 'badge-info'],
  cancelada: ['Cancelada', 'badge-danger'],
  no_confirmada: ['No se pudo confirmar', 'badge-danger']
};

export const CONFIRMA_EMAIL_PARA_RESERVAR = 'Confirma tu email para poder reservar.';

// El paso de confirmación, si el servidor responde 401 al crear la reserva.
export const SESION_CADUCADA = 'Tu sesión ha caducado. Vuelve a iniciar sesión para reservar.';
