const { z } = require('zod');
const { requerido, EMAIL_REGEX } = require('./comunes');
const { esFechaValida, esHoraValida } = require('../utils/fechasMadrid');

// Panel de reservas (docs/reservas-diseno.md, 8.1 y 8.3; bloque R-d). Solo la FORMA de la consulta
// y de los cuerpos: lo que depende de hoy o de la propia reserva (que un bloqueo no empiece en el
// pasado, el máximo del reembolso, si la acción vale en su estado...) lo decide
// utils/adminReservas.js, que conoce la fila y la hora.

const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VISTAS = [
  'proximas',
  'entregas',
  'recogidas',
  'retrasadas',
  'conflicto',
  'reembolsos',
  'legacy',
  'todas'
];
const MAX_MOTIVO = 500;
// numeric(10,2) de la columna importe_total: 99.999.999,99 €.
const MAX_IMPORTE_CENTIMOS = 9999999999;

const pieza = z.string({ error: () => 'Elige la pieza.' }).regex(FORMATO_UUID, 'Elige la pieza.');
const fecha = (mensaje) => z.string({ error: () => mensaje }).refine(esFechaValida, mensaje);
const hora = (mensaje) => z.string({ error: () => mensaje }).refine(esHoraValida, mensaje);
const modo = (mensaje) => z.enum(['domicilio', 'tienda'], { error: () => mensaje });
const motivo = (mensaje) =>
  requerido(mensaje).max(
    MAX_MOTIVO,
    `El motivo es demasiado largo (máximo ${MAX_MOTIVO} caracteres).`
  );

// Un dato de contacto que se puede dejar en blanco: vacío o null cuentan como "no lo sé".
const textoOpcional = (max, mensajeLargo) =>
  z
    .string({ error: () => 'Revisa los datos del cliente.' })
    .trim()
    .max(max, `${mensajeLargo} (máximo ${max} caracteres).`)
    .nullish()
    .transform((valor) => valor || null);

const finPosterior = {
  message: 'La fecha de fin tiene que ser posterior a la de inicio.',
  path: ['fecha_fin']
};

// GET /api/admin/reservas?vista=...&mueble_id=...&q=...&desde=...&hasta=... Sin vista, las próximas.
// Un mueble_id, una q o unas fechas vacías cuentan como sin filtro. Con q, desde o hasta es una
// búsqueda en todas las reservas y la vista no cuenta (utils/adminReservas.js, listarReservas).
const MAX_BUSQUEDA_TEXTO = 100;
const vacioEsNada = (valor) => (valor === '' ? undefined : valor);
const fechaDelFiltro = (mensaje) =>
  z.preprocess(
    vacioEsNada,
    z
      .string({ error: () => mensaje })
      .refine(esFechaValida, mensaje)
      .optional()
  );
const schemaListaReservas = z
  .object({
    vista: z
      .enum(VISTAS, { error: () => 'Esa vista de la lista de reservas no existe.' })
      .default('proximas'),
    mueble_id: z.preprocess(
      vacioEsNada,
      z
        .string({ error: () => 'La pieza del filtro no es válida.' })
        .regex(FORMATO_UUID, 'La pieza del filtro no es válida.')
        .optional()
    ),
    q: z.preprocess(
      (valor) => (typeof valor === 'string' ? valor.trim() : valor),
      z
        .string({ error: () => 'La búsqueda no es válida.' })
        .max(
          MAX_BUSQUEDA_TEXTO,
          `La búsqueda es demasiado larga (máximo ${MAX_BUSQUEDA_TEXTO} caracteres).`
        )
        .optional()
    ),
    desde: fechaDelFiltro('Elige una fecha de inicio válida para la búsqueda (AAAA-MM-DD).'),
    hasta: fechaDelFiltro('Elige una fecha de fin válida para la búsqueda (AAAA-MM-DD).')
  })
  .refine((consulta) => !consulta.desde || !consulta.hasta || consulta.hasta >= consulta.desde, {
    message: 'La fecha final de la búsqueda no puede ser anterior a la inicial.',
    path: ['hasta']
  });

// POST /api/admin/reservas/:id/<acción>: el cuerpo de cada acción.
const sinDatos = z.object({});
const SCHEMAS_ACCION = {
  entregar: z.object({
    antes_de_tiempo: z
      .boolean({ error: () => 'Indica si la entregas antes de tiempo (true o false).' })
      .optional()
  }),
  // Sin fecha, hoy (19 oct). Que no sea posterior a hoy ni anterior a la entrega lo decide
  // utils/adminReservas.js, que conoce la fila.
  recoger: z.object({
    fecha_recogida: fecha('Elige la fecha de recogida (AAAA-MM-DD).').optional()
  }),
  ampliar: z.object({
    fin_ocupacion: fecha('Elige la nueva fecha de recogida (AAAA-MM-DD).')
  }),
  cancelar: z.object({
    motivo: motivo('Escribe el motivo de la cancelación.'),
    reembolso_centimos: z
      .number({ error: () => 'Indica el reembolso en céntimos (0 si no se devuelve nada).' })
      .int('El reembolso tiene que ser un número entero de céntimos.')
      .min(0, 'El reembolso no puede ser negativo.')
  }),
  'reintentar-reembolso': sinDatos,
  // `aunque_no_conste`: darlo por hecho aunque Stripe no muestre el reembolso (se hizo por otro medio).
  'dar-por-reembolsado': z.object({
    aunque_no_conste: z
      .boolean({
        error: () => 'Indica si lo das por hecho aunque no conste en Stripe (true o false).'
      })
      .optional()
  }),
  'levantar-bloqueo': sinDatos
};

// POST /api/admin/reservas/bloqueos
const schemaBloqueo = z
  .object({
    mueble_id: pieza,
    fecha_inicio: fecha('Elige una fecha de inicio válida (AAAA-MM-DD).'),
    fecha_fin: fecha('Elige una fecha de fin válida (AAAA-MM-DD).'),
    motivo: motivo('Escribe el motivo del bloqueo.')
  })
  .refine((datos) => datos.fecha_fin > datos.fecha_inicio, finPosterior);

// POST /api/admin/reservas/alquileres: un alquiler pactado fuera de la web (origen 'manual') o un
// contrato antiguo (origen 'legacy', 9.2), sin pago de Stripe. Los límites de los datos de contacto
// son los de la reserva web (schemas/reservas.js), porque acaban en el mismo sitio.
const schemaAlquilerFueraDeLaWeb = z
  .object({
    mueble_id: pieza,
    fecha_inicio: fecha('Elige una fecha de entrega válida (AAAA-MM-DD).'),
    hora_entrega: hora('Elige la hora de entrega (HH:MM).'),
    fecha_fin: fecha('Elige una fecha de recogida válida (AAAA-MM-DD).'),
    hora_recogida: hora('Elige la hora de recogida (HH:MM).'),
    modo_entrega: modo('Elige cómo se entrega: a domicilio o en la tienda.'),
    modo_devolucion: modo('Elige cómo se devuelve: a domicilio o en la tienda.'),
    contacto: z.object(
      {
        nombre: requerido('Escribe el nombre del cliente.').max(
          100,
          'El nombre es demasiado largo (máximo 100 caracteres).'
        ),
        email: textoOpcional(254, 'El email es demasiado largo').refine(
          (valor) => valor === null || EMAIL_REGEX.test(valor),
          'El email del cliente no es válido.'
        ),
        telefono: textoOpcional(30, 'El teléfono es demasiado largo'),
        direccion: textoOpcional(500, 'La dirección es demasiado larga'),
        notas: textoOpcional(500, 'Las notas son demasiado largas')
      },
      { error: () => 'Faltan los datos del cliente.' }
    ),
    importe_total_centimos: z
      .number({ error: () => 'El importe tiene que ir en céntimos (12050 son 120,50 €).' })
      .int('El importe tiene que ser un número entero de céntimos.')
      .min(0, 'El importe no puede ser negativo.')
      .max(MAX_IMPORTE_CENTIMOS, 'El importe es demasiado alto.')
      .nullish(),
    origen: z.enum(['manual', 'legacy'], {
      error: () => 'Indica si es un alquiler fuera de la web o un contrato antiguo.'
    }),
    ya_entregado: z
      .boolean({ error: () => 'Indica si ya está entregado (true o false).' })
      .default(false)
  })
  .refine((datos) => datos.fecha_fin > datos.fecha_inicio, finPosterior)
  .refine(
    (datos) =>
      (datos.modo_entrega !== 'domicilio' && datos.modo_devolucion !== 'domicilio') ||
      Boolean(datos.contacto.direccion),
    {
      message: 'Escribe la dirección para la entrega o la recogida a domicilio.',
      path: ['contacto', 'direccion']
    }
  );

// POST /api/admin/reservas/ventas: una venta fuera de la web, ya hecha o con entrega diferida (6.7).
const schemaVentaFueraDeLaWeb = z.object({
  mueble_id: pieza,
  fecha_inicio: fecha('Elige una fecha válida para la venta (AAAA-MM-DD).'),
  motivo: motivo('Escribe el motivo o una nota de la venta.')
});

module.exports = {
  VISTAS,
  SCHEMAS_ACCION,
  schemaListaReservas,
  schemaBloqueo,
  schemaAlquilerFueraDeLaWeb,
  schemaVentaFueraDeLaWeb
};
