// Panel de reservas: la búsqueda de GET /api/admin/reservas (q, desde y hasta), en todas las
// reservas y sea cual sea la vista. Supabase es el doble en memoria; las fechas van relativas a hoy en
// Madrid, porque el endpoint usa el reloj de verdad.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
require('./helpers/testEnv');

process.env.JWT_SECRET = 'secreto-de-prueba-para-este-archivo';

const app = require('../index');
const supabase = require('../data/supabase');
const { crearFakeSupabase } = require('./helpers/fakeSupabase');
const { MAX_TODAS, MAX_BUSQUEDA } = require('../utils/adminReservas');
const { hoyEnMadrid, sumarDias } = require('../utils/fechasMadrid');

const hoy = hoyEnMadrid();
const dia = (n) => sumarDias(hoy, n);
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const SOFA = uuid(1);
const MESA = uuid(2);

const TOKEN_ADMIN = jwt.sign(
  { email: 'admin@test.com', nombre: 'Admin', rol: 'admin' },
  process.env.JWT_SECRET
);

const MUEBLES = () => [
  { id: SOFA, nombre: 'Sofá Lumina', referencia: 'NAV-SOF-001', estado: 'disponible' },
  { id: MESA, nombre: 'Mesa de roble', referencia: 'NAV-MES-007', estado: 'disponible' }
];

const ANA = {
  nombre: 'Ana Pérez',
  email: 'ana.perez@ejemplo.com',
  telefono: '600 111 222',
  direccion: 'Calle del Sol 12, Barcelona',
  notas: 'Tercero sin ascensor'
};
const LUIS = {
  nombre: 'Luis Gómez',
  email: 'luis@ejemplo.com',
  telefono: '+34 611-333-444',
  direccion: 'Avenida de la Luna 3, Girona',
  notas: null
};

const alquiler = (n, cambios = {}) => ({
  id: uuid(n),
  mueble_id: SOFA,
  tipo: 'alquiler',
  estado: 'confirmada',
  origen: 'web',
  fecha_inicio: dia(5),
  hora_entrega: '10:00:00',
  fecha_fin: dia(8),
  hora_recogida: '18:30:00',
  fin_ocupacion: dia(8),
  dias_margen: 2,
  modo_entrega: 'domicilio',
  modo_devolucion: 'domicilio',
  direccion_entrega: 'Calle del Sol 12, Barcelona',
  datos_contacto: ANA,
  historial: [],
  created_at: `2026-10-01T10:${String(n % 60).padStart(2, '0')}:00.000Z`,
  ...cambios
});

const instalar = (reservas = []) => {
  const fake = crearFakeSupabase({ muebles: MUEBLES(), reservas });
  mock.method(supabase, 'from', fake.from);
  return fake;
};
const buscar = (consulta) =>
  request(app).get(`/api/admin/reservas?${consulta}`).set('Authorization', `Bearer ${TOKEN_ADMIN}`);
const ids = (res) => res.body.reservas.map((r) => r.id);

beforeEach(() => {
  process.env.RESERVAS_ACTIVAS = 'true';
  mock.method(console, 'error', () => {});
  instalar();
});
afterEach(() => {
  mock.restoreAll();
  delete process.env.RESERVAS_ACTIVAS;
});

describe('búsqueda por texto', () => {
  test('por el nombre del cliente, sin mayúsculas ni acentos', async () => {
    instalar([alquiler(1), alquiler(2, { datos_contacto: LUIS })]);
    assert.deepEqual(ids(await buscar('q=perez')), [uuid(1)]);
    assert.deepEqual(ids(await buscar('q=ANA')), [uuid(1)]);
    assert.deepEqual(ids(await buscar('q=g%C3%B3mez')), [uuid(2)]);
    assert.deepEqual(ids(await buscar('q=gomez')), [uuid(2)]);
  });

  test('por el nombre y por la referencia de la pieza', async () => {
    instalar([alquiler(1), alquiler(2, { mueble_id: MESA })]);
    assert.deepEqual(ids(await buscar('q=mesa')), [uuid(2)]);
    assert.deepEqual(ids(await buscar('q=nav-sof')), [uuid(1)]);
    assert.deepEqual(ids(await buscar('q=NAV-MES-007')), [uuid(2)]);
  });

  test('por la referencia de la reserva, la que ve el cliente, en mayúsculas o minúsculas', async () => {
    instalar([
      alquiler(1, { pedido_id: 'a1b2c3d4-0000-4000-8000-000000000001' }),
      alquiler(2, { pedido_id: 'ffeeddcc-0000-4000-8000-000000000002' })
    ]);
    assert.deepEqual(ids(await buscar('q=A1B2C3D4')), [uuid(1)]);
    assert.deepEqual(ids(await buscar('q=ffeedd')), [uuid(2)]);
  });

  test('por el email, la dirección del cliente y la de entrega', async () => {
    instalar([
      alquiler(1),
      alquiler(2, { datos_contacto: LUIS, direccion_entrega: 'Plaza Mayor 9, Madrid' })
    ]);
    assert.deepEqual(ids(await buscar('q=luis%40ejemplo')), [uuid(2)]);
    assert.deepEqual(ids(await buscar('q=avenida')), [uuid(2)]);
    assert.deepEqual(ids(await buscar('q=plaza+mayor')), [uuid(2)]);
  });

  test('por el motivo de un bloqueo o de una venta', async () => {
    instalar([
      alquiler(1, { tipo: 'bloqueo', datos_contacto: null, motivo: 'Exposición en la tienda' }),
      alquiler(2)
    ]);
    assert.deepEqual(ids(await buscar('q=exposicion')), [uuid(1)]);
  });

  test('por el teléfono, aunque se escriba con otros espacios o guiones', async () => {
    instalar([alquiler(1), alquiler(2, { datos_contacto: LUIS })]);
    assert.deepEqual(ids(await buscar('q=600111222')), [uuid(1)]);
    assert.deepEqual(ids(await buscar('q=600+111+222')), [uuid(1)]);
    assert.deepEqual(ids(await buscar('q=611333444')), [uuid(2)]);
    assert.deepEqual(ids(await buscar('q=611-333')), [uuid(2)]);
    assert.deepEqual(ids(await buscar('q=%2B34611')), [uuid(2)]);
    // El «+» de lo que se escribe tampoco cuenta si el teléfono se guardó sin él.
    assert.deepEqual(ids(await buscar('q=%2B600111222')), [uuid(1)]);
  });

  test('un número que no es de ningún teléfono no encuentra nada, y el «+» de delante se busca tal cual', async () => {
    instalar([alquiler(1), alquiler(2, { datos_contacto: LUIS })]);
    assert.deepEqual(ids(await buscar('q=999999')), []);
    assert.deepEqual(ids(await buscar('q=%2B34')), [uuid(2)]);
  });

  test('una palabra no cruza de un campo a otro', async () => {
    // La pieza acaba en «001» y el cliente empieza por «Ana»: «001ana» no está en ningún sitio.
    instalar([alquiler(1)]);
    assert.deepEqual(ids(await buscar('q=001ana')), []);
    assert.deepEqual(ids(await buscar('q=001+ana')), [uuid(1)]);
  });

  test('un teléfono con prefijo entre paréntesis se encuentra por sus dígitos', async () => {
    const fijo = { ...LUIS, telefono: '(93) 123 45 67' };
    instalar([alquiler(1, { datos_contacto: fijo })]);
    assert.deepEqual(ids(await buscar('q=93123')), [uuid(1)]);
    assert.deepEqual(ids(await buscar('q=931234567')), [uuid(1)]);
  });

  test('el salto entre grupos del teléfono se busca desde tres cifras: «112» sí, «12» no', async () => {
    // 600 111 222 son los dígitos 600111222: «112» y «12» solo aparecen cruzando los espacios.
    const sinNumeros = { ...ANA, direccion: 'Calle del Sol', notas: null };
    instalar([alquiler(1, { datos_contacto: sinNumeros, direccion_entrega: 'Calle del Sol' })]);
    assert.deepEqual(ids(await buscar('q=112')), [uuid(1)]);
    assert.deepEqual(ids(await buscar('q=12')), []);
  });

  test('con varias palabras tienen que estar todas, en cualquier orden', async () => {
    instalar([
      alquiler(1),
      alquiler(2, { mueble_id: MESA }),
      alquiler(3, { datos_contacto: LUIS, mueble_id: MESA })
    ]);
    assert.deepEqual(ids(await buscar('q=ana+mesa')), [uuid(2)]);
    assert.deepEqual(ids(await buscar('q=mesa+ana')), [uuid(2)]);
    assert.deepEqual(ids(await buscar('q=ana+luis')), []);
  });

  test('las notas del cliente no se buscan, ni salen en la respuesta', async () => {
    instalar([alquiler(1)]);
    const res = await buscar('q=ascensor');
    assert.deepEqual(res.body.reservas, []);
  });

  test('sin coincidencias: lista vacía, con hoy y sin aviso de límite', async () => {
    instalar([alquiler(1)]);
    const res = await buscar('q=nadie');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { hoy, reservas: [], limitada: false });
    assert.equal(res.headers['cache-control'], 'private, no-store');
  });

  test('sin vista no cuenta: la búsqueda mira todas, también canceladas, devueltas y caducadas', async () => {
    instalar([
      alquiler(1),
      alquiler(2, { estado: 'cancelada' }),
      alquiler(3, {
        estado: 'devuelta',
        fecha_inicio: dia(-20),
        fecha_fin: dia(-15),
        fin_ocupacion: dia(-15)
      }),
      alquiler(4, { estado: 'expirada' }),
      alquiler(5, { datos_contacto: LUIS })
    ]);
    const res = await buscar('vista=entregas&q=ana');
    assert.deepEqual(ids(res).sort(), [uuid(1), uuid(2), uuid(3), uuid(4)]);
  });

  test('cada reserva sale como en la lista, con su etiqueta y sus acciones', async () => {
    instalar([alquiler(1, { estado: 'cancelada' })]);
    const [reserva] = (await buscar('q=ana')).body.reservas;
    assert.equal(reserva.etiqueta, 'Cancelada');
    assert.deepEqual(reserva.acciones, []);
    assert.equal(reserva.pieza.nombre, 'Sofá Lumina');
    assert.equal(reserva.contacto.nombre, 'Ana Pérez');
  });

  test('con mueble_id, solo las de esa pieza', async () => {
    instalar([alquiler(1), alquiler(2, { mueble_id: MESA })]);
    assert.deepEqual(ids(await buscar(`q=ana&mueble_id=${MESA}`)), [uuid(2)]);
  });

  test('las más recientes primero', async () => {
    instalar([
      alquiler(1, { created_at: '2026-09-01T10:00:00.000Z' }),
      alquiler(2, { created_at: '2026-10-05T10:00:00.000Z' }),
      alquiler(3, { created_at: '2026-09-20T10:00:00.000Z' })
    ]);
    assert.deepEqual(ids(await buscar('q=ana')), [uuid(2), uuid(3), uuid(1)]);
  });

  test('una pieza que ya no está en el catálogo se encuentra por su aviso', async () => {
    instalar([alquiler(1, { mueble_id: uuid(77) })]);
    assert.deepEqual(ids(await buscar('q=eliminada')), [uuid(1)]);
  });

  test('un q de solo espacios o vacío no es una búsqueda: la vista de siempre, sin `limitada`', async () => {
    instalar([alquiler(1), alquiler(2, { estado: 'cancelada' })]);
    for (const consulta of ['q=', 'q=+++', 'q=%20%20']) {
      const res = await buscar(consulta);
      assert.deepEqual(ids(res), [uuid(1)], consulta);
      assert.equal('limitada' in res.body, false, consulta);
    }
  });

  test('sin q ni fechas, la lista no lleva `limitada`', async () => {
    instalar([alquiler(1)]);
    const res = await buscar('vista=todas');
    assert.equal(res.status, 200);
    assert.equal('limitada' in res.body, false);
  });
});

describe('búsqueda por fechas', () => {
  // Un alquiler del día 5 al 8.
  test('entre dos fechas, los dos días incluidos: la entrega y la recogida cuentan', async () => {
    instalar([alquiler(1)]);
    assert.deepEqual(ids(await buscar(`desde=${dia(8)}&hasta=${dia(20)}`)), [uuid(1)]);
    assert.deepEqual(ids(await buscar(`desde=${dia(0)}&hasta=${dia(5)}`)), [uuid(1)]);
    assert.deepEqual(ids(await buscar(`desde=${dia(6)}&hasta=${dia(7)}`)), [uuid(1)]);
    assert.deepEqual(ids(await buscar(`desde=${dia(9)}&hasta=${dia(20)}`)), []);
    assert.deepEqual(ids(await buscar(`desde=${dia(0)}&hasta=${dia(4)}`)), []);
  });

  test('solo desde: lo que sigue en esa fecha o más tarde; solo hasta: lo que ya había empezado', async () => {
    instalar([alquiler(1)]);
    assert.deepEqual(ids(await buscar(`desde=${dia(8)}`)), [uuid(1)]);
    assert.deepEqual(ids(await buscar(`desde=${dia(9)}`)), []);
    assert.deepEqual(ids(await buscar(`hasta=${dia(5)}`)), [uuid(1)]);
    assert.deepEqual(ids(await buscar(`hasta=${dia(4)}`)), []);
  });

  test('una recogida ampliada cuenta hasta su nueva fecha', async () => {
    instalar([alquiler(1, { estado: 'en_curso', fin_ocupacion: dia(11) })]);
    assert.deepEqual(ids(await buscar(`desde=${dia(11)}`)), [uuid(1)]);
    assert.deepEqual(ids(await buscar(`desde=${dia(12)}`)), []);
  });

  test('una devuelta cuenta hasta el día en que de verdad volvió, no el pactado', async () => {
    instalar([alquiler(1, { estado: 'devuelta', fin_ocupacion: dia(6) })]);
    assert.deepEqual(ids(await buscar(`desde=${dia(6)}`)), [uuid(1)]);
    assert.deepEqual(ids(await buscar(`desde=${dia(7)}`)), []);
  });

  test('una devuelta sin día de devolución guardado cuenta hasta la recogida pactada', async () => {
    instalar([alquiler(1, { estado: 'devuelta', fin_ocupacion: null })]);
    assert.deepEqual(ids(await buscar(`desde=${dia(8)}`)), [uuid(1)]);
    assert.deepEqual(ids(await buscar(`desde=${dia(9)}`)), []);
  });

  test('una devuelta tarde cuenta hasta el día real', async () => {
    instalar([alquiler(1, { estado: 'devuelta', fin_ocupacion: dia(10) })]);
    assert.deepEqual(ids(await buscar(`desde=${dia(10)}`)), [uuid(1)]);
  });

  test('una venta solo cuenta el día de la venta, aunque la pieza quede ocupada para siempre', async () => {
    instalar([
      alquiler(1, {
        tipo: 'venta',
        fecha_inicio: dia(3),
        fecha_fin: null,
        fin_ocupacion: null,
        dias_margen: 0,
        datos_contacto: null,
        motivo: 'Venta en tienda'
      })
    ]);
    assert.deepEqual(ids(await buscar(`desde=${dia(3)}&hasta=${dia(3)}`)), [uuid(1)]);
    assert.deepEqual(ids(await buscar(`desde=${dia(4)}`)), []);
    assert.deepEqual(ids(await buscar(`hasta=${dia(2)}`)), []);
  });

  test('un bloqueo, como un alquiler', async () => {
    instalar([
      alquiler(1, {
        tipo: 'bloqueo',
        datos_contacto: null,
        motivo: 'Arreglo',
        fecha_inicio: dia(2),
        fecha_fin: dia(4),
        fin_ocupacion: dia(4)
      })
    ]);
    assert.deepEqual(ids(await buscar(`desde=${dia(4)}&hasta=${dia(4)}`)), [uuid(1)]);
    assert.deepEqual(ids(await buscar(`desde=${dia(5)}`)), []);
  });

  test('el texto y las fechas se suman: tienen que cumplirse las dos', async () => {
    instalar([
      alquiler(1),
      alquiler(2, { datos_contacto: LUIS }),
      alquiler(3, { fecha_inicio: dia(30), fecha_fin: dia(33), fin_ocupacion: dia(33) })
    ]);
    assert.deepEqual(ids(await buscar(`q=ana&desde=${dia(0)}&hasta=${dia(10)}`)), [uuid(1)]);
    assert.deepEqual(ids(await buscar(`q=luis&desde=${dia(0)}&hasta=${dia(10)}`)), [uuid(2)]);
    assert.deepEqual(ids(await buscar(`desde=${dia(0)}&hasta=${dia(10)}`)).sort(), [
      uuid(1),
      uuid(2)
    ]);
  });

  test('un día solo: desde y hasta iguales', async () => {
    instalar([alquiler(1)]);
    assert.deepEqual(ids(await buscar(`desde=${dia(6)}&hasta=${dia(6)}`)), [uuid(1)]);
  });
});

describe('el límite de la búsqueda', () => {
  const muchas = (cuantas, cambios = () => ({})) =>
    Array.from({ length: cuantas }, (_, i) => alquiler(i + 1, cambios(i + 1)));

  test('enseña como mucho las 200 más recientes que coinciden, y lo avisa', async () => {
    instalar(
      muchas(MAX_TODAS + 1, (n) => ({
        created_at: `2026-10-01T10:00:00.${String(n).padStart(3, '0')}Z`
      }))
    );
    const res = await buscar('q=ana');
    assert.equal(res.body.reservas.length, MAX_TODAS);
    assert.equal(res.body.limitada, true);
    // La más antigua es la que se queda fuera.
    assert.ok(!ids(res).includes(uuid(1)));
    assert.ok(ids(res).includes(uuid(MAX_TODAS + 1)));
  });

  test('con exactamente 200 coincidencias no hay aviso', async () => {
    instalar(muchas(MAX_TODAS));
    const res = await buscar('q=ana');
    assert.equal(res.body.reservas.length, MAX_TODAS);
    assert.equal(res.body.limitada, false);
  });

  test('una búsqueda lee las 1000 más recientes: si hay más, avisa aunque solo coincidan unas pocas', async () => {
    instalar(
      muchas(MAX_BUSQUEDA + 5, (n) => ({
        datos_contacto: n <= 3 ? ANA : LUIS,
        created_at: `2026-10-01T10:00:00.${String(n).padStart(4, '0')}Z`
      }))
    );
    const res = await buscar('q=ana');
    assert.equal(res.body.limitada, true);
    // Las tres que coinciden son las más antiguas: quedan fuera de lo que se pudo leer.
    assert.deepEqual(res.body.reservas, []);
  });

  test('con menos de 1000 reservas se miran todas, y no hay aviso', async () => {
    instalar(muchas(MAX_BUSQUEDA - 1, (n) => ({ datos_contacto: n <= 3 ? ANA : LUIS })));
    const res = await buscar('q=ana');
    assert.equal(res.body.limitada, false);
    assert.equal(res.body.reservas.length, 3);
  });
});

describe('búsqueda: la consulta se valida', () => {
  test('una fecha que no existe o mal escrita: 400 con su mensaje', async () => {
    const inicio = await buscar('desde=2026-02-30');
    assert.equal(inicio.status, 400);
    assert.equal(
      inicio.body.error,
      'Elige una fecha de inicio válida para la búsqueda (AAAA-MM-DD).'
    );
    const fin = await buscar('hasta=ayer');
    assert.equal(fin.status, 400);
    assert.equal(fin.body.error, 'Elige una fecha de fin válida para la búsqueda (AAAA-MM-DD).');
  });

  test('«hasta» antes que «desde»: 400', async () => {
    const res = await buscar(`desde=${dia(5)}&hasta=${dia(4)}`);
    assert.equal(res.status, 400);
    assert.equal(
      res.body.error,
      'La fecha final de la búsqueda no puede ser anterior a la inicial.'
    );
  });

  test('«hasta» igual que «desde» vale', async () => {
    assert.equal((await buscar(`desde=${dia(5)}&hasta=${dia(5)}`)).status, 200);
  });

  test('fechas vacías cuentan como sin filtro', async () => {
    instalar([alquiler(1), alquiler(2, { estado: 'cancelada' })]);
    const res = await buscar('desde=&hasta=');
    assert.equal(res.status, 200);
    assert.deepEqual(ids(res), [uuid(1)]);
  });

  test('un texto de 100 caracteres vale; de 101, 400', async () => {
    assert.equal((await buscar(`q=${'a'.repeat(100)}`)).status, 200);
    const res = await buscar(`q=${'a'.repeat(101)}`);
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'La búsqueda es demasiado larga (máximo 100 caracteres).');
  });

  test('el texto se recorta antes de contar su largo', async () => {
    assert.equal((await buscar(`q=%20%20${'a'.repeat(100)}%20%20`)).status, 200);
  });

  test('q repetido no es un texto: 400', async () => {
    const res = await buscar('q=ana&q=luis');
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'La búsqueda no es válida.');
  });

  test('la vista y el mueble_id siguen validándose', async () => {
    assert.equal((await buscar('vista=nada&q=ana')).status, 400);
    assert.equal((await buscar('mueble_id=x&q=ana')).status, 400);
  });

  test('«busqueda» no es una vista que se pueda pedir', async () => {
    const res = await buscar('vista=busqueda');
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Esa vista de la lista de reservas no existe.');
  });
});

describe('búsqueda: errores', () => {
  test('si falla la base de datos: 500 genérico y el detalle solo al log', async () => {
    const fake = instalar([alquiler(1)]);
    fake.fallos['reservas.select'] = { message: 'conexión perdida con 10.0.0.3' };
    const res = await buscar('q=ana');
    assert.equal(res.status, 500);
    assert.deepEqual(res.body, { error: 'Error interno al cargar las reservas.' });
    assert.ok(console.error.mock.calls.some((c) => /conexión perdida/.test(c.arguments[1])));
  });
});
