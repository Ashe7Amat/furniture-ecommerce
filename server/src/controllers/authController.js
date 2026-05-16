const supabase = require('../data/supabase');
const bcrypt = require('bcryptjs');

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

module.exports = {
  registrarCliente,
  loginCliente
};
// Actualizar datos del perfil del cliente
const actualizarPerfil = async (req, res) => {
  try {
    const { emailActual, nuevoNombre, nuevoEmail } = req.body;

    const { data, error } = await supabase
      .from('clientes')
      .update({ nombre: nuevoNombre, email: nuevoEmail })
      .eq('email', emailActual)
      .select();

    if (error) throw error;

    res.status(200).json({
      success: true,
      user: { nombre: data[0].nombre, email: data[0].email, rol: data[0].rol }
    });
  } catch (error) {
    console.error('Error al actualizar perfil:', error.message);
    res.status(500).json({ error: 'No se pudo actualizar la información.' });
  }
};

// Añádelo al module.exports del archivo:
module.exports = {
  registrarCliente,
  loginCliente,
  actualizarPerfil // <-- Añadido
};