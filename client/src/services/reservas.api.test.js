// Las 10 funciones de reservas por fechas de api.js (docs/reservas-diseno.md): qué piden al servidor
// (URL, método, cabeceras, cuerpo y parámetros) y qué devuelven ({ data, error, status }, sin lanzar
// nunca: services/peticion.js; las del cliente con sesión, también el `codigo` de un error que lo
// trae). fetch se sustituye por un doble, como en api.contratos.test.js.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getDisponibilidad,
  getPresupuestoReserva,
  crearSesionPagoReserva,
  retomarPagoReserva,
  getMisReservas,
  solicitarCancelacionReserva,
  getReservasAdmin,
  getResumenReservasAdmin,
  accionReservaAdmin,
  crearEnCalendarioAdmin
} from './api';
import { SIN_CONEXION } from './peticion';
import { setAccessToken, setRefreshToken, limpiarTokens } from '../utils/authToken';

const API = 'http://localhost:5000/api';
const respuesta = (status, cuerpo) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => {
    if (cuerpo === undefined) throw new SyntaxError('Unexpected token <');
    return cuerpo;
  }
});
const peticion = (n = -1) => {
  const [url, opciones = {}] = fetch.mock.calls.at(n);
  return { url, ...opciones };
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  localStorage.clear();
  limpiarTokens();
  setAccessToken('tk-1');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// Cada función, con lo que pide y su mensaje por defecto (si el servidor no da ninguno).
const FUNCIONES = [
  ['getDisponibilidad', () => getDisponibilidad('m1'), 'No se ha podido consultar la disponibilidad.'],
  [
    'getPresupuestoReserva',
    () => getPresupuestoReserva('m1', { fecha_inicio: '2026-11-04', fecha_fin: '2026-11-07' }),
    'No se ha podido calcular el precio.'
  ],
  ['crearSesionPagoReserva', () => crearSesionPagoReserva({ mueble_id: 'm1' }), 'No se pudo iniciar el pago.'],
  ['retomarPagoReserva', () => retomarPagoReserva('r1'), 'No se pudo retomar el pago.'],
  ['getMisReservas', () => getMisReservas(), 'No se han podido cargar tus reservas.'],
  ['solicitarCancelacionReserva', () => solicitarCancelacionReserva('r1'), 'No se ha podido enviar la solicitud.'],
  ['getReservasAdmin', () => getReservasAdmin(), 'No se han podido cargar las reservas.'],
  [
    'getResumenReservasAdmin',
    () => getResumenReservasAdmin(),
    'No se han podido cargar los avisos de reservas.'
  ],
  ['accionReservaAdmin', () => accionReservaAdmin('r1', 'recoger', {}), 'No se ha podido completar la acción.'],
  ['crearEnCalendarioAdmin', () => crearEnCalendarioAdmin('bloqueo', {}), 'No se ha podido guardar en el calendario.']
];

describe('resultado común: { data, error, status }, sin lanzar', () => {
  it.each(FUNCIONES)('%s: si va bien, el cuerpo en data', async (_nombre, llamar) => {
    fetch.mockResolvedValue(respuesta(200, { ok: 1 }));
    expect(await llamar()).toEqual({ data: { ok: 1 }, error: null, status: 200 });
  });

  it.each(FUNCIONES)('%s: si el servidor responde con { error }, su mensaje tal cual y el status', async (_nombre, llamar) => {
    fetch.mockResolvedValue(respuesta(409, { error: 'Esas fechas se acaban de reservar.' }));
    expect(await llamar()).toEqual({ data: null, error: 'Esas fechas se acaban de reservar.', status: 409 });
  });

  it.each(FUNCIONES)('%s: un error sin JSON (una página de Vercel), su mensaje por defecto', async (_nombre, llamar, porDefecto) => {
    fetch.mockResolvedValue(respuesta(504));
    expect(await llamar()).toEqual({ data: null, error: porDefecto, status: 504 });
  });

  it.each(FUNCIONES)('%s: si falla la red, status 0 y "sin conexión"', async (_nombre, llamar) => {
    fetch.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await llamar()).toEqual({ data: null, error: SIN_CONEXION, status: 0 });
  });
});

describe('públicas, sin sesión y sin caché', () => {
  it('getDisponibilidad: GET a la pieza (id codificado), sin parámetros si no se piden', async () => {
    fetch.mockResolvedValue(respuesta(200, {}));
    await getDisponibilidad('m 1/2');

    const p = peticion();
    expect(p.url).toBe(`${API}/muebles/m%201%2F2/disponibilidad`);
    expect(p.method).toBeUndefined();
    expect(p.cache).toBe('no-store');
    expect(p.headers).toBeUndefined();
  });

  it('getDisponibilidad: con desde y hasta en la consulta; los vacíos no se mandan', async () => {
    fetch.mockResolvedValue(respuesta(200, {}));
    await getDisponibilidad('m1', { desde: '2026-11-01', hasta: '2026-12-31' });
    expect(peticion().url).toBe(`${API}/muebles/m1/disponibilidad?desde=2026-11-01&hasta=2026-12-31`);

    await getDisponibilidad('m1', { desde: '', hasta: null });
    expect(peticion().url).toBe(`${API}/muebles/m1/disponibilidad`);
  });

  it('getPresupuestoReserva: GET con fechas, horas y trayectos en la consulta, sin sesión', async () => {
    fetch.mockResolvedValue(respuesta(200, {}));
    await getPresupuestoReserva('m1', {
      fecha_inicio: '2026-11-04',
      hora_entrega: '10:00',
      fecha_fin: '2026-11-07',
      hora_recogida: '12:30',
      entrega: 'domicilio',
      recogida: 'tienda',
      otro: 'no se manda'
    });

    const p = peticion();
    expect(p.url).toBe(
      `${API}/muebles/m1/presupuesto?fecha_inicio=2026-11-04&hora_entrega=10%3A00&fecha_fin=2026-11-07` +
        '&hora_recogida=12%3A30&entrega=domicilio&recogida=tienda'
    );
    expect(p.cache).toBe('no-store');
    expect(p.headers).toBeUndefined();
  });

  it('getPresupuestoReserva: lo que falta no se manda', async () => {
    fetch.mockResolvedValue(respuesta(200, {}));
    await getPresupuestoReserva('m1', { fecha_inicio: '2026-11-04', fecha_fin: '2026-11-07' });
    expect(peticion().url).toBe(`${API}/muebles/m1/presupuesto?fecha_inicio=2026-11-04&fecha_fin=2026-11-07`);
  });
});

describe('del cliente, con sesión', () => {
  it('crearSesionPagoReserva: POST con el cuerpo en JSON y la sesión', async () => {
    fetch.mockResolvedValue(respuesta(200, { url: 'https://checkout.stripe.com/c/pay/cs_1' }));
    const datos = {
      mueble_id: 'm1',
      fecha_inicio: '2026-11-04',
      hora_entrega: '10:00',
      fecha_fin: '2026-11-07',
      hora_recogida: '12:30',
      entrega: 'domicilio',
      recogida: 'tienda',
      contacto: { nombre: 'Ana', telefono: '600123123', direccion: 'Calle Mayor 1' },
      acepta_condiciones: true
    };

    const res = await crearSesionPagoReserva(datos);

    expect(res).toEqual({ data: { url: 'https://checkout.stripe.com/c/pay/cs_1' }, error: null, status: 200 });
    const p = peticion();
    expect(p.url).toBe(`${API}/reservas/sesion-pago`);
    expect(p.method).toBe('POST');
    expect(p.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer tk-1' });
    expect(JSON.parse(p.body)).toEqual(datos);
  });

  it('crearSesionPagoReserva: un 403 por el email sin confirmar trae el mensaje y el código del servidor', async () => {
    fetch.mockResolvedValue(
      respuesta(403, { error: 'Confirma tu email para poder reservar.', codigo: 'email_no_verificado' })
    );
    expect(await crearSesionPagoReserva({})).toStrictEqual({
      data: null,
      error: 'Confirma tu email para poder reservar.',
      status: 403,
      codigo: 'email_no_verificado'
    });
  });

  it('crearSesionPagoReserva: el 403 del alquiler cerrado no trae código', async () => {
    fetch.mockResolvedValue(respuesta(403, { error: 'El alquiler online no está disponible en este momento.' }));
    expect(await crearSesionPagoReserva({})).toStrictEqual({
      data: null,
      error: 'El alquiler online no está disponible en este momento.',
      status: 403
    });
  });

  it.each([
    ['retomarPagoReserva', () => retomarPagoReserva('r1')],
    ['getMisReservas', () => getMisReservas()],
    ['solicitarCancelacionReserva', () => solicitarCancelacionReserva('r1')]
  ])('%s: un error con código lo trae; uno con un código vacío o que no es texto, no', async (_nombre, llamar) => {
    fetch.mockResolvedValueOnce(respuesta(403, { error: 'Confirma tu email.', codigo: 'email_no_verificado' }));
    expect(await llamar()).toStrictEqual({
      data: null,
      error: 'Confirma tu email.',
      status: 403,
      codigo: 'email_no_verificado'
    });

    fetch.mockResolvedValueOnce(respuesta(409, { error: 'Ya no se puede.', codigo: '' }));
    expect(await llamar()).toStrictEqual({ data: null, error: 'Ya no se puede.', status: 409 });

    fetch.mockResolvedValueOnce(respuesta(409, { error: 'Ya no se puede.', codigo: 7 }));
    expect(await llamar()).toStrictEqual({ data: null, error: 'Ya no se puede.', status: 409 });
  });

  it.each([
    ['crearSesionPagoReserva', () => crearSesionPagoReserva({})],
    ['retomarPagoReserva', () => retomarPagoReserva('r1')],
    ['getMisReservas', () => getMisReservas()],
    ['solicitarCancelacionReserva', () => solicitarCancelacionReserva('r1')]
  ])('%s: sin código si va bien, si el error no es JSON o si falla la red', async (_nombre, llamar) => {
    fetch.mockResolvedValueOnce(respuesta(200, { codigo: 'no_es_un_error' }));
    expect(await llamar()).toStrictEqual({ data: { codigo: 'no_es_un_error' }, error: null, status: 200 });

    fetch.mockResolvedValueOnce(respuesta(502));
    expect(Object.keys(await llamar())).toEqual(['data', 'error', 'status']);

    fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    expect(await llamar()).toStrictEqual({ data: null, error: SIN_CONEXION, status: 0 });
  });

  it('retomarPagoReserva: POST a la reserva (id codificado), con sesión y cuerpo vacío; devuelve la url de pago', async () => {
    fetch.mockResolvedValue(respuesta(200, { url: 'https://checkout.stripe.com/c/pay/cs_1' }));
    const res = await retomarPagoReserva('r/1');

    expect(res).toEqual({ data: { url: 'https://checkout.stripe.com/c/pay/cs_1' }, error: null, status: 200 });
    const p = peticion();
    expect(p.url).toBe(`${API}/reservas/r%2F1/retomar-pago`);
    expect(p.method).toBe('POST');
    expect(p.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer tk-1' });
    expect(p.body).toBe('{}');
  });

  it('retomarPagoReserva: el 409 del plazo terminado llega con su código', async () => {
    fetch.mockResolvedValue(respuesta(409, { error: 'El plazo para pagar ha terminado.', codigo: 'plazo_terminado' }));
    expect(await retomarPagoReserva('r1')).toStrictEqual({
      data: null,
      error: 'El plazo para pagar ha terminado.',
      status: 409,
      codigo: 'plazo_terminado'
    });
  });

  it('getMisReservas: GET con la sesión y sin caché', async () => {
    fetch.mockResolvedValue(respuesta(200, [{ id: 'r1' }]));
    expect(await getMisReservas()).toEqual({ data: [{ id: 'r1' }], error: null, status: 200 });

    const p = peticion();
    expect(p.url).toBe(`${API}/reservas/mias`);
    expect(p.method).toBeUndefined();
    expect(p.cache).toBe('no-store');
    expect(p.headers).toEqual({ Authorization: 'Bearer tk-1' });
  });

  it('getMisReservas: con el access token caducado (401), renueva la sesión y repite la petición', async () => {
    setRefreshToken('rt-1');
    fetch
      .mockResolvedValueOnce(respuesta(401, { error: 'Token caducado' }))
      .mockResolvedValueOnce(respuesta(200, { accessToken: 'tk-2', refreshToken: 'rt-2' }))
      .mockResolvedValueOnce(respuesta(200, []));

    expect(await getMisReservas()).toEqual({ data: [], error: null, status: 200 });
    expect(peticion(1).url).toBe(`${API}/auth/refresh`);
    expect(peticion(2).url).toBe(`${API}/reservas/mias`);
    expect(peticion(2).headers.Authorization).toBe('Bearer tk-2');
  });

  it('getMisReservas: sin poder renovar, el 401 llega tal cual', async () => {
    fetch.mockResolvedValue(respuesta(401, { error: 'No has iniciado sesión.' }));
    expect(await getMisReservas()).toEqual({ data: null, error: 'No has iniciado sesión.', status: 401 });
  });

  it('solicitarCancelacionReserva: POST a la reserva (id codificado) con el motivo', async () => {
    fetch.mockResolvedValue(respuesta(200, { mensaje: 'Hemos recibido tu solicitud.' }));
    const res = await solicitarCancelacionReserva('r/1', 'Cambio de planes');

    expect(res).toEqual({ data: { mensaje: 'Hemos recibido tu solicitud.' }, error: null, status: 200 });
    const p = peticion();
    expect(p.url).toBe(`${API}/reservas/r%2F1/solicitar-cancelacion`);
    expect(p.method).toBe('POST');
    expect(p.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer tk-1' });
    expect(JSON.parse(p.body)).toEqual({ motivo: 'Cambio de planes' });
  });

  it('solicitarCancelacionReserva: sin motivo, el cuerpo va vacío', async () => {
    fetch.mockResolvedValue(respuesta(200, {}));
    await solicitarCancelacionReserva('r1');
    expect(peticion().body).toBe('{}');
  });
});

describe('del panel, con sesión de administrador', () => {
  it('getReservasAdmin: por defecto la vista "proximas"', async () => {
    fetch.mockResolvedValue(respuesta(200, { hoy: '2026-11-02', reservas: [] }));
    expect(await getReservasAdmin()).toEqual({
      data: { hoy: '2026-11-02', reservas: [] },
      error: null,
      status: 200
    });

    const p = peticion();
    expect(p.url).toBe(`${API}/admin/reservas?vista=proximas`);
    expect(p.cache).toBe('no-store');
    expect(p.headers).toEqual({ Authorization: 'Bearer tk-1' });
  });

  it('getReservasAdmin: otra vista y una pieza', async () => {
    fetch.mockResolvedValue(respuesta(200, {}));
    await getReservasAdmin({ vista: 'retrasadas', muebleId: 'm 1' });
    expect(peticion().url).toBe(`${API}/admin/reservas?vista=retrasadas&mueble_id=m+1`);
  });

  it('getReservasAdmin: una búsqueda manda el texto y las fechas, bien codificados', async () => {
    fetch.mockResolvedValue(respuesta(200, {}));
    await getReservasAdmin({ q: 'ana pérez & co', desde: '2026-11-02', hasta: '2026-11-09' });
    expect(peticion().url).toBe(
      `${API}/admin/reservas?vista=proximas&q=ana+p%C3%A9rez+%26+co&desde=2026-11-02&hasta=2026-11-09`
    );
  });

  it('getReservasAdmin: lo que está vacío no se manda', async () => {
    fetch.mockResolvedValue(respuesta(200, {}));
    await getReservasAdmin({ q: '', desde: '', hasta: undefined });
    expect(peticion().url).toBe(`${API}/admin/reservas?vista=proximas`);
  });

  it('getResumenReservasAdmin: GET con sesión y sin caché', async () => {
    const resumen = { hoy: '2026-11-02', total: 3, retrasadas: 2, en_conflicto: 1, reembolsos_a_medias: 0 };
    fetch.mockResolvedValue(respuesta(200, resumen));
    expect(await getResumenReservasAdmin()).toEqual({ data: resumen, error: null, status: 200 });

    const p = peticion();
    expect(p.url).toBe(`${API}/admin/reservas/resumen`);
    expect(p.method).toBeUndefined();
    expect(p.cache).toBe('no-store');
    expect(p.headers).toEqual({ Authorization: 'Bearer tk-1' });
  });

  it('accionReservaAdmin: POST a la acción de la reserva, con sus datos', async () => {
    fetch.mockResolvedValue(respuesta(200, { reserva: { id: 'r1', estado: 'en_curso' } }));
    const res = await accionReservaAdmin('r 1', 'entregar', { antes_de_tiempo: true });

    expect(res).toEqual({ data: { reserva: { id: 'r1', estado: 'en_curso' } }, error: null, status: 200 });
    const p = peticion();
    expect(p.url).toBe(`${API}/admin/reservas/r%201/entregar`);
    expect(p.method).toBe('POST');
    expect(p.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer tk-1' });
    expect(JSON.parse(p.body)).toEqual({ antes_de_tiempo: true });
  });

  it('accionReservaAdmin: sin datos, el cuerpo va vacío; un 409 con código lo trae junto al mensaje', async () => {
    fetch.mockResolvedValue(
      respuesta(409, { error: 'La entrega es el 4 de noviembre. ¿Entregar antes?', codigo: 'entrega_anticipada' })
    );
    const res = await accionReservaAdmin('r1', 'entregar');

    expect(peticion().body).toBe('{}');
    expect(res).toEqual({
      data: null,
      error: 'La entrega es el 4 de noviembre. ¿Entregar antes?',
      status: 409,
      codigo: 'entrega_anticipada'
    });
  });

  it('accionReservaAdmin: un 502 con el código del reembolso a medias lo trae; sin él (la pasarela) no', async () => {
    const AVISO = 'La reserva está cancelada, pero el reembolso no se ha podido hacer.';
    fetch.mockResolvedValueOnce(respuesta(502, { error: AVISO, codigo: 'reembolso_a_medias', reserva: { id: 'r1' } }));
    expect(await accionReservaAdmin('r1', 'cancelar', { motivo: 'x', reembolso_centimos: 100 })).toEqual({
      data: null,
      error: AVISO,
      status: 502,
      codigo: 'reembolso_a_medias'
    });

    fetch.mockResolvedValueOnce(respuesta(502));
    expect(await accionReservaAdmin('r1', 'cancelar', { motivo: 'x', reembolso_centimos: 100 })).toEqual({
      data: null,
      error: 'No se ha podido completar la acción.',
      status: 502
    });
  });

  it('accionReservaAdmin: un error sin código no lo lleva', async () => {
    fetch.mockResolvedValue(respuesta(409, { error: 'Esta reserva ya está cancelada.' }));
    const res = await accionReservaAdmin('r1', 'cancelar', { motivo: 'x', reembolso_centimos: 0 });

    expect(res).toEqual({ data: null, error: 'Esta reserva ya está cancelada.', status: 409 });
  });

  it.each([
    ['bloqueo', 'bloqueos'],
    ['alquiler', 'alquileres'],
    ['venta', 'ventas']
  ])('crearEnCalendarioAdmin: un %s va a /admin/reservas/%s', async (tipo, ruta) => {
    fetch.mockResolvedValue(respuesta(201, { reserva: { id: 'r9', tipo } }));
    const datos = { mueble_id: 'm1', fecha_inicio: '2026-11-04', motivo: 'Restauración' };

    const res = await crearEnCalendarioAdmin(tipo, datos);

    expect(res).toEqual({ data: { reserva: { id: 'r9', tipo } }, error: null, status: 201 });
    const p = peticion();
    expect(p.url).toBe(`${API}/admin/reservas/${ruta}`);
    expect(p.method).toBe('POST');
    expect(p.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer tk-1' });
    expect(JSON.parse(p.body)).toEqual(datos);
  });
});
