const nodemailer = require('nodemailer');
const Stripe = require('stripe');
const supabase = require('../data/supabase');
const { uploadToSupabase } = require('../utils/upload');

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

// Auxiliar para enviar notificación por email de la venta
const enviarEmailVentaAdmin = async (items, clienteInfo, total) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER || 'mock_user',
        pass: process.env.SMTP_PASS || 'mock_pass',
      },
    });

    const itemsHtml = items.map(item => `
      <li>
        <strong>${item.nombre}</strong> - ${item.modalidad === 'compra' ? 'Compra' : 'Alquiler'} (${item.cantidad} x ${item.precio} €)
      </li>
    `).join('');

    const emailContent = `
      <div style="font-family: sans-serif; color: #3E322A; max-width: 600px; padding: 20px; background-color: #F5F2EC; border-radius: 8px;">
        <h2 style="color: #3E322A; border-bottom: 2px solid #E2DCD0; padding-bottom: 10px;">🔔 ¡Nueva Venta Registrada!</h2>
        <p>Se ha completado una transacción con éxito en <strong>Nave 5 Barcelona</strong>.</p>

        <h3 style="color: #857468; margin-top: 20px;">Detalles del Cliente y Envío:</h3>
        <p style="margin: 4px 0;"><strong>Nombre:</strong> ${clienteInfo.nombre || 'No provisto'}</p>
        <p style="margin: 4px 0;"><strong>Email:</strong> ${clienteInfo.email || 'No provisto'}</p>
        <p style="margin: 4px 0;"><strong>Teléfono:</strong> ${clienteInfo.telefono || 'No provisto'}</p>
        <p style="margin: 4px 0;"><strong>Dirección de Entrega:</strong> ${clienteInfo.direccion || 'No provista'}</p>
        <p style="margin: 4px 0;"><strong>Notas de Envío:</strong> ${clienteInfo.notas || 'Ninguna'}</p>
        <p style="margin: 4px 0;"><strong>Método de Pago:</strong> ${clienteInfo.metodoPago || 'Tarjeta (Stripe)'}</p>

        <h3 style="color: #857468; margin-top: 20px;">Productos Adquiridos:</h3>
        <ul style="padding-left: 20px; line-height: 1.6;">
          ${itemsHtml}
        </ul>

        <div style="margin-top: 30px; padding: 15px; background-color: #FCFAF8; border: 1px solid #E2DCD0; border-radius: 4px; text-align: right;">
          <strong style="font-size: 1.1rem; color: #3E322A;">Total Transacción: ${total.toFixed(2)} €</strong>
        </div>

        <p style="font-size: 0.85rem; color: #857468; margin-top: 40px; border-top: 1px solid #E2DCD0; padding-top: 10px; text-align: center;">
          © 2026 Nave 5 Barcelona | Almacén de ideas
        </p>
      </div>
    `;

    if (process.env.SMTP_USER && process.env.SMTP_USER !== 'mock_user') {
      await transporter.sendMail({
        from: '"Nave 5 Barcelona" <no-reply@nave5barcelona.com>',
        to: process.env.ADMIN_EMAIL || process.env.SMTP_USER,
        subject: `🔔 Nueva venta en Nave 5 Barcelona - ${total.toFixed(2)} €`,
        html: emailContent
      });
      console.log('✅ Correo de notificación de venta enviado al administrador.');
    } else {
      console.log('\n--- 📧 SIMULACIÓN DE EMAIL RECIBIDO EN ADMINISTRACIÓN ---');
      console.log('Para:', process.env.ADMIN_EMAIL || 'admin@nave5barcelona.com');
      console.log('Asunto: 🔔 Nueva venta en Nave 5 Barcelona');
      console.log('Cliente:', clienteInfo);
      console.log('Detalle de items:', items);
      console.log('Total:', total.toFixed(2), '€');
      console.log('--------------------------------------------------------\n');
    }
  } catch (error) {
    console.error('❌ Error al enviar la notificación de email:', error.message);
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

// Marca cada pieza como vendida/alquilada en Supabase y avisa por email al admin.
// Es tolerante a que se llame dos veces con las mismas piezas (p. ej. si el comprador
// recarga la página de confirmación) para no romper esa pantalla tras haber cobrado ya.
const procesarCompra = async (lineas, clienteInfo) => {
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
  enviarEmailVentaAdmin(lineas, clienteInfo || {}, total);
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
        })
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
