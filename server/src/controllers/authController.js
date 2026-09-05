// server/src/controllers/authController.js
const supabase = require('../data/supabase');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { enviarEmailBienvenida } = require('../utils/email');

// Cliente para verificar los tokens que manda el botón de Google. Si no hay
// GOOGLE_CLIENT_ID configurado en el servidor, el login con Google queda desactivado
// (se avisa con un error claro en vez de fallar de forma rara).
const googleClient = process.env.GOOGLE_CLIENT_ID ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID) : null;

// Validación básica de email/contraseña, compartida entre registro y (parcialmente) el
// cambio de contraseña. No sustituye una verificación de email por link, pero evita
// altas con datos claramente inválidos.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 6;

// Firma un token de sesión (válido 7 días) con los datos mínimos del usuario
const firmarToken = (usuario) => {
  return jwt.sign(
    { email: usuario.email, nombre: usuario.nombre, rol: usuario.rol },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// 1. REGISTRO DE NUEVOS CLIENTES
const registrarCliente = async (req, res) => {
  try {
    const { nombre, email, password } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
    }
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'Introduce un email válido.' });
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      return res.status(400).json({ error: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.` });
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

    const token = firmarToken(nuevoUsuario[0]);

    res.status(201).json({
      success: true,
      message: 'Cuenta creada con éxito.',
      user: { nombre: nuevoUsuario[0].nombre, email: nuevoUsuario[0].email, rol: nuevoUsuario[0].rol },
      token
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

    // Mensaje de error genérico (no distinguir "no existe" de "contraseña incorrecta"):
    // así quien llame a la API no puede usarlo para averiguar qué emails están registrados.
    const CREDENCIALES_INVALIDAS = { error: 'Email o contraseña incorrectos.' };

    if (error || !usuario) {
      return res.status(401).json(CREDENCIALES_INVALIDAS);
    }

    // Comparar la contraseña introducida con la encriptada de la base de datos
    const contraseñaCorrecta = await bcrypt.compare(password, usuario.password);

    if (!contraseñaCorrecta) {
      return res.status(401).json(CREDENCIALES_INVALIDAS);
    }

    // Login exitoso: Devolvemos los datos limpios (sin la contraseña) + token de sesión
    const token = firmarToken(usuario);

    res.status(200).json({
      success: true,
      user: {
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol
      },
      token
    });

  } catch (error) {
    console.error('Error en login:', error.message);
    res.status(500).json({ error: 'Error interno del servidor al iniciar sesión.' });
  }
};

// Actualizar datos del perfil del cliente (Seguro - Requiere contraseña solo si cambia email/password)
const actualizarPerfil = async (req, res) => {
  try {
    const { nuevoNombre, nuevoEmail, passwordActual, nuevaPassword } = req.body;
    // El email de la cuenta a modificar viene del token verificado, nunca del body:
    // así un usuario no puede editar la cuenta de otro cambiando el JSON de la petición.
    const emailActual = req.usuario.email;

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

    // Se firma un token nuevo porque el token de sesión lleva dentro el nombre/email/rol:
    // si no se renueva aquí, el nombre o el email quedan desactualizados en la sesión y,
    // si cambió el email, las peticiones autenticadas posteriores (p. ej. "Mis Pedidos")
    // dejarían de encontrar nada porque seguirían buscando con el email antiguo.
    const token = firmarToken(dataActualizada[0]);

    res.status(200).json({
      success: true,
      message: 'Perfil actualizado con éxito.',
      user: {
        nombre: dataActualizada[0].nombre,
        email: dataActualizada[0].email,
        rol: dataActualizada[0].rol
      },
      token
    });
  } catch (error) {
    console.error('Error al actualizar perfil:', error.message);
    res.status(500).json({ error: 'No se pudo actualizar la información de la cuenta.' });
  }
};

// 4. INICIO DE SESIÓN CON GOOGLE ("Continuar con Google")
// El cliente manda el "credential" (un ID token firmado por Google) que devuelve el botón
// de Google Identity Services. Aquí se verifica esa firma directamente con Google -- nunca
// nos fiamos de lo que diga el navegador sin comprobarlo -- y con el email verificado se
// busca o se crea la cuenta en la misma tabla "clientes" de siempre, para que el resto de
// la web (Mis Pedidos, Mis Datos, etc.) funcione exactamente igual que con un login normal.
const loginConGoogle = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ error: 'Falta el token de Google.' });
    }
    if (!googleClient) {
      console.error('Login con Google: falta GOOGLE_CLIENT_ID en las variables de entorno del servidor.');
      return res.status(500).json({ error: 'El inicio de sesión con Google no está disponible ahora mismo.' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload?.email || !payload.email_verified) {
      return res.status(401).json({ error: 'No se pudo verificar la cuenta de Google.' });
    }

    const email = payload.email;
    const nombre = payload.name || email.split('@')[0];

    // Buscar si ya existía una cuenta con este email (registrada con contraseña o con
    // Google anteriormente); si no existe, se crea una cuenta nueva.
    const { data: usuarioExistente, error: fetchError } = await supabase
      .from('clientes')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (fetchError) throw fetchError;

    let usuario = usuarioExistente;

    if (!usuario) {
      // Las cuentas creadas por Google no se usan nunca con contraseña, pero la columna
      // "password" es obligatoria: se rellena con un valor aleatorio e inservible.
      const passwordInservible = await bcrypt.hash(crypto.randomUUID(), 10);
      const { data: nuevoUsuario, error: insertError } = await supabase
        .from('clientes')
        .insert([{ nombre, email, password: passwordInservible, rol: 'cliente' }])
        .select()
        .single();

      if (insertError) throw insertError;
      usuario = nuevoUsuario;
    }

    const token = firmarToken(usuario);

    res.status(200).json({
      success: true,
      user: { nombre: usuario.nombre, email: usuario.email, rol: usuario.rol },
      token
    });
  } catch (error) {
    console.error('Error en login con Google:', error.message);
    res.status(401).json({ error: 'No se pudo iniciar sesión con Google.' });
  }
};

module.exports = {
  registrarCliente,
  loginCliente,
  actualizarPerfil,
  loginConGoogle
};