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

module.exports = { ErrorValidacion };
