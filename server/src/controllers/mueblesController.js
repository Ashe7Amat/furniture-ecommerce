const supabase = require('../data/supabase');
const { uploadToSupabase } = require('../utils/upload');
const stripeUtil = require('../utils/stripe');
const pagos = require('../utils/pagos');
const { construirMetadataPago } = require('../utils/metadataStripe');
const { ErrorValidacion } = require('../utils/errores');

// 1. Obtener todos los muebles (Catálogo). Admite ?limit=N para pedir solo los N más
// recientes (p. ej. la portada, que solo enseña 4 piezas destacadas y antes se traía
// el catálogo entero de golpe solo para quedarse con los primeros 4).
const obtenerMuebles = async (req, res) => {
  try {
    let query = supabase.from('muebles').select('*').order('created_at', { ascending: false });

    const limit = parseInt(req.query.limit, 10);
    if (Number.isInteger(limit) && limit > 0) {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) throw error;

    // El catálogo casi no cambia entre visitas: se puede cachear un par de minutos en
    // el navegador y en la CDN de Vercel para no volver a pedirlo en cada carga de página.
    res.set('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300');
    res.status(200).json(data);
  } catch (error) {
    console.error('Error al obtener muebles:', error.message);
    res.status(500).json({ error: 'Error interno al obtener los muebles.' });
  }
};

// 2. Obtener un solo mueble por su ID (Detalle)
const obtenerMueblePorId = async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('muebles')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Mueble no encontrado.' });
    }
    res.status(200).json(data);
  } catch (error) {
    console.error('Error al obtener mueble por ID:', error.message);
    res.status(500).json({ error: 'Error al buscar el detalle del mueble.' });
  }
};

// 3. Crear un nuevo mueble con soporte de carga física de imágenes
// nombre/categoria/descripcion/precio_venta/precio_alquiler/disponible/estado ya vienen
// validados y con su tipo real (precios como number o null, disponible como boolean) por
// schemas/muebles.js -- ver validar() en mueblesRoutes.js.
const crearMueble = async (req, res) => {
  try {
    const { nombre, categoria, descripcion, precio_venta, precio_alquiler, disponible, estado } = req.body;
    let imagenes = [];

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const url = await uploadToSupabase(file, 'muebles');
        if (url) imagenes.push(url);
      }
    } else if (req.body.imagenes) {
      if (typeof req.body.imagenes === 'string') {
        try {
          imagenes = JSON.parse(req.body.imagenes);
        } catch (e) {
          imagenes = [req.body.imagenes];
        }
      } else {
        imagenes = Array.isArray(req.body.imagenes) ? req.body.imagenes : [req.body.imagenes];
      }
    }

    const { data, error } = await supabase
      .from('muebles')
      .insert([
        {
          nombre,
          categoria,
          descripcion,
          precio_venta: precio_venta ?? null,
          precio_alquiler_dia: precio_alquiler ?? null,
          disponible: disponible !== undefined ? disponible : true,
          imagenes,
          estado: estado || 'disponible'
        }
      ])
      .select();

    if (error) throw error;
    res.status(201).json({ success: true, message: 'Mueble creado con éxito', data });
  } catch (error) {
    console.error('Error al crear mueble:', error.message);
    res.status(500).json({ error: 'Error al guardar en la base de datos.' });
  }
};

// 4. Editar un mueble (actualización parcial: solo se tocan los campos presentes en el body,
// ya validados y con su tipo real por schemas/muebles.js)
const editarMueble = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, categoria, descripcion, precio_venta, precio_alquiler, disponible, estado } = req.body;

    const updateData = {};
    if (nombre !== undefined) updateData.nombre = nombre;
    if (categoria !== undefined) updateData.categoria = categoria;
    if (descripcion !== undefined) updateData.descripcion = descripcion;
    if (precio_venta !== undefined) updateData.precio_venta = precio_venta;
    if (precio_alquiler !== undefined) updateData.precio_alquiler_dia = precio_alquiler;
    if (disponible !== undefined) updateData.disponible = disponible;
    if (estado !== undefined) updateData.estado = estado;

    let imagenesFinales = [];
    if (req.body.imagenes_existentes !== undefined) {
      if (typeof req.body.imagenes_existentes === 'string') {
        try {
          imagenesFinales = JSON.parse(req.body.imagenes_existentes);
        } catch (e) {
          imagenesFinales = [req.body.imagenes_existentes];
        }
      } else {
        imagenesFinales = Array.isArray(req.body.imagenes_existentes) ? req.body.imagenes_existentes : [req.body.imagenes_existentes];
      }
    }

    if (req.files && req.files.length > 0) {
      const nuevasUrls = [];
      for (const file of req.files) {
        const url = await uploadToSupabase(file, 'muebles');
        if (url) nuevasUrls.push(url);
      }
      imagenesFinales = [...imagenesFinales, ...nuevasUrls];
    } else if (req.body.imagenes !== undefined && req.body.imagenes_existentes === undefined) {
      if (typeof req.body.imagenes === 'string') {
        try {
          imagenesFinales = JSON.parse(req.body.imagenes);
        } catch (e) {
          imagenesFinales = [req.body.imagenes];
        }
      } else {
        imagenesFinales = Array.isArray(req.body.imagenes) ? req.body.imagenes : [req.body.imagenes];
      }
    }

    if (imagenesFinales.length > 0 || req.body.imagenes_existentes !== undefined || req.body.imagenes !== undefined) {
      updateData.imagenes = imagenesFinales;
    }

    const { data, error } = await supabase
      .from('muebles')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) throw error;
    res.status(200).json({ success: true, message: 'Mueble editado con éxito', data });
  } catch (error) {
    console.error('Error al editar mueble:', error.message);
    res.status(500).json({ error: 'Error al editar el mueble.' });
  }
};

// 5. Eliminar un mueble
const eliminarMueble = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('muebles').delete().eq('id', id);
    if (error) throw error;
    res.status(200).json({ success: true, message: 'Mueble eliminado con éxito de la base de datos.' });
  } catch (error) {
    console.error('Error al eliminar mueble:', error.message);
    res.status(500).json({ error: 'Error interno del servidor al intentar borrar el mueble.' });
  }
};

// 6. Buscar muebles por coincidencia de texto
const buscarMuebles = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(200).json([]);
    const { data, error } = await supabase.from('muebles').select('*').ilike('nombre', `%${q}%`);
    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    console.error('Error al buscar muebles:', error.message);
    res.status(500).json({ error: 'Error en el motor de búsqueda.' });
  }
};

// Mira en Supabase el precio REAL de cada pieza del carrito (nunca se confía en el
// precio que manda el navegador) y devuelve las líneas listas para Stripe. Lanza un error
// legible si algo ya no está disponible. Solo se usa ANTES de cobrar (crearSesionPago); una
// vez pagado, el pedido lo registra utils/pagos.js sin rechazar nada.
const construirLineasDesdeCarrito = async (items) => {
  const lineas = [];
  for (const item of items) {
    const { data: mueble, error } = await supabase
      .from('muebles')
      .select('*')
      .eq('id', item.productId)
      .single();

    if (error || !mueble) {
      throw new ErrorValidacion(`La pieza con ID ${item.productId} no existe en catálogo.`);
    }
    if (mueble.estado === 'vendido') {
      throw new ErrorValidacion(`Lo sentimos, la pieza única "${mueble.nombre}" ya ha sido vendida.`);
    }
    if (mueble.estado === 'alquilado' && item.modalidad === 'compra') {
      throw new ErrorValidacion(`Lo sentimos, la pieza única "${mueble.nombre}" está alquilada y no se puede comprar.`);
    }

    const precioReal = item.modalidad === 'alquiler' ? mueble.precio_alquiler_dia : mueble.precio_venta;
    if (!precioReal) {
      throw new ErrorValidacion(`"${mueble.nombre}" no tiene precio disponible para esa modalidad.`);
    }

    lineas.push({
      productId: mueble.id,
      nombre: mueble.nombre,
      modalidad: item.modalidad === 'alquiler' ? 'alquiler' : 'compra',
      cantidad: 1, // son piezas únicas: siempre 1
      precio: precioReal
    });
  }
  return lineas;
};

// 7. Crear una sesión de pago real con Stripe (modo test o real según la clave configurada)
// La forma del carrito y de los datos del comprador (items no vacío, productId de texto...) ya
// viene validada por schemas/muebles.js (ver validar() en mueblesRoutes.js). Dentro de esta
// función, construirMetadataPago y construirLineasDesdeCarrito pueden lanzar ErrorValidacion por
// motivos que SÍ dependen de la base de datos o de reglas de negocio (un carrito que no cabe en
// la metadata de Stripe, una pieza ya vendida...): el catch de abajo es el único sitio que decide
// qué error se le puede contar tal cual al comprador y cuál no.
const crearSesionPago = async (req, res) => {
  try {
    const stripe = stripeUtil.getStripe();
    if (!stripe) {
      return res.status(503).json({ error: 'Los pagos con tarjeta todavía no están configurados en el servidor.' });
    }

    const { items, clienteInfo } = req.body;

    // Se valida antes de tocar la base de datos o Stripe: si un dato del comprador es
    // demasiado largo, o el carrito no cabe en la metadata, se le dice con claridad en lugar de
    // dejar que Stripe rechace la sesión con un error en inglés.
    const metadata = construirMetadataPago({ items, clienteInfo });
    const lineas = await construirLineasDesdeCarrito(items);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: lineas.map(l => ({
        price_data: {
          currency: 'eur',
          product_data: { name: `${l.nombre}${l.modalidad === 'alquiler' ? ' (alquiler / día)' : ''}` },
          unit_amount: Math.round(l.precio * 100),
        },
        quantity: l.cantidad,
      })),
      customer_email: clienteInfo?.email || undefined,
      success_url: `${process.env.CLIENT_URL}/checkout/exito?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/checkout/cancelado`,
      metadata
    });

    res.status(200).json({ url: session.url });
  } catch (error) {
    // ErrorValidacion: su mensaje está escrito para el comprador (400). Cualquier otro error
    // (Stripe caído, un fallo de red, un bug) no debe filtrar su detalle -- se registra en el
    // log y se responde un mensaje genérico (500). Antes de esto, CUALQUIER error devolvía 400
    // con su .message tal cual, incluidos los internos.
    if (error instanceof ErrorValidacion) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error al crear la sesión de pago:', error.message || error);
    res.status(500).json({ error: 'No se pudo iniciar el proceso de pago.' });
  }
};

// 8. Confirmar una sesión de Stripe al volver del pago. Es el respaldo del webhook
// (POST /api/stripe/webhook), que es quien normalmente registra la venta: si el webhook ya
// la registró, o llega mientras tanto, procesarSesionPagada lo detecta y no repite nada.
const confirmarSesion = async (req, res) => {
  try {
    const stripe = stripeUtil.getStripe();
    if (!stripe) {
      return res.status(503).json({ error: 'Los pagos con tarjeta todavía no están configurados en el servidor.' });
    }

    const { session_id } = req.query;
    if (!session_id || typeof session_id !== 'string') {
      return res.status(400).json({ error: 'Falta el identificador de la sesión de pago.' });
    }

    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'El pago todavía no se ha completado.' });
    }

    // El pago ya está verificado con Stripe: aunque no se pueda guardar ahora (p. ej. la
    // base de datos falla un momento), al comprador no se le dice que su pago ha fallado.
    // Si hay webhook configurado, Stripe volverá a intentarlo solo; si no lo hay, nadie lo
    // reintentará, así que se avisa por email al administrador para que lo registre a mano.
    try {
      await pagos.procesarSesionPagada(session);
    } catch (error) {
      console.error(`No se pudo registrar el pedido de la sesión ${session.id} al confirmarla:`, error.message || error);
      if (!process.env.STRIPE_WEBHOOK_SECRET) {
        await pagos.avisarPagoSinRegistrar(session, error);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Pago confirmado. El catálogo ha sido actualizado.',
      total: (session.amount_total || 0) / 100
    });
  } catch (error) {
    console.error('Error al confirmar la sesión de pago:', error.message);
    res.status(500).json({ error: 'No se pudo confirmar el pago.' });
  }
};

module.exports = {
  obtenerMuebles,
  obtenerMueblePorId,
  crearMueble,
  editarMueble,
  eliminarMueble,
  buscarMuebles,
  crearSesionPago,
  confirmarSesion
};
