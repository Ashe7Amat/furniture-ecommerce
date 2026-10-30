import { BRAND } from '../../theme/brand.config';
// Ayudantes de la pestaña "Mensajes" (pestanas/MensajesTab.jsx).

// Corta un texto largo para la tabla (y junta sus espacios y saltos de línea); el texto entero sale
// al pasar el ratón y en el modal del mensaje.
export const recortar = (texto, maximo) => {
  const limpio = String(texto ?? '').replace(/\s+/g, ' ').trim();
  return limpio.length > maximo ? `${limpio.slice(0, maximo - 1).trimEnd()}…` : limpio;
};

// Fecha y hora cortas, en hora de Madrid (la del negocio).
export const fechaMensaje = (iso) =>
  new Date(iso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Madrid' });

// Las referencias de pieza (NAV-SIL-001) que trae un mensaje, sin repetir y en el orden en que salen.
// El botón «Preguntar por esta pieza» de la web las escribe así: «(ref. NAV-SIL-001)». La tabla
// mensajes_contacto no tiene asunto, así que solo se mira el texto del mensaje.
const REFERENCIA = new RegExp(`${BRAND.prefijoSku}-[A-Z]{3}-\\d{3}`, 'g');

export const referenciasEn = (texto) => [...new Set(String(texto).match(REFERENCIA) ?? [])];

// Texto para comparar nombres: sin mayúsculas, sin acentos (también ñ -> n y ü -> u) y con los espacios
// juntados, para que «sillon chester» encuentre el «Sillón Chester».
export const normalizar = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

// Solo cuentan los nombres largos (3 palabras o más, o 10 letras o más): con «Mesa» o «Silla»,
// cualquier mensaje que hable de mesas o sillas sacaría esa pieza.
const nombreBuscable = (nombre) => nombre.length >= 10 || nombre.split(' ').length >= 3;

// Las piezas de las que habla un mensaje, en el orden en que salen en el texto:
//  - porReferencia: cada referencia (NAV-SIL-001) con su pieza, o `mueble: null` si ya no está en el
//    inventario. Son las más fiables.
//  - porNombre: las piezas cuyo nombre entero sale en el mensaje, sin las que ya salen por referencia.
//    Si el nombre de una pieza está dentro del de otra que también sale («Silla Thonet» y «Silla Thonet
//    (Copia)»), solo cuenta la del nombre más largo.
export const piezasDelMensaje = (mensaje, muebles) => {
  const porReferencia = referenciasEn(mensaje?.mensaje).map((referencia) => ({
    referencia,
    mueble: muebles.find((m) => m.referencia === referencia) ?? null
  }));
  const yaDetectadas = new Set(porReferencia.map((p) => p.mueble?.id));
  const texto = normalizar(mensaje?.mensaje);
  const candidatas = muebles
    .map((mueble) => ({ mueble, nombre: normalizar(mueble.nombre) }))
    .filter(({ mueble, nombre }) => nombreBuscable(nombre) && !yaDetectadas.has(mueble.id) && texto.includes(nombre));
  const porNombre = candidatas
    .filter((c) => !candidatas.some((otra) => otra.nombre.length > c.nombre.length && otra.nombre.includes(c.nombre)))
    .sort((a, b) => texto.indexOf(a.nombre) - texto.indexOf(b.nombre))
    .map(({ mueble }) => ({ referencia: mueble.referencia ?? null, mueble }));
  return { porReferencia, porNombre };
};

// El buscador manual del mensaje: las piezas cuyo nombre o referencia contiene lo escrito (sin
// mayúsculas ni acentos). Sin nada escrito, ninguna.
export const buscarPiezas = (muebles, busqueda) => {
  const buscado = normalizar(busqueda);
  if (!buscado) return [];
  return muebles.filter((m) => normalizar(m.nombre).includes(buscado) || normalizar(m.referencia).includes(buscado));
};

// El texto de la insignia de estado de una pieza (los colores son los de .status-pill).
const ESTADOS = { disponible: 'Disponible', vendido: 'Vendido', alquilado: 'Alquilado' };
// Sin estado cuenta como disponible, igual que en el inventario.
export const textoEstado = (estado) => ESTADOS[estado || 'disponible'] ?? estado;
