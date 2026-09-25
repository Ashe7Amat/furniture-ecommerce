const { z } = require('zod');
const { requerido } = require('./comunes');

const ESTADOS_MUEBLE = ['disponible', 'vendido', 'alquilado'];

// crearMueble/editarMueble llegan como multipart/form-data (por las fotos, vía multer): TODOS
// los campos de texto llegan como string, incluso los números y los booleanos ("true"/"false").
// Este validador acepta ese string y lo convierte al tipo real, igual que hacía antes el
// parseFloat()/comparación manual en el controlador -- pero ahora rechaza con un mensaje claro
// un precio que no sea un número, en vez de guardar NaN en la base de datos.
// Una cadena vacía o solo de espacios cuenta como "sin precio": Number('   ') vale 0 en
// JavaScript (no NaN), así que sin el .trim() de esta comprobación un precio pegado con
// espacios de más se guardaría como 0 en vez de quedar vacío o rechazarse.
const esVacio = (valor) =>
  valor === null || valor === undefined || (typeof valor === 'string' && valor.trim() === '');
const precioOpcional = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((valor) => (esVacio(valor) ? null : Number(valor)))
  .refine((valor) => valor === null || Number.isFinite(valor), {
    message: 'El precio debe ser un número.'
  })
  .refine((valor) => valor === null || valor >= 0, { message: 'El precio no puede ser negativo.' });

const booleanDeFormulario = z
  .union([z.boolean(), z.string()])
  .transform((valor) => valor === true || valor === 'true');

// categoria_id: opcional (migración A, ver docs/tarea3-diseno.md -- doble escritura durante la
// transición). Igual que precioOpcional, admite vacío/ausente como "no lo mandaron" (el
// controlador resuelve entonces desde `categoria` por nombre), y rechaza cualquier otra cosa que
// no sea un entero positivo real -- nunca guardar un id inventado o mal tecleado.
const categoriaIdOpcional = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((valor) => (esVacio(valor) ? null : Number(valor)))
  .refine((valor) => valor === null || Number.isInteger(valor), {
    message: 'categoria_id debe ser un número entero.'
  })
  .refine((valor) => valor === null || valor > 0, {
    message: 'categoria_id debe ser un entero positivo.'
  });

// .passthrough(): crearMueble/editarMueble manejan aparte, con su propio parseo, los campos
// "imagenes"/"imagenes_existentes" (JSON dentro de un string, o varias entradas repetidas) y los
// archivos subidos (req.files, fuera de req.body). Sin passthrough, Zod los eliminaría de
// req.body por no estar declarados en este esquema, y esa lógica se rompería.
const schemaMuebleCrear = z
  .object({
    nombre: requerido('El nombre del mueble es obligatorio.'),
    categoria: requerido('La categoría es obligatoria.'),
    descripcion: z.string().optional(),
    precio_venta: precioOpcional.optional(),
    precio_alquiler: precioOpcional.optional(),
    // Se sigue aceptando por compatibilidad, pero los controladores ya no lo escriben: la base de
    // datos calcula `disponible` a partir de `estado` (trigger trg_sync_disponible_desde_estado).
    disponible: booleanDeFormulario.optional(),
    estado: z
      .enum(ESTADOS_MUEBLE, { message: `El estado debe ser uno de: ${ESTADOS_MUEBLE.join(', ')}.` })
      .optional(),
    categoria_id: categoriaIdOpcional.optional()
  })
  .passthrough();

// Edición: los mismos campos, pero todos opcionales (es una actualización parcial -- solo se
// valida lo que venga en la petición).
const schemaMuebleEditar = schemaMuebleCrear.partial();

// POST /api/muebles/crear-sesion-pago -- valida la FORMA del carrito (que sea una lista no vacía
// de piezas con un id de texto) y de los datos del comprador (que sean texto si vienen). El
// mensaje de "carrito vacío" es el mismo que daba antes el chequeo manual en el controlador (que
// por eso se ha quitado de ahí: esta validación ya lo cubre). Los límites de longitud propios de
// la metadata de Stripe siguen en utils/metadataStripe.js (construirMetadataPago), con sus
// propios mensajes -- son dos comprobaciones distintas sobre el mismo campo.
//
// "modalidad" se deja como texto libre (no un enum estricto): tanto aquí como en
// construirLineasDesdeCarrito y en utils/pagos.js, cualquier valor que no sea "alquiler" se trata
// como "compra" -- si aquí se exigiera un enum, se rechazaría un caso que el resto del código
// tolera a propósito (ver el test "una modalidad desconocida se trata como compra").
const MENSAJE_CARRITO_VACIO = 'El carrito de compras está vacío.';
const schemaCarritoPago = z
  .object({
    items: z
      .array(
        z.object({
          productId: requerido('Falta el identificador de una pieza del carrito.'),
          modalidad: z.string().optional()
        }),
        { error: () => MENSAJE_CARRITO_VACIO }
      )
      .min(1, MENSAJE_CARRITO_VACIO),
    clienteInfo: z
      .object({
        nombre: z.string().optional(),
        email: z.string().optional(),
        telefono: z.string().optional(),
        direccion: z.string().optional(),
        notas: z.string().optional()
      })
      .optional()
  })
  .passthrough();

module.exports = { schemaMuebleCrear, schemaMuebleEditar, schemaCarritoPago, ESTADOS_MUEBLE };
