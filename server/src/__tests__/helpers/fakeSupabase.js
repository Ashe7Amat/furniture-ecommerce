// Doble en memoria del subconjunto de supabase-js que usan los controladores, para que los
// tests no toquen nunca la base de datos real. Se instala con
//   mock.method(supabase, 'from', fake.from)
// Soporta: select / eq / neq / in / is / lt / lte / gte / not / or / like / ilike / contains / overlaps (rangos) / limit / range / order / insert /
// update / delete / single / maybeSingle, y select(columnas, { count: 'exact', head }) para contar
// (como supabase-js, devuelve `count` con el total de filas que cumplen los filtros, sin contar
// limit ni range; con head: true, data es null). Se puede esperar (await) igual que las consultas reales. Cada consulta cede una vuelta
// al bucle de eventos antes de ejecutarse, así dos flujos concurrentes se intercalan paso a
// paso como harían contra una base de datos de verdad, y cada operación es atómica: un update()
// busca las filas que cumplen sus filtros y las modifica en el mismo paso síncrono, así que dos
// `update(...).is('revoked_at', null)` lanzados a la vez nunca ven los dos la fila sin revocar
// (igual que el UPDATE ... WHERE ... RETURNING de Postgres; lo necesita refreshTokens.test.js).
//
// Fidelidad con la base de datos real (lo que un doble descuidado ocultaría):
//   - single()/maybeSingle() con más filas de las esperadas devuelven ERROR, no la primera
//   - insert con un id ya existente falla con 23505, como la clave primaria
//   - update() devuelve las filas afectadas para poder encadenar .select()
//   - contains() solo acepta una cadena JSON (un array de objetos falla con 22P02) y neq()
//     excluye las filas NULL, como SQL
//   - lt/lte/gte, not() y or() siguen la lógica de tres valores de SQL: comparar con NULL no
//     cumple nunca, y su NOT tampoco (not('c', 'eq', x) no devuelve las filas con c NULL); solo
//     not('c', 'is', null) las separa. or() entiende la cadena de PostgREST ('a.neq.x,b.gte.y'),
//     solo con condiciones simples (eq, neq, lt, lte, gt, gte, is, con o sin not.): un and()/or()
//     anidado o un valor entre comillas lanza, para que un test no pase con una consulta que el doble
//     no sabe leer. Los valores se comparan como texto (fechas ISO, enumerados)
//   - en `muebles`, cada fila insertada o actualizada pasa por el equivalente del trigger
//     trg_sync_disponible_desde_estado (BEFORE INSERT OR UPDATE): `disponible` se recalcula
//     siempre desde `estado`, pisando lo que se haya mandado. Las filas iniciales no pasan por
//     él, igual que las que ya están en la base de datos.
//   - select('a, b') devuelve solo esas columnas, como PostgREST (H26: así se puede comprobar que
//     un endpoint público no expone una columna que no ha pedido).
//   - en `reservas`, la columna generada rango_ocupado se calcula en cada fila (también en las
//     iniciales, porque en la base de datos siempre existe) con el mismo texto canónico que
//     devuelve Postgres: "[inicio,fin+margen)", "[inicio,)" sin fin, o "empty" si acaba el mismo
//     día que empieza. Si acaba ANTES de empezar (fin_ocupacion + dias_margen < fecha_inicio), la
//     escritura falla con 22000 "range lower bound must be less than or equal to range upper
//     bound" y no escribe nada, como Postgres (comprobado en PostgreSQL 16, 19 oct); una fila
//     inicial así no puede existir y hace fallar el test.
//   - en `reservas`, cada insert y cada update pasa por las restricciones de la migración R2
//     (docs/reservas-sql/r2_crear_reservas.sql): la exclusión reservas_sin_solape (23P01: misma
//     pieza, rangos que se solapan, las dos en un estado que ocupa), el índice de una sola
//     provisional por cliente y UNIQUE (stripe_session_id, mueble_id) (los dos, 23505). Si una fila
//     lo incumple no se escribe nada, como en Postgres. Las filas iniciales no se comprueban.
//   - en `reservas`, los dos disparadores de R2: cada escritura cambia `updated_at` (las filas
//     iniciales tienen uno fijo si no traen el suyo) y, al marcar una reserva `devuelta` con su
//     `devuelta_en`, `fin_ocupacion` pasa a ser el día de la devolución en hora de Madrid.
// Lo que NO comprueba: que las columnas existan ni sus tipos, ni cómo serializa la librería cada
// filtro a la URL. Eso último lo cubre queryContract.test.js con el cliente real.
//
// Opciones:
//   muebles, pedidos, categorias, clientes, refresh_tokens, mensajes_contacto,
//   verificaciones_email, reservas  filas iniciales
//   indiceUnicoStripe    emula el índice único de pedidos.stripe_session_id (código 23505)
//   fallos               { 'tabla.accion': error | (consulta) => error|null } hace fallar esa
//                        operación (accion: select|insert|update); es un objeto vivo, se puede
//                        añadir y quitar durante el test para simular reintentos. Con función,
//                        `consulta.usa` es el conjunto de métodos encadenados (p. ej. 'contains')
const { sumarDias, hoyEnMadrid } = require('../../utils/fechasMadrid');

// Copia de la columna generada reservas.rango_ocupado:
//   daterange(fecha_inicio, fin_ocupacion + dias_margen, '[)')
// null si el fin va antes del principio: Postgres no puede calcular la columna (ERROR_RANGO).
const rangoOcupado = ({ fecha_inicio, fin_ocupacion, dias_margen = 0 }) => {
  if (fin_ocupacion == null) return `[${fecha_inicio},)`;
  const fin = sumarDias(fin_ocupacion, dias_margen);
  if (fin < fecha_inicio) return null;
  return fin > fecha_inicio ? `[${fecha_inicio},${fin})` : 'empty';
};
const ERROR_RANGO = {
  code: '22000',
  message: 'range lower bound must be less than or equal to range upper bound'
};
const rangoInicial = (fila) => {
  const rango = rangoOcupado(fila);
  if (rango === null) {
    throw new Error(`Fila inicial de reservas con el fin antes del principio: ${fila.id}`);
  }
  return rango;
};

// Un daterange en texto ("[a,b)", "[a,)" o "empty") como { desde, hasta } (null = sin límite).
const leerRangoTexto = (texto) => {
  const partes = /^\[([^,]*),([^)]*)\)$/.exec(texto);
  return partes ? { desde: partes[1] || null, hasta: partes[2] || null } : null;
};
const rangosSeSolapan = (a, b) =>
  a !== null &&
  b !== null &&
  (a.hasta === null || b.desde === null || b.desde < a.hasta) &&
  (b.hasta === null || a.desde === null || a.desde < b.hasta);

// Una comparación de PostgREST con la lógica de tres valores de SQL: true, false o null (desconocido:
// la columna es NULL y el operador no es IS). Los valores se comparan como texto, que basta para
// fechas ISO y enumerados. Lo usan lte/gte, not() y or().
const OPERADORES = ['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'is'];
const comparar = (valor, operador, objetivo) => {
  if (operador === 'is') return objetivo === null ? valor == null : valor === objetivo;
  if (valor == null) return null;
  if (operador === 'eq') return valor === objetivo;
  if (operador === 'neq') return valor !== objetivo;
  if (operador === 'lt') return valor < objetivo;
  if (operador === 'lte') return valor <= objetivo;
  if (operador === 'gt') return valor > objetivo;
  if (operador === 'gte') return valor >= objetivo;
  throw new Error(`Operador no previsto en el doble de Supabase: ${operador}`);
};

// Una condición de or() en el formato de PostgREST: "columna.operador.valor" o
// "columna.not.operador.valor". Con is, "null", "true" y "false" son esos valores, no texto.
const leerCondicionOr = (texto) => {
  const partes = /^([a-z_][a-z0-9_]*)\.(not\.)?([a-z]+)\.(.*)$/.exec(texto);
  if (!partes || !OPERADORES.includes(partes[3]) || /["()]/.test(partes[4])) {
    throw new Error(`Condición de or() que el doble de Supabase no sabe leer: ${texto}`);
  }
  const [, columna, negada, operador, crudo] = partes;
  const literales = { null: null, true: true, false: false };
  const valor = operador === 'is' && crudo in literales ? literales[crudo] : crudo;
  return { columna, negada: Boolean(negada), operador, valor };
};

// Las restricciones de la tabla `reservas` que puede incumplir una fila frente a las demás, con el
// error que daría Postgres (o null si cumple todas). El predicado de la exclusión es el de la
// migración: solo cuentan las filas en un estado que ocupa el calendario.
const ESTADOS_QUE_OCUPAN = ['pendiente', 'confirmada', 'en_curso', 'devuelta'];
const violacionReservas = (fila, otras) => {
  const unicidad = (indice) => ({
    code: '23505',
    message: `duplicate key value violates unique constraint "${indice}"`
  });
  // En el orden en que las comprueba Postgres, que es el de creación en R2 (comprobado en
  // PostgreSQL 16): primero la exclusión, luego la unicidad de (stripe_session_id, mueble_id) y por
  // último el índice de una provisional por cliente. Así, repetir la venta de una sesión, o el doble
  // clic de una reserva con las mismas fechas, da 23P01 y no 23505.
  const ocupa = (f) => ESTADOS_QUE_OCUPAN.includes(f.estado);
  if (
    ocupa(fila) &&
    otras.some(
      (o) =>
        ocupa(o) &&
        o.mueble_id === fila.mueble_id &&
        rangosSeSolapan(leerRangoTexto(o.rango_ocupado), leerRangoTexto(fila.rango_ocupado))
    )
  ) {
    return {
      code: '23P01',
      message: 'conflicting key value violates exclusion constraint "reservas_sin_solape"'
    };
  }
  if (
    fila.stripe_session_id != null &&
    otras.some(
      (o) => o.stripe_session_id === fila.stripe_session_id && o.mueble_id === fila.mueble_id
    )
  ) {
    return unicidad('reservas_sesion_mueble_key');
  }
  if (
    fila.estado === 'pendiente' &&
    fila.cliente_id != null &&
    otras.some((o) => o.estado === 'pendiente' && o.cliente_id === fila.cliente_id)
  ) {
    return unicidad('reservas_una_pendiente_por_cliente');
  }
  return null;
};

const crearFakeSupabase = ({
  muebles = [],
  pedidos = [],
  categorias = [],
  clientes = [],
  refresh_tokens = [],
  mensajes_contacto = [],
  verificaciones_email = [],
  password_resets = [],
  audit_log = [],
  reservas = [],
  ajustes_home = [{ id: 1, hero_imagenes: [], productos_destacados: [] }],
  indiceUnicoStripe = true,
  fallos = {}
} = {}) => {
  const tablas = {
    muebles: muebles.map((fila) => ({ ...fila })),
    pedidos: pedidos.map((fila) => ({ ...fila })),
    categorias: categorias.map((fila) => ({ ...fila })),
    clientes: clientes.map((fila) => ({ ...fila })),
    refresh_tokens: refresh_tokens.map((fila) => ({ ...fila })),
    mensajes_contacto: mensajes_contacto.map((fila) => ({ ...fila })),
    verificaciones_email: verificaciones_email.map((fila) => ({ ...fila })),
    password_resets: password_resets.map((fila) => ({ ...fila })),
    audit_log: audit_log.map((fila) => ({ ...fila })),
    ajustes_home: ajustes_home.map((fila) => ({ ...fila })),
    reservas: reservas.map((fila) => ({
      updated_at: '2025-12-31T00:00:00.000Z',
      ...fila,
      rango_ocupado: rangoInicial(fila)
    }))
  };
  const escrituras = []; // registro de inserts/updates, en orden
  const estado = { unicidadRechazada: 0, exclusionRechazada: 0 };
  const rechazarEscritura = (error) => {
    if (error.code === '23505') estado.unicidadRechazada++;
    else estado.exclusionRechazada++;
    return { data: null, error };
  };
  let secuencia = 0;
  let reloj = 0;

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
        : {
            data: null,
            error: {
              code: 'PGRST116',
              message: 'JSON object requested, multiple (or no) rows returned'
            }
          };
    }
    if (salida === 'maybe') {
      return lista.length <= 1
        ? { data: lista[0] ?? null, error: null }
        : {
            data: null,
            error: {
              code: 'PGRST116',
              message: 'JSON object requested, multiple (or no) rows returned'
            }
          };
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

  // Traduce un patrón LIKE/ILIKE a una regex, con la semántica de PostgREST + Postgres
  // (comprobada contra el PostgREST real, ver utils/ilike.js):
  //   '%' y '*' (alias de PostgREST) = cualquier secuencia, incluida la vacía
  //   '_' = exactamente un carácter
  //   '\' = el carácter siguiente se toma literal
  // ILIKE además no distingue mayúsculas; LIKE sí (distingueMayusculas). Antes solo entendía '%':
  // tomaba '_' y '\' como literales, y eso ocultaba H17 (un '_' en el email de la cuenta
  // coincidía con otro email).
  const escaparRegex = (caracter) => caracter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const comodinARegex = (patron, { distingueMayusculas = false } = {}) => {
    const texto = String(patron);
    let regex = '';
    for (let i = 0; i < texto.length; i++) {
      const caracter = texto[i];
      if (caracter === '\\' && i + 1 < texto.length) regex += escaparRegex(texto[++i]);
      else if (caracter === '%' || caracter === '*') regex += '[\\s\\S]*';
      else if (caracter === '_') regex += '[\\s\\S]';
      else regex += escaparRegex(caracter);
    }
    return new RegExp(`^${regex}$`, distingueMayusculas ? '' : 'i');
  };

  // Triggers BEFORE INSERT OR UPDATE de la base de datos real, por tabla. Copia de
  // sync_disponible_desde_estado():
  //   NEW.disponible := (COALESCE(NEW.estado, 'disponible') = 'disponible');
  const triggers = {
    muebles: (fila) => {
      fila.disponible = (fila.estado ?? 'disponible') === 'disponible';
    },
    reservas: (fila) => {
      // reservas_fin_ocupacion_al_devolver (R2), que va antes de calcular el rango.
      if (fila.estado === 'devuelta' && fila.devuelta_en) {
        fila.fin_ocupacion = hoyEnMadrid(new Date(fila.devuelta_en));
      }
      fila.rango_ocupado = rangoOcupado(fila);
      // reservas_actualizar_updated_at (R2): cada escritura cambia updated_at. Aquí basta con que
      // sea distinto en cada una.
      fila.updated_at = new Date(Date.UTC(2026, 0, 1) + ++reloj).toISOString();
    }
  };
  const aplicarTriggers = (nombre, fila) => triggers[nombre]?.(fila);

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
      nuevasFilas.forEach((fila) => aplicarTriggers(nombre, fila));
      // La columna generada se calcula antes de mirar ninguna restricción.
      if (nombre === 'reservas' && nuevasFilas.some((fila) => fila.rango_ocupado === null)) {
        return { data: null, error: ERROR_RANGO };
      }

      for (const [i, fila] of nuevasFilas.entries()) {
        const duplicaId = filas.some((f) => f.id === fila.id);
        const duplicaSesion =
          nombre === 'pedidos' &&
          indiceUnicoStripe &&
          fila.stripe_session_id &&
          filas.some((f) => f.stripe_session_id === fila.stripe_session_id);
        if (duplicaId || duplicaSesion) {
          return rechazarEscritura({
            code: '23505',
            message: 'duplicate key value violates unique constraint'
          });
        }
        const violacion =
          nombre === 'reservas' && violacionReservas(fila, [...filas, ...nuevasFilas.slice(0, i)]);
        if (violacion) return rechazarEscritura(violacion);
        // La clave ajena de reservas.mueble_id. Postgres la comprueba al final de la sentencia,
        // después de las restricciones de arriba: por eso va la última.
        if (nombre === 'reservas' && !tablas.muebles.some((m) => m.id === fila.mueble_id)) {
          return {
            data: null,
            error: {
              code: '23503',
              message:
                'insert or update on table "reservas" violates foreign key constraint "reservas_mueble_id_fkey"'
            }
          };
        }
      }

      filas.push(...nuevasFilas);
      // `fila` es la fila tal como queda guardada (con los triggers aplicados); `enviado`, lo
      // que mandó la aplicación, para poder comprobar qué columnas escribe de verdad.
      nuevasFilas.forEach((fila, i) =>
        escrituras.push({ tabla: nombre, accion: 'insert', fila, enviado: entrada[i] })
      );
      // Como supabase-js: `.insert(...).select().single()` devuelve un objeto, no una lista.
      return aplicarSalida(
        nuevasFilas.map((f) => ({ ...f })),
        consulta.salida
      );
    }

    if (consulta.accion === 'update') {
      const afectadas = filas.filter(coincide);
      if (nombre === 'reservas') {
        // Se comprueba cómo quedarían las filas antes de tocar ninguna: si una incumple, no cambia
        // nada (la sentencia entera falla).
        const propuestas = afectadas.map((fila) => {
          const copia = { ...fila, ...consulta.datos };
          aplicarTriggers(nombre, copia);
          return copia;
        });
        if (propuestas.some((fila) => fila.rango_ocupado === null)) {
          return { data: null, error: ERROR_RANGO };
        }
        const resto = filas.filter((fila) => !afectadas.includes(fila));
        for (const [i, propuesta] of propuestas.entries()) {
          const violacion = violacionReservas(propuesta, [
            ...resto,
            ...propuestas.filter((_, j) => j !== i)
          ]);
          if (violacion) return rechazarEscritura(violacion);
        }
      }
      afectadas.forEach((fila) => {
        Object.assign(fila, consulta.datos);
        aplicarTriggers(nombre, fila);
      });
      if (afectadas.length > 0) {
        escrituras.push({
          tabla: nombre,
          accion: 'update',
          datos: consulta.datos,
          ids: afectadas.map((f) => f.id)
        });
      }
      return aplicarSalida(
        afectadas.map((f) => ({ ...f })),
        consulta.salida
      );
    }

    if (consulta.accion === 'delete') {
      const aBorrar = filas.filter(coincide);
      // reservas.mueble_id es ON DELETE RESTRICT: una pieza con filas en el calendario (de cualquier
      // estado) no se puede borrar, y no se borra nada.
      if (
        nombre === 'muebles' &&
        aBorrar.some((m) => (tablas.reservas || []).some((r) => r.mueble_id === m.id))
      ) {
        return {
          data: null,
          error: {
            code: '23503',
            message:
              'update or delete on table "muebles" violates foreign key constraint "reservas_mueble_id_fkey" on table "reservas"'
          }
        };
      }
      aBorrar.forEach((fila) => {
        const idx = filas.indexOf(fila);
        if (idx !== -1) filas.splice(idx, 1);
      });
      if (aBorrar.length > 0) {
        escrituras.push({ tabla: nombre, accion: 'delete', ids: aBorrar.map((f) => f.id) });
      }
      return aplicarSalida(
        aBorrar.map((f) => ({ ...f })),
        consulta.salida
      );
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
    const total = encontradas.length;
    if (consulta.rango)
      encontradas = encontradas.slice(consulta.rango.desde, consulta.rango.hasta + 1);
    if (consulta.limite !== null) encontradas = encontradas.slice(0, consulta.limite);
    const resultado = aplicarSalida(encontradas, consulta.salida);
    if (!consulta.contar) return resultado;
    return { ...resultado, data: consulta.soloCabecera ? null : resultado.data, count: total };
  };

  // Deja en cada fila del resultado solo las columnas pedidas en select() (ver select, abajo).
  const proyectar = (resultado, columnas) => {
    if (!columnas || resultado.error || resultado.data == null) return resultado;
    const recortar = (fila) =>
      Object.fromEntries(columnas.filter((c) => c in fila).map((c) => [c, fila[c]]));
    return {
      ...resultado,
      data: Array.isArray(resultado.data) ? resultado.data.map(recortar) : recortar(resultado.data)
    };
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
      // Como PostgREST, select('a, b') devuelve solo esas columnas (también detrás de un insert o un
      // update). Sin argumento o con '*', todas. Lo que no sea una lista de nombres simples
      // (relaciones, alias, 'columna->>clave'...) se deja pasar entero. Hace falta para comprobar
      // que un endpoint no expone una columna que no ha pedido (H26).
      select: (columnas, opciones = {}) => {
        if (opciones.count) consulta.contar = true;
        if (opciones.head) consulta.soloCabecera = true;
        const texto = typeof columnas === 'string' ? columnas.trim() : '';
        consulta.columnas =
          !texto || texto === '*' || /[():>]/.test(texto)
            ? null
            : texto
                .split(',')
                .map((c) => c.trim())
                .filter(Boolean);
        return usar('select');
      },
      limit: (n) => {
        consulta.limite = n;
        return usar('limit');
      },
      // Como PostgREST: desde y hasta son posiciones (empezando en 0) e incluyen las dos puntas.
      range: (desde, hasta) => {
        consulta.rango = { desde, hasta };
        return usar('range');
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
        consulta.filtros.push(
          (f) => valorDeColumna(f, columna) != null && valorDeColumna(f, columna) !== valor
        );
        return usar('neq');
      },
      in: (columna, valores) => {
        consulta.filtros.push((f) => valores.includes(valorDeColumna(f, columna)));
        return usar('in');
      },
      // "columna IS NULL" (o IS TRUE/FALSE): una columna que no está en la fila cuenta como NULL
      is: (columna, valor) => {
        consulta.filtros.push((f) =>
          valor === null ? valorDeColumna(f, columna) == null : valorDeColumna(f, columna) === valor
        );
        return usar('is');
      },
      // Como SQL: comparar con NULL no cumple nunca. Sirve para fechas ISO (se comparan como texto).
      lt: (columna, valor) => {
        consulta.filtros.push(
          (f) => valorDeColumna(f, columna) != null && valorDeColumna(f, columna) < valor
        );
        return usar('lt');
      },
      lte: (columna, valor) => {
        consulta.filtros.push((f) => comparar(valorDeColumna(f, columna), 'lte', valor) === true);
        return usar('lte');
      },
      gte: (columna, valor) => {
        consulta.filtros.push((f) => comparar(valorDeColumna(f, columna), 'gte', valor) === true);
        return usar('gte');
      },
      // NOT de un operador, como el filtro "not.<op>" de PostgREST: not('c', 'is', null) es
      // "c IS NOT NULL". Como SQL, NOT de una comparación desconocida (columna NULL) tampoco cumple.
      not: (columna, operador, valor) => {
        consulta.filtros.push(
          (f) => comparar(valorDeColumna(f, columna), operador, valor) === false
        );
        return usar('not');
      },
      // OR de condiciones simples, con la cadena de PostgREST: or('tipo.neq.venta,fecha.gte.2026-01-01').
      // Una fila cumple si alguna condición da true (las desconocidas no cuentan).
      or: (texto) => {
        const condiciones = String(texto).split(',').map(leerCondicionOr);
        consulta.filtros.push((f) =>
          condiciones.some(({ columna, negada, operador, valor }) => {
            const resultado = comparar(valorDeColumna(f, columna), operador, valor);
            return negada ? resultado === false : resultado === true;
          })
        );
        return usar('or');
      },
      // LIKE: los mismos comodines que ILIKE, pero distinguiendo mayúsculas, como en Postgres. Lo
      // usa utils/referencia.js para buscar la última referencia de un código (NAV-SIL-%).
      like: (columna, patron) => {
        const regex = comodinARegex(patron, { distingueMayusculas: true });
        consulta.filtros.push((f) => {
          const valor = valorDeColumna(f, columna);
          return valor != null && regex.test(String(valor));
        });
        return usar('like');
      },
      // Comparación de texto sin distinguir mayúsculas/minúsculas, con los comodines de ILIKE
      // (ver comodinARegex). Admite columnas jsonb tipo 'cliente_info->>email'.
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
      // && de rangos: como el filtro "ov" de PostgREST con un rango en texto ("[a,b)" o "[a,)").
      overlaps: (columna, rango) => {
        const buscado = leerRangoTexto(rango);
        consulta.filtros.push((f) => rangosSeSolapan(leerRangoTexto(f[columna] ?? ''), buscado));
        return usar('overlaps');
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
          .then(() => proyectar(ejecutar(nombre, consulta), consulta.columnas))
          .then(resolver, rechazar)
    };
    return constructor;
  };

  return { from, tablas, escrituras, fallos, estado };
};

module.exports = { crearFakeSupabase };
