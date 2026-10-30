/**
 * Configuración centralizada de marca (Brand Config).
 * Permite adaptar el ecommerce a cualquier nuevo cliente modificando únicamente este archivo.
 */

export const BRAND = {
  nombre: 'Nave 5 Barcelona',
  nombreCorto: 'Nave 5',
  eslogan: 'Almacén de ideas',
  // Qué es el negocio, en minúscula: se usa en frases como «piezas restauradas en <nombre>, <tipoNegocio>»
  tipoNegocio: 'almacén de muebles y atrezo vintage',
  hashtag: '#Nave5Barcelona',
  descripcion: 'Almacén de ideas en el corazón de Barcelona: muebles y piezas restauradas con historia, cuidadas al detalle para dar vida a tus espacios.',

  // Logotipo de la cabecera (components/Logo.jsx): 'dibujo' pinta el SVG de theme/LogoDibujo.jsx;
  // 'texto', el nombre corto en mayúsculas. init:client lo deja en 'texto'.
  logo: 'dibujo',
  
  // Catálogo y referencias
  prefijoSku: 'NAV',

  // Identificador técnico corto: claves del navegador (tema elegido, consentimiento de cookies) y
  // nombre de los CSV del panel. En una tienda en marcha no se cambia: se perderían las preferencias
  // guardadas de los visitantes.
  idInterno: 'nave5',
  
  // Localización e internacionalización
  moneda: 'EUR',
  locale: 'es-ES',
  simboloMoneda: '€',

  // Datos de contacto y fiscales
  contacto: {
    email: 'hola@nave5barcelona.com',
    telefono: '+34 930 00 00 00',
    // calle: sin el «interior», para Google Maps y el albarán; direccion: la completa, para el pie y Contacto
    calle: 'Carrer del Plom, 32-34',
    direccion: 'Carrer del Plom, 32-34, interior',
    ciudad: 'Barcelona',
    codigoPostal: '08038',
    pais: 'ES',
    horario: 'Mo-Fr 10:00-19:00',
    razonSocial: 'Nave 5 Barcelona S.L.',
    cif: 'B-00000000'
  },

  // Presencia online
  web: 'https://www.nave5barcelona.com',
  dominio: 'nave5barcelona.com',
  redes: {
    instagram: 'https://www.instagram.com/nave5bcn',
    instagramUsuario: 'nave5bcn'
  },

  // Módulos funcionales activos
  modulos: {
    ecommerce: true,
    bookings: true
  },

  // Atajos con los nombres de la guía del starter (docs/NUEVO_CLIENTE.md). Leen los campos de
  // arriba, así que cada dato se escribe una sola vez.
  get prefijoSKU() { return this.prefijoSku; },
  get emailContacto() { return this.contacto.email; },
  get telefono() { return this.contacto.telefono; },
  get direccion() { return this.contacto.direccion; },
  get redesSociales() { return this.redes; }
};

/**
 * Helper con acceso seguro a propiedades por path ('contacto.email', 'prefijoSku', etc.)
 */
export const brand = {
  ...BRAND,
  get: (ruta, valorPorDefecto = '') => {
    if (!ruta) return BRAND;
    const resultado = ruta.split('.').reduce((acumulado, parte) => {
      return acumulado && acumulado[parte] !== undefined ? acumulado[parte] : undefined;
    }, BRAND);
    return resultado !== undefined ? resultado : valorPorDefecto;
  }
};

export default brand;
