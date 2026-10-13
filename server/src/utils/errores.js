// Error de validación o de una regla de negocio (una pieza ya vendida, un carrito que no cabe
// en la metadata de Stripe, un campo de un formulario mal escrito...). Su `message` está escrito
// para poder mostrarse tal cual a quien hizo la petición -- a diferencia de un error inesperado
// (una caída de la base de datos, un fallo de red, un bug), cuyo detalle nunca debe salir del
// servidor. Los controladores distinguen ambos casos con `instanceof ErrorValidacion`: si lo es,
// responden 400 con `error.message`; si no, responden un mensaje genérico y registran el detalle
// solo en el log.
class ErrorValidacion extends Error {
  constructor(mensaje, detalles) {
    super(mensaje);
    this.name = 'ErrorValidacion';
    this.detalles = detalles; // opcional: los issues de Zod, para depurar en el log si hiciera falta
  }
}

// Una petición bien formada que choca con lo que ya hay: unas fechas que alguien acaba de reservar,
// o una segunda reserva a medio pagar del mismo cliente (docs/reservas-diseno.md, 4.3). Su mensaje
// también se puede enseñar tal cual, pero se responde 409 y no 400: así la web sabe que no es un dato
// mal escrito y puede volver a cargar la disponibilidad.
class ErrorConflicto extends ErrorValidacion {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'ErrorConflicto';
  }
}

// Un servicio externo (Stripe) ha fallado de una forma que no deja saber cómo ha quedado la
// operación. Nada se ha dado por hecho: quien llama puede repetir la petición dentro de un momento
// (503). Su mensaje se puede enseñar tal cual.
class ErrorReintentable extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'ErrorReintentable';
  }
}

module.exports = { ErrorValidacion, ErrorConflicto, ErrorReintentable };
