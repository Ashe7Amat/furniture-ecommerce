// Configuración de la marca en el servidor: nombre, web, dirección y aspecto de los correos.
// Es la pareja de client/src/theme/brand.config.js (la web y la API se despliegan por separado y no
// comparten archivos): para otro cliente se cambian las dos, a mano o con `npm run init:client`
// desde la raíz del repo (ver docs/NUEVO_CLIENTE.md). Los secretos y lo que cambia según el
// entorno (RESEND_FROM, ADMIN_EMAIL, CLIENT_URL...) siguen en las variables de entorno: aquí solo
// están sus valores por defecto.

const BRAND = Object.freeze({
  nombre: 'Nave 5 Barcelona',
  // Logotipo en texto: el alt del logo de los correos y la cabecera de su versión en texto plano
  nombreLogo: 'NAVE 5',
  eslogan: 'Almacén de ideas',

  // Prefijo de las referencias de las piezas (NAV-SIL-001). Cambiarlo en una tienda en marcha deja
  // las referencias viejas con el prefijo anterior: las nuevas seguirían otra numeración.
  prefijoSku: 'NAV',

  // Identificador técnico corto: nombre de los CSV que descarga el panel. Igual que en el cliente.
  idInterno: 'nave5',

  // La web pública (sitemap y enlaces de reserva de contraseña) y el dominio que se enseña en los
  // correos (sus enlaces van a https://<dominio>).
  web: 'https://www.nave5barcelona.com',
  dominio: 'nave5barcelona.com',

  contacto: Object.freeze({
    direccion: 'Carrer del Plom, 32-34, interior',
    codigoPostal: '08038',
    ciudad: 'Barcelona'
  }),

  email: Object.freeze({
    // Remitente si falta RESEND_FROM. onboarding@resend.dev solo entrega al dueño de la cuenta de
    // Resend: en producción RESEND_FROM debe usar un dominio verificado.
    remitentePorDefecto: 'Nave 5 Barcelona <onboarding@resend.dev>',
    // A quién van los avisos del panel si falta ADMIN_EMAIL
    avisosPorDefecto: 'amatashenafi7@gmail.com',
    // Logo de la cabecera (PNG en blanco roto, fondo transparente; lo genera server/scripts/logo-email.js)
    logo: 'https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/marca/logo-nave5.png',
    logo2x:
      'https://gdrmpxcpucmaxvtpljge.supabase.co/storage/v1/object/public/imagenes/marca/logo-nave5@2x.png',
    // Colores de los correos: los de la web (client/src/theme/tokens.css), escritos en hex porque los
    // clientes de correo no entienden variables CSS.
    colores: Object.freeze({
      oscuro: '#221B16', // fondo de la cabecera (el del hero)
      claro: '#F5F2EC', // blanco roto
      secundario: '#6E5D51', // texto secundario
      borde: '#E2DCD0',
      texto: '#3E322A',
      textoSuave: '#857468',
      acento: '#B38A70',
      superficie: '#FCFAF8',
      blanco: '#FFFFFF'
    })
  })
});

module.exports = { BRAND };
