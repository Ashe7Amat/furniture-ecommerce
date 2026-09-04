const Stripe = require('stripe');
const supabase = require('../data/supabase');
const { uploadToSupabase } = require('../utils/upload');
const { enviarNotificacionVenta, enviarConfirmacionCliente } = require('../utils/email');

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

// 1. Obtener todos los muebles (Catálogo)
const obtenerMuebles = async (req, res) => {
  try {
    const { data, error } = await supabase.from('muebles').select('*');
    if (error) throw error;
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
          precio_venta: (precio_venta === '' || precio_venta === null || precio_venta === undefined) ? null : parseFloat(precio_venta),
          precio_alquiler_dia: (precio_alquiler === '' || precio_alquiler === null || precio_alquiler === undefined) ? null : parseFloat(precio_alquiler),
          disponible: disponible !== undefined ? (disponible === 'true' || disponible === true) : true,
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

// 4. Editar un mueble
const editarMueble = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, categoria, descripcion, precio_venta, precio_alquiler, disponible, estado } = req.body;

    const updateData = {};
    if (nombre !== undefined) updateData.nombre = nombre;
    if (categoria !== undefined) updateData.categoria = categoria;
    if (descripcion !== undefined) updateData.descripcion = descripcion;
    if (precio_venta !== undefined) updateData.precio_venta = (precio_venta === '' || precio_venta === null || precio_venta === undefined) ? null : parseFloat(precio_venta);
    if (precio_alquiler !== undefined) updateData.precio_alquiler_dia = (precio_alquiler === '' || precio_alquiler === null || precio_alquiler === undefined) ? null : parseFloat(precio_alquiler);
    if (disponible !== undefined) updateData.disponible = disponible === 'true' || disponible === true;
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
// precio que manda el navegador) y devuelve las líneas listas para Stripe / para marcar
// como vendidas. Lanza un error legible si algo ya no está disponible.
const construirLineasDesdeCarrito = async (items) => {
  const lineas = [];
  for (const item of items) {
    const { data: mueble, error } = await supabase
      .from('muebles')
      .select('*')
      .eq('id', item.productId)
      .single();

    if (error || !mueble) {
      throw new Error(`La pieza con ID ${item.productId} no existe en catálogo.`);
    }
    if (mueble.estado === 'vendido') {
      throw new Error(`Lo sentimos, la pieza única "${mueble.nombre}" ya ha sido vendida.`);
    }
    if (mueble.estado === 'alquilado' && item.modalidad === 'compra') {
      throw new Error(`Lo sentimos, la pieza única "${mueble.nombre}" está alquilada y no se puede comprar.`);
    }

    const precioReal = item.modalidad === 'alquiler' ? mueble.precio_alquiler_dia : mueble.precio_venta;
    if (!precioReal) {
      throw new Error(`"${mueble.nombre}" no tiene precio disponible para esa modalidad.`);
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

// Marca cada pieza como vendida/alquilada en Supabase, guarda el pedido (para el panel
// de administración) y avisa por email tanto al admin como al propio comprador.
// Es tolerante a que se llame dos veces con las mismas piezas (p. ej. si el comprador
// recarga la página de confirmación) para no romper esa pantalla tras haber cobrado ya.
const procesarCompra = async (lineas, clienteInfo, sessionId) => {
  for (const linea of lineas) {
    const nuevoEstado = linea.modalidad === 'compra' ? 'vendido' : 'alquilado';

    const { data: actual } = await supabase
      .from('muebles')
      .select('estado')
      .eq('id', linea.productId)
      .single();

    if (actual && actual.estado === nuevoEstado) continue; // ya estaba aplicado, no repetir

    const { error } = await supabase
      .from('muebles')
      .update({ estado: nuevoEstado, disponible: false })
      .eq('id', linea.productId);

    if (error) {
      console.error(`Error al actualizar el mueble ${linea.productId}:`, error.message);
    }
  }

  const total = lineas.reduce((acc, l) => acc + l.precio * l.cantidad, 0);
  const fecha = new Date();

  // Guardamos el pedido para que aparezca en el panel de administración con toda la
  // info necesaria para prepararlo y enviarlo (cliente, dirección, productos, total).
  // Si esta misma sesión de Stripe ya generó un pedido (p. ej. el comprador recargó la
  // pantalla de confirmación), no lo duplicamos.
  if (sessionId) {
    const { data: pedidoExistente } = await supabase
      .from('pedidos')
      .select('id')
      .eq('stripe_session_id', sessionId)
      .maybeSingle();

    if (!pedidoExistente) {
      const { error: errorPedido } = await supabase.from('pedidos').insert({
        items: lineas,
        cliente_info: clienteInfo || {},
        total,
        metodo_entrega: 'domicilio',
        direccion_envio: clienteInfo?.direccion || null,
        estado: 'procesando',
        stripe_session_id: sessionId
      });

      if (errorPedido) {
        console.error('Error al guardar el pedido en Supabase:', errorPedido.message);
      }
    }
  }

  const pedidoParaEmail = { items: lineas, clienteInfo: clienteInfo || {}, total, fecha };

  // Notificaciones por email vía Resend. Ninguna de las dos funciones lanza (try/catch
  // interno): un fallo en el envío del correo jamás debe romper el checkout.
  enviarNotificacionVenta(pedidoParaEmail);
  enviarConfirmacionCliente(pedidoParaEmail);

  return total;
};

// 7. Crear una sesión de pago real con Stripe (modo test o real según la clave configurada)
const crearSesionPago = async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ error: 'Los pagos con tarjeta todavía no están configurados en el servidor.' });
    }

    const { items, clienteInfo } = req.body;
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'El carrito de compras está vacío.' });
    }

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
      metadata: {
        items: JSON.stringify(items.map(i => ({ productId: i.productId, modalidad: i.modalidad }))),
        clienteNombre: clienteInfo?.nombre || '',
        clienteEmail: clienteInfo?.email || '',
        clienteTelefono: clienteInfo?.telefono || '',
        clienteDireccion: clienteInfo?.direccion || '',
        clienteNotas: clienteInfo?.notas || ''
      }
    });

    res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Error al crear la sesión de pago:', error.message);
    res.status(400).json({ error: error.message || 'No se pudo iniciar el proceso de pago.' });
  }
};

// 8. Confirmar una sesión de Stripe al volver del pago y aplicar la venta
const confirmarSesion = async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ error: 'Los pagos con tarjeta todavía no están configurados en el servidor.' });
    }

    const { session_id } = req.query;
    if (!session_id) {
      return res.status(400).json({ error: 'Falta el identificador de la sesión de pago.' });
    }

    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'El pago todavía no se ha completado.' });
    }

    const itemsMeta = JSON.parse(session.metadata.items || '[]');
    const lineas = await construirLineasDesdeCarrito(itemsMeta).catch(() => null);

    // Si construirLineasDesdeCarrito falla es porque ya se aplicó antes (piezas marcadas
    // como vendidas/alquiladas en una confirmación previa): no es un error para el cliente.
    const total = lineas
      ? await procesarCompra(lineas, {
          nombre: session.metadata.clienteNombre,
          email: session.metadata.clienteEmail,
          telefono: session.metadata.clienteTelefono,
          direccion: session.metadata.clienteDireccion,
          notas: session.metadata.clienteNotas,
          metodoPago: 'Tarjeta (Stripe)'
        }, session.id)
      : (session.amount_total || 0) / 100;

    res.status(200).json({
      success: true,
      message: 'Pago confirmado. El catálogo ha sido actualizado.',
      total
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
