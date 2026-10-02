// Fase C: el cliente quiere enseñar el catálogo sin precios mientras termina de definirlos, y que
// mientras tanto no se pueda comprar. Lo controla MOSTRAR_PRECIOS (ver server/.env.example y
// docs/env-vars.md):
// - "true": todo como siempre, con precios y con compra;
// - cualquier otra cosa, o sin poner (el valor por defecto): las lecturas públicas de muebles
//   devuelven los dos precios a null y no se puede iniciar un pago.
// Se lee en cada petición, no al arrancar, para que un cambio en Vercel (que redespliega) o en
// los tests se note sin más. Solo cambia las respuestas HTTP: la base de datos no se toca, y el
// panel (GET /api/admin/muebles) sigue viendo siempre los precios reales.
const preciosVisibles = () => process.env.MOSTRAR_PRECIOS === 'true';

// Un mueble (o una lista) tal y como se le puede enseñar al público.
const sinPreciosOcultos = (mueble) =>
  preciosVisibles() ? mueble : { ...mueble, precio_venta: null, precio_alquiler_dia: null };
const paraElPublico = (datos) =>
  Array.isArray(datos) ? datos.map(sinPreciosOcultos) : sinPreciosOcultos(datos);

const MENSAJE_COMPRA_CERRADA =
  'La compra online no está disponible en este momento. Pregúntanos por la pieza en la página de contacto.';

module.exports = { preciosVisibles, paraElPublico, MENSAJE_COMPRA_CERRADA };
