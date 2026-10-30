// server/src/controllers/authController.js
const supabase = require('../data/supabase');
const { BRAND } = require('../config/brand.config');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const correos = require('../utils/email');
const refreshTokens = require('../utils/refreshTokens');
const verificacionEmail = require('../utils/verificacionEmail');
const { enviarTodos } = require('../utils/enviarTodos');
const { registrarActividad } = require('../utils/audit');

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

// Lo que el cliente ve de la cuenta. `email_verificado` y `email_pendiente` son de H18
// (docs/verificacion-email-diseno.md): con ellos el cliente enseña los avisos de "confirma tu email"
// y del cambio de email a medias.
const usuarioPublico = (usuario) => ({
  nombre: usuario.nombre,
  email: usuario.email,
  rol: usuario.rol,
  email_verificado: usuario.email_verificado === true,
  email_pendiente: usuario.email_pendiente || null
});

// La cuenta de la sesión: por su id (`sub` del token) o, en los tokens firmados antes de que lo
// llevaran, por su email.
const buscarCuentaDeSesion = async (usuarioToken, columnas) => {
  const consulta = supabase.from('clientes').select(columnas);
  const { data, error } = usuarioToken.sub
    ? await consulta.eq('id', usuarioToken.sub).maybeSingle()
    : await consulta.eq('email', usuarioToken.email).maybeSingle();
  if (error) throw error;
  return data;
};

// Crea un enlace de verificación y manda su correo. Nunca lanza: si falta
// EMAIL_TOKEN_HASH_SECRET o falla la base de datos, se registra y la cuenta sigue sin verificar
// (desde Mi cuenta se puede pedir otro enlace). Devuelve true si el enlace se creó.
// El correo se espera (con tope) antes de responder: en Vercel, un envío pendiente al responder
// podría no completarse, y sin este correo la cuenta no se puede verificar (enviarTodos.js).
const mandarEnlace = async ({ cliente, motivo, destino, enviar }) => {
  try {
    const token = await verificacionEmail.crear({ clienteId: cliente.id, email: destino, motivo });
    await enviarTodos([
      () =>
        enviar({
          email: destino,
          nombre: cliente.nombre,
          url: verificacionEmail.urlVerificacion(token)
        })
    ]);
    return true;
  } catch (error) {
    console.error(`No se pudo crear el enlace de verificación (${motivo}):`, error.message);
    return false;
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

    // H18: la cuenta nace sin verificar (email_verificado tiene false por defecto en la base de
    // datos) y le llega el correo para confirmar el email, que sustituye al de bienvenida. La
    // sesión se devuelve igual que antes: sin verificar se puede comprar, pero no ver "Mis pedidos".
    await mandarEnlace({
      cliente: nuevoUsuario[0],
      motivo: 'registro',
      destino: nuevoUsuario[0].email,
      enviar: correos.enviarConfirmarRegistro
    });

    const token = firmarToken(nuevoUsuario[0]);
    const refreshToken = await emitirRefresh(nuevoUsuario[0], req);

    res.status(201).json({
      success: true,
      message: 'Cuenta creada con éxito.',
      user: usuarioPublico({ ...nuevoUsuario[0], email_verificado: false }),
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

    try {
      await registrarActividad(
        { ...req, usuario: { sub: usuario.id, email: usuario.email, rol: usuario.rol } },
        'login',
        'auth',
        usuario.id,
        null,
        { email: usuario.email, rol: usuario.rol }
      );
    } catch (errAudit) {
      console.error('Error al registrar auditoría en login:', errAudit.message);
    }

    res.status(200).json({
      success: true,
      user: usuarioPublico(usuario),
      token,
      refreshToken
    });
  } catch (error) {
    console.error('Error en login:', error.message);
    res.status(500).json({ error: 'Error interno del servidor al iniciar sesión.' });
  }
};

// Actualizar datos del perfil del cliente (Seguro - Requiere contraseña solo si cambia email/password)
//
// H18, opción C (docs/verificacion-email-diseno.md, parte 6, punto 5): el email nuevo NO se aplica
// aquí. Se guarda en `email_pendiente`, le llega un enlace al email nuevo y un aviso al antiguo, y
// el cambio se hace al confirmar el enlace (verificarEmail, más abajo). Hasta entonces la cuenta
// sigue con su email. Por eso H21 (cerrar las demás sesiones) se aplica aquí solo al cambiar la
// contraseña; la del email se aplica al confirmarlo.
const CAMBIO_EMAIL_NO_DISPONIBLE = {
  error: 'No se puede cambiar el email ahora mismo. Inténtalo de nuevo más tarde.'
};

const actualizarPerfil = async (req, res) => {
  try {
    const { nuevoNombre, nuevoEmail, passwordActual, nuevaPassword } = req.body;
    // La cuenta a modificar sale del token verificado, nunca del body: así un usuario no puede
    // editar la cuenta de otro cambiando el JSON de la petición. Se busca por su id (`sub`), no por
    // el email del token: tras confirmar un cambio de email, un token de antes (vale 1 hora) aún
    // lleva el email viejo, que para entonces puede ser ya de otra cuenta.
    const usuario = await buscarCuentaDeSesion(req.usuario, '*');
    if (!usuario) {
      return res.status(404).json({ error: 'El usuario no existe.' });
    }
    const emailActual = usuario.email;

    const estaCambiandoEmail = !!nuevoEmail && nuevoEmail !== emailActual;
    const estaCambiandoPassword = !!nuevaPassword;
    let tokenCambio = null; // el del enlace al email nuevo, si cambia el email

    // Solo verificar la contraseña si se está intentando cambiar email o contraseña
    if (estaCambiandoEmail || estaCambiandoPassword) {
      if (!passwordActual) {
        return res.status(400).json({
          error: 'Debes proporcionar tu contraseña actual para cambiar tu correo o contraseña.'
        });
      }

      // 1. Verificar la contraseña actual
      const contraseñaCorrecta = await bcrypt.compare(passwordActual, usuario.password);
      if (!contraseñaCorrecta) {
        // H28: queda en el log quién lo intentó (el id de la cuenta), nunca la contraseña.
        console.warn(`perfil-update: contraseña actual incorrecta (cuenta ${usuario.id}).`);
        return res.status(401).json({ error: 'La contraseña actual es incorrecta.' });
      }
    }

    // 2. Preparar los campos a actualizar
    const updateFields = {};
    if (nuevoNombre !== undefined) updateFields.nombre = nuevoNombre;
    if (estaCambiandoEmail) {
      // Si cambia de email, verificar si el nuevo email ya está registrado por otro usuario
      const { data: emailDuplicado } = await supabase
        .from('clientes')
        .select('email')
        .eq('email', nuevoEmail)
        .single();

      if (emailDuplicado) {
        return res.status(400).json({ error: 'El nuevo correo electrónico ya está en uso.' });
      }

      // El enlace se crea antes de guardar email_pendiente: sin EMAIL_TOKEN_HASH_SECRET, o si
      // falla, no se deja un cambio a medias que nadie podría confirmar. Un enlace creado cuyo
      // guardado falle después no sirve de nada: al confirmarlo, el email pendiente no coincide.
      try {
        tokenCambio = await verificacionEmail.crear({
          clienteId: usuario.id,
          email: nuevoEmail,
          motivo: 'cambio_email'
        });
      } catch (error) {
        console.error(
          'perfil-update: no se pudo crear el enlace del cambio de email:',
          error.message
        );
        const status = error instanceof verificacionEmail.SecretoNoConfigurado ? 503 : 500;
        return res.status(status).json(CAMBIO_EMAIL_NO_DISPONIBLE);
      }
      updateFields.email_pendiente = nuevoEmail;
    }

    // 3. Si se desea cambiar la contraseña (la longitud mínima ya la valida Zod)
    if (nuevaPassword) {
      const salt = await bcrypt.genSalt(10);
      updateFields.password = await bcrypt.hash(nuevaPassword, salt);
      // Cambiar solo la contraseña anula un cambio de email pendiente: es lo que el aviso al email
      // antiguo (correo 4) le dice que haga a quien no lo ha pedido. Sin el pendiente, su enlace
      // ya no vale (verificarEmail lo compara con email_pendiente).
      if (!estaCambiandoEmail && usuario.email_pendiente) updateFields.email_pendiente = null;
    }

    // H21: cambiar la contraseña cierra todas las sesiones de la cuenta (los refresh tokens de
    // otras pestañas y dispositivos, y también el de esta). Se hace ANTES de guardar el cambio: si
    // la revocación fallara, no se cambia nada. La sesión que hace el cambio recibe un refresh
    // token nuevo (más abajo) para no quedarse fuera. El cambio de email cierra las sesiones al
    // confirmarse (verificarEmail), no al pedirse.
    if (estaCambiandoPassword) await refreshTokens.revocarTodasDelUsuario(usuario.id);

    // 4. Ejecutar la actualización en Supabase
    const { data: dataActualizada, error: updateError } = await supabase
      .from('clientes')
      .update(updateFields)
      .eq('id', usuario.id)
      .select();

    if (updateError || !dataActualizada || dataActualizada.length === 0) {
      throw new Error(updateError?.message || 'Error al actualizar registro en base de datos');
    }
    const cuenta = dataActualizada[0];

    // Correos del cambio de email (parte 3, correos 3 y 4): el enlace al email nuevo y el aviso
    // al antiguo. Nunca lanzan, y se esperan con tope antes de responder (enviarTodos.js).
    if (estaCambiandoEmail) {
      await enviarTodos([
        () =>
          correos.enviarConfirmarCambioEmail({
            email: nuevoEmail,
            nombre: cuenta.nombre,
            url: verificacionEmail.urlVerificacion(tokenCambio)
          }),
        () =>
          correos.enviarAvisoCambioEmail({
            email: emailActual,
            nombre: cuenta.nombre,
            emailNuevo: nuevoEmail
          })
      ]);
    }

    // Se firma un access token nuevo (1 hora) porque lleva dentro el nombre/email/rol: si no se
    // renueva aquí, el nombre queda desactualizado en la sesión. El cliente lo guarda en memoria.
    // Si no cambia la contraseña, el refresh token no se toca (cada rotación ya vuelve a leer la
    // cuenta) y la respuesta no trae `refreshToken`. Si cambió, las sesiones se han revocado
    // arriba (H21) y `refreshToken` trae el de una sesión nueva (o null si falta
    // REFRESH_TOKEN_HASH_SECRET).
    const token = firmarToken(cuenta);
    const sesionNueva = estaCambiandoPassword
      ? { refreshToken: await emitirRefresh(cuenta, req) }
      : {};

    res.status(200).json({
      success: true,
      message: estaCambiandoEmail
        ? `Te hemos enviado un enlace a ${nuevoEmail}. Hasta que lo confirmes, tu cuenta sigue con ${emailActual}.`
        : 'Perfil actualizado con éxito.',
      user: usuarioPublico(cuenta),
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
    const ahora = new Date().toISOString();

    if (!usuario) {
      // Las cuentas creadas por Google no se usan nunca con contraseña, pero la columna
      // "password" es obligatoria: se rellena con un valor aleatorio e inservible.
      const passwordInservible = await bcrypt.hash(crypto.randomUUID(), 10);
      const { data: nuevoUsuario, error: insertError } = await supabase
        .from('clientes')
        .insert([
          {
            nombre,
            email,
            password: passwordInservible,
            rol: 'cliente',
            // H18: Google solo entrega emails que ha comprobado (email_verified, arriba)
            email_verificado: true,
            email_verificado_en: ahora
          }
        ])
        .select()
        .single();

      if (insertError) throw insertError;
      usuario = nuevoUsuario;
      // Nace verificada: recibe ya sus compras de invitado, como al confirmar el email (Mis
      // pedidos las busca por cliente_id).
      await verificacionEmail.asociarPedidosDeInvitado(usuario.id, usuario.email);
    } else if (usuario.email_verificado !== true) {
      // H18, caso 3 (parte 6, punto 8): una cuenta sin verificar con este email. Pudo crearla
      // con contraseña otra persona para adelantarse; Google acaba de demostrar que el email es
      // de quien entra ahora. Se protege: queda verificada, la contraseña se sustituye por una
      // inservible (la de antes la podría saber quien la creó), se cierran todas sus sesiones y
      // se avisa por correo. No se distingue una cuenta de Google de antes de H18 (tampoco
      // verificada): con ella pasa lo mismo, y solo cambia que se cierran sus otras sesiones.
      // También se anula un cambio de email pendiente: lo pudo pedir quien creó la cuenta, y con
      // su enlace se quedaría con ella (y con los pedidos que se acaban de asociar).
      const passwordInservible = await bcrypt.hash(crypto.randomUUID(), 10);
      await refreshTokens.revocarTodasDelUsuario(usuario.id);
      const { data: protegida, error: updateError } = await supabase
        .from('clientes')
        .update({
          email_verificado: true,
          email_verificado_en: ahora,
          password: passwordInservible,
          email_pendiente: null
        })
        .eq('id', usuario.id)
        .select()
        .single();
      if (updateError) throw updateError;
      usuario = protegida;
      await verificacionEmail.asociarPedidosDeInvitado(usuario.id, usuario.email);
      await enviarTodos([
        () => correos.enviarCuentaProtegida({ email: usuario.email, nombre: usuario.nombre })
      ]);
    }

    const token = firmarToken(usuario);
    const refreshToken = await emitirRefresh(usuario, req);

    res.status(200).json({
      success: true,
      user: usuarioPublico(usuario),
      token,
      refreshToken
    });
  } catch (error) {
    console.error('Error en login con Google:', error.message);
    res.status(401).json({ error: 'No se pudo iniciar sesión con Google.' });
  }
};

// 5. RENOVAR LA SESIÓN (POST /api/auth/refresh)
// Entrada: { refreshToken }. Salida: { accessToken, refreshToken, user }: el refresh SIEMPRE rota.
// `user` (H18) lleva la cuenta tal como está ahora, para que el cliente se entere, p. ej., de que
// el email se ha confirmado desde otra pestaña o dispositivo.
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
      .select('id, email, nombre, rol, email_verificado, email_pendiente')
      .eq('id', resultado.userId)
      .maybeSingle();
    if (error) throw error;
    if (!usuario) {
      await refreshTokens.revocarFamilia(resultado.familia);
      console.warn(`Refresh rechazado: la cuenta ya no existe (familia ${resultado.familia}).`);
      return res.status(401).json(SESION_NO_VALIDA);
    }

    res.status(200).json({
      accessToken: firmarToken(usuario),
      refreshToken: resultado.refreshToken,
      user: usuarioPublico(usuario)
    });
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

// 7. CONFIRMAR EL EMAIL (POST /api/auth/verificar-email) -- H18, parte 6, punto 2
// Entrada: { token }, el del enlace del correo. No pide sesión: el enlace se puede abrir en otro
// dispositivo. Todo lo que no vale (enlace inventado, usado, caducado, gastado a la vez por otra
// petición, o que ya no corresponde a la cuenta) responde igual, con el mismo 400 y el mismo texto.
const ENLACE_NO_VALIDO = { error: 'El enlace no es válido o ha caducado.' };
const VERIFICACION_NO_DISPONIBLE = {
  error: 'No se puede confirmar el email ahora mismo. Inténtalo de nuevo en unos minutos.'
};

const verificarEmail = async (req, res) => {
  try {
    const enlace = await verificacionEmail.consumir(req.body.token);
    if (!enlace) {
      console.warn('verificar-email: enlace rechazado.');
      return res.status(400).json(ENLACE_NO_VALIDO);
    }

    const { data: cliente, error: errorCliente } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', enlace.cliente_id)
      .maybeSingle();
    if (errorCliente) throw errorCliente;

    // El enlace ya no corresponde a la cuenta: el email ha cambiado desde que se mandó (registro),
    // o el cambio pedido ya no es ese (cambio_email).
    const vigente =
      cliente &&
      (enlace.motivo === 'registro'
        ? cliente.email === enlace.email
        : cliente.email_pendiente === enlace.email);
    if (!vigente) {
      console.warn(
        `verificar-email: el enlace ya no corresponde a la cuenta ${enlace.cliente_id}.`
      );
      return res.status(400).json(ENLACE_NO_VALIDO);
    }

    const ahora = new Date().toISOString();
    const cambios = { email_verificado: true, email_verificado_en: ahora };

    if (enlace.motivo === 'cambio_email') {
      // El email nuevo tiene que seguir libre: alguien pudo registrarlo mientras tanto.
      const { data: ocupado, error: errorOcupado } = await supabase
        .from('clientes')
        .select('id')
        .eq('email', enlace.email)
        .maybeSingle();
      if (errorOcupado) throw errorOcupado;
      if (ocupado) {
        // El cambio ya no se puede hacer: se anula, para que "Enviar otro" no siga mandando
        // enlaces a una dirección que ya es de otra cuenta. Si falla, solo se registra: el
        // enlace ya está gastado y la respuesta es la misma.
        const { error: errorAnular } = await supabase
          .from('clientes')
          .update({ email_pendiente: null })
          .eq('id', cliente.id)
          .eq('email_pendiente', enlace.email);
        if (errorAnular) {
          console.error(
            'verificar-email: no se pudo anular el cambio de email:',
            errorAnular.message
          );
        }
        return res.status(409).json({ error: 'Ese correo electrónico ya está en uso.' });
      }
      cambios.email = enlace.email;
      cambios.email_pendiente = null;
      // H21: el email cambia ahora, así que ahora se cierran todas las sesiones de la cuenta.
      await refreshTokens.revocarTodasDelUsuario(cliente.id);
    }

    const { data: actualizada, error: errorUpdate } = await supabase
      .from('clientes')
      .update(cambios)
      .eq('id', cliente.id)
      .select()
      .single();
    if (errorUpdate) throw errorUpdate;

    await verificacionEmail.asociarPedidosDeInvitado(actualizada.id, actualizada.email);
    if (enlace.motivo === 'registro') {
      await enviarTodos([
        () => correos.enviarCuentaActivada({ email: actualizada.email, nombre: actualizada.nombre })
      ]);
    }

    res.status(200).json({
      success: true,
      motivo: enlace.motivo,
      user: usuarioPublico(actualizada),
      // Tras un cambio de email, las sesiones de la cuenta están cerradas: el cliente cierra la
      // suya y pide entrar con el email nuevo.
      sesionCerrada: enlace.motivo === 'cambio_email'
    });
  } catch (error) {
    if (error instanceof verificacionEmail.SecretoNoConfigurado) {
      console.error(error.message);
      return res.status(503).json(VERIFICACION_NO_DISPONIBLE);
    }
    console.error('Error al confirmar el email:', error.message);
    res.status(500).json(VERIFICACION_NO_DISPONIBLE);
  }
};

// 8. PEDIR OTRO ENLACE (POST /api/auth/reenviar-verificacion) -- H18, parte 6, punto 3
// Con sesión. El límite (3 cada hora por cuenta) va en authRoutes.js. Si la cuenta no está
// verificada, manda otro enlace de registro; si lo está pero tiene un cambio de email a medias,
// otro enlace al email pendiente. Crear un enlace borra los anteriores sin usar del mismo tipo.
const reenviarVerificacion = async (req, res) => {
  try {
    const cliente = await buscarCuentaDeSesion(req.usuario, '*');
    if (!cliente) return res.status(404).json({ error: 'El usuario no existe.' });

    let enviado;
    if (cliente.email_verificado !== true) {
      enviado = await mandarEnlace({
        cliente,
        motivo: 'registro',
        destino: cliente.email,
        enviar: correos.enviarConfirmarRegistro
      });
    } else if (cliente.email_pendiente) {
      enviado = await mandarEnlace({
        cliente,
        motivo: 'cambio_email',
        destino: cliente.email_pendiente,
        enviar: correos.enviarConfirmarCambioEmail
      });
    } else {
      return res.status(400).json({ error: 'Tu email ya está confirmado.' });
    }

    if (!enviado) {
      return res.status(503).json({
        error: 'No se ha podido enviar el correo ahora mismo. Inténtalo de nuevo más tarde.'
      });
    }
    res.status(200).json({ success: true, message: 'Te hemos enviado otro correo.' });
  } catch (error) {
    console.error('Error al reenviar la verificación:', error.message);
    res.status(500).json({ error: 'No se ha podido enviar el correo ahora mismo.' });
  }
};

// 9. RECUPERACIÓN DE CONTRASEÑA — SOLICITAR (POST /api/auth/forgot-password)
const MENSAJE_FORGOT_GENERICO = 'Si el correo está registrado, recibirás un enlace.';

const solicitarRecuperacion = async (req, res) => {
  try {
    const emailEntrada = String(req.body?.email || '')
      .toLowerCase()
      .trim();
    if (!emailEntrada) {
      return res.status(200).json({ success: true, message: MENSAJE_FORGOT_GENERICO });
    }

    const { data: cliente, error } = await supabase
      .from('clientes')
      .select('id, email, nombre')
      .eq('email', emailEntrada)
      .maybeSingle();

    if (error) {
      console.error('Error al buscar cliente en solicitarRecuperacion:', error.message);
      return res.status(200).json({ success: true, message: MENSAJE_FORGOT_GENERICO });
    }

    if (!cliente) {
      return res.status(200).json({ success: true, message: MENSAJE_FORGOT_GENERICO });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const { error: errorInsert } = await supabase.from('password_resets').insert({
      email: cliente.email,
      token_hash: tokenHash,
      expires_at: expiresAt,
      used_at: null
    });

    if (errorInsert) {
      console.error('Error al guardar token de password_resets:', errorInsert.message);
      return res.status(200).json({ success: true, message: MENSAJE_FORGOT_GENERICO });
    }

    const urlBase = (process.env.CLIENT_URL || BRAND.web).replace(/\/+$/, '');
    const enlace = `${urlBase}/reset-password?token=${token}`;

    await enviarTodos([() => correos.enviarEmailRecuperacion(cliente.email, enlace)]);

    return res.status(200).json({ success: true, message: MENSAJE_FORGOT_GENERICO });
  } catch (error) {
    console.error('Error no controlado en solicitarRecuperacion:', error.message);
    return res.status(200).json({ success: true, message: MENSAJE_FORGOT_GENERICO });
  }
};

// 10. RECUPERACIÓN DE CONTRASEÑA — RESTABLECER (POST /api/auth/reset-password)
const restablecerPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};
    if (!token) {
      return res.status(400).json({ error: 'El token es obligatorio.' });
    }
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
    }

    const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');

    const { data: resetEntry, error: errorRead } = await supabase
      .from('password_resets')
      .select('*')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (errorRead) {
      console.error('Error al leer token de recuperación:', errorRead.message);
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }

    if (!resetEntry) {
      return res
        .status(400)
        .json({ error: 'El enlace de recuperación no es válido o ha caducado.' });
    }

    if (resetEntry.used_at) {
      return res.status(400).json({ error: 'Este enlace de recuperación ya ha sido utilizado.' });
    }

    if (new Date(resetEntry.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: 'El enlace de recuperación ha caducado.' });
    }

    // Actualiza clientes.password (con bcrypt, 12 rondas)
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    const { data: cliente, error: errorUpdate } = await supabase
      .from('clientes')
      .update({ password: hashedPassword })
      .eq('email', resetEntry.email)
      .select('id')
      .maybeSingle();

    if (errorUpdate) {
      console.error('Error al actualizar contraseña del cliente:', errorUpdate.message);
      return res.status(500).json({ error: 'Error al actualizar la contraseña.' });
    }

    // Marca el token como usado
    const { error: errorMarcar } = await supabase
      .from('password_resets')
      .update({ used_at: new Date().toISOString() })
      .eq('id', resetEntry.id);

    if (errorMarcar) {
      console.error('Error al marcar token de recuperación como usado:', errorMarcar.message);
    }

    // Revoca todos los refresh_tokens del usuario (por seguridad)
    if (cliente?.id) {
      try {
        await refreshTokens.revocarTodasDelUsuario(cliente.id);
      } catch (errTokens) {
        console.error(
          'Error al revocar refresh tokens tras restablecer contraseña:',
          errTokens.message
        );
      }
    }

    return res.status(200).json({ success: true, message: 'Contraseña restablecida con éxito.' });
  } catch (error) {
    console.error('Error en restablecerPassword:', error.message);
    return res.status(500).json({ error: 'Error al restablecer la contraseña.' });
  }
};

module.exports = {
  registrarCliente,
  loginCliente,
  actualizarPerfil,
  loginConGoogle,
  refrescarSesion,
  cerrarSesion,
  verificarEmail,
  reenviarVerificacion,
  solicitarRecuperacion,
  restablecerPassword
};
