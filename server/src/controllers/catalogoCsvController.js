const supabase = require('../data/supabase');
const { construirCsv, parsearCsv } = require('../utils/csv');
const { insertarMuebleConReferencia } = require('../utils/altaMueble');
const { ESTADOS_MUEBLE } = require('../schemas/muebles');

// Exportar el catálogo a CSV desde el panel (GET /api/admin/muebles/export, con verificarAdmin).
// Lleva los precios reales siempre: es una ruta del panel, así que MOSTRAR_PRECIOS no se aplica.

const COLUMNAS_EXPORTACION = [
  'id',
  'referencia',
  'nombre',
  'categoria',
  'categoria_id',
  'descripcion',
  'precio_venta',
  'precio_alquiler_dia',
  'estado',
  'imagenes',
  'created_at'
];

// Precio con coma decimal, como lo escribe Excel en español (450,5). Vacío si no hay precio.
const precioParaCsv = (precio) =>
  precio === null || precio === undefined ? '' : String(precio).replace('.', ',');

// La fecha del nombre del archivo, en hora de Madrid (la del negocio): AAAA-MM-DD.
const fechaDeHoy = (ahora = new Date()) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(ahora);

const exportarCatalogoCsv = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('muebles')
      .select(COLUMNAS_EXPORTACION.join(', '))
      .order('created_at', { ascending: false });
    if (error) throw error;

    const filas = (data || []).map((mueble) => ({
      ...mueble,
      precio_venta: precioParaCsv(mueble.precio_venta),
      precio_alquiler_dia: precioParaCsv(mueble.precio_alquiler_dia),
      // Las fotos, separadas por un espacio (una URL no lleva espacios).
      imagenes: (mueble.imagenes || []).join(' ')
    }));

    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="catalogo-nave5-${fechaDeHoy()}.csv"`);
    res.set('Cache-Control', 'private, no-store');
    res.status(200).send(construirCsv(COLUMNAS_EXPORTACION, filas));
  } catch (error) {
    console.error('Error al exportar el catálogo:', error.message);
    res.status(500).json({ error: 'Error al exportar el catálogo.' });
  }
};

// ─── Importar ────────────────────────────────────────────────────────────────────────────────────
// POST /api/admin/muebles/import (verificarAdmin), multipart con el archivo en `archivo` y
// `modo` = "preview" (solo comprueba, no guarda nada) o "apply" (da de alta las filas válidas y
// salta las demás). Cada fila válida se crea como una pieza nueva, con su referencia automática:
// la referencia no se importa nunca.

const MAX_FILAS_IMPORTACION = 500;
const OBLIGATORIAS = ['nombre', 'categoria'];
const OPCIONALES = ['descripcion', 'precio_venta', 'precio_alquiler_dia', 'estado', 'imagenes'];
// Columnas del CSV exportado que no se importan: se aceptan (para poder partir de una exportación)
// pero no se leen. `referencia` sí se mira: ver validarFila.
const DEL_EXPORTADO = ['id', 'referencia', 'categoria_id', 'created_at'];

// "450", "450.5" o "450,5" (coma decimal de Excel en español). Nada de separador de miles, signo
// ni símbolo de euro: mejor rechazarlo que guardar un precio mal leído.
const PRECIO = /^\d+(?:[.,]\d+)?$/;

// Fotos: solo URLs públicas del almacenamiento de este proyecto de Supabase. La web (CSP) no
// enseña imágenes de otros sitios, así que una URL de fuera se vería rota en la tienda.
const prefijoFotos = () =>
  `${(process.env.SUPABASE_URL || '').replace(/\/+$/, '')}/storage/v1/object/public/`;

const leerPrecio = (texto, etiqueta, motivos) => {
  if (texto === '') return null;
  if (!PRECIO.test(texto)) {
    motivos.push(`${etiqueta} no es un número válido ("${texto}").`);
    return null;
  }
  return Number(texto.replace(',', '.'));
};

// Comprueba una fila y la convierte en el mueble que se guardaría. `categorias` son las de la base
// de datos. Devuelve { mueble } o { motivos: [...] } con todo lo que está mal en esa fila.
const validarFila = (valores, categorias) => {
  const motivos = [];
  const texto = (columna) => (valores[columna] ?? '').trim();

  const nombre = texto('nombre');
  if (!nombre) motivos.push('Falta el nombre.');

  if (texto('referencia')) {
    motivos.push(
      `Ya tiene referencia (${texto('referencia')}): parece una pieza que ya está en el catálogo. ` +
        'Para darla de alta otra vez, deja la referencia vacía.'
    );
  }

  const nombreCategoria = texto('categoria');
  let categoria = null;
  if (!nombreCategoria) {
    motivos.push('Falta la categoría.');
  } else {
    categoria = categorias.find(
      (c) => c.nombre.trim().toLowerCase() === nombreCategoria.toLowerCase()
    );
    if (!categoria) {
      motivos.push(`La categoría "${nombreCategoria}" no existe.`);
    } else if (!categoria.categoria_padre_id) {
      // Como en "Añadir Mueble": las generales (Mobiliario...) agrupan, no se eligen.
      motivos.push(
        `"${categoria.nombre}" es una categoría general: elige una de sus categorías específicas.`
      );
    }
  }

  const precio_venta = leerPrecio(texto('precio_venta'), 'El precio de venta', motivos);
  const precio_alquiler_dia = leerPrecio(
    texto('precio_alquiler_dia'),
    'El precio de alquiler por día',
    motivos
  );

  const estado = texto('estado').toLowerCase() || 'disponible';
  if (!ESTADOS_MUEBLE.includes(estado)) {
    motivos.push(`El estado "${texto('estado')}" no es válido (${ESTADOS_MUEBLE.join(', ')}).`);
  }

  const imagenes = texto('imagenes').split(/\s+/).filter(Boolean);
  const fotoDeFuera = imagenes.find((url) => !url.startsWith(prefijoFotos()));
  if (fotoDeFuera) {
    motivos.push(
      `La foto "${fotoDeFuera}" no es del almacenamiento de la tienda: súbela desde el panel.`
    );
  }

  if (motivos.length > 0) return { motivos };
  return {
    mueble: {
      nombre,
      categoria: categoria.nombre,
      categoria_id: categoria.id,
      descripcion: texto('descripcion') || null,
      precio_venta,
      precio_alquiler_dia,
      imagenes,
      estado
    }
  };
};

// Lee el CSV entero y valida cada fila. Lanza ErrorDeImportacion (400) si el archivo en sí no sirve:
// vacío, sin las cabeceras obligatorias, con cabeceras repetidas o con demasiadas filas.
class ErrorDeImportacion extends Error {}

const analizarCsv = (textoCsv, categorias) => {
  const [cabecera, ...filas] = parsearCsv(textoCsv);
  if (!cabecera) throw new ErrorDeImportacion('El archivo está vacío.');

  const columnas = cabecera.celdas.map((c) => c.trim().toLowerCase());
  const faltan = OBLIGATORIAS.filter((c) => !columnas.includes(c));
  if (faltan.length > 0) {
    throw new ErrorDeImportacion(
      `Faltan las cabeceras obligatorias: ${faltan.join(', ')}. La primera línea del archivo ` +
        'tiene que llevar los nombres de las columnas.'
    );
  }
  const repetida = columnas.find((c, i) => c && columnas.indexOf(c) !== i);
  if (repetida) throw new ErrorDeImportacion(`La columna "${repetida}" está repetida.`);
  if (filas.length > MAX_FILAS_IMPORTACION) {
    throw new ErrorDeImportacion(
      `El archivo tiene ${filas.length} filas y el máximo es ${MAX_FILAS_IMPORTACION}. ` +
        'Divídelo en varios archivos.'
    );
  }

  const conocidas = [...OBLIGATORIAS, ...OPCIONALES, ...DEL_EXPORTADO];
  const columnasIgnoradas = columnas.filter((c) => c && !conocidas.includes(c));

  const analizadas = filas.map(({ linea, celdas }) => {
    const valores = Object.fromEntries(columnas.map((c, i) => [c, celdas[i] ?? '']));
    return { linea, nombre: (valores.nombre ?? '').trim(), ...validarFila(valores, categorias) };
  });
  return { analizadas, columnasIgnoradas };
};

const importarCatalogoCsv = async (req, res) => {
  const modo = req.body?.modo;
  if (modo !== 'preview' && modo !== 'apply') {
    return res.status(400).json({ error: 'El modo tiene que ser "preview" o "apply".' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'Falta el archivo CSV (campo "archivo").' });
  }

  try {
    const { data: categorias, error } = await supabase
      .from('categorias')
      .select('id, nombre, categoria_padre_id');
    if (error) throw error;

    let resultado;
    try {
      resultado = analizarCsv(req.file.buffer.toString('utf8'), categorias || []);
    } catch (errorCsv) {
      if (errorCsv instanceof ErrorDeImportacion) {
        return res.status(400).json({ error: errorCsv.message });
      }
      throw errorCsv;
    }
    const { analizadas, columnasIgnoradas } = resultado;

    const errores = analizadas
      .filter((fila) => fila.motivos)
      .map(({ linea, motivos }) => ({ linea, motivo: motivos.join(' ') }));
    const validas = analizadas.filter((fila) => fila.mueble);

    if (modo === 'preview') {
      return res.status(200).json({
        total: analizadas.length,
        validas: validas.length,
        errores,
        columnasIgnoradas,
        filas: analizadas.map(({ linea, nombre, mueble, motivos }) => ({
          linea,
          nombre,
          categoria: mueble?.categoria ?? null,
          valida: Boolean(mueble),
          motivo: motivos ? motivos.join(' ') : null
        }))
      });
    }

    // apply: una a una y en orden, para que las referencias salgan seguidas y sin chocar entre sí.
    // Si una falla al guardarse, se apunta y se sigue con las demás.
    const creadas = [];
    for (const { linea, mueble } of validas) {
      try {
        const [fila] = await insertarMuebleConReferencia(mueble, { origen: 'importarCatalogoCsv' });
        creadas.push({ linea, id: fila?.id, referencia: fila?.referencia ?? null });
      } catch (errorAlta) {
        console.error(`Error al importar la línea ${linea}:`, errorAlta.message);
        errores.push({ linea, motivo: 'No se pudo guardar en la base de datos.' });
      }
    }
    errores.sort((a, b) => a.linea - b.linea);

    res.status(200).json({
      creadas: creadas.length,
      saltadas: analizadas.length - creadas.length,
      errores,
      columnasIgnoradas,
      piezas: creadas
    });
  } catch (error) {
    console.error('Error al importar el catálogo:', error.message);
    res.status(500).json({ error: 'Error al importar el catálogo.' });
  }
};

module.exports = {
  exportarCatalogoCsv,
  importarCatalogoCsv,
  COLUMNAS_EXPORTACION,
  MAX_FILAS_IMPORTACION,
  fechaDeHoy
};
