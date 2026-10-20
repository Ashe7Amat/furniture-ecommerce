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
  }
];
