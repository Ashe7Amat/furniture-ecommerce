// server/src/controllers/authController.js
const supabase = require('../data/supabase');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

// Auxiliar para enviar correo de bienvenida al cliente
const enviarEmailBienvenida = async (emailDestinatario, nombreCliente) => {
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

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            margin: 0;
            padding: 0;
            background-color: #F5F2EC;
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #3E322A;
          }
          .email-wrapper {
            width: 100%;
            background-color: #F5F2EC;
            padding: 40px 0;
          }
          .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #FCFAF8;
            border: 1px solid #E2DCD0;
            border-radius: 6px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(62,50,42,0.04);
          }
          .email-header {
            background-color: #3E322A;
            padding: 40px 30px;
            text-align: center;
          }
          .email-header h1 {
            color: #FCFAF8;
            font-size: 1.5rem;
            font-weight: 300;
            text-transform: uppercase;
            letter-spacing: 3px;
            margin: 0 0 10px 0;
          }
          .email-header p {
            color: #B38A70;
            font-size: 0.85rem;
            margin: 0;
            letter-spacing: 1px;
            font-style: italic;
          }
          .email-body {
            padding: 40px 30px;
            line-height: 1.6;
          }
          .email-body h2 {
            font-size: 1.25rem;
            font-weight: 400;
            margin-top: 0;
            color: #3E322A;
          }
          .email-body p {
            font-size: 0.95rem;
            color: #857468;
            margin-bottom: 20px;
          }
          .highlight-box {
            background-color: #F5F2EC;
            border-left: 3px solid #B38A70;
            padding: 20px;
            margin: 30px 0;
            border-radius: 4px;
          }
          .highlight-box p {
            margin: 0;
            font-style: italic;
            color: #3E322A;
            font-size: 0.92rem;
          }
          .cta-button-container {
            text-align: center;
            margin: 35px 0 15px 0;
          }
          .cta-button {
            background-color: #B38A70;
            color: #FCFAF8;
            text-decoration: none;
            padding: 14px 28px;
            font-size: 0.88rem;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            font-weight: 500;
            border-radius: 4px;
            display: inline-block;
          }
          .email-footer {
            background-color: #F5F2EC;
            border-top: 1px solid #E2DCD0;
            padding: 30px;
            text-align: center;
            font-size: 0.8rem;
            color: #857468;
          }
          .email-footer p {
            margin: 4px 0;
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="email-container">
            <div class="email-header">
              <h1>Nave 5 Barcelona</h1>
              <p>Almacén de ideas</p>
            </div>
            
            <div class="email-body">
              <h2>¡Hola, ${nombreCliente}!</h2>
              <p>Te damos la bienvenida más cálida a <strong>Nave 5 Barcelona</strong>. Nos hace inmensamente felices que te unas a nuestra pequeña gran comunidad dedicada a la recuperación y restauración artesanal de piezas singulares.</p>
              
              <p>Creemos en un diseño sincero y sostenible, en piezas con alma y carácter que añaden calidez y una historia que contar a los hogares contemporáneos. Cada mueble de nuestro catálogo ha sido mimado y devuelto a la vida en nuestro propio taller.</p>
              
              <div class="highlight-box">
                <p>"La imperfección del paso del tiempo restaurada con respeto y pasión."</p>
              </div>

              <p>A partir de ahora, tienes acceso exclusivo a nuestro panel de compras, podrás guardar tus piezas favoritas y disfrutar de un proceso de checkout fluido y seguro para adquirir esa obra única que estás buscando.</p>
              
              <div class="cta-button-container">
                <a href="https://nave5barcelona.com" class="cta-button">Visitar Colección</a>
              </div>
            </div>
            
            <div class="email-footer">
              <p><strong>Nave 5 Barcelona | Almacén de ideas</strong></p>
              <p>Carrer del Plom, 32-34, interior, 08038 Barcelona</p>
              <p>Sostenibilidad • Artesanía • Diseño Slow</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    if (!process.env.SMTP_USER || process.env.SMTP_USER === 'mock_user') {
      console.log('\n======================================================');
      console.log('📬 [SIMULACIÓN SMTP] - EMAIL DE BIENVENIDA ENVIADO');
      console.log(`Para: ${emailDestinatario} (${nombreCliente})`);
      console.log('Asunto: ¡Te damos la bienvenida a Nave 5 Barcelona!');
      console.log('------------------------------------------------------');
      console.log('Mensaje de Bienvenida Generado Exitosamente:');
      console.log(`"Hola ${nombreCliente}, ¡bienvenido a nuestro Almacén de Ideas de Nave 5!"`);
      console.log('======================================================\n');
      return;
    }

    await transporter.sendMail({
      from: `"Nave 5 Barcelona" <${process.env.SMTP_USER}>`,
      to: emailDestinatario,
      subject: '¡Te damos la bienvenida a Nave 5 Barcelona! 🤎',
      html: htmlBody,
    });

    console.log(`📧 Correo de bienvenida enviado con éxito a: ${emailDestinatario}`);
  } catch (error) {
    console.error('❌ Error enviando email de bienvenida:', error.message);
  }
};

// 1. REGISTRO DE NUEVOS CLIENTES
const registrarCliente = async (req, res) => {
  try {
    const { nombre, email, password } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
    }

    // Comprobar si el email ya existe en Supabase
    const { data: usuarioExistente } = await supabase
      .from('clientes')
      .select('email')
      .eq('email', email)
      .single();

    if (usuarioExistente) {
      return res.status(400).json({ error: 'El correo electrónico ya está registrado.' });
    }

    // Encriptar la contraseña (fuerza de hash: 10)
    const salt = await bcrypt.genSalt(10);
    const passwordEncriptada = await bcrypt.hash(password, salt);

    // Insertar en la base de datos
    const { data: nuevoUsuario, error } = await supabase
      .from('clientes')
      .insert([
        {
          nombre,
          email,
          password: passwordEncriptada,
          rol: 'cliente' // Por defecto son clientes normales
        }
      ])
      .select();

    if (error) throw error;

    // --- ENVIAR EMAIL DE BIENVENIDA ---
    // Se ejecuta de manera asíncrona no bloqueante
    enviarEmailBienvenida(nuevoUsuario[0].email, nuevoUsuario[0].nombre);

    res.status(201).json({
      success: true,
      message: 'Cuenta creada con éxito.',
      user: { nombre: nuevoUsuario[0].nombre, email: nuevoUsuario[0].email, rol: nuevoUsuario[0].rol }
    });

  } catch (error) {
    console.error('Error en registro:', error.message);
    res.status(500).json({ error: 'Error interno del servidor al crear la cuenta.' });
  }
};

// 2. INICIO DE SESIÓN (LOGIN)
const loginCliente = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos.' });
    }

    // Buscar al usuario por email
    const { data: usuario, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !usuario) {
      return res.status(404).json({ error: 'El usuario no existe.' });
    }

    // Comparar la contraseña introducida con la encriptada de la base de datos
    const contraseñaCorrecta = await bcrypt.compare(password, usuario.password);

    if (!contraseñaCorrecta) {
      return res.status(400).json({ error: 'Contraseña incorrecta.' });
    }

    // Login exitoso: Devolvemos los datos limpios (sin la contraseña)
    res.status(200).json({
      success: true,
      user: {
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol
      }
    });

  } catch (error) {
    console.error('Error en login:', error.message);
    res.status(500).json({ error: 'Error interno del servidor al iniciar sesión.' });
  }
};

// Actualizar datos del perfil del cliente (Seguro - Requiere contraseña solo si cambia email/password)
const actualizarPerfil = async (req, res) => {
  try {
    const { emailActual, nuevoNombre, nuevoEmail, passwordActual, nuevaPassword } = req.body;

    const estaCambiandoEmail = nuevoEmail && nuevoEmail !== emailActual;
    const estaCambiandoPassword = !!nuevaPassword;

    // Solo verificar la contraseña si se está intentando cambiar email o contraseña
    if (estaCambiandoEmail || estaCambiandoPassword) {
      if (!passwordActual) {
        return res.status(400).json({ error: 'Debes proporcionar tu contraseña actual para cambiar tu correo o contraseña.' });
      }

      // 1. Buscar al usuario en la base de datos para comparar contraseñas
      const { data: usuario, error: fetchError } = await supabase
        .from('clientes')
        .select('*')
        .eq('email', emailActual)
        .single();

      if (fetchError || !usuario) {
        return res.status(404).json({ error: 'El usuario no existe.' });
      }

      // 2. Verificar la contraseña actual
      const contraseñaCorrecta = await bcrypt.compare(passwordActual, usuario.password);
      if (!contraseñaCorrecta) {
        return res.status(401).json({ error: 'La contraseña actual es incorrecta.' });
      }
    }

    // 3. Preparar los campos a actualizar
    const updateFields = {};
    if (nuevoNombre !== undefined) updateFields.nombre = nuevoNombre;
    if (nuevoEmail !== undefined) {
      // Si cambia de email, verificar si el nuevo email ya está registrado por otro usuario
      if (nuevoEmail !== emailActual) {
        const { data: emailDuplicado } = await supabase
          .from('clientes')
          .select('email')
          .eq('email', nuevoEmail)
          .single();

        if (emailDuplicado) {
          return res.status(400).json({ error: 'El nuevo correo electrónico ya está en uso.' });
        }
      }
      updateFields.email = nuevoEmail;
    }

    // 4. Si se desea cambiar la contraseña
    if (nuevaPassword) {
      if (nuevaPassword.length < 6) {
        return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
      }
      const salt = await bcrypt.genSalt(10);
      updateFields.password = await bcrypt.hash(nuevaPassword, salt);
    }

    // 5. Ejecutar la actualización en Supabase
    const { data: dataActualizada, error: updateError } = await supabase
      .from('clientes')
      .update(updateFields)
      .eq('email', emailActual)
      .select();

    if (updateError || !dataActualizada || dataActualizada.length === 0) {
      throw new Error(updateError?.message || 'Error al actualizar registro en base de datos');
    }

    res.status(200).json({
      success: true,
      message: 'Perfil actualizado con éxito.',
      user: {
        nombre: dataActualizada[0].nombre,
        email: dataActualizada[0].email,
        rol: dataActualizada[0].rol
      }
    });
  } catch (error) {
    console.error('Error al actualizar perfil:', error.message);
    res.status(500).json({ error: 'No se pudo actualizar la información de la cuenta.' });
  }
};

module.exports = {
  registrarCliente,
  loginCliente,
  actualizarPerfil
};