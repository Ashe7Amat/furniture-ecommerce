/**
 * Configuración centralizada de marca (Brand Config).
 * Permite adaptar el ecommerce a cualquier nuevo cliente modificando únicamente este archivo.
 */

export const BRAND = {
  nombre: 'Nave 5 Barcelona',
  nombreCorto: 'Nave 5',
  eslogan: 'Almacén de ideas',
  descripcion: 'Almacén de ideas en el corazón de Barcelona: muebles y piezas restauradas con historia, cuidadas al detalle para dar vida a tus espacios.',
  
  // Catálogo y referencias
  prefijoSku: 'NAV',
  
  // Localización e internacionalización
  moneda: 'EUR',
  locale: 'es-ES',
  simboloMoneda: '€',

  // Datos de contacto y fiscales
  contacto: {
    email: 'hola@nave5barcelona.com',
    telefono: '+34 930 00 00 00',
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
  redes: {
    instagram: 'https://www.instagram.com/nave5bcn'
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
