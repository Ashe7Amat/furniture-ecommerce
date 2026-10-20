// Mutantes de los textos de la insignia de «Reservas» (textoAvisos, en reservasAdmin.js; ver
// scripts/mutantes-panel.js). Los mata reservasAdmin.test.js.
export const TEST = 'src/pages/admin/reservasAdmin.test.js';

const ARCHIVO = 'src/pages/admin/reservasAdmin.js';

export const MUTANTES = [
  {
    nombre: 'una sola retrasada se escribe «1 retrasadas»',
    archivo: ARCHIVO,
    buscar: "avisos.retrasadas === 1 ? 'retrasada' : 'retrasadas'",
    reemplazo: "'retrasadas'"
  },
  {
    nombre: 'un solo reembolso a medias se escribe «1 reembolsos a medias»',
    archivo: ARCHIVO,
    buscar: "avisos.reembolsos_a_medias === 1 ? 'reembolso' : 'reembolsos'",
    reemplazo: "'reembolsos'"
  },
  {
    nombre: 'el detalle nombra lo que está a cero («0 retrasadas»)',
    archivo: ARCHIVO,
    buscar: 'avisos.retrasadas > 0 &&',
    reemplazo: 'avisos.retrasadas >= 0 &&'
  },
  {
    nombre: 'las pagadas sin confirmar salen con otro nombre',
    archivo: ARCHIVO,
    buscar: '`${avisos.en_conflicto} sin confirmar`',
    reemplazo: '`${avisos.en_conflicto} en conflicto`'
  },
  {
    nombre: 'una vista de aviso apunta a otra clave del resumen (los números salen cambiados)',
    archivo: ARCHIVO,
    buscar: "aviso: 'en_conflicto'",
    reemplazo: "aviso: 'retrasadas'"
  },
  {
    nombre: 'una sola entrega se escribe «1 entregas»',
    archivo: ARCHIVO,
    buscar: "return n > 0 && (n === 1 ? `1 ${singular}` : `${n} ${plural}`);",
    reemplazo: 'return n > 0 && `${n} ${plural}`;'
  },
  {
    nombre: 'el resumen de la agenda nombra lo que está a cero («0 recogidas»)',
    archivo: ARCHIVO,
    buscar: 'return n > 0 && (n === 1',
    reemplazo: 'return n >= 0 && (n === 1'
  },
  {
    nombre: 'el resumen de la agenda cuenta las entregas y las recogidas juntas',
    archivo: ARCHIVO,
    buscar: 'trayectos.filter((t) => t.tipo === tipo).length',
    reemplazo: 'trayectos.length'
  },
  {
    nombre: 'entregas y recogidas se separan con una coma en vez de «y»',
    archivo: ARCHIVO,
    buscar: "partes.filter(Boolean).join(' y ')",
    reemplazo: "partes.filter(Boolean).join(', ')"
  },
  {
    nombre: 'una agenda vacía no lo dice',
    archivo: ARCHIVO,
    buscar: " || 'Nada que entregar ni recoger hoy ni mañana'",
    reemplazo: " || ''"
  },
  {
    nombre: 'una sola reserva encontrada se escribe «1 reservas encontradas»',
    archivo: ARCHIVO,
    buscar: "n === 1 ? '1 reserva encontrada' : `${n} reservas encontradas`",
    reemplazo: '`${n} reservas encontradas`'
  },
  {
    nombre: 'una búsqueda sin resultados dice «0 reservas encontradas» en vez de que no coincide ninguna',
    archivo: ARCHIVO,
    buscar: 'if (n === 0) return',
    reemplazo: 'if (n < 0) return'
  },
  {
    nombre: 'los resultados no dicen qué se buscó',
    archivo: ARCHIVO,
    buscar: '. Búsqueda: ${que}.`',
    reemplazo: '.`'
  },
  {
    nombre: 'un solo día se escribe «del 02/11/2026 al 02/11/2026»',
    archivo: ARCHIVO,
    buscar: 'desde === hasta ? `el ${fechaCorta(desde)}` : ',
    reemplazo: ''
  },
  {
    nombre: 'solo «desde» se escribe como «hasta»',
    archivo: ARCHIVO,
    buscar: 'fechas = `desde el ${fechaCorta(desde)}`',
    reemplazo: 'fechas = `hasta el ${fechaCorta(desde)}`'
  },
  {
    nombre: 'solo «hasta» se escribe como «desde»',
    archivo: ARCHIVO,
    buscar: 'fechas = `hasta el ${fechaCorta(hasta)}`',
    reemplazo: 'fechas = `desde el ${fechaCorta(hasta)}`'
  },
  {
    nombre: 'el texto buscado sale sin comillas',
    archivo: ARCHIVO,
    buscar: '[q && `«${q}»`, fechas]',
    reemplazo: '[q && q, fechas]'
  }
];
