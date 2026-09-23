// Doble en memoria del subconjunto de supabase-js que usan los controladores, para que los
// tests no toquen nunca la base de datos real. Se instala con
//   mock.method(supabase, 'from', fake.from)
// Soporta: select / eq / neq / in / ilike / contains / limit / order / insert / update / delete /
// single / maybeSingle, y se puede esperar (await) igual que las consultas reales. Cada consulta cede una vuelta
// al bucle de eventos antes de ejecutarse, así dos flujos concurrentes se intercalan paso a
// paso como harían contra una base de datos de verdad, y cada operación es atómica.
//
// Fidelidad con la base de datos real (lo que un doble descuidado ocultaría):
//   - single()/maybeSingle() con más filas de las esperadas devuelven ERROR, no la primera
//   - insert con un id ya existente falla con 23505, como la clave primaria
//   - update() devuelve las filas afectadas para poder encadenar .select()
//   - contains() solo acepta una cadena JSON (un array de objetos falla con 22P02) y neq()
//     excluye las filas NULL, como SQL
// Lo que NO comprueba: nombres de columnas ni tipos, ni cómo serializa la librería cada
// filtro a la URL. Eso último lo cubre queryContract.test.js con el cliente real.
//
// Opciones:
//   muebles, pedidos, categorias  filas iniciales
//   indiceUnicoStripe    emula el índice único de pedidos.stripe_session_id (código 23505)
//   fallos               { 'tabla.accion': error | (consulta) => error|null } hace fallar esa
//                        operación (accion: select|insert|update); es un objeto vivo, se puede
//                        añadir y quitar durante el test para simular reintentos. Con función,
//                        `consulta.usa` es el conjunto de métodos encadenados (p. ej. 'contains')
const crearFakeSupabase = ({
  muebles = [],
  pedidos = [],
  categorias = [],
  indiceUnicoStripe = true,
  fallos = {}
} = {}) => {
  const tablas = {
    muebles: muebles.map((fila) => ({ ...fila })),
    pedidos: pedidos.map((fila) => ({ ...fila })),
    categorias: categorias.map((fila) => ({ ...fila }))
  };
  const escrituras = []; // registro de inserts/updates, en orden
  const estado = { unicidadRechazada: 0 };
  let secuencia = 0;

  const contiene = (elemento, patron) =>
    Object.entries(patron).every(([clave, valor]) => elemento && elemento[clave] === valor);

  // .single()/.maybeSingle() aplican igual detrás de un update()/delete() que detrás de un
  // select() -- p. ej. `.update({...}).eq('id', id).select().single()` sobre un id que no
  // existe debe dar el mismo error PGRST116 (0 filas) que daría un select().single() vacío, no
  // devolver silenciosamente un array vacío. Centralizado aquí para no duplicar esta lógica en
  // cada rama de `ejecutar`.
  const aplicarSalida = (lista, salida) => {
    if (salida === 'single') {
      return lista.length === 1
        ? { data: lista[0], error: null }
        : { data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' } };
    }
    if (salida === 'maybe') {
      return lista.length <= 1
        ? { data: lista[0] ?? null, error: null }
        : { data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' } };
    }
    return { data: lista, error: null };
  };

  // Soporta el atajo de PostgREST "columna->>clave" (extraer texto de un campo jsonb), usado
  // p. ej. por pedidosController al buscar pedidos por 'cliente_info->>email'. Sin "->>", es
  // una columna normal.
  const valorDeColumna = (fila, columna) => {
    if (!columna.includes('->>')) return fila?.[columna];
    const [base, clave] = columna.split('->>');
    return fila?.[base]?.[clave];
  };

  // Traduce un patrón LIKE/ILIKE ('%' = cualquier cosa, incluido nada) a una regex. ILIKE es
  // igual pero sin distinguir mayúsculas/minúsculas -- justo lo que hace falta aquí.
  const comodinARegex = (patron) => {
    const escapado = String(patron).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^${escapado.replace(/%/g, '.*')}$`, 'i');
  };

  const ejecutar = (nombre, consulta) => {
    const filas = tablas[nombre];
    const coincide = (fila) => consulta.filtros.every((filtro) => filtro(fila));

    const configurado = fallos[`${nombre}.${consulta.accion}`];
    const fallo = typeof configurado === 'function' ? configurado(consulta) : configurado;
    if (fallo) return { data: null, error: fallo };
    if (consulta.errorDeFiltro) return { data: null, error: consulta.errorDeFiltro };

    if (consulta.accion === 'insert') {
      // .insert() de supabase-js real acepta un objeto O un array de objetos (varias filas de
      // una vez); aquí se normaliza a array para tratar ambos casos igual.
      const entrada = Array.isArray(consulta.datos) ? consulta.datos : [consulta.datos];
      const nuevasFilas = entrada.map((datos) => ({ id: `${nombre}-${++secuencia}`, ...datos }));

      for (const fila of nuevasFilas) {
        const duplicaId = filas.some((f) => f.id === fila.id);
        const duplicaSesion =
          nombre === 'pedidos' &&
          indiceUnicoStripe &&
          fila.stripe_session_id &&
          filas.some((f) => f.stripe_session_id === fila.stripe_session_id);
        if (duplicaId || duplicaSesion) {
          estado.unicidadRechazada++;
          return {
            data: null,
            error: { code: '23505', message: 'duplicate key value violates unique constraint' }
          };
        }
      }

      filas.push(...nuevasFilas);
      nuevasFilas.forEach((fila) => escrituras.push({ tabla: nombre, accion: 'insert', fila }));
      return { data: nuevasFilas, error: null };
    }

    if (consulta.accion === 'update') {
      const afectadas = filas.filter(coincide);
      afectadas.forEach((fila) => Object.assign(fila, consulta.datos));
      if (afectadas.length > 0) {
        escrituras.push({
          tabla: nombre,
          accion: 'update',
          datos: consulta.datos,
          ids: afectadas.map((f) => f.id)
        });
      }
      return aplicarSalida(afectadas.map((f) => ({ ...f })), consulta.salida);
    }

    if (consulta.accion === 'delete') {
      const aBorrar = filas.filter(coincide);
      aBorrar.forEach((fila) => {
        const idx = filas.indexOf(fila);
        if (idx !== -1) filas.splice(idx, 1);
      });
      if (aBorrar.length > 0) {
        escrituras.push({ tabla: nombre, accion: 'delete', ids: aBorrar.map((f) => f.id) });
      }
      return aplicarSalida(aBorrar.map((f) => ({ ...f })), consulta.salida);
    }

    let encontradas = filas.filter(coincide);
    if (consulta.orden) {
      const { columna, ascendente } = consulta.orden;
      encontradas = [...encontradas].sort((a, b) => {
        const va = valorDeColumna(a, columna);
        const vb = valorDeColumna(b, columna);
        if (va === vb) return 0;
        const mayor = va > vb ? 1 : -1;
        return ascendente ? mayor : -mayor;
      });
    }
    if (consulta.limite !== null) encontradas = encontradas.slice(0, consulta.limite);
    return aplicarSalida(encontradas, consulta.salida);
  };

  const from = (nombre) => {
    if (!tablas[nombre]) throw new Error(`Tabla no prevista en el doble de Supabase: ${nombre}`);
    const consulta = {
      accion: 'select',
      filtros: [],
      datos: null,
      salida: 'lista',
      limite: null,
      orden: null,
      usa: new Set(),
      errorDeFiltro: null
    };
    const usar = (metodo) => {
      consulta.usa.add(metodo);
      return constructor;
    };
    const constructor = {
      select: () => usar('select'),
      limit: (n) => {
        consulta.limite = n;
        return usar('limit');
      },
      order: (columna, opciones = {}) => {
        consulta.orden = { columna, ascendente: opciones.ascending !== false };
        return usar('order');
      },
      eq: (columna, valor) => {
        consulta.filtros.push((f) => valorDeColumna(f, columna) === valor);
        return usar('eq');
      },
      // Como SQL: "columna <> valor" excluye las filas donde la columna es NULL
      neq: (columna, valor) => {
        consulta.filtros.push((f) => valorDeColumna(f, columna) != null && valorDeColumna(f, columna) !== valor);
        return usar('neq');
      },
      in: (columna, valores) => {
        consulta.filtros.push((f) => valores.includes(valorDeColumna(f, columna)));
        return usar('in');
      },
      // Comparación de texto sin distinguir mayúsculas/minúsculas, con '%' como comodín
      // (igual que ILIKE de Postgres). Admite columnas jsonb tipo 'cliente_info->>email'.
      ilike: (columna, patron) => {
        const regex = comodinARegex(patron);
        consulta.filtros.push((f) => {
          const valor = valorDeColumna(f, columna);
          return valor != null && regex.test(String(valor));
        });
        return usar('ilike');
      },
      // jsonb @> : cada elemento del patrón debe estar contenido en algún elemento de la columna.
      // Solo se acepta una CADENA JSON, como el filtro "cs" real de PostgREST: postgrest-js
      // serializa un array de objetos como "{[object Object]}" y la base de datos lo rechaza
      // (22P02). Aceptarlo aquí ocultaría ese fallo (ya pasó una vez: ver queryContract.test.js).
      contains: (columna, patron) => {
        if (typeof patron !== 'string')
          consulta.errorDeFiltro = { code: '22P02', message: 'invalid input syntax for type json' };
        else {
          let requerido;
          try {
            requerido = JSON.parse(patron);
          } catch {
            consulta.errorDeFiltro = {
              code: '22P02',
              message: 'invalid input syntax for type json'
            };
          }
          if (requerido)
            consulta.filtros.push(
              (f) =>
                Array.isArray(f[columna]) &&
                requerido.every((p) => f[columna].some((e) => contiene(e, p)))
            );
        }
        return usar('contains');
      },
      insert: (datos) => {
        consulta.accion = 'insert';
        consulta.datos = datos;
        return usar('insert');
      },
      update: (datos) => {
        consulta.accion = 'update';
        consulta.datos = datos;
        return usar('update');
      },
      delete: () => {
        consulta.accion = 'delete';
        return usar('delete');
      },
      single: () => {
        consulta.salida = 'single';
        return usar('single');
      },
      maybeSingle: () => {
        consulta.salida = 'maybe';
        return usar('maybeSingle');
      },
      then: (resolver, rechazar) =>
        new Promise((r) => setImmediate(r))
          .then(() => ejecutar(nombre, consulta))
          .then(resolver, rechazar)
    };
    return constructor;
  };

  return { from, tablas, escrituras, fallos, estado };
};

module.exports = { crearFakeSupabase };
