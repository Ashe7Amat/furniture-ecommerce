// Mutantes de la insignia de «Reservas» en la barra lateral del panel (ver scripts/mutantes-panel.js).
// Los mata src/pages/admin/reservasPanel.test.jsx, que monta el panel entero con el interruptor
// de reservas encendido.
export const TEST = 'src/pages/admin/reservasPanel.test.jsx';

const ARCHIVO = 'src/pages/Admin.jsx';

export const MUTANTES = [
  {
    nombre: 'la insignia de «Reservas» sale también cuando no hay ningún aviso (un «0»)',
    archivo: ARCHIVO,
    buscar: "pestana.id === 'reservas' && avisosReservas?.total > 0 && (",
    reemplazo: "pestana.id === 'reservas' && avisosReservas && ("
  },
  {
    nombre: 'la insignia de los avisos de reservas sale junto a «Pedidos» en vez de «Reservas»',
    archivo: ARCHIVO,
    buscar: "pestana.id === 'reservas' && avisosReservas?.total > 0 && (",
    reemplazo: "pestana.id === 'pedidos' && avisosReservas?.total > 0 && ("
  },
  {
    nombre: 'la insignia cuenta solo las retrasadas, no el total de avisos',
    archivo: ARCHIVO,
    buscar: '{avisosReservas.total}</span>',
    reemplazo: '{avisosReservas.retrasadas}</span>'
  },
  {
    nombre: 'la insignia no dice al pasar el ratón qué avisos son',
    archivo: ARCHIVO,
    buscar: 'title={textoAvisos(avisosReservas)}',
    reemplazo: ''
  },
  {
    nombre: 'la pestaña de reservas no recibe los números de sus vistas',
    archivo: ARCHIVO,
    buscar: 'resumen={avisosReservas} ',
    reemplazo: ''
  },
  {
    nombre: 'una acción hecha en la pestaña no actualiza la insignia del menú',
    archivo: ARCHIVO,
    buscar: ' alCambiar={recargarAvisosReservas}',
    reemplazo: ''
  }
];
