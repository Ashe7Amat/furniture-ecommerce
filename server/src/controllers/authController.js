// server/src/controllers/authController.js
const supabase = require('../data/supabase');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { enviarEmailBienvenida } = require('../utils/email');
const refreshTokens = require('../utils/refreshTokens');

// Cliente para verificar los tokens que manda el botón de Google. Si no hay
// GOOGLE_CLIENT_ID configurado en el servidor, el login con Google queda desactivado
// (se avisa con un error claro en vez de fallar de forma rara).
const googleClient = process.env.GOOGLE_CLIENT_ID
  ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
  : null;

// La forma del payload (campos obligatorios, formato de email, longitud de la contraseña) ya la
// valida el middleware validar() con los esquemas de schemas/auth.js, antes de llegar aquí. Lo
// que queda en este archivo son las reglas que dependen de la base de datos (email duplicado,
// contraseña actual correcta...), que Zod no puede comprobar por sí solo.

// Firma el access token (válido 1 hora) con los datos mínimos del usuario. La sesión dura más
// gracias al refresh token (utils/refreshTokens.js), que se rota en /api/auth/refresh. Los tokens
// de 7 días firmados antes de este cambio siguen valiendo hasta que caduquen solos (opción 1 del
// diseño): verificarToken no cambia.
// `sub` es el id de la cuenta (el campo estándar de JWT para "de quién es"): lo usa el límite de
// intentos de perfil-update (H28). Los tokens firmados antes no lo llevan; ahí se usa el email.
const firmarToken = (usuario) => {
  return jwt.sign(
    { sub: usuario.id, email: usuario.email, nombre: usuario.nombre, rol: usuario.rol },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
};

// Refresh token de una sesión nueva. Si falta REFRESH_TOKEN_HASH_SECRET (configuración
// incompleta), el inicio de sesión sigue funcionando sin refresh token: la sesión dura como mucho
// lo que el access token (1 hora), y se pierde al recargar la página, porque el cliente guarda ese
// token solo en memoria. Se registra el error para que se note. Cualquier otro fallo se propaga.
const emitirRefresh = async (usuario, req) => {
  try {
    const { token } = await refreshTokens.emitir(usuario.id, {
      meta: refreshTokens.metadatos(req)
    });
    return token;
  } catch (error) {
    if (error instanceof refreshTokens.SecretoNoConfigurado) {
      console.error(`${error.message} Se inicia sesión sin refresh token.`);
      return null;
    }
    throw error;
  }
};

// 1. REGISTRO DE NUEVOS CLIENTES
const registrarCliente = async (req, res) => {
  try {
    const { nombre, email, password } = req.body;

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
    const refreshToken = await emitirRefresh(nuevoUsuario[0], req);

    res.status(201).json({
      success: true,
      message: 'Cuenta creada con éxito.',
      user: {
        nombre: nuevoUsuario[0].nombre,
        email: nuevoUsuario[0].email,
        rol: nuevoUsuario[0].rol
      },
      token,
      refreshToken
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

    // Login exitoso: Devolvemos los datos limpios (sin la contraseña), el access token (`token`,
    // el nombre de siempre) y el refresh token
    const token = firmarToken(usuario);
    const refreshToken = await emitirRefresh(usuario, req);

    res.status(200).json({
      success: true,
      user: {
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol
      },
      token,
      refreshToken
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
    let idUsuario = null; // solo se rellena si cambian el email o la contraseña (ver H21, abajo)

    // Solo verificar la contraseña si se está intentando cambiar email o contraseña
    if (estaCambiandoEmail || estaCambiandoPassword) {
      if (!passwordActual) {
        return res.status(400).json({
          error: 'Debes proporcionar tu contraseña actual para cambiar tu correo o contraseña.'
        });
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
        // H28: queda en el log quién lo intentó (el id de la cuenta), nunca la contraseña.
        console.warn(`perfil-update: contraseña actual incorrecta (cuenta ${usuario.id}).`);
        return res.status(401).json({ error: 'La contraseña actual es incorrecta.' });
      }
      idUsuario = usuario.id;
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

    // 4. Si se desea cambiar la contraseña (la longitud mínima ya la valida Zod)
    if (nuevaPassword) {
      const salt = await bcrypt.genSalt(10);
      updateFields.password = await bcrypt.hash(nuevaPassword, salt);
    }

    // H21: cambiar la contraseña o el email cierra todas las sesiones de la cuenta (los refresh
    // tokens de otras pestañas y dispositivos, y también el de esta). Se hace ANTES de guardar el
    // cambio: si la revocación fallara, no se cambia nada. La sesión que hace el cambio recibe un
    // refresh token nuevo (más abajo) para no quedarse fuera.
    if (idUsuario) await refreshTokens.revocarTodasDelUsuario(idUsuario);

    // 5. Ejecutar la actualización en Supabase
    const { data: dataActualizada, error: updateError } = await supabase
      .from('clientes')
      .update(updateFields)
      .eq('email', emailActual)
      .select();

    if (updateError || !dataActualizada || dataActualizada.length === 0) {
      throw new Error(updateError?.message || 'Error al actualizar registro en base de datos');
    }

    // Se firma un access token nuevo (1 hora) porque lleva dentro el nombre/email/rol: si no se
    // renueva aquí, el nombre o el email quedan desactualizados en la sesión y, si cambió el
    // email, las peticiones autenticadas posteriores (p. ej. "Mis Pedidos") dejarían de encontrar
    // nada porque seguirían buscando con el email antiguo. El cliente lo guarda en memoria.
    // Si solo cambia el nombre, el refresh token no se toca (cada rotación ya vuelve a leer la
    // cuenta) y la respuesta no trae `refreshToken`. Si cambiaron el email o la contraseña, las
    // sesiones se han revocado arriba (H21) y `refreshToken` trae el de una sesión nueva (o null si
    // falta REFRESH_TOKEN_HASH_SECRET).
    const token = firmarToken(dataActualizada[0]);
    const sesionNueva = idUsuario
      ? { refreshToken: await emitirRefresh(dataActualizada[0], req) }
      : {};

    res.status(200).json({
      success: true,
      message: 'Perfil actualizado con éxito.',
      user: {
        nombre: dataActualizada[0].nombre,
        email: dataActualizada[0].email,
        rol: dataActualizada[0].rol
      },
      token,
      ...sesionNueva
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
      console.error(
        'Login con Google: falta GOOGLE_CLIENT_ID en las variables de entorno del servidor.'
      );
      return res
        .status(500)
        .json({ error: 'El inicio de sesión con Google no está disponible ahora mismo.' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
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
    const refreshToken = await emitirRefresh(usuario, req);

    res.status(200).json({
      success: true,
      user: { nombre: usuario.nombre, email: usuario.email, rol: usuario.rol },
      token,
      refreshToken
    });
  } catch (error) {
    console.error('Error en login con Google:', error.message);
    res.status(401).json({ error: 'No se pudo iniciar sesión con Google.' });
  }
};

// 5. RENOVAR LA SESIÓN (POST /api/auth/refresh)
// Entrada: { refreshToken }. Salida: { accessToken, refreshToken }: el refresh SIEMPRE rota.
// Los tres fallos (token que no existe, reuso y caducado) responden igual, con el mismo 401 y el
// mismo texto: distinguirlos le confirmaría a quien llama que su token fue legítimo alguna vez.
// El motivo solo va al log, nunca el token.
const SESION_NO_VALIDA = { error: 'Sesión no válida, vuelve a iniciar sesión.' };
const SESIONES_NO_DISPONIBLES = {
  error: 'No se puede renovar la sesión ahora mismo. Inténtalo de nuevo en unos minutos.'
};

const refrescarSesion = async (req, res) => {
  try {
    const resultado = await refreshTokens.rotar(
      req.body.refreshToken,
      refreshTokens.metadatos(req)
    );

    if (!resultado.ok) {
      if (resultado.motivo === 'reuso') {
        console.warn(`Refresh: reuso detectado, familia ${resultado.familia} revocada entera.`);
      } else {
        console.warn(`Refresh rechazado: token ${resultado.motivo}.`);
      }
      return res.status(401).json(SESION_NO_VALIDA);
    }

    // Se lee la cuenta en cada rotación: si cambió el nombre o el rol desde el último login, el
    // access token nuevo ya lo refleja.
    const { data: usuario, error } = await supabase
      .from('clientes')
      .select('id, email, nombre, rol')
      .eq('id', resultado.userId)
      .maybeSingle();
    if (error) throw error;
    if (!usuario) {
      await refreshTokens.revocarFamilia(resultado.familia);
      console.warn(`Refresh rechazado: la cuenta ya no existe (familia ${resultado.familia}).`);
      return res.status(401).json(SESION_NO_VALIDA);
    }

    res
      .status(200)
      .json({ accessToken: firmarToken(usuario), refreshToken: resultado.refreshToken });
  } catch (error) {
    if (error instanceof refreshTokens.SecretoNoConfigurado) {
      console.error(error.message);
      return res.status(503).json(SESIONES_NO_DISPONIBLES);
    }
    console.error('Error al renovar la sesión:', error.message);
    res.status(500).json(SESIONES_NO_DISPONIBLES);
  }
};

// 6. CERRAR SESIÓN (POST /api/auth/logout)
// Entrada: { refreshToken }. Revoca toda la familia de ese token (la sesión entera, con todas sus
// rotaciones). Responde 200 aunque el token no exista o ya estuviera revocado: cerrar sesión dos
// veces no es un error. El cliente borra su sesión local pase lo que pase.
const cerrarSesion = async (req, res) => {
  try {
    await refreshTokens.revocarFamiliaDeToken(req.body.refreshToken);
    res.status(200).json({ success: true });
  } catch (error) {
    if (error instanceof refreshTokens.SecretoNoConfigurado) {
      console.error(error.message);
      return res.status(503).json(SESIONES_NO_DISPONIBLES);
    }
    console.error('Error al cerrar sesión:', error.message);
    res.status(500).json({ error: 'No se pudo cerrar la sesión en el servidor.' });
  }
};

module.exports = {
  registrarCliente,
  loginCliente,
  actualizarPerfil,
  loginConGoogle,
  refrescarSesion,
  cerrarSesion
};
