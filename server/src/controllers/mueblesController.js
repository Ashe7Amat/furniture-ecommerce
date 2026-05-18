const nodemailer = require('nodemailer');
const supabase = require('../data/supabase');
const { uploadToSupabase } = require('../utils/upload');

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

    // Si se subieron archivos físicos
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

    // Soporte para combinar imágenes existentes con las nuevas subidas físicas
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

    // Si se subieron nuevos archivos de imágenes físicos
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

    const { error } = await supabase
      .from('muebles')
      .delete()
      .eq('id', id);

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

    const { data, error } = await supabase
      .from('muebles')
      .select('*')
      .ilike('nombre', `%${q}%`);

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
        
        <h3 style="color: #857468; margin-top: 20px;">Detalles del Cliente:</h3>
        <p style="margin: 4px 0;"><strong>Nombre:</strong> ${clienteInfo.nombre || 'No provisto'}</p>
        <p style="margin: 4px 0;"><strong>Email:</strong> ${clienteInfo.email || 'No provisto'}</p>
        <p style="margin: 4px 0;"><strong>Método de Pago:</strong> ${clienteInfo.metodoPago || 'Tarjeta'}</p>

        <h3 style="color: #857468; margin-top: 20px;">Productos Adquiridos:</h3>
        <ul style="padding-left: 20px; line-height: 1.6;">
          ${itemsHtml}
        </ul>

        <div style="margin-top: 30px; padding: 15px; background-color: #FCFAF8; border: 1px solid #E2DCD0; border-radius: 4px; text-align: right;">
          <strong style="font-size: 1.1rem; color: #3E322A;">Total Transacción: ${total} €</strong>
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
        subject: `🔔 Nueva venta en Nave 5 Barcelona - ${total} €`,
        html: emailContent
      });
      console.log('✅ Correo de notificación de venta enviado al administrador.');
    } else {
      console.log('\n--- 📧 SIMULACIÓN DE EMAIL RECIBIDO EN ADMINISTRACIÓN ---');
      console.log('Para:', process.env.ADMIN_EMAIL || 'admin@nave5barcelona.com');
      console.log('Asunto: 🔔 Nueva venta en Nave 5 Barcelona');
      console.log('Detalle de items:', items);
      console.log('Total:', total, '€');
      console.log('--------------------------------------------------------\n');
    }
  } catch (error) {
    console.error('❌ Error al enviar la notificación de email:', error.message);
  }
};

// 7. Registrar compra y actualizar el estado a "vendido" / "alquilado" (Verificando disponibilidad previa)
const comprarMuebles = async (req, res) => {
  try {
    const { items, clienteInfo, total } = req.body;
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'El carrito de compras está vacío.' });
    }

    // Para cada item en el carrito, verificar disponibilidad antes de proceder
    for (const item of items) {
      // 1. Consultar el estado real actual en Supabase
      const { data: mueble, error: getError } = await supabase
        .from('muebles')
        .select('nombre, estado, disponible')
        .eq('id', item.productId)
        .single();

      if (getError || !mueble) {
        return res.status(404).json({ error: `La pieza con ID ${item.productId} no existe en catálogo.` });
      }

      // 2. Si ya está vendido, abortar y avisar de inmediato
      if (mueble.estado === 'vendido') {
        return res.status(400).json({
          error: `Lo sentimos, la pieza única "${mueble.nombre}" ya ha sido vendida por otro cliente.`
        });
      }

      // 3. Si está alquilado y el cliente desea comprarlo
      if (mueble.estado === 'alquilado' && item.modalidad === 'compra') {
        return res.status(400).json({
          error: `Lo sentimos, la pieza única "${mueble.nombre}" está alquilada en este momento y no se puede comprar.`
        });
      }

      // 4. Si sigue libre, proceder a actualizar el estado en base de datos
      const nuevoEstado = item.modalidad === 'compra' ? 'vendido' : 'alquilado';

      const { error: updateError } = await supabase
        .from('muebles')
        .update({
          estado: nuevoEstado,
          disponible: false
        })
        .eq('id', item.productId);

      if (updateError) {
        console.error(`Error al actualizar el mueble ${item.productId}:`, updateError.message);
        throw updateError;
      }
    }

    // Enviar notificación de email (asíncrono)
    enviarEmailVentaAdmin(items, clienteInfo || {}, total || 0);

    res.status(200).json({
      success: true,
      message: 'Compra procesada correctamente. El catálogo ha sido actualizado.'
    });
  } catch (error) {
    console.error('Error al procesar la compra:', error.message);
    res.status(500).json({ error: 'Error interno del servidor al procesar la compra.' });
  }
};

module.exports = {
  obtenerMuebles,
  obtenerMueblePorId,
  crearMueble,
  editarMueble,
  eliminarMueble,
  buscarMuebles,
  comprarMuebles
};