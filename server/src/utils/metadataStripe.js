// Metadata de las sesiones de Stripe Checkout: cómo se escribe al crear el pago
// (construirMetadataPago) y cómo se lee después en el webhook (leerItemsDeMetadata).
//
// Stripe limita la metadata de cada objeto a 50 claves, con nombres de hasta 40 caracteres y
// valores de hasta 500 caracteres. Un valor más largo hace fallar stripe.checkout.sessions.create
// (y el comprador no puede pagar), así que nada que escriba el comprador ni el tamaño del
// carrito puede acabar en un solo valor sin control: los datos del comprador se validan con un
// límite propio y el carrito se reparte en varias claves (items_0, items_1...).

const MAX_CLAVES = 50;
const MAX_VALOR = 500;
const MAX_NOMBRE_CLAVE = 40;

// Límite de cada dato del comprador, en caracteres. El formulario del cliente aplica los suyos,
// iguales o más estrictos (client/src/components/CheckoutModal.jsx): aquí se comprueban de nuevo
// porque la API es pública y no hay que fiarse de quien la llama.
const CAMPOS_COMPRADOR = [
  { campo: 'nombre', clave: 'clienteNombre', max: 100, error: 'El nombre es demasiado largo' },
  { campo: 'email', clave: 'clienteEmail', max: 254, error: 'El correo electrónico es demasiado largo' },
  { campo: 'telefono', clave: 'clienteTelefono', max: 30, error: 'El teléfono es demasiado largo' },
  { campo: 'direccion', clave: 'clienteDireccion', max: MAX_VALOR, error: 'La dirección es demasiado larga' },
  { campo: 'notas', clave: 'clienteNotas', max: MAX_VALOR, error: 'Las notas de entrega son demasiado largas' }
];

// Error de validación que se le puede mostrar tal cual al comprador (a diferencia de un fallo
// interno, cuyo detalle no debe salir del servidor).
class ErrorMetadata extends Error {}

const trocear = (texto, tamano) => {
  const partes = [];
  for (let i = 0; i < texto.length; i += tamano) partes.push(texto.slice(i, i + tamano));
  return partes;
};

// Devuelve la metadata lista para stripe.checkout.sessions.create. Lanza ErrorMetadata (mensaje
// en castellano para el comprador) si algún dato del comprador es demasiado largo o el carrito
// no cabe en 50 claves.
const construirMetadataPago = ({ items, clienteInfo }) => {
  const info = clienteInfo || {};
  const metadata = {};

  for (const { campo, clave, max, error } of CAMPOS_COMPRADOR) {
    const valor = info[campo] == null ? '' : String(info[campo]);
    if (valor.length > max) throw new ErrorMetadata(`${error} (máximo ${max} caracteres).`);
    metadata[clave] = valor;
  }

  const json = JSON.stringify(items.map(item => ({ productId: item.productId, modalidad: item.modalidad })));
  trocear(json, MAX_VALOR).forEach((parte, i) => { metadata[`items_${i}`] = parte; });

  if (Object.keys(metadata).length > MAX_CLAVES) {
    throw new ErrorMetadata('El carrito es demasiado grande para pagarlo de una sola vez. Divide el pedido en dos.');
  }

  // Comprobación final: si algo llegara aquí fuera de los límites de Stripe sería un fallo de
  // este módulo, no del comprador, y es mejor detectarlo antes de llamar a Stripe.
  for (const [clave, valor] of Object.entries(metadata)) {
    if (clave.length > MAX_NOMBRE_CLAVE || valor.length > MAX_VALOR) {
      throw new Error(`La metadata de Stripe se sale de los límites en la clave "${clave}".`);
    }
  }
  return metadata;
};

// Texto crudo (JSON) del carrito guardado en la metadata, o null si no hay. Entiende los dos
// formatos: el actual (items_0, items_1... que se concatenan en orden) y el antiguo, un único
// valor "items", que siguen teniendo las sesiones abiertas antes de repartir el carrito (una
// sesión de Stripe vive hasta 24 horas).
const juntarItems = (metadata) => {
  if (!metadata) return null;
  if (metadata.items !== undefined) return metadata.items;

  let texto = '';
  for (let i = 0; metadata[`items_${i}`] !== undefined; i++) texto += metadata[`items_${i}`];
  return texto || null;
};

// Piezas del carrito guardadas en la metadata, o null si no hay o no se pueden leer (p. ej. una
// sesión que no es de esta tienda). Como el JSON se reconstruye por trozos, un trozo perdido lo
// deja inválido y aquí se descarta en vez de procesar un carrito incompleto.
const leerItemsDeMetadata = (metadata) => {
  const bruto = juntarItems(metadata);
  if (!bruto) return null;
  try {
    const items = JSON.parse(bruto);
    // Cada elemento debe ser un objeto con productId: una metadata corrupta (p. ej. [null])
    // haría fallar el procesado siempre y Stripe reintentaría el webhook durante días.
    const validos = Array.isArray(items) && items.length > 0
      && items.every(item => item && typeof item.productId === 'string' && item.productId.length > 0);
    return validos ? items : null;
  } catch {
    return null;
  }
};

module.exports = {
  MAX_CLAVES, MAX_VALOR, MAX_NOMBRE_CLAVE,
  ErrorMetadata, construirMetadataPago, juntarItems, leerItemsDeMetadata
};
