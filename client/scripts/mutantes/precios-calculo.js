// Mutantes de los cálculos de precios del inventario (src/pages/admin/precios.js, 21 oct 2026; ver
// scripts/mutantes-panel.js). Lo que se ve en pantalla está en precios.js.
export const TEST = 'src/pages/admin/precios.test.js';

const ARCHIVO = 'src/pages/admin/precios.js';

export const MUTANTES = [
  {
    nombre: 'los precios con céntimos se enseñan sin el cero final',
    archivo: ARCHIVO,
    buscar: 'const decimales = Number.isInteger(n) ? 0 : 2;',
    reemplazo: 'const decimales = 0;'
  },
  {
    nombre: 'la coma decimal no se entiende',
    archivo: ARCHIVO,
    buscar: ".trim().replace(',', '.');",
    reemplazo: '.trim();'
  },
  {
    nombre: 'un precio negativo vale',
    archivo: ARCHIVO,
    buscar: 'if (!Number.isFinite(n) || n < 0)',
    reemplazo: 'if (!Number.isFinite(n))'
  },
  {
    nombre: 'el precio escrito no se deja en dos decimales',
    archivo: ARCHIVO,
    buscar: 'return { valor: Math.round(n * 100) / 100 };',
    reemplazo: 'return { valor: n };'
  },
  {
    nombre: 'un precio 0 cuenta como precio',
    archivo: ARCHIVO,
    buscar: '(Number(valor) > 0 ? Number(valor) : null)',
    reemplazo: '(Number(valor) >= 0 ? Number(valor) : null)'
  },
  {
    nombre: 'el redondeo a 0,50 € redondea a euros',
    archivo: ARCHIVO,
    buscar: "redondeo === 'medio' ? Math.round(valor * 2) / 2 : Math.round(valor)",
    reemplazo: 'Math.round(valor)'
  },
  {
    nombre: 'el redondeo a euros trunca en vez de redondear',
    archivo: ARCHIVO,
    buscar: ': Math.round(valor));',
    reemplazo: ': Math.floor(valor));'
  },
  {
    nombre: 'el porcentaje se calcula sobre 10 en vez de sobre 100',
    archivo: ARCHIVO,
    buscar: '(venta * opcion.porcentaje) / 100',
    reemplazo: '(venta * opcion.porcentaje) / 10'
  },
  {
    nombre: 'un porcentaje que redondeado da 0 se asigna como 0',
    archivo: ARCHIVO,
    buscar: 'return precio > 0 ? precio : null;',
    reemplazo: 'return precio;'
  },
  {
    nombre: 'el precio fijo no se aplica a las piezas sin precio de venta',
    archivo: ARCHIVO,
    buscar: "if (opcion.modo === 'fijo') return opcion.fijo;",
    reemplazo: "if (opcion.modo === 'fijo' && Number(mueble.precio_venta) > 0) return opcion.fijo;"
  },
  {
    nombre: '"X de Y piezas actualizadas" siempre en plural',
    archivo: ARCHIVO,
    buscar: "actualizada${total === 1 ? '' : 's'}",
    reemplazo: 'actualizadas'
  }
];
