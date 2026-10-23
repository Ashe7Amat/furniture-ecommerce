// Mutantes del hook que lee cuántas reservas piden atención (insignia de «Reservas» y números de sus
// vistas; ver scripts/mutantes-panel.js). Los mata useAvisosReservas.test.js.
export const TEST = 'src/pages/admin/hooks/useAvisosReservas.test.js';

const ARCHIVO = 'src/pages/admin/hooks/useAvisosReservas.js';

export const MUTANTES = [
  {
    nombre: 'con el interruptor apagado, el panel pide igualmente los avisos de reservas',
    archivo: ARCHIVO,
    buscar: '    if (!reservasActivas()) return;\n',
    reemplazo: ''
  },
  {
    nombre: 'sin sesión, se piden los avisos',
    archivo: ARCHIVO,
    buscar: '    if (user) recargar();',
    reemplazo: '    recargar();'
  },
  {
    nombre: 'la respuesta lenta de una lectura anterior pisa la más reciente',
    archivo: ARCHIVO,
    buscar: '    if (numero !== ultima.current) return;\n',
    reemplazo: ''
  },
  {
    nombre: 'una lectura que falla borra el último número que se tenía',
    archivo: ARCHIVO,
    buscar: '    if (datos && Number.isInteger(datos.total)) setAvisos(datos);',
    reemplazo: '    setAvisos(datos ?? null);'
  },
  {
    nombre: 'una respuesta sin un total válido se toma por buena',
    archivo: ARCHIVO,
    buscar: 'if (datos && Number.isInteger(datos.total)) setAvisos(datos);',
    reemplazo: 'if (datos) setAvisos(datos);'
  },
  {
    nombre: 'al cambiar de pestaña no se vuelven a leer los avisos',
    archivo: ARCHIVO,
    buscar: '  }, [user, vistaActiva, recargar]);',
    reemplazo: '  }, [user, recargar]);'
  }
];
