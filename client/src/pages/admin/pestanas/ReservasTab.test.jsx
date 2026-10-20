// Pestaña "Reservas" del panel (docs/reservas-diseno.md, 8.1 y 8.3; bloque R-d, commit 15). No son
// tests de caracterización: describen lo nuevo. La lista de mutantes de esta pestaña
// (scripts/mutantes/reservas.js) corre este archivo.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, act, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReservasTab from './ReservasTab';
import { ToastContext } from '../../../context/ToastContext';
import { getReservasAdmin, accionReservaAdmin, crearEnCalendarioAdmin } from '../../../services/api';
import { eurosDeCentimos } from '../../../utils/reservas';

vi.mock('../../../services/api');

const HOY = '2026-10-13';
// Un importe como lo lee Testing Library en un texto: con espacios normales (Intl pone uno duro).
const euros = (centimos) => eurosDeCentimos(centimos).replace(/\s/g, ' ');
const ok = (data) => ({ data, error: null, status: 200 });
const falla = (error, status, codigo) => ({ data: null, error, status, ...(codigo ? { codigo } : {}) });
// Una promesa que se resuelve cuando lo diga el test.
const diferida = () => {
  let resolver;
  const promesa = new Promise((r) => {
    resolver = r;
  });
  return { promesa, resolver };
};

const ALQUILER = {
  id: 'r1',
  referencia: 'A1B2C3D4',
  tipo: 'alquiler',
  estado: 'confirmada',
  origen: 'web',
  etiqueta: 'Confirmada',
  retrasada: false,
  en_conflicto: false,
  cancelacion_solicitada: false,
  pieza: { id: 'm1', nombre: 'Silla Tolix', referencia: 'NAV-SIL-001' },
  fecha_inicio: '2026-10-15',
  hora_entrega: '10:00:00',
  fecha_fin: '2026-10-20',
  hora_recogida: '18:30:00',
  fin_ocupacion: '2026-10-20',
  dias_margen: 2,
  modo_entrega: 'domicilio',
  modo_devolucion: 'tienda',
  direccion_entrega: 'Calle Mayor 1, Barcelona',
  contacto: {
    nombre: 'Ana Pérez',
    email: 'ana@example.com',
    telefono: '600111222',
    direccion: 'Calle Mayor 1, Barcelona',
    notas: 'Tercer piso sin ascensor'
  },
  importe_total: 120.5,
  pagado: true,
  reembolso: null,
  reembolso_a_medias: false,
  motivo: null,
  motivo_cancelacion: null,
  entregada_en: null,
  devuelta_en: null,
  created_at: '2026-10-01T10:00:00Z',
  acciones: ['entregar', 'cancelar']
};
// Entregada el 1 de octubre, tenía que volver el 10: retrasada.
const RETRASADA = {
  ...ALQUILER,
  id: 'r2',
  referencia: 'B2C3D4E5',
  estado: 'en_curso',
  etiqueta: 'Retrasada',
  retrasada: true,
  pieza: { id: 'm2', nombre: 'Mesa de roble', referencia: 'NAV-MES-007' },
  fecha_inicio: '2026-10-01',
  fecha_fin: '2026-10-10',
  fin_ocupacion: '2026-10-10',
  entregada_en: '2026-10-01T08:00:00Z',
  acciones: ['recoger', 'ampliar']
};
const BLOQUEO = {
  ...ALQUILER,
  id: 'r3',
  referencia: 'C3D4E5F6',
  tipo: 'bloqueo',
  origen: 'manual',
  etiqueta: 'Bloqueo',
  pieza: { id: 'm3', nombre: 'Lámpara antigua', referencia: null },
  fecha_inicio: '2026-11-02',
  hora_entrega: null,
  fecha_fin: '2026-11-05',
  hora_recogida: null,
  fin_ocupacion: '2026-11-05',
  dias_margen: 0,
  modo_entrega: null,
  modo_devolucion: null,
  direccion_entrega: null,
  contacto: null,
  importe_total: null,
  pagado: false,
  motivo: 'Exposición en la tienda',
  acciones: ['levantar-bloqueo']
};
const A_MEDIAS = {
  ...ALQUILER,
  id: 'r4',
  referencia: 'D4E5F6A7',
  estado: 'cancelada',
  origen: 'legacy',
  etiqueta: 'Cancelada',
  reembolso: { solicitado_en: '2026-10-12T09:00:00Z', importe: 60, stripe_refund_id: null },
  reembolso_a_medias: true,
  motivo_cancelacion: 'El cliente no puede',
  acciones: ['reintentar-reembolso']
};
// La misma, cuando el servidor deja además darlo por hecho (un reembolso hecho desde Stripe).
const A_MEDIAS_CERRABLE = { ...A_MEDIAS, acciones: ['reintentar-reembolso', 'dar-por-reembolsado'] };
// Una venta de la web con entrega diferida: ocupa la pieza desde el 5 de noviembre, sin fin.
const VENTA = {
  ...BLOQUEO,
  id: 'r5',
  referencia: 'E5F6A7B8',
  tipo: 'venta',
  origen: 'web',
  etiqueta: 'Venta',
  pieza: { id: 'm4', nombre: 'Aparador', referencia: 'NAV-APA-002' },
  fecha_inicio: '2026-11-05',
  fecha_fin: null,
  fin_ocupacion: null,
  importe_total: 450,
  pagado: true,
  motivo: null,
  acciones: ['cancelar']
};
const MUEBLES = [
  { id: 'm1', nombre: 'Silla Tolix', referencia: 'NAV-SIL-001' },
  { id: 'm3', nombre: 'Lámpara antigua', referencia: null }
];

let showToast;

const montar = async ({ reservas = [ALQUILER], hoy = HOY, muebles = MUEBLES, props = {} } = {}) => {
  getReservasAdmin.mockResolvedValue(ok({ hoy, reservas }));
  const user = userEvent.setup();
  await act(async () => {
    render(
      <ToastContext.Provider value={{ showToast }}>
        <ReservasTab muebles={muebles} {...props} />
      </ToastContext.Provider>
    );
  });
  return { user };
};

// La tarjeta de una reserva, por el nombre de su pieza (su título).
const tarjeta = (pieza) => within(screen.getByRole('heading', { level: 3, name: new RegExp(`^${pieza}`) }).closest('li'));
const dialogo = () => within(screen.getByRole('dialog'));
const filasDe = (t) =>
  t.getAllByRole('term').map((dt) => [dt.textContent, dt.nextElementSibling.textContent]);

beforeEach(() => {
  vi.resetAllMocks();
  showToast = vi.fn();
  // El reloj marca el mismo día que `hoy` de las respuestas (solo la fecha: los temporizadores siguen reales).
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-13T10:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Reservas — carga y vistas', () => {
  it('al entrar pide "Próximas" y enseña el día de hoy y el recuento', async () => {
    const carga = diferida();
    getReservasAdmin.mockReturnValue(carga.promesa);
    render(
      <ToastContext.Provider value={{ showToast }}>
        <ReservasTab muebles={MUEBLES} />
      </ToastContext.Provider>
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Reservas' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Cargando reservas…');
    expect(screen.getByText('Alquileres, bloqueos y ventas del calendario')).toBeInTheDocument();
    expect(getReservasAdmin).toHaveBeenCalledTimes(1);
    expect(getReservasAdmin).toHaveBeenCalledWith({ vista: 'proximas' });
    expect(screen.getByRole('button', { name: 'Próximas' })).toHaveAttribute('aria-pressed', 'true');

    await act(async () => carga.resolver(ok({ hoy: HOY, reservas: [ALQUILER] })));
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText('Hoy es martes, 13 de octubre de 2026')).toBeInTheDocument();
    expect(screen.getByText('1 reserva')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('con varias, el recuento va en plural', async () => {
    await montar({ reservas: [ALQUILER, RETRASADA, BLOQUEO] });
    expect(screen.getByText('3 reservas')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('cada vista pide la suya, queda marcada (solo ella) y, vacía, lo dice con su texto', async () => {
    const { user } = await montar({ reservas: [] });
    const vistas = [
      ['Entregas hoy y mañana', 'entregas', 'No hay entregas hoy ni mañana.'],
      ['Recogidas hoy y mañana', 'recogidas', 'No hay recogidas hoy ni mañana.'],
      ['Retrasadas', 'retrasadas', 'No hay ninguna reserva retrasada.'],
      ['En conflicto', 'conflicto', 'No hay ninguna reserva en conflicto.'],
      ['Reembolsos a medias', 'reembolsos', 'No hay ningún reembolso a medias.'],
      ['Contratos antiguos', 'legacy', 'No hay contratos antiguos en revisión.'],
      ['Todas', 'todas', 'Todavía no hay ninguna reserva.'],
      ['Próximas', 'proximas', 'No hay reservas próximas.']
    ];
    const grupo = within(screen.getByRole('group', { name: 'Qué reservas ver' }));
    for (const [boton, vista, vacia] of vistas) {
      await user.click(grupo.getByRole('button', { name: boton }));
      expect(getReservasAdmin).toHaveBeenLastCalledWith({ vista });
      expect(await screen.findByText(vacia)).toBeInTheDocument();
      const pulsados = grupo.getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true');
      expect(pulsados.map((b) => b.textContent)).toEqual([boton]);
    }
  });

  it('si se cambia de vista antes de que llegue la respuesta, la respuesta vieja no se pinta', async () => {
    const vieja = diferida();
    getReservasAdmin.mockReturnValueOnce(vieja.promesa).mockResolvedValueOnce(ok({ hoy: HOY, reservas: [BLOQUEO] }));
    const user = userEvent.setup();
    render(
      <ToastContext.Provider value={{ showToast }}>
        <ReservasTab muebles={MUEBLES} />
      </ToastContext.Provider>
    );
    await user.click(screen.getByRole('button', { name: 'Todas' }));
    expect(await screen.findByRole('heading', { level: 3, name: /^Lámpara antigua/ })).toBeInTheDocument();

    await act(async () => vieja.resolver(ok({ hoy: HOY, reservas: [ALQUILER] })));
    expect(screen.queryByRole('heading', { level: 3, name: /^Silla Tolix/ })).toBeNull();
    expect(screen.getByRole('heading', { level: 3, name: /^Lámpara antigua/ })).toBeInTheDocument();
  });

  it('si la carga falla, enseña el mensaje del servidor y "Reintentar" vuelve a pedirla', async () => {
    getReservasAdmin.mockResolvedValueOnce(falla('No se han podido cargar las reservas.', 500));
    const user = userEvent.setup();
    await act(async () => {
      render(
        <ToastContext.Provider value={{ showToast }}>
          <ReservasTab muebles={MUEBLES} />
        </ToastContext.Provider>
      );
    });
    expect(screen.getByRole('alert')).toHaveTextContent('No se han podido cargar las reservas.');
    expect(screen.queryByRole('list')).toBeNull();

    getReservasAdmin.mockResolvedValueOnce(ok({ hoy: HOY, reservas: [ALQUILER] }));
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('heading', { level: 3, name: /^Silla Tolix/ })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(getReservasAdmin).toHaveBeenLastCalledWith({ vista: 'proximas' });
  });

  it('una respuesta sin lista se toma como vacía', async () => {
    getReservasAdmin.mockResolvedValue(ok(null));
    await act(async () => {
      render(
        <ToastContext.Provider value={{ showToast }}>
          <ReservasTab muebles={MUEBLES} />
        </ToastContext.Provider>
      );
    });
    expect(screen.getByText('No hay reservas próximas.')).toBeInTheDocument();
    expect(screen.getByText('Alquileres, bloqueos y ventas del calendario')).toBeInTheDocument();
  });

  it('"Actualizar" vuelve a pedir la vista que se ve', async () => {
    const { user } = await montar();
    await user.click(screen.getByRole('button', { name: 'Retrasadas' }));
    await user.click(screen.getByRole('button', { name: 'Actualizar' }));
    await waitFor(() => expect(getReservasAdmin).toHaveBeenCalledTimes(3));
    expect(getReservasAdmin).toHaveBeenLastCalledWith({ vista: 'retrasadas' });
  });
});

describe('Reservas — la tarjeta', () => {
  it('un alquiler: etiqueta, referencia, pieza, fechas con horas y modos, importe, cliente y sus acciones', async () => {
    await montar();
    const t = tarjeta('Silla Tolix');

    expect(t.getByText('Confirmada')).toHaveClass('reserva-etiqueta', 'estado-confirmada');
    expect(t.getByText('Confirmada')).not.toHaveClass('is-aviso');
    expect(t.getByText('Reserva A1B2C3D4')).toBeInTheDocument();
    expect(t.getByRole('heading', { level: 3 })).toHaveTextContent(/^Silla Tolix$/);
    expect(t.getByText('Ref. NAV-SIL-001')).toHaveClass('ref-producto', 'reserva-ref');
    expect(filasDe(t)).toEqual([
      ['Entrega prevista', '15/10/2026 a las 10:00, a domicilio'],
      ['Recogida prevista', '20/10/2026 a las 18:30, en tienda'],
      ['Margen', '2 días después de la recogida'],
      ['Dirección de entrega', 'Calle Mayor 1, Barcelona'],
      ['Importe', `${eurosDeCentimos(12050)}, pagado`]
    ]);

    expect(t.getByRole('heading', { level: 4, name: 'Cliente' })).toBeInTheDocument();
    expect(t.getByText('Ana Pérez')).toBeInTheDocument();
    expect(t.getByRole('link', { name: '600111222' })).toHaveAttribute('href', 'tel:600111222');
    expect(t.getByRole('link', { name: 'ana@example.com' })).toHaveAttribute('href', 'mailto:ana@example.com');
    expect(t.getByText('Tercer piso sin ascensor').closest('p')).toHaveTextContent('Notas: Tercer piso sin ascensor');
    expect(t.queryByText('Fuera de la web')).toBeNull();
    expect(t.queryByText('Cancelación solicitada')).toBeNull();

    const botones = t.getAllByRole('button');
    expect(botones.map((b) => b.textContent)).toEqual(['Marcar entregada', 'Cancelar reserva']);
    for (const boton of botones) {
      expect(boton).toBeEnabled();
      expect(boton).toHaveAccessibleDescription('Silla Tolix Reserva A1B2C3D4');
    }
  });

  it('un bloqueo: marca de "Fuera de la web", fechas y motivo, sin cliente ni referencia de pieza', async () => {
    await montar({ reservas: [BLOQUEO] });
    const t = tarjeta('Lámpara antigua');

    expect(t.getByText('Fuera de la web')).toBeInTheDocument();
    expect(t.queryByText(/^Ref\./)).toBeNull();
    expect(filasDe(t)).toEqual([
      ['Desde', '02/11/2026'],
      ['Libre de nuevo', '05/11/2026'],
      ['Motivo', 'Exposición en la tienda']
    ]);
    expect(t.queryByText('Cliente')).toBeNull();
    expect(t.getAllByRole('button').map((b) => b.textContent)).toEqual(['Levantar bloqueo']);
  });

  it('una retrasada se marca como aviso; un contrato antiguo con el reembolso a medias lo dice', async () => {
    await montar({ reservas: [RETRASADA, A_MEDIAS] });
    expect(tarjeta('Mesa de roble').getByText('Retrasada')).toHaveClass('estado-en_curso', 'is-aviso');

    const t = tarjeta('Silla Tolix');
    expect(t.getByText('Contrato antiguo')).toBeInTheDocument();
    expect(t.getByText(/El reembolso se quedó a medias/)).toHaveTextContent(
      'El reembolso se quedó a medias: Stripe no lo ha confirmado. «Reintentar reembolso» comprueba primero en Stripe ' +
        'si ya se hizo y no lo repite.'
    );
    // Sin la acción «dar-por-reembolsado» en la lista del servidor, el aviso no la ofrece.
    expect(t.getByText(/El reembolso se quedó a medias/)).not.toHaveTextContent('Dar por reembolsado');
    expect(filasDe(t)).toContainEqual([
      'Reembolso',
      `${eurosDeCentimos(6000)}, solicitado el 12/10/2026, 11:00, sin confirmar en Stripe`
    ]);
    expect(filasDe(t)).toContainEqual(['Motivo de la cancelación', 'El cliente no puede']);
    expect(tarjeta('Mesa de roble').queryByText(/a medias/)).toBeNull();
  });

  it('si el cliente pidió cancelarla desde "Mis reservas", se ve una marca (solo en esa)', async () => {
    await montar({ reservas: [{ ...ALQUILER, cancelacion_solicitada: true }, RETRASADA] });
    expect(tarjeta('Silla Tolix').getByText('Cancelación solicitada')).toHaveClass('reserva-solicitud');
    expect(tarjeta('Mesa de roble').queryByText('Cancelación solicitada')).toBeNull();
  });

  it('una en conflicto también se marca como aviso, y dice qué hacer (no tiene botones)', async () => {
    await montar({ reservas: [{ ...ALQUILER, en_conflicto: true, etiqueta: 'No se pudo confirmar', acciones: [] }] });
    expect(screen.getByText('No se pudo confirmar')).toHaveClass('is-aviso');
    expect(
      screen.getByText('Esta reserva no se pudo confirmar: el reembolso se hace desde el Dashboard de Stripe.')
    ).toBeInTheDocument();
    expect(tarjeta('Silla Tolix').queryByRole('button')).toBeNull();
  });

  it('en conflicto con el reembolso a medias solo sale el aviso del reembolso', async () => {
    await montar({ reservas: [{ ...A_MEDIAS, en_conflicto: true }] });
    expect(screen.queryByText(/no se pudo confirmar: el reembolso se hace desde/)).not.toBeInTheDocument();
    expect(screen.getByText(/El reembolso se quedó a medias/)).toBeInTheDocument();
  });

  it('sin acciones (o con una desconocida) no hay botones, y el cliente sin datos opcionales solo lleva el nombre', async () => {
    await montar({
      reservas: [
        { ...ALQUILER, acciones: ['resolver-fianza'], contacto: { nombre: 'Luis', email: null, telefono: '', direccion: null, notas: null } },
        { ...BLOQUEO, acciones: undefined }
      ]
    });
    expect(screen.queryAllByRole('button', { name: /Marcar|Cancelar reserva|Levantar|Ampliar|Reintentar reembolso/ })).toHaveLength(0);
    const t = tarjeta('Silla Tolix');
    expect(t.queryAllByRole('link')).toHaveLength(0);
    expect(t.getByText('Luis').closest('div').querySelectorAll('p')).toHaveLength(1);
  });
});

describe('Reservas — acciones directas', () => {
  it('"Levantar bloqueo": desactiva los botones mientras guarda, sustituye la reserva y avisa', async () => {
    const respuesta = diferida();
    accionReservaAdmin.mockReturnValue(respuesta.promesa);
    const { user } = await montar({ reservas: [BLOQUEO, ALQUILER] });

    await user.click(tarjeta('Lámpara antigua').getByRole('button', { name: 'Levantar bloqueo' }));
    expect(accionReservaAdmin).toHaveBeenCalledWith('r3', 'levantar-bloqueo', {});
    expect(tarjeta('Lámpara antigua').getByRole('button', { name: 'Guardando…' })).toBeDisabled();
    expect(tarjeta('Silla Tolix').getByRole('button', { name: 'Marcar entregada' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Bloquear fechas' })).toBeDisabled();

    await act(async () =>
      respuesta.resolver(ok({ reserva: { ...BLOQUEO, estado: 'cancelada', etiqueta: 'Cancelada', acciones: [] } }))
    );
    expect(tarjeta('Lámpara antigua').getByText('Cancelada')).toBeInTheDocument();
    expect(tarjeta('Lámpara antigua').queryByRole('button')).toBeNull();
    expect(tarjeta('Silla Tolix').getByRole('button', { name: 'Marcar entregada' })).toBeEnabled();
    expect(tarjeta('Silla Tolix').getByText('Confirmada')).toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith('Bloqueo levantado', 'success');
    expect(getReservasAdmin).toHaveBeenCalledTimes(1);
  });

  it('"Reintentar reembolso": dice cuánto va a devolver y pide confirmación; "Volver" no manda nada', async () => {
    const { user } = await montar({ reservas: [A_MEDIAS] });
    await user.click(screen.getByRole('button', { name: 'Reintentar reembolso' }));

    expect(accionReservaAdmin).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Reintentar el reembolso' })).toBeInTheDocument();
    expect(dialogo().getByText(/^Se devolverán /)).toHaveTextContent(
      `Se devolverán ${euros(6000)} al cliente en Stripe por la reserva D4E5F6A7 (Silla Tolix). ` +
        'Antes se comprueba en Stripe si ya se devolvió, para no devolverlo dos veces.'
    );
    await user.click(dialogo().getByRole('button', { name: 'Volver' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(accionReservaAdmin).not.toHaveBeenCalled();
  });

  it('"Reintentar reembolso" sin saber el importe, lo dice sin él', async () => {
    const { user } = await montar({ reservas: [{ ...A_MEDIAS, reembolso: null }] });
    await user.click(screen.getByRole('button', { name: 'Reintentar reembolso' }));
    expect(dialogo().getByText(/^Se devolverán /)).toHaveTextContent(
      'Se devolverán al cliente en Stripe por la reserva D4E5F6A7 (Silla Tolix).'
    );
  });

  it('"Reintentar reembolso": si la respuesta no trae la reserva, vuelve a cargar la vista', async () => {
    accionReservaAdmin.mockResolvedValue(ok({}));
    const { user } = await montar({ reservas: [A_MEDIAS] });
    await user.click(screen.getByRole('button', { name: 'Reintentar reembolso' }));
    await user.click(dialogo().getByRole('button', { name: 'Reintentar reembolso' }));

    expect(accionReservaAdmin).toHaveBeenCalledWith('r4', 'reintentar-reembolso', {});
    expect(showToast).toHaveBeenCalledWith('Reembolso registrado', 'success');
    await waitFor(() => expect(getReservasAdmin).toHaveBeenCalledTimes(2));
    expect(getReservasAdmin).toHaveBeenLastCalledWith({ vista: 'proximas' });
  });

  it('si el servidor dice que no, su mensaje sale en la tarjeta (y se borra al volver a intentarlo)', async () => {
    accionReservaAdmin.mockResolvedValueOnce(falla('Revisa los datos.', 400));
    const { user } = await montar({ reservas: [BLOQUEO] });
    const t = tarjeta('Lámpara antigua');

    await user.click(t.getByRole('button', { name: 'Levantar bloqueo' }));
    expect(t.getByRole('alert')).toHaveTextContent('Revisa los datos.');
    expect(showToast).not.toHaveBeenCalled();
    expect(getReservasAdmin).toHaveBeenCalledTimes(1);

    const otra = diferida();
    accionReservaAdmin.mockReturnValueOnce(otra.promesa);
    await user.click(t.getByRole('button', { name: 'Levantar bloqueo' }));
    expect(t.queryByRole('alert')).toBeNull();
    await act(async () => otra.resolver(ok({ reserva: BLOQUEO })));
  });

  it('un 409 (o un 404) de una lista que ya no está al día: recarga la vista, deja el mensaje y avisa', async () => {
    accionReservaAdmin.mockResolvedValueOnce(falla('Este bloqueo ya está levantado.', 409));
    const { user } = await montar({ reservas: [BLOQUEO] });
    await user.click(screen.getByRole('button', { name: 'Levantar bloqueo' }));

    await waitFor(() => expect(getReservasAdmin).toHaveBeenCalledTimes(2));
    expect(getReservasAdmin).toHaveBeenLastCalledWith({ vista: 'proximas' });
    // La recarga no se lleva el mensaje de la tarjeta
    expect(await screen.findByRole('heading', { level: 3, name: /^Lámpara antigua/ })).toBeInTheDocument();
    expect(tarjeta('Lámpara antigua').getByRole('alert')).toHaveTextContent('Este bloqueo ya está levantado.');
    expect(showToast).toHaveBeenCalledWith('Este bloqueo ya está levantado.', 'error');

    accionReservaAdmin.mockResolvedValueOnce(falla('Reserva no encontrada.', 404));
    await user.click(tarjeta('Lámpara antigua').getByRole('button', { name: 'Levantar bloqueo' }));
    await waitFor(() => expect(getReservasAdmin).toHaveBeenCalledTimes(3));
    expect(showToast).toHaveBeenLastCalledWith('Reserva no encontrada.', 'error');
  });

  it('un error sin respuesta (red, 504, 500) avisa de que puede haberse guardado; un 400 no', async () => {
    accionReservaAdmin
      .mockResolvedValueOnce(falla('No se pudo conectar con el servidor. Revisa tu conexión.', 0))
      .mockResolvedValueOnce(falla('No se ha podido completar la acción.', 504))
      .mockResolvedValueOnce(falla('Revisa los datos.', 400));
    const { user } = await montar({ reservas: [BLOQUEO] });
    const boton = () => tarjeta('Lámpara antigua').getByRole('button', { name: 'Levantar bloqueo' });
    const PUDO = ' Puede que sí se haya guardado: pulsa «Actualizar» y mira cómo ha quedado antes de repetirlo.';

    await user.click(boton());
    expect(tarjeta('Lámpara antigua').getByRole('alert')).toHaveTextContent(
      `No se pudo conectar con el servidor. Revisa tu conexión.${PUDO}`
    );
    await user.click(boton());
    expect(tarjeta('Lámpara antigua').getByRole('alert')).toHaveTextContent(`No se ha podido completar la acción.${PUDO}`);
    await user.click(boton());
    expect(tarjeta('Lámpara antigua').getByRole('alert')).toHaveTextContent(/^Revisa los datos\.$/);
    // Ninguno recarga la lista: el mensaje se quedaría sin tarjeta
    expect(getReservasAdmin).toHaveBeenCalledTimes(1);
  });

  it('al acabar una acción cuyo botón desaparece, el foco pasa a la tarjeta', async () => {
    accionReservaAdmin.mockResolvedValue(ok({ reserva: { ...BLOQUEO, estado: 'cancelada', etiqueta: 'Bloqueo levantado', acciones: [] } }));
    const { user } = await montar({ reservas: [BLOQUEO, ALQUILER] });
    await user.click(tarjeta('Lámpara antigua').getByRole('button', { name: 'Levantar bloqueo' }));

    await waitFor(() => expect(tarjeta('Lámpara antigua').getByText('Bloqueo levantado')).toBeInTheDocument());
    expect(screen.getByRole('heading', { level: 3, name: /^Lámpara antigua/ }).closest('li')).toHaveFocus();
  });

  it('"Marcar entregada" el día previsto: se manda sin más', async () => {
    accionReservaAdmin.mockResolvedValue(ok({ reserva: { ...ALQUILER, estado: 'en_curso', etiqueta: 'Entregada', acciones: [] } }));
    const { user } = await montar({ hoy: '2026-10-15' });
    await user.click(screen.getByRole('button', { name: 'Marcar entregada' }));

    expect(accionReservaAdmin).toHaveBeenCalledTimes(1);
    expect(accionReservaAdmin).toHaveBeenCalledWith('r1', 'entregar', {});
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Entregada')).toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith('Reserva marcada como entregada', 'success');
  });

  it('"Marcar entregada" antes de la fecha: con el 409, pide confirmación y la reenvía con antes_de_tiempo', async () => {
    // El servidor mueve el inicio del alquiler a hoy, y la tarjeta enseña la reserva que devuelve.
    accionReservaAdmin
      .mockResolvedValueOnce(falla('La entrega está prevista para el 15/10/2026.', 409, 'entrega_anticipada'))
      .mockResolvedValueOnce(
        ok({ reserva: { ...ALQUILER, estado: 'en_curso', etiqueta: 'Entregada', fecha_inicio: HOY, acciones: [] } })
      );
    const { user } = await montar();
    await user.click(screen.getByRole('button', { name: 'Marcar entregada' }));

    expect(screen.getByRole('dialog', { name: 'Entregar antes de la fecha' })).toBeInTheDocument();
    expect(
      dialogo().getByText(
        'La entrega está prevista para el 15/10/2026. ¿Marcas la reserva A1B2C3D4 (Silla Tolix) como entregada antes de tiempo? ' +
          'El alquiler pasará a empezar hoy.'
      )
    ).toBeInTheDocument();
    expect(tarjeta('Silla Tolix').queryByRole('alert')).toBeNull();
    expect(showToast).not.toHaveBeenCalled();

    await user.click(dialogo().getByRole('button', { name: 'Marcar entregada' }));
    expect(accionReservaAdmin).toHaveBeenCalledTimes(2);
    expect(accionReservaAdmin).toHaveBeenLastCalledWith('r1', 'entregar', { antes_de_tiempo: true });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Entregada')).toBeInTheDocument();
    expect(filasDe(tarjeta('Silla Tolix'))[0]).toEqual(['Entrega prevista', '13/10/2026 a las 10:00, a domicilio']);
    expect(showToast).toHaveBeenCalledWith('Reserva marcada como entregada', 'success');
  });

  it('entregar antes de la fecha: si al adelantarla choca con otra reserva, el 409 sale tal cual en la confirmación', async () => {
    accionReservaAdmin
      .mockResolvedValueOnce(falla('La entrega está prevista para el 15/10/2026.', 409, 'entrega_anticipada'))
      .mockResolvedValueOnce(falla('Choca con el alquiler #F6A7B8C9 (del 10/10/2026 al 14/10/2026).', 409));
    const { user } = await montar();
    await user.click(screen.getByRole('button', { name: 'Marcar entregada' }));
    await user.click(dialogo().getByRole('button', { name: 'Marcar entregada' }));

    expect(accionReservaAdmin).toHaveBeenLastCalledWith('r1', 'entregar', { antes_de_tiempo: true });
    expect(screen.getByRole('dialog', { name: 'Entregar antes de la fecha' })).toBeInTheDocument();
    expect(dialogo().getByRole('alert')).toHaveTextContent('Choca con el alquiler #F6A7B8C9 (del 10/10/2026 al 14/10/2026).');
    expect(filasDe(tarjeta('Silla Tolix'))[0]).toEqual(['Entrega prevista', '15/10/2026 a las 10:00, a domicilio']);
    expect(showToast).not.toHaveBeenCalled();
  });

  it('"Volver" en la confirmación no manda nada más', async () => {
    accionReservaAdmin.mockResolvedValueOnce(falla('La entrega está prevista para el 15/10/2026.', 409, 'entrega_anticipada'));
    const { user } = await montar();
    await user.click(screen.getByRole('button', { name: 'Marcar entregada' }));
    await user.click(dialogo().getByRole('button', { name: 'Volver' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(accionReservaAdmin).toHaveBeenCalledTimes(1);
  });

  it('un 409 sin el código de entrega anticipada (aunque la reserva empiece más tarde) no pide confirmar: sale como error', async () => {
    accionReservaAdmin.mockResolvedValueOnce(falla('Este alquiler ya está marcado como entregado.', 409));
    const { user } = await montar();
    await user.click(screen.getByRole('button', { name: 'Marcar entregada' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(await screen.findByRole('heading', { level: 3, name: /^Silla Tolix/ })).toBeInTheDocument();
    expect(tarjeta('Silla Tolix').getByRole('alert')).toHaveTextContent('Este alquiler ya está marcado como entregado.');
    // La recarga se llevó el botón que se pulsó: el foco pasa a la tarjeta
    await waitFor(() => expect(screen.getByRole('heading', { level: 3, name: /^Silla Tolix/ }).closest('li')).toHaveFocus());
  });

  it('con una recarga lenta (red real), el mensaje de un 409 sigue bajo la tarjeta cuando llega la lista', async () => {
    accionReservaAdmin.mockResolvedValueOnce(falla('Este alquiler ya está marcado como entregado.', 409));
    const { user } = await montar();
    const recarga = diferida();
    getReservasAdmin.mockReturnValueOnce(recarga.promesa);
    await user.click(screen.getByRole('button', { name: 'Marcar entregada' }));
    await waitFor(() => expect(getReservasAdmin).toHaveBeenCalledTimes(2));

    await act(async () => recarga.resolver(ok({ hoy: HOY, reservas: [{ ...ALQUILER, estado: 'en_curso', acciones: ['recoger'] }] })));
    expect(await screen.findByRole('heading', { level: 3, name: /^Silla Tolix/ })).toBeInTheDocument();
    expect(tarjeta('Silla Tolix').getByRole('alert')).toHaveTextContent('Este alquiler ya está marcado como entregado.');
  });

  it('otro error al entregar antes de la fecha (no un 409) tampoco pide confirmación', async () => {
    accionReservaAdmin.mockResolvedValueOnce(falla('No se ha podido completar la acción.', 500));
    const { user } = await montar();
    await user.click(screen.getByRole('button', { name: 'Marcar entregada' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(tarjeta('Silla Tolix').getByRole('alert')).toHaveTextContent(/^No se ha podido completar la acción\./);
  });
});

describe('Reservas — acciones con diálogo', () => {
  it('"Marcar recogida" pide el día (hoy por defecto); un error sale en el diálogo y, al repetir, se guarda', async () => {
    const recogida = { ...RETRASADA, estado: 'devuelta', etiqueta: 'Devuelta', retrasada: false, acciones: [] };
    accionReservaAdmin
      .mockResolvedValueOnce(falla('La recogida choca con la reserva E5F6A7B8 (del 12/10/2026).', 409))
      .mockResolvedValueOnce(ok({ reserva: recogida }));
    const { user } = await montar({ reservas: [RETRASADA] });

    await user.click(screen.getByRole('button', { name: 'Marcar recogida' }));
    expect(accionReservaAdmin).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Marcar como recogida' })).toBeInTheDocument();
    expect(dialogo().getByText('¿Ya has recogido Mesa de roble (reserva B2C3D4E5)?')).toBeInTheDocument();
    const dia = dialogo().getByLabelText('Día de la recogida');
    expect(dia).toHaveAttribute('type', 'date');
    expect(dia).toHaveValue(HOY);
    expect(dia).toHaveAttribute('min', '2026-10-01');
    expect(dia).toHaveAttribute('max', HOY);
    expect(dia).toHaveAccessibleDescription('Si volvió otro día, elígelo: desde el día de la entrega hasta hoy.');

    await user.click(dialogo().getByRole('button', { name: 'Marcar recogida' }));
    expect(accionReservaAdmin).toHaveBeenCalledWith('r2', 'recoger', { fecha_recogida: HOY });
    expect(dialogo().getByRole('alert')).toHaveTextContent('La recogida choca con la reserva E5F6A7B8 (del 12/10/2026).');
    expect(showToast).not.toHaveBeenCalled();

    await user.click(dialogo().getByRole('button', { name: 'Marcar recogida' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Devuelta')).toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith('Reserva marcada como recogida', 'success');
  });

  it('el diálogo de confirmación dice "Guardando…" y se desactiva mientras guarda', async () => {
    const respuesta = diferida();
    accionReservaAdmin.mockReturnValue(respuesta.promesa);
    const { user } = await montar({ reservas: [RETRASADA] });
    await user.click(screen.getByRole('button', { name: 'Marcar recogida' }));
    await user.click(dialogo().getByRole('button', { name: 'Marcar recogida' }));

    expect(dialogo().getByRole('button', { name: 'Guardando…' })).toBeDisabled();
    await act(async () => respuesta.resolver(ok({ reserva: RETRASADA })));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('si se cierra el diálogo mientras guarda, el error del servidor sale en un aviso; si va bien, avisa igual', async () => {
    const primera = diferida();
    const segunda = diferida();
    accionReservaAdmin.mockReturnValueOnce(primera.promesa).mockReturnValueOnce(segunda.promesa);
    const { user } = await montar({ reservas: [RETRASADA] });
    await user.click(screen.getByRole('button', { name: 'Marcar recogida' }));
    await user.click(dialogo().getByRole('button', { name: 'Marcar recogida' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();

    await act(async () => primera.resolver(falla('Este alquiler ya está marcado como recogido.', 409)));
    expect(showToast).toHaveBeenCalledWith('Este alquiler ya está marcado como recogido.', 'error');
    expect(screen.queryByRole('dialog')).toBeNull();
    // El mensaje no se queda solo en el toast (3 s, sin anunciar): sale también bajo la tarjeta, tras la recarga
    expect(await screen.findByRole('heading', { level: 3, name: /^Mesa de roble/ })).toBeInTheDocument();
    expect(tarjeta('Mesa de roble').getByRole('alert')).toHaveTextContent('Este alquiler ya está marcado como recogido.');

    await user.click(screen.getByRole('button', { name: 'Marcar recogida' }));
    expect(dialogo().queryByRole('alert')).toBeNull();
    await user.click(dialogo().getByRole('button', { name: 'Marcar recogida' }));
    await user.keyboard('{Escape}');
    await act(async () => segunda.resolver(ok({ reserva: { ...RETRASADA, estado: 'devuelta', etiqueta: 'Devuelta', acciones: [] } })));
    expect(showToast).toHaveBeenLastCalledWith('Reserva marcada como recogida', 'success');
    expect(screen.getByText('Devuelta')).toBeInTheDocument();
  });

  it('si se cierra el diálogo y la red falla, el aviso se queda bajo la tarjeta (con lo de que pudo guardarse), no solo en un toast', async () => {
    const respuesta = diferida();
    accionReservaAdmin.mockReturnValue(respuesta.promesa);
    const { user } = await montar({ reservas: [RETRASADA] });
    await user.click(screen.getByRole('button', { name: 'Marcar recogida' }));
    await user.click(dialogo().getByRole('button', { name: 'Marcar recogida' }));
    await user.keyboard('{Escape}');

    await act(async () => respuesta.resolver(falla('No se pudo conectar con el servidor. Revisa tu conexión.', 0)));
    expect(tarjeta('Mesa de roble').getByRole('alert')).toHaveTextContent(
      'No se pudo conectar con el servidor. Revisa tu conexión. Puede que sí se haya guardado: pulsa «Actualizar» y mira cómo ha quedado antes de repetirlo.'
    );
    // No es una lista desfasada: no se recarga, y la tarjeta sigue con su botón
    expect(getReservasAdmin).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledTimes(1);
    expect(tarjeta('Mesa de roble').getByRole('button', { name: 'Marcar recogida' })).toBeEnabled();
  });

  it('si se cierra el diálogo y luego se cambia de vista antes de que falle, el toast avisa aunque la tarjeta ya no esté', async () => {
    const respuesta = diferida();
    accionReservaAdmin.mockReturnValue(respuesta.promesa);
    const { user } = await montar({ reservas: [RETRASADA] });
    await user.click(screen.getByRole('button', { name: 'Marcar recogida' }));
    await user.click(dialogo().getByRole('button', { name: 'Marcar recogida' }));
    await user.keyboard('{Escape}');
    getReservasAdmin.mockResolvedValue(ok({ hoy: HOY, reservas: [] }));
    await user.click(screen.getByRole('button', { name: 'En conflicto' }));
    await waitFor(() => expect(getReservasAdmin).toHaveBeenCalledTimes(2));

    await act(async () => respuesta.resolver(falla('No se pudo conectar con el servidor. Revisa tu conexión.', 0)));
    // La tarjeta no está en esta vista: el aviso que se queda no se ve, pero el toast sí
    expect(showToast).toHaveBeenCalledWith(expect.stringMatching(/^No se pudo conectar con el servidor\./), 'error');
    expect(screen.queryByText('Mesa de roble')).toBeNull();
  });

  it('si se cierra el diálogo y falla con un 409, y la recarga tarda, el aviso sigue bajo la tarjeta cuando llega la lista', async () => {
    const respuesta = diferida();
    accionReservaAdmin.mockReturnValue(respuesta.promesa);
    const { user } = await montar({ reservas: [RETRASADA] });
    await user.click(screen.getByRole('button', { name: 'Marcar recogida' }));
    await user.click(dialogo().getByRole('button', { name: 'Marcar recogida' }));
    await user.keyboard('{Escape}');
    const recarga = diferida();
    getReservasAdmin.mockReturnValueOnce(recarga.promesa);
    await act(async () => respuesta.resolver(falla('Este alquiler ya está marcado como recogido.', 409)));
    await waitFor(() => expect(getReservasAdmin).toHaveBeenCalledTimes(2));

    await act(async () => recarga.resolver(ok({ hoy: HOY, reservas: [{ ...RETRASADA, estado: 'devuelta', acciones: [] }] })));
    expect(await screen.findByRole('heading', { level: 3, name: /^Mesa de roble/ })).toBeInTheDocument();
    expect(tarjeta('Mesa de roble').getByRole('alert')).toHaveTextContent('Este alquiler ya está marcado como recogido.');
  });

  it('el error de un diálogo no reaparece al volver a abrir una acción: abrir lo limpia', async () => {
    accionReservaAdmin.mockResolvedValueOnce(falla('La recogida choca con la reserva E5F6A7B8 (del 12/10/2026).', 400));
    const { user } = await montar({ reservas: [RETRASADA] });
    await user.click(screen.getByRole('button', { name: 'Marcar recogida' }));
    await user.click(dialogo().getByRole('button', { name: 'Marcar recogida' }));
    expect(dialogo().getByRole('alert')).toHaveTextContent('La recogida choca con la reserva E5F6A7B8');
    await user.click(dialogo().getByRole('button', { name: 'Volver' }));

    await user.click(screen.getByRole('button', { name: 'Marcar recogida' }));
    expect(dialogo().queryByRole('alert')).toBeNull();
  });

  it('un 409 con un diálogo abierto recarga la lista y, al cerrarlo, el foco va a la tarjeta (no se pierde en el <body>)', async () => {
    accionReservaAdmin.mockResolvedValue(falla('La recogida choca con la reserva E5F6A7B8 (del 12/10/2026).', 409));
    const { user } = await montar({ reservas: [RETRASADA] });
    await user.click(screen.getByRole('button', { name: 'Marcar recogida' }));
    await user.click(dialogo().getByRole('button', { name: 'Marcar recogida' }));
    await waitFor(() => expect(getReservasAdmin).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('heading', { level: 3, name: /^Mesa de roble/ })).toBeInTheDocument();
    expect(dialogo().getByRole('alert')).toHaveTextContent('La recogida choca con la reserva E5F6A7B8 (del 12/10/2026).');

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('heading', { level: 3, name: /^Mesa de roble/ }).closest('li')).toHaveFocus();
  });

  it('"Marcar recogida" de otro día: solo entre el día de la entrega y hoy, y se manda el día elegido', async () => {
    accionReservaAdmin.mockResolvedValue(ok({ reserva: { ...RETRASADA, estado: 'devuelta', etiqueta: 'Devuelta', acciones: [] } }));
    const { user } = await montar({ reservas: [RETRASADA] });
    await user.click(screen.getByRole('button', { name: 'Marcar recogida' }));
    const dia = dialogo().getByLabelText('Día de la recogida');

    for (const fuera of ['2026-09-30', '2026-10-14', '']) {
      fireEvent.change(dia, { target: { value: fuera } });
      await user.click(dialogo().getByRole('button', { name: 'Marcar recogida' }));
      expect(dialogo().getByRole('alert')).toHaveTextContent('Elige un día entre el 01/10/2026 y el 13/10/2026.');
    }
    expect(accionReservaAdmin).not.toHaveBeenCalled();

    fireEvent.change(dia, { target: { value: '2026-10-01' } });
    await user.click(dialogo().getByRole('button', { name: 'Marcar recogida' }));
    expect(accionReservaAdmin).toHaveBeenCalledWith('r2', 'recoger', { fecha_recogida: '2026-10-01' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(showToast).toHaveBeenCalledWith('Reserva marcada como recogida', 'success');
  });

  it('"Marcar recogida" en una pestaña que lleva abierta desde ayer: el día es el del reloj, no el de la lista', async () => {
    const { user } = await montar({ reservas: [RETRASADA], hoy: '2026-10-12' });
    await user.click(screen.getByRole('button', { name: 'Marcar recogida' }));
    const dia = dialogo().getByLabelText('Día de la recogida');
    expect(dia).toHaveValue(HOY);
    expect(dia).toHaveAttribute('max', HOY);

    await user.click(dialogo().getByRole('button', { name: 'Marcar recogida' }));
    expect(accionReservaAdmin).toHaveBeenCalledWith('r2', 'recoger', { fecha_recogida: HOY });
  });

  it('"Marcar recogida": el mínimo es el día en que se entregó de verdad, no el previsto', async () => {
    // Prevista para el 1 de octubre, entregada el 3 (a las 23:30 UTC ya es el 4 en Madrid)
    const tarde = { ...RETRASADA, entregada_en: '2026-10-03T23:30:00Z' };
    const { user } = await montar({ reservas: [tarde] });
    await user.click(screen.getByRole('button', { name: 'Marcar recogida' }));
    expect(dialogo().getByLabelText('Día de la recogida')).toHaveAttribute('min', '2026-10-04');
  });

  it('"Marcar recogida" de un alquiler ya entregado que todavía no empieza: no hay día posible y no se puede mandar', async () => {
    const futuro = { ...RETRASADA, fecha_inicio: '2026-10-25', fecha_fin: '2026-10-30', fin_ocupacion: '2026-10-30', entregada_en: HOY + 'T08:00:00Z' };
    const { user } = await montar({ reservas: [futuro] });
    await user.click(screen.getByRole('button', { name: 'Marcar recogida' }));

    expect(dialogo().getByText('Todavía no se puede recoger: la entrega es el 25/10/2026.')).toBeInTheDocument();
    expect(dialogo().getByRole('button', { name: 'Marcar recogida' })).toBeDisabled();
    expect(accionReservaAdmin).not.toHaveBeenCalled();
  });

  it('si al recogerla el servidor recorta el margen, su aviso se queda en esa tarjeta hasta recargar', async () => {
    const AVISO = 'Ha vuelto tarde: el margen antes del alquiler #E5F6A7B8 se queda en 1 día.';
    accionReservaAdmin.mockResolvedValue(
      ok({ reserva: { ...RETRASADA, estado: 'devuelta', etiqueta: 'Devuelta', retrasada: false, acciones: [] }, aviso: AVISO })
    );
    const { user } = await montar({ reservas: [RETRASADA, ALQUILER] });
    await user.click(screen.getByRole('button', { name: 'Marcar recogida' }));
    await user.click(dialogo().getByRole('button', { name: 'Marcar recogida' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(tarjeta('Mesa de roble').getByRole('alert')).toHaveTextContent(AVISO);
    expect(tarjeta('Mesa de roble').getByRole('alert')).toHaveClass('reserva-aviso');
    expect(tarjeta('Mesa de roble').getByText('Devuelta')).toBeInTheDocument();
    expect(tarjeta('Silla Tolix').queryByRole('alert')).toBeNull();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(showToast).toHaveBeenCalledWith('Reserva marcada como recogida', 'success');

    await user.click(screen.getByRole('button', { name: 'Actualizar' }));
    await waitFor(() => expect(getReservasAdmin).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('heading', { level: 3, name: /^Mesa de roble/ })).toBeInTheDocument();
    expect(screen.queryByText(AVISO)).toBeNull();
  });

  it('el aviso de una acción se borra al pulsar otra acción de esa tarjeta', async () => {
    accionReservaAdmin
      .mockResolvedValueOnce(ok({ reserva: { ...RETRASADA, acciones: ['ampliar'] }, aviso: 'Margen recortado.' }))
      .mockResolvedValueOnce(ok({ reserva: RETRASADA }));
    const { user } = await montar({ reservas: [RETRASADA] });
    await user.click(screen.getByRole('button', { name: 'Marcar recogida' }));
    await user.click(dialogo().getByRole('button', { name: 'Marcar recogida' }));
    expect(tarjeta('Mesa de roble').getByRole('alert')).toHaveTextContent('Margen recortado.');

    await user.click(screen.getByRole('button', { name: 'Ampliar' }));
    expect(tarjeta('Mesa de roble').queryByText('Margen recortado.')).toBeNull();
  });

  it('"Ampliar": propone mañana, no deja una fecha pasada y manda el nuevo fin de ocupación', async () => {
    accionReservaAdmin
      .mockResolvedValueOnce(falla('Choca con la reserva E5F6A7B8, que empieza el 16/10/2026.', 409))
      .mockResolvedValueOnce(ok({ reserva: { ...RETRASADA, fin_ocupacion: '2026-10-15' } }));
    const { user } = await montar({ reservas: [RETRASADA] });
    await user.click(screen.getByRole('button', { name: 'Ampliar' }));

    expect(screen.getByRole('dialog', { name: 'Ampliar la ocupación' })).toBeInTheDocument();
    expect(dialogo().getByText('Reserva B2C3D4E5 (Mesa de roble). Ahora la pieza tiene que volver el 10/10/2026.')).toBeInTheDocument();
    const fecha = dialogo().getByLabelText('Nueva fecha de recogida');
    expect(fecha).toHaveAttribute('type', 'date');
    expect(fecha).toHaveValue('2026-10-14');
    expect(fecha).toHaveAttribute('min', HOY);
    expect(fecha).toHaveAccessibleDescription(
      'No se cobra nada: solo mantiene la pieza ocupada. Si llega a la reserva siguiente, no se guarda y se te dice cuál es.'
    );

    fireEvent.change(fecha, { target: { value: '2026-10-12' } });
    await user.click(dialogo().getByRole('button', { name: 'Ampliar' }));
    expect(dialogo().getByRole('alert')).toHaveTextContent('Elige el 13/10/2026 o un día posterior.');
    expect(accionReservaAdmin).not.toHaveBeenCalled();

    fireEvent.change(fecha, { target: { value: '' } });
    await user.click(dialogo().getByRole('button', { name: 'Ampliar' }));
    expect(accionReservaAdmin).not.toHaveBeenCalled();

    fireEvent.change(fecha, { target: { value: '2026-10-17' } });
    await user.click(dialogo().getByRole('button', { name: 'Ampliar' }));
    expect(accionReservaAdmin).toHaveBeenLastCalledWith('r2', 'ampliar', { fin_ocupacion: '2026-10-17' });
    expect(dialogo().getByRole('alert')).toHaveTextContent('Choca con la reserva E5F6A7B8, que empieza el 16/10/2026.');

    fireEvent.change(fecha, { target: { value: '2026-10-15' } });
    await user.click(dialogo().getByRole('button', { name: 'Ampliar' }));
    expect(accionReservaAdmin).toHaveBeenLastCalledWith('r2', 'ampliar', { fin_ocupacion: '2026-10-15' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(filasDe(tarjeta('Mesa de roble'))).toContainEqual(['Ocupación ampliada hasta', '15/10/2026']);
    expect(showToast).toHaveBeenCalledWith('Ocupación ampliada', 'success');
  });

  it('"Ampliar" una que aún no ha vencido propone el día siguiente a su fin, y no deja quedarse en él', async () => {
    const { user } = await montar({ reservas: [{ ...RETRASADA, fin_ocupacion: '2026-10-25', fecha_fin: '2026-10-25' }] });
    await user.click(screen.getByRole('button', { name: 'Ampliar' }));
    const fecha = dialogo().getByLabelText('Nueva fecha de recogida');
    expect(fecha).toHaveValue('2026-10-26');
    expect(fecha).toHaveAttribute('min', '2026-10-26');

    fireEvent.change(fecha, { target: { value: '2026-10-25' } });
    await user.click(dialogo().getByRole('button', { name: 'Ampliar' }));
    expect(dialogo().getByRole('alert')).toHaveTextContent('Elige el 26/10/2026 o un día posterior.');
    expect(accionReservaAdmin).not.toHaveBeenCalled();
  });

  it('"Ampliar" en una pestaña que lleva abierta desde ayer parte del día del reloj', async () => {
    const { user } = await montar({ reservas: [RETRASADA], hoy: '2026-10-10' });
    await user.click(screen.getByRole('button', { name: 'Ampliar' }));
    expect(dialogo().getByLabelText('Nueva fecha de recogida')).toHaveValue('2026-10-14');
    expect(dialogo().getByLabelText('Nueva fecha de recogida')).toHaveAttribute('min', HOY);
  });

  it('"Ampliar" una sin fin de ocupación guardado parte de la recogida pactada', async () => {
    accionReservaAdmin.mockResolvedValue(ok({ reserva: { ...RETRASADA, fin_ocupacion: '2026-10-14' } }));
    const { user } = await montar({ reservas: [{ ...RETRASADA, fin_ocupacion: null }] });
    await user.click(screen.getByRole('button', { name: 'Ampliar' }));
    expect(dialogo().getByText('Reserva B2C3D4E5 (Mesa de roble). Ahora la pieza tiene que volver el 10/10/2026.')).toBeInTheDocument();
    await user.click(dialogo().getByRole('button', { name: 'Ampliar' }));
    expect(accionReservaAdmin).toHaveBeenCalledWith('r2', 'ampliar', { fin_ocupacion: '2026-10-14' });
  });

  it('un segundo envío del formulario mientras guarda no se manda', async () => {
    const respuesta = diferida();
    accionReservaAdmin.mockReturnValue(respuesta.promesa);
    const { user } = await montar({ reservas: [RETRASADA] });
    await user.click(screen.getByRole('button', { name: 'Ampliar' }));
    const formulario = screen.getByRole('dialog').querySelector('form');

    fireEvent.submit(formulario);
    fireEvent.submit(formulario);
    expect(accionReservaAdmin).toHaveBeenCalledTimes(1);
    expect(dialogo().getByRole('button', { name: 'Guardando…' })).toBeDisabled();
    await act(async () => respuesta.resolver(ok({ reserva: RETRASADA })));
    expect(accionReservaAdmin).toHaveBeenCalledTimes(1);
  });

  it('"Cancelar reserva": motivo obligatorio, reembolso por defecto todo lo pagado y nunca más', async () => {
    const { user } = await montar();
    await user.click(screen.getByRole('button', { name: 'Cancelar reserva' }));

    expect(screen.getByRole('dialog', { name: 'Cancelar la reserva' })).toBeInTheDocument();
    expect(dialogo().getByText('Reserva A1B2C3D4 (Silla Tolix).')).toBeInTheDocument();
    expect(dialogo().getByLabelText('Motivo de la cancelación')).toHaveAccessibleDescription('Queda guardado en la reserva.');
    const reembolso = dialogo().getByLabelText('Reembolso (€)');
    expect(reembolso).toHaveValue('120,50');
    expect(reembolso).toHaveAccessibleDescription(
      `Pagado en la web: ${eurosDeCentimos(12050)}. Puedes reembolsar desde 0 hasta esa cantidad.`
    );

    await user.click(dialogo().getByRole('button', { name: 'Revisar' }));
    expect(dialogo().getByRole('alert')).toHaveTextContent('Escribe el motivo de la cancelación.');

    await user.type(dialogo().getByLabelText('Motivo de la cancelación'), 'Avería de la pieza');
    await user.clear(reembolso);
    await user.type(reembolso, '200');
    await user.click(dialogo().getByRole('button', { name: 'Revisar' }));
    expect(dialogo().getByRole('alert')).toHaveTextContent(`El reembolso no puede pasar de ${euros(12050)}.`);

    await user.clear(reembolso);
    await user.type(reembolso, 'mucho');
    await user.click(dialogo().getByRole('button', { name: 'Revisar' }));
    expect(dialogo().getByRole('alert')).toHaveTextContent('El reembolso no es válido. Escríbelo así: 120 o 120,50.');
    expect(accionReservaAdmin).not.toHaveBeenCalled();
  });

  it('"Cancelar reserva" repite lo que va a pasar antes de mandarlo, y "Volver" conserva lo escrito', async () => {
    accionReservaAdmin
      .mockResolvedValueOnce(falla('Ya hay un reembolso en curso o hecho.', 409))
      .mockResolvedValueOnce(ok({ reserva: { ...ALQUILER, estado: 'cancelada', etiqueta: 'Cancelada', acciones: [] } }));
    const { user } = await montar();
    await user.click(screen.getByRole('button', { name: 'Cancelar reserva' }));
    await user.type(dialogo().getByLabelText('Motivo de la cancelación'), '  Avería de la pieza ');
    const reembolso = dialogo().getByLabelText('Reembolso (€)');
    await user.clear(reembolso);
    await user.type(reembolso, '60,5');
    await user.click(dialogo().getByRole('button', { name: 'Revisar' }));

    expect(screen.getByRole('dialog', { name: '¿Cancelar la reserva?' })).toBeInTheDocument();
    expect(
      dialogo().getByText(
        `Vas a cancelar la reserva A1B2C3D4 (Silla Tolix) y a reembolsar ${euros(6050)} al cliente. El reembolso se hace en Stripe y no se puede deshacer.`
      )
    ).toBeInTheDocument();
    expect(accionReservaAdmin).not.toHaveBeenCalled();

    await user.click(dialogo().getByRole('button', { name: 'Volver' }));
    expect(dialogo().getByLabelText('Motivo de la cancelación')).toHaveValue('  Avería de la pieza ');
    expect(dialogo().getByLabelText('Reembolso (€)')).toHaveValue('60,5');
    await user.click(dialogo().getByRole('button', { name: 'Revisar' }));

    await user.click(dialogo().getByRole('button', { name: 'Cancelar la reserva' }));
    expect(accionReservaAdmin).toHaveBeenCalledWith('r1', 'cancelar', { motivo: 'Avería de la pieza', reembolso_centimos: 6050 });
    expect(dialogo().getByRole('alert')).toHaveTextContent('Ya hay un reembolso en curso o hecho.');

    await user.click(dialogo().getByRole('button', { name: 'Cancelar la reserva' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(tarjeta('Silla Tolix').getByText('Cancelada')).toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith('Reserva cancelada', 'success');
  });

  it('"Cancelar reserva" sin nada pagado en la web: sin campo de reembolso, y se manda 0', async () => {
    accionReservaAdmin.mockResolvedValue(ok({ reserva: { ...ALQUILER, pagado: false, estado: 'cancelada', acciones: [] } }));
    const { user } = await montar({ reservas: [{ ...ALQUILER, pagado: false, origen: 'manual' }] });
    await user.click(screen.getByRole('button', { name: 'Cancelar reserva' }));

    expect(dialogo().queryByLabelText('Reembolso (€)')).toBeNull();
    expect(dialogo().getByText('No hay ningún pago en la web: no se reembolsa nada.')).toBeInTheDocument();
    await user.type(dialogo().getByLabelText('Motivo de la cancelación'), 'Se anula el contrato');
    await user.click(dialogo().getByRole('button', { name: 'Revisar' }));
    expect(dialogo().getByText('Vas a cancelar la reserva A1B2C3D4 (Silla Tolix), sin reembolso.')).toBeInTheDocument();

    await user.click(dialogo().getByRole('button', { name: 'Cancelar la reserva' }));
    expect(accionReservaAdmin).toHaveBeenCalledWith('r1', 'cancelar', { motivo: 'Se anula el contrato', reembolso_centimos: 0 });
  });

  it('"Cancelar venta": sin campo de reembolso (una compra se reembolsa en Stripe), manda 0 y avisa', async () => {
    accionReservaAdmin.mockResolvedValue(ok({ reserva: { ...VENTA, estado: 'cancelada', etiqueta: 'Venta cancelada', acciones: [] } }));
    const { user } = await montar({ reservas: [VENTA] });
    const t = tarjeta('Aparador');
    expect(filasDe(t)).toEqual([
      ['Desde', '05/11/2026'],
      ['Importe', `${eurosDeCentimos(45000)}, pagado`]
    ]);
    expect(t.getAllByRole('button').map((b) => b.textContent)).toEqual(['Cancelar venta']);

    await user.click(t.getByRole('button', { name: 'Cancelar venta' }));
    expect(screen.getByRole('dialog', { name: 'Cancelar la venta' })).toBeInTheDocument();
    expect(dialogo().getByText('Venta E5F6A7B8 (Aparador).')).toBeInTheDocument();
    expect(dialogo().getByLabelText('Motivo de la cancelación')).toHaveAccessibleDescription('Queda guardado en la venta.');
    expect(dialogo().queryByLabelText('Reembolso (€)')).toBeNull();
    expect(
      dialogo().getByText('Aquí se cancela sin reembolso: una compra se reembolsa desde el Dashboard de Stripe.')
    ).toBeInTheDocument();

    await user.type(dialogo().getByLabelText('Motivo de la cancelación'), 'Devuelta en la tienda');
    await user.click(dialogo().getByRole('button', { name: 'Revisar' }));
    expect(screen.getByRole('dialog', { name: '¿Cancelar la venta?' })).toBeInTheDocument();
    expect(dialogo().getByText('Vas a cancelar la venta E5F6A7B8 (Aparador), sin reembolso.')).toBeInTheDocument();

    await user.click(dialogo().getByRole('button', { name: 'Cancelar la venta' }));
    expect(accionReservaAdmin).toHaveBeenCalledWith('r5', 'cancelar', { motivo: 'Devuelta en la tienda', reembolso_centimos: 0 });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(tarjeta('Aparador').getByText('Venta cancelada')).toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith('Venta cancelada', 'success');
  });

  it('mientras se guarda la cancelación no se puede volver al formulario (la respuesta sale en la confirmación)', async () => {
    const respuesta = diferida();
    accionReservaAdmin.mockReturnValue(respuesta.promesa);
    const { user } = await montar();
    await user.click(screen.getByRole('button', { name: 'Cancelar reserva' }));
    await user.type(dialogo().getByLabelText('Motivo de la cancelación'), 'Avería');
    await user.click(dialogo().getByRole('button', { name: 'Revisar' }));
    expect(dialogo().getByRole('button', { name: 'Volver' })).toBeEnabled();

    await user.click(dialogo().getByRole('button', { name: 'Cancelar la reserva' }));
    expect(dialogo().getByRole('button', { name: 'Volver' })).toBeDisabled();
    expect(dialogo().getByRole('button', { name: 'Guardando…' })).toBeDisabled();
    await act(async () => respuesta.resolver(falla('Ya hay un reembolso en curso o hecho.', 409)));
    expect(dialogo().getByRole('alert')).toHaveTextContent('Ya hay un reembolso en curso o hecho.');
    expect(dialogo().getByRole('button', { name: 'Volver' })).toBeEnabled();

    // Al volver al formulario y revisar otra vez, el error de antes ya no sale.
    await user.click(dialogo().getByRole('button', { name: 'Volver' }));
    await user.click(dialogo().getByRole('button', { name: 'Revisar' }));
    expect(screen.getByRole('dialog', { name: '¿Cancelar la reserva?' })).toBeInTheDocument();
    expect(dialogo().queryByRole('alert')).toBeNull();
  });

  it('reembolsar 0 de una reserva pagada también se avisa como "sin reembolso"', async () => {
    const { user } = await montar();
    await user.click(screen.getByRole('button', { name: 'Cancelar reserva' }));
    await user.type(dialogo().getByLabelText('Motivo de la cancelación'), 'Lo pide el cliente fuera de plazo');
    await user.clear(dialogo().getByLabelText('Reembolso (€)'));
    await user.type(dialogo().getByLabelText('Reembolso (€)'), '0');
    await user.click(dialogo().getByRole('button', { name: 'Revisar' }));
    expect(dialogo().getByText('Vas a cancelar la reserva A1B2C3D4 (Silla Tolix), sin reembolso.')).toBeInTheDocument();
  });
});

describe('Reservas — reembolsos a medias', () => {
  it('"Dar por reembolsado": dice que no mueve dinero y pide confirmación; "Volver" no manda nada', async () => {
    accionReservaAdmin.mockResolvedValue(
      ok({
        reserva: {
          ...A_MEDIAS,
          etiqueta: 'Cancelada',
          reembolso: { ...A_MEDIAS.reembolso, stripe_refund_id: 're_1' },
          reembolso_a_medias: false,
          acciones: []
        }
      })
    );
    const { user } = await montar({ reservas: [A_MEDIAS_CERRABLE] });
    const t = tarjeta('Silla Tolix');
    expect(t.getAllByRole('button').map((b) => b.textContent)).toEqual(['Reintentar reembolso', 'Dar por reembolsado']);
    expect(t.getByText(/El reembolso se quedó a medias/)).toHaveTextContent(
      'El reembolso se quedó a medias: Stripe no lo ha confirmado. «Reintentar reembolso» comprueba primero en Stripe ' +
        'si ya se hizo y no lo repite. Solo si lo has devuelto tú desde el Dashboard de Stripe, usa «Dar por reembolsado».'
    );

    await user.click(t.getByRole('button', { name: 'Dar por reembolsado' }));
    expect(accionReservaAdmin).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Dar por reembolsado' })).toBeInTheDocument();
    expect(
      dialogo().getByText(
        'Esto no mueve dinero: solo da por cerrado el reembolso a medias de la reserva D4E5F6A7 (Silla Tolix). ' +
          'Úsalo solo si ya has devuelto el dinero desde el Dashboard de Stripe: antes se comprueba allí que conste.'
      )
    ).toBeInTheDocument();
    await user.click(dialogo().getByRole('button', { name: 'Volver' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(accionReservaAdmin).not.toHaveBeenCalled();

    await user.click(t.getByRole('button', { name: 'Dar por reembolsado' }));
    await user.click(dialogo().getByRole('button', { name: 'Dar por reembolsado' }));
    expect(accionReservaAdmin).toHaveBeenCalledTimes(1);
    expect(accionReservaAdmin).toHaveBeenCalledWith('r4', 'dar-por-reembolsado', {});
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(showToast).toHaveBeenCalledWith('Reembolso dado por hecho', 'success');
    expect(tarjeta('Silla Tolix').queryByText(/a medias/)).toBeNull();
    expect(tarjeta('Silla Tolix').queryByRole('button')).toBeNull();
  });

  it('"Dar por reembolsado": si el servidor dice que no, su mensaje sale en la confirmación', async () => {
    accionReservaAdmin.mockResolvedValue(falla('Esta reserva no tiene ningún reembolso a medias.', 409));
    const { user } = await montar({ reservas: [A_MEDIAS_CERRABLE] });
    await user.click(screen.getByRole('button', { name: 'Dar por reembolsado' }));
    await user.click(dialogo().getByRole('button', { name: 'Dar por reembolsado' }));

    expect(dialogo().getByRole('alert')).toHaveTextContent('Esta reserva no tiene ningún reembolso a medias.');
    expect(showToast).not.toHaveBeenCalled();
  });

  it('"Dar por reembolsado" y Stripe no lo muestra: segundo paso, solo si se devolvió por otro medio', async () => {
    const NO_CONSTA = 'En Stripe no consta ningún reembolso de este pago desde que se canceló la reserva.';
    accionReservaAdmin
      .mockResolvedValueOnce(falla(NO_CONSTA, 409, 'reembolso_no_consta'))
      .mockResolvedValueOnce(
        ok({ reserva: { ...A_MEDIAS_CERRABLE, etiqueta: 'Cancelada', reembolso_a_medias: false, acciones: [] } })
      );
    const { user } = await montar({ reservas: [A_MEDIAS_CERRABLE] });
    await user.click(screen.getByRole('button', { name: 'Dar por reembolsado' }));
    await user.click(dialogo().getByRole('button', { name: 'Dar por reembolsado' }));

    // No es una lista desfasada: no se recarga, y el diálogo pasa al segundo paso con lo que dijo el servidor
    expect(getReservasAdmin).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('dialog', { name: 'No consta en Stripe' })).toBeInTheDocument();
    expect(dialogo().getByText(/^En Stripe no consta/)).toHaveTextContent(
      `${NO_CONSTA} Si el dinero se devolvió por otro medio, por ejemplo con una transferencia, puedes darlo por ` +
        'reembolsado igualmente. Si solo devolviste una parte desde el Dashboard de Stripe, devuelve el resto allí y ' +
        'vuelve a pulsar «Dar por reembolsado». Si no has devuelto nada, vuelve y usa «Reintentar reembolso».'
    );
    expect(dialogo().queryByRole('alert')).toBeNull();
    expect(showToast).not.toHaveBeenCalled();

    await user.click(dialogo().getByRole('button', { name: 'Dar por reembolsado igualmente' }));
    expect(accionReservaAdmin).toHaveBeenCalledTimes(2);
    expect(accionReservaAdmin).toHaveBeenLastCalledWith('r4', 'dar-por-reembolsado', { aunque_no_conste: true });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(showToast).toHaveBeenCalledWith('Reembolso dado por hecho', 'success');
    expect(tarjeta('Silla Tolix').queryByRole('button')).toBeNull();
  });

  it('"Dar por reembolsado" sin Stripe: «Volver» del segundo paso no manda nada y la tarjeta sigue a medias', async () => {
    accionReservaAdmin.mockResolvedValue(
      falla('No se ha podido comprobar en Stripe si el reembolso está hecho.', 409, 'reembolso_no_consta')
    );
    const { user } = await montar({ reservas: [A_MEDIAS_CERRABLE] });
    await user.click(screen.getByRole('button', { name: 'Dar por reembolsado' }));
    await user.click(dialogo().getByRole('button', { name: 'Dar por reembolsado' }));
    await user.click(dialogo().getByRole('button', { name: 'Volver' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(accionReservaAdmin).toHaveBeenCalledTimes(1);
    expect(tarjeta('Silla Tolix').getByRole('button', { name: 'Reintentar reembolso' })).toBeInTheDocument();
  });

  it('el segundo paso, si su envío falla, enseña el error dentro del mismo diálogo', async () => {
    accionReservaAdmin
      .mockResolvedValueOnce(falla('En Stripe no consta ningún reembolso.', 409, 'reembolso_no_consta'))
      .mockResolvedValueOnce(falla('Revisa los datos.', 400));
    const { user } = await montar({ reservas: [A_MEDIAS_CERRABLE] });
    await user.click(screen.getByRole('button', { name: 'Dar por reembolsado' }));
    await user.click(dialogo().getByRole('button', { name: 'Dar por reembolsado' }));
    await user.click(dialogo().getByRole('button', { name: 'Dar por reembolsado igualmente' }));

    expect(screen.getByRole('dialog', { name: 'No consta en Stripe' })).toBeInTheDocument();
    expect(dialogo().getByRole('alert')).toHaveTextContent('Revisa los datos.');
  });

  it('si se cierra el diálogo mientras se comprueba en Stripe, el motivo sale como aviso y no se abre otro', async () => {
    const respuesta = diferida();
    accionReservaAdmin.mockReturnValue(respuesta.promesa);
    const { user } = await montar({ reservas: [A_MEDIAS_CERRABLE] });
    await user.click(screen.getByRole('button', { name: 'Dar por reembolsado' }));
    await user.click(dialogo().getByRole('button', { name: 'Dar por reembolsado' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();

    await act(async () => {
      respuesta.resolver(falla('En Stripe no consta ningún reembolso.', 409, 'reembolso_no_consta'));
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    // El motivo se queda bajo la tarjeta, donde el lector de pantalla lo lee (el toast dura 3 s y no se anuncia)
    expect(tarjeta('Silla Tolix').getByRole('alert')).toHaveTextContent('En Stripe no consta ningún reembolso.');
    expect(showToast).toHaveBeenCalledWith('En Stripe no consta ningún reembolso.', 'error');
    expect(getReservasAdmin).toHaveBeenCalledTimes(1);
    // y la tarjeta sigue ofreciendo las acciones
    expect(tarjeta('Silla Tolix').getByRole('button', { name: 'Dar por reembolsado' })).toBeEnabled();
  });

  it('"Reintentar reembolso": si hay un reembolso hecho fuera del panel, el 409 sale tal cual en la tarjeta', async () => {
    const MENSAJE = 'Stripe tiene un reembolso de este pago hecho fuera del panel. Revísalo en el Dashboard de Stripe.';
    accionReservaAdmin.mockResolvedValue(falla(MENSAJE, 409));
    const { user } = await montar({ reservas: [A_MEDIAS_CERRABLE] });
    await user.click(screen.getByRole('button', { name: 'Reintentar reembolso' }));
    await user.click(dialogo().getByRole('button', { name: 'Reintentar reembolso' }));

    expect(accionReservaAdmin).toHaveBeenCalledWith('r4', 'reintentar-reembolso', {});
    // El mensaje sale en el diálogo, que sigue abierto (como en cualquier otra acción de diálogo)
    expect(dialogo().getByRole('alert')).toHaveTextContent(MENSAJE);
    // y es un 409: la lista se recarga por si ya no está al día
    await waitFor(() => expect(getReservasAdmin).toHaveBeenCalledTimes(2));
  });

  it('"Cancelar reserva": si Stripe no deja devolver tanto, el 400 sale en la confirmación y el diálogo sigue abierto', async () => {
    accionReservaAdmin.mockResolvedValue(falla('Stripe solo permite devolver 50,00 € de este pago.', 400));
    const { user } = await montar();
    await user.click(screen.getByRole('button', { name: 'Cancelar reserva' }));
    await user.type(dialogo().getByLabelText('Motivo de la cancelación'), 'Avería');
    await user.click(dialogo().getByRole('button', { name: 'Revisar' }));
    await user.click(dialogo().getByRole('button', { name: 'Cancelar la reserva' }));

    expect(accionReservaAdmin).toHaveBeenCalledWith('r1', 'cancelar', { motivo: 'Avería', reembolso_centimos: 12050 });
    expect(screen.getByRole('dialog', { name: '¿Cancelar la reserva?' })).toBeInTheDocument();
    expect(dialogo().getByRole('alert')).toHaveTextContent('Stripe solo permite devolver 50,00 € de este pago.');
    expect(getReservasAdmin).toHaveBeenCalledTimes(1);
    expect(showToast).not.toHaveBeenCalled();

    // Se vuelve al formulario para bajar el importe, con lo escrito.
    await user.click(dialogo().getByRole('button', { name: 'Volver' }));
    expect(dialogo().getByLabelText('Reembolso (€)')).toHaveValue('120,50');
    expect(dialogo().queryByRole('alert')).toBeNull();
  });

  it('un 502 al cancelar (reembolso a medias): cierra el diálogo, pasa a «Reembolsos a medias» y deja el aviso con la reserva', async () => {
    const MENSAJE = 'La reserva se ha cancelado, pero el reembolso se ha quedado a medias. Reinténtalo en «Reembolsos a medias».';
    accionReservaAdmin.mockResolvedValue(falla(MENSAJE, 502, 'reembolso_a_medias'));
    const { user } = await montar({ reservas: [ALQUILER, RETRASADA] });
    await user.click(screen.getByRole('button', { name: 'Retrasadas' }));
    await waitFor(() => expect(getReservasAdmin).toHaveBeenCalledTimes(2));
    await user.click(await screen.findByRole('button', { name: 'Cancelar reserva' }));
    await user.type(dialogo().getByLabelText('Motivo de la cancelación'), 'Avería');
    await user.click(dialogo().getByRole('button', { name: 'Revisar' }));

    getReservasAdmin.mockResolvedValue(ok({ hoy: HOY, reservas: [{ ...ALQUILER, estado: 'cancelada', reembolso_a_medias: true, acciones: ['reintentar-reembolso'] }] }));
    await user.click(dialogo().getByRole('button', { name: 'Cancelar la reserva' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(getReservasAdmin).toHaveBeenCalledTimes(3));
    expect(getReservasAdmin).toHaveBeenLastCalledWith({ vista: 'reembolsos' });
    expect(screen.getByRole('button', { name: 'Reembolsos a medias' })).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByText('1 reserva')).toBeInTheDocument();

    // El aviso dice de qué reserva se trata (la vista puede haber cambiado) y no se repite en la tarjeta
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveTextContent(`Reserva A1B2C3D4 (Silla Tolix): ${MENSAJE} Está en «Reembolsos a medias».`);
    expect(screen.getByRole('alert')).toHaveClass('reservas-aviso-general');
    expect(showToast).toHaveBeenCalledWith(MENSAJE, 'error');

    await user.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('un 502 en una acción directa: el mensaje sale arriba, no en la tarjeta, y la vista se vuelve a cargar', async () => {
    const MENSAJE = 'Stripe no ha respondido: el reembolso sigue a medias.';
    accionReservaAdmin.mockResolvedValue(falla(MENSAJE, 502, 'reembolso_a_medias'));
    const { user } = await montar({ reservas: [A_MEDIAS] });
    await user.click(screen.getByRole('button', { name: 'Reintentar reembolso' }));
    await user.click(dialogo().getByRole('button', { name: 'Reintentar reembolso' }));

    await waitFor(() => expect(getReservasAdmin).toHaveBeenCalledTimes(2));
    expect(getReservasAdmin).toHaveBeenLastCalledWith({ vista: 'reembolsos' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent(`Reserva D4E5F6A7 (Silla Tolix): ${MENSAJE} Está en «Reembolsos a medias».`);
    expect(await screen.findByRole('heading', { level: 3, name: /^Silla Tolix/ })).toBeInTheDocument();
    expect(tarjeta('Silla Tolix').queryByRole('alert')).toBeNull();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(showToast).toHaveBeenCalledWith(MENSAJE, 'error');
  });

  it('un 502 estando ya en «Reembolsos a medias»: recarga esa misma vista, sin cambiarla', async () => {
    accionReservaAdmin.mockResolvedValue(falla('Stripe no ha respondido.', 502, 'reembolso_a_medias'));
    const { user } = await montar({ reservas: [ALQUILER] });
    getReservasAdmin.mockResolvedValue(ok({ hoy: HOY, reservas: [A_MEDIAS] }));
    await user.click(screen.getByRole('button', { name: 'Reembolsos a medias' }));
    await waitFor(() => expect(getReservasAdmin).toHaveBeenCalledTimes(2));
    await user.click(await screen.findByRole('button', { name: 'Reintentar reembolso' }));
    await user.click(dialogo().getByRole('button', { name: 'Reintentar reembolso' }));

    await waitFor(() => expect(getReservasAdmin).toHaveBeenCalledTimes(3));
    expect(getReservasAdmin).toHaveBeenLastCalledWith({ vista: 'reembolsos' });
    expect(screen.getByRole('button', { name: 'Reembolsos a medias' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('un 502 sin el código del reembolso a medias (la pasarela, Vercel) es un error más: puede haberse guardado y no cambia de vista', async () => {
    accionReservaAdmin.mockResolvedValue(falla('No se ha podido completar la acción.', 502));
    const { user } = await montar({ reservas: [BLOQUEO] });
    await user.click(tarjeta('Lámpara antigua').getByRole('button', { name: 'Levantar bloqueo' }));

    expect(tarjeta('Lámpara antigua').getByRole('alert')).toHaveTextContent(
      'No se ha podido completar la acción. Puede que sí se haya guardado: pulsa «Actualizar» y mira cómo ha quedado antes de repetirlo.'
    );
    expect(screen.getByRole('button', { name: 'Próximas' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText(/Está en «Reembolsos a medias»/)).toBeNull();
    expect(getReservasAdmin).toHaveBeenCalledTimes(1);
    expect(showToast).not.toHaveBeenCalled();
  });

  it('un 502 sin código al cancelar con reembolso: el error sale en el diálogo, que sigue abierto, y no se pasa a «Reembolsos a medias»', async () => {
    accionReservaAdmin.mockResolvedValue(falla('No se ha podido completar la acción.', 502));
    const { user } = await montar();
    await user.click(screen.getByRole('button', { name: 'Cancelar reserva' }));
    await user.type(dialogo().getByLabelText('Motivo de la cancelación'), 'Avería');
    await user.click(dialogo().getByRole('button', { name: 'Revisar' }));
    await user.click(dialogo().getByRole('button', { name: 'Cancelar la reserva' }));

    expect(screen.getByRole('dialog', { name: '¿Cancelar la reserva?' })).toBeInTheDocument();
    expect(dialogo().getByRole('alert')).toHaveTextContent(/^No se ha podido completar la acción\. Puede que sí se haya guardado/);
    expect(screen.getByRole('button', { name: 'Próximas' })).toHaveAttribute('aria-pressed', 'true');
    expect(getReservasAdmin).toHaveBeenCalledTimes(1);
  });

  it('«Reintentar reembolso» bien hecho borra el aviso de arriba', async () => {
    accionReservaAdmin
      .mockResolvedValueOnce(falla('Stripe no ha respondido.', 502, 'reembolso_a_medias'))
      .mockResolvedValueOnce(ok({ reserva: { ...A_MEDIAS, reembolso_a_medias: false, acciones: [] } }));
    const { user } = await montar({ reservas: [A_MEDIAS] });
    await user.click(screen.getByRole('button', { name: 'Reintentar reembolso' }));
    await user.click(dialogo().getByRole('button', { name: 'Reintentar reembolso' }));
    expect(await screen.findByText(/Está en «Reembolsos a medias»/)).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Reintentar reembolso' }));
    await user.click(dialogo().getByRole('button', { name: 'Reintentar reembolso' }));
    await waitFor(() => expect(screen.queryByText(/Está en «Reembolsos a medias»/)).toBeNull());
    expect(showToast).toHaveBeenLastCalledWith(expect.any(String), 'success');
  });
});

describe('Reservas — diálogos accesibles', () => {
  it('es un diálogo modal con su título; el foco entra, Escape lo cierra y el foco vuelve al botón', async () => {
    const { user } = await montar();
    const boton = screen.getByRole('button', { name: 'Cancelar reserva' });
    await user.click(boton);

    const caja = screen.getByRole('dialog', { name: 'Cancelar la reserva' });
    expect(caja).toHaveAttribute('aria-modal', 'true');
    expect(caja).toContainElement(document.activeElement);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(boton).toHaveFocus();
  });

  it('el paso de confirmación de la cancelación también tiene el foco dentro, y la "X" lo cierra todo', async () => {
    const { user } = await montar();
    const boton = screen.getByRole('button', { name: 'Cancelar reserva' });
    await user.click(boton);
    await user.type(dialogo().getByLabelText('Motivo de la cancelación'), 'Avería');
    await user.click(dialogo().getByRole('button', { name: 'Revisar' }));

    expect(screen.getByRole('dialog', { name: '¿Cancelar la reserva?' })).toContainElement(document.activeElement);
    await user.click(dialogo().getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(boton).toHaveFocus();
  });
});

describe('Reservas — altas en el calendario', () => {
  const abrirAlta = async (boton, opciones) => {
    const datos = await montar(opciones);
    await datos.user.click(screen.getByRole('button', { name: boton }));
    return datos;
  };

  it('"Bloquear fechas": la pieza sale del inventario, se comprueba antes de mandar y el 409 sale tal cual', async () => {
    crearEnCalendarioAdmin
      .mockResolvedValueOnce(falla('Choca con la reserva A1B2C3D4 (del 02/11/2026 al 05/11/2026).', 409))
      .mockResolvedValueOnce({ data: { reserva: BLOQUEO }, error: null, status: 201 });
    const { user } = await abrirAlta('Bloquear fechas');

    expect(screen.getByRole('dialog', { name: 'Bloquear fechas' })).toBeInTheDocument();
    const pieza = dialogo().getByLabelText('Pieza');
    expect([...pieza.options].map((o) => o.textContent)).toEqual(['Elige una pieza', 'Silla Tolix (NAV-SIL-001)', 'Lámpara antigua']);
    expect(dialogo().getByLabelText('Primer día bloqueado')).toHaveValue(HOY);
    expect(dialogo().getByLabelText('Libre de nuevo el')).toHaveAccessibleDescription('El primer día que se puede volver a reservar.');
    expect(dialogo().getByLabelText('Motivo')).toHaveAttribute('placeholder', 'Mantenimiento, exposición…');

    await user.click(dialogo().getByRole('button', { name: 'Bloquear fechas' }));
    expect(dialogo().getByRole('alert')).toHaveTextContent('Elige la pieza.');

    await user.selectOptions(pieza, 'm3');
    fireEvent.change(dialogo().getByLabelText('Primer día bloqueado'), { target: { value: '2026-11-02' } });
    fireEvent.change(dialogo().getByLabelText('Libre de nuevo el'), { target: { value: '2026-11-02' } });
    await user.click(dialogo().getByRole('button', { name: 'Bloquear fechas' }));
    expect(dialogo().getByRole('alert')).toHaveTextContent('El día en que vuelve a estar libre tiene que ser posterior al primer día bloqueado.');

    fireEvent.change(dialogo().getByLabelText('Libre de nuevo el'), { target: { value: '2026-11-05' } });
    await user.type(dialogo().getByLabelText('Motivo'), 'Exposición');
    await user.click(dialogo().getByRole('button', { name: 'Bloquear fechas' }));
    expect(crearEnCalendarioAdmin).toHaveBeenCalledWith('bloqueo', {
      mueble_id: 'm3',
      fecha_inicio: '2026-11-02',
      fecha_fin: '2026-11-05',
      motivo: 'Exposición'
    });
    expect(dialogo().getByRole('alert')).toHaveTextContent('Choca con la reserva A1B2C3D4 (del 02/11/2026 al 05/11/2026).');
    expect(getReservasAdmin).toHaveBeenCalledTimes(1);

    await user.click(dialogo().getByRole('button', { name: 'Bloquear fechas' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(showToast).toHaveBeenCalledWith('Fechas bloqueadas', 'success');
    await waitFor(() => expect(getReservasAdmin).toHaveBeenCalledTimes(2));
    expect(getReservasAdmin).toHaveBeenLastCalledWith({ vista: 'proximas' });
  });

  it('"Registrar alquiler": fechas, horas, modos, contacto, importe en céntimos, contrato y entrega hecha', async () => {
    crearEnCalendarioAdmin.mockResolvedValue({ data: { reserva: ALQUILER }, error: null, status: 201 });
    const { user } = await abrirAlta('Registrar alquiler fuera de la web');
    const d = dialogo();

    expect(screen.getByRole('dialog', { name: 'Registrar alquiler fuera de la web' })).toBeInTheDocument();
    await user.selectOptions(d.getByLabelText('Pieza'), 'm1');
    await user.selectOptions(d.getByLabelText('Contrato'), 'legacy');
    fireEvent.change(d.getByLabelText('Día de entrega'), { target: { value: '2026-09-01' } });
    await user.selectOptions(d.getByLabelText('Hora de entrega'), '09:30');
    await user.selectOptions(d.getByLabelText('Entrega'), 'tienda');
    fireEvent.change(d.getByLabelText('Día de recogida'), { target: { value: '2026-12-01' } });
    await user.selectOptions(d.getByLabelText('Hora de recogida'), '19:00');
    expect(d.getByLabelText('Recogida')).toHaveValue('domicilio');
    await user.type(d.getByLabelText('Teléfono'), '600111222');
    await user.type(d.getByLabelText('Email'), 'ana@example.com');
    await user.type(d.getByLabelText('Dirección'), 'Calle Mayor 1');
    await user.type(d.getByLabelText('Notas'), 'Contrato en papel');
    await user.type(d.getByLabelText('Importe total (€)'), '300,5');
    await user.click(d.getByLabelText('Ya está entregada (el cliente ya tiene la pieza)'));

    await user.click(d.getByRole('button', { name: 'Registrar alquiler' }));
    expect(d.getByRole('alert')).toHaveTextContent('Escribe el nombre del cliente.');

    await user.type(d.getByLabelText('Nombre del cliente'), 'Ana Pérez');
    await user.click(d.getByRole('button', { name: 'Registrar alquiler' }));
    expect(crearEnCalendarioAdmin).toHaveBeenCalledWith('alquiler', {
      mueble_id: 'm1',
      fecha_inicio: '2026-09-01',
      hora_entrega: '09:30',
      fecha_fin: '2026-12-01',
      hora_recogida: '19:00',
      modo_entrega: 'tienda',
      modo_devolucion: 'domicilio',
      contacto: { nombre: 'Ana Pérez', telefono: '600111222', email: 'ana@example.com', direccion: 'Calle Mayor 1', notas: 'Contrato en papel' },
      importe_total_centimos: 30050,
      origen: 'legacy',
      ya_entregado: true
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(showToast).toHaveBeenCalledWith('Alquiler registrado', 'success');
  });

  it('"Registrar alquiler" a domicilio pide la dirección; en tienda no hace falta, y sin importe no se manda', async () => {
    crearEnCalendarioAdmin.mockResolvedValue({ data: { reserva: ALQUILER }, error: null, status: 201 });
    const { user } = await abrirAlta('Registrar alquiler fuera de la web');
    const d = dialogo();
    await user.selectOptions(d.getByLabelText('Pieza'), 'm3');
    fireEvent.change(d.getByLabelText('Día de recogida'), { target: { value: '2026-10-20' } });
    await user.type(d.getByLabelText('Nombre del cliente'), 'Luis');

    await user.click(d.getByRole('button', { name: 'Registrar alquiler' }));
    expect(d.getByRole('alert')).toHaveTextContent('Escribe la dirección para la entrega o la recogida a domicilio.');
    expect(crearEnCalendarioAdmin).not.toHaveBeenCalled();

    await user.selectOptions(d.getByLabelText('Entrega'), 'tienda');
    await user.selectOptions(d.getByLabelText('Recogida'), 'tienda');
    await user.click(d.getByRole('button', { name: 'Registrar alquiler' }));
    expect(crearEnCalendarioAdmin).toHaveBeenCalledWith('alquiler', {
      mueble_id: 'm3',
      fecha_inicio: HOY,
      hora_entrega: '10:00',
      fecha_fin: '2026-10-20',
      hora_recogida: '10:00',
      modo_entrega: 'tienda',
      modo_devolucion: 'tienda',
      contacto: { nombre: 'Luis' },
      origen: 'manual',
      ya_entregado: false
    });
  });

  it('"Registrar alquiler" ya entregado que empieza después de hoy: no se manda; con la entrega de hoy, sí', async () => {
    crearEnCalendarioAdmin.mockResolvedValue({ data: { reserva: ALQUILER }, error: null, status: 201 });
    const { user } = await abrirAlta('Registrar alquiler fuera de la web');
    const d = dialogo();
    await user.selectOptions(d.getByLabelText('Pieza'), 'm3');
    fireEvent.change(d.getByLabelText('Día de entrega'), { target: { value: '2026-10-14' } });
    fireEvent.change(d.getByLabelText('Día de recogida'), { target: { value: '2026-10-20' } });
    await user.type(d.getByLabelText('Nombre del cliente'), 'Luis');
    await user.selectOptions(d.getByLabelText('Entrega'), 'tienda');
    await user.selectOptions(d.getByLabelText('Recogida'), 'tienda');
    await user.click(d.getByLabelText('Ya está entregada (el cliente ya tiene la pieza)'));

    await user.click(d.getByRole('button', { name: 'Registrar alquiler' }));
    expect(d.getByRole('alert')).toHaveTextContent('Un alquiler ya entregado no puede empezar después de hoy.');
    expect(crearEnCalendarioAdmin).not.toHaveBeenCalled();

    fireEvent.change(d.getByLabelText('Día de entrega'), { target: { value: HOY } });
    await user.click(d.getByRole('button', { name: 'Registrar alquiler' }));
    expect(crearEnCalendarioAdmin).toHaveBeenCalledWith('alquiler', expect.objectContaining({ fecha_inicio: HOY, ya_entregado: true }));
  });

  it('"Registrar venta": explica la entrega diferida y manda pieza, fecha y motivo', async () => {
    crearEnCalendarioAdmin.mockResolvedValue({ data: { reserva: BLOQUEO }, error: null, status: 201 });
    const { user } = await abrirAlta('Registrar venta fuera de la web');
    const d = dialogo();

    expect(screen.getByRole('dialog', { name: 'Registrar venta fuera de la web' })).toBeInTheDocument();
    expect(d.getByText(/también para una venta con entrega diferida/)).toBeInTheDocument();
    expect(d.getByLabelText('Fecha de la venta')).toHaveAccessibleDescription(
      'Con entrega diferida, el primer día que la pieza queda libre después de sus alquileres.'
    );
    expect(d.queryByLabelText('Libre de nuevo el')).toBeNull();
    expect(d.getByLabelText('Motivo')).toHaveAttribute('placeholder', 'Venta en tienda, entrega diferida…');

    await user.selectOptions(d.getByLabelText('Pieza'), 'm1');
    fireEvent.change(d.getByLabelText('Fecha de la venta'), { target: { value: '2026-11-05' } });
    await user.type(d.getByLabelText('Motivo'), 'Venta en tienda, ticket 123');
    await user.click(d.getByRole('button', { name: 'Registrar venta' }));

    expect(crearEnCalendarioAdmin).toHaveBeenCalledWith('venta', {
      mueble_id: 'm1',
      fecha_inicio: '2026-11-05',
      motivo: 'Venta en tienda, ticket 123'
    });
    expect(showToast).toHaveBeenCalledWith('Venta registrada', 'success');
  });

  it('sin haber cargado la lista, la fecha de inicio es la de hoy según el reloj', async () => {
    getReservasAdmin.mockResolvedValue(falla('No se han podido cargar las reservas.', 500));
    const user = userEvent.setup();
    await act(async () => {
      render(
        <ToastContext.Provider value={{ showToast }}>
          <ReservasTab muebles={MUEBLES} />
        </ToastContext.Provider>
      );
    });
    await user.click(screen.getByRole('button', { name: 'Registrar venta fuera de la web' }));
    expect(dialogo().getByLabelText('Fecha de la venta')).toHaveValue(HOY);
  });

  it('un alta mientras se guarda: un segundo envío no sale, y el botón dice "Guardando…"', async () => {
    const respuesta = diferida();
    crearEnCalendarioAdmin.mockReturnValue(respuesta.promesa);
    const { user } = await abrirAlta('Registrar venta fuera de la web');
    await user.selectOptions(dialogo().getByLabelText('Pieza'), 'm1');
    await user.type(dialogo().getByLabelText('Motivo'), 'Venta en tienda');
    const formulario = screen.getByRole('dialog').querySelector('form');

    fireEvent.submit(formulario);
    fireEvent.submit(formulario);
    expect(crearEnCalendarioAdmin).toHaveBeenCalledTimes(1);
    expect(dialogo().getByRole('button', { name: 'Guardando…' })).toBeDisabled();
    await act(async () => respuesta.resolver({ data: { reserva: BLOQUEO }, error: null, status: 201 }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('si se cierra un alta mientras guarda, el 409 sale en un aviso', async () => {
    const respuesta = diferida();
    crearEnCalendarioAdmin.mockReturnValue(respuesta.promesa);
    const { user } = await abrirAlta('Registrar venta fuera de la web');
    await user.selectOptions(dialogo().getByLabelText('Pieza'), 'm1');
    await user.type(dialogo().getByLabelText('Motivo'), 'Venta en tienda');
    await user.click(dialogo().getByRole('button', { name: 'Registrar venta' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();

    await act(async () => respuesta.resolver(falla('Choca con la reserva A1B2C3D4 (del 15/10/2026 al 22/10/2026).', 409)));
    expect(showToast).toHaveBeenCalledWith('Choca con la reserva A1B2C3D4 (del 15/10/2026 al 22/10/2026).', 'error');
    // y se queda arriba, que no hay tarjeta donde ponerlo
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Registrar venta fuera de la web: Choca con la reserva A1B2C3D4 (del 15/10/2026 al 22/10/2026).'
    );
    expect(screen.getByRole('alert')).toHaveClass('reservas-aviso-general');
    expect(showToast).not.toHaveBeenCalledWith('Venta registrada', 'success');
    expect(getReservasAdmin).toHaveBeenCalledTimes(1);
  });

  it('el aviso de un alta cerrada a mitad de petición va aparte del de un reembolso a medias: ni lo pisa ni lo borra otro reintento, y abrir otra alta lo quita', async () => {
    const MENSAJE_502 = 'La reserva se ha cancelado, pero el reembolso se ha quedado a medias.';
    const alta = diferida();
    crearEnCalendarioAdmin.mockReturnValue(alta.promesa);
    accionReservaAdmin
      .mockResolvedValueOnce(falla(MENSAJE_502, 502, 'reembolso_a_medias'))
      .mockResolvedValueOnce(ok({ reserva: { ...A_MEDIAS, reembolso_a_medias: false, acciones: [] } }));
    getReservasAdmin.mockResolvedValue(ok({ hoy: HOY, reservas: [A_MEDIAS] }));
    const { user } = await montar({ reservas: [A_MEDIAS] });
    await user.click(screen.getByRole('button', { name: 'Reintentar reembolso' }));
    await user.click(dialogo().getByRole('button', { name: 'Reintentar reembolso' }));
    expect(await screen.findByText(/Está en «Reembolsos a medias»/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Registrar venta fuera de la web' }));
    await user.selectOptions(dialogo().getByLabelText('Pieza'), 'm1');
    await user.type(dialogo().getByLabelText('Motivo'), 'Venta en tienda');
    await user.click(dialogo().getByRole('button', { name: 'Registrar venta' }));
    await user.keyboard('{Escape}');
    await act(async () => alta.resolver(falla('Choca con la reserva A1B2C3D4 (del 15/10/2026 al 22/10/2026).', 409)));

    // Dos avisos, cada uno con su «Entendido»: el del alta no sustituye al del reembolso
    expect(screen.getAllByRole('alert').map((a) => a.textContent)).toEqual([
      expect.stringContaining(`${MENSAJE_502} Está en «Reembolsos a medias».`),
      'Registrar venta fuera de la web: Choca con la reserva A1B2C3D4 (del 15/10/2026 al 22/10/2026).Entendido'
    ]);

    // Un reintento bien hecho quita el del reembolso, no el del alta
    await user.click(await screen.findByRole('button', { name: 'Reintentar reembolso' }));
    await user.click(dialogo().getByRole('button', { name: 'Reintentar reembolso' }));
    await waitFor(() => expect(screen.queryByText(/Está en «Reembolsos a medias»/)).toBeNull());
    expect(screen.getByRole('alert')).toHaveTextContent(/^Registrar venta fuera de la web: Choca con/);

    // Abrir otra alta quita el aviso del anterior
    await user.click(screen.getByRole('button', { name: 'Bloquear fechas' }));
    expect(screen.queryByText(/^Registrar venta fuera de la web: Choca/)).toBeNull();
  });

  it('el aviso de un alta cerrada también se puede descartar con «Entendido»', async () => {
    const respuesta = diferida();
    crearEnCalendarioAdmin.mockReturnValue(respuesta.promesa);
    const { user } = await abrirAlta('Bloquear fechas');
    await user.selectOptions(dialogo().getByLabelText('Pieza'), 'm1');
    fireEvent.change(dialogo().getByLabelText('Primer día bloqueado'), { target: { value: '2026-11-02' } });
    fireEvent.change(dialogo().getByLabelText('Libre de nuevo el'), { target: { value: '2026-11-05' } });
    await user.type(dialogo().getByLabelText('Motivo'), 'Mantenimiento');
    await user.click(dialogo().getByRole('button', { name: 'Bloquear fechas' }));
    await user.keyboard('{Escape}');
    await act(async () => respuesta.resolver(falla('Choca con la reserva A1B2C3D4.', 409)));
    expect(screen.getByRole('alert')).toHaveTextContent('Bloquear fechas: Choca con la reserva A1B2C3D4.');

    await user.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('un alta que falla sin respuesta del servidor (red, 500) avisa de que pudo guardarse, en el diálogo o en el aviso; un 400 no', async () => {
    const PUDO = ' Puede que sí se haya guardado: pulsa «Actualizar» y mira cómo ha quedado antes de repetirlo.';
    crearEnCalendarioAdmin
      .mockResolvedValueOnce(falla('No se pudo conectar con el servidor. Revisa tu conexión.', 0))
      .mockResolvedValueOnce(falla('No se ha podido guardar en el calendario.', 500))
      .mockResolvedValueOnce(falla('Revisa los datos.', 400));
    const { user } = await abrirAlta('Registrar venta fuera de la web');
    await user.selectOptions(dialogo().getByLabelText('Pieza'), 'm1');
    await user.type(dialogo().getByLabelText('Motivo'), 'Venta en tienda');
    const enviar = () => user.click(dialogo().getByRole('button', { name: 'Registrar venta' }));

    await enviar();
    expect(dialogo().getByRole('alert')).toHaveTextContent(`No se pudo conectar con el servidor. Revisa tu conexión.${PUDO}`);
    await enviar();
    expect(dialogo().getByRole('alert')).toHaveTextContent(`No se ha podido guardar en el calendario.${PUDO}`);
    await enviar();
    expect(dialogo().getByRole('alert')).toHaveTextContent(/^Revisa los datos\.$/);
  });

  it('"Volver" cierra el alta sin mandar nada, y el foco vuelve al botón', async () => {
    const { user } = await abrirAlta('Bloquear fechas');
    await user.click(dialogo().getByRole('button', { name: 'Volver' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Bloquear fechas' })).toHaveFocus();
    expect(crearEnCalendarioAdmin).not.toHaveBeenCalled();
  });
});

// Lo que se añadió el 20 oct 2026 tras revisar las capturas: qué hay en cada vista, los números de las
// vistas que piden atención (vienen del contenedor, que también los pone en la barra lateral) y el
// aviso de que la lista se ha movido después de una acción.
describe('Reservas — descripciones, números de aviso y lista movida', () => {
  const RESUMEN = { hoy: HOY, total: 3, retrasadas: 2, en_conflicto: 1, reembolsos_a_medias: 0 };

  it('bajo los botones, lo que hay en la vista elegida; cambia con ella', async () => {
    const { user } = await montar({ reservas: [] });
    const ayuda = () => document.querySelector('.reservas-vista-ayuda').textContent;

    expect(ayuda()).toMatch(/^Todo lo que ocupa el calendario de hoy en adelante/);
    await user.click(screen.getByRole('button', { name: 'Retrasadas' }));
    expect(ayuda()).toMatch(/^Alquileres entregados cuya recogida prevista ya pasó\./);
    await user.click(screen.getByRole('button', { name: 'En conflicto' }));
    expect(ayuda()).toMatch(/^Reservas pagadas que no se pudieron confirmar/);
    await user.click(screen.getByRole('button', { name: 'Reembolsos a medias' }));
    expect(ayuda()).toMatch(/^Reservas canceladas cuyo reembolso no consta hecho en Stripe/);
    await user.click(screen.getByRole('button', { name: 'Todas' }));
    expect(ayuda()).toBe('Las más recientes de cualquier tipo y estado, hasta 200.');
  });

  it('con el resumen, el número va en las vistas de aviso que tienen algo, y solo en ellas', async () => {
    await montar({ reservas: [], props: { resumen: RESUMEN } });
    const grupo = within(screen.getByRole('group', { name: 'Qué reservas ver' }));

    expect(grupo.getByRole('button', { name: 'Retrasadas 2' })).toBeInTheDocument();
    expect(grupo.getByRole('button', { name: 'En conflicto 1' })).toBeInTheDocument();
    // A cero no sale (un «0» en cada botón sería ruido), ni en las vistas de trabajo del día.
    expect(grupo.getByRole('button', { name: 'Reembolsos a medias' })).toBeInTheDocument();
    expect(grupo.getByRole('button', { name: 'Próximas' })).toBeInTheDocument();
    expect(document.querySelectorAll('.reservas-vista-n')).toHaveLength(2);
  });

  it('sin resumen (apagado, sin cargar o con error) no hay números', async () => {
    await montar({ reservas: [] });
    expect(document.querySelector('.reservas-vista-n')).toBeNull();
  });

  it('tras una acción, la tarjeta se queda con su estado y sale el aviso; "Actualizar la lista" lo quita', async () => {
    const alCambiar = vi.fn();
    accionReservaAdmin.mockResolvedValue(
      ok({ reserva: { ...RETRASADA, estado: 'devuelta', etiqueta: 'Devuelta', retrasada: false, acciones: [] } })
    );
    const { user } = await montar({ reservas: [RETRASADA], props: { alCambiar } });
    expect(screen.queryByText(/Has cambiado una reserva/)).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Marcar recogida' }));
    await user.click(dialogo().getByRole('button', { name: 'Marcar recogida' }));

    expect(tarjeta('Mesa de roble').getByText('Devuelta')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Has cambiado una reserva. Actualiza la lista para quitar de esta vista las que ya no encajan.'
    );
    expect(alCambiar).toHaveBeenCalledTimes(1);
    expect(getReservasAdmin).toHaveBeenCalledTimes(1);

    getReservasAdmin.mockResolvedValue(ok({ hoy: HOY, reservas: [] }));
    await user.click(screen.getByRole('button', { name: 'Actualizar la lista' }));
    expect(await screen.findByText('No hay reservas próximas.')).toBeInTheDocument();
    expect(screen.queryByText(/Has cambiado una reserva/)).toBeNull();
    expect(getReservasAdmin).toHaveBeenCalledTimes(2);
    expect(alCambiar).toHaveBeenCalledTimes(2);
  });

  it('el botón «Actualizar» de arriba también quita el aviso y avisa al contenedor', async () => {
    const alCambiar = vi.fn();
    accionReservaAdmin.mockResolvedValue(ok({ reserva: { ...BLOQUEO, estado: 'cancelada', etiqueta: 'Cancelada', acciones: [] } }));
    const { user } = await montar({ reservas: [BLOQUEO], props: { alCambiar } });
    await user.click(screen.getByRole('button', { name: 'Levantar bloqueo' }));
    expect(screen.getByText(/Has cambiado una reserva/)).toBeInTheDocument();
    alCambiar.mockClear();

    await user.click(screen.getByRole('button', { name: 'Actualizar' }));
    await waitFor(() => expect(screen.queryByText(/Has cambiado una reserva/)).toBeNull());
    expect(alCambiar).toHaveBeenCalledTimes(1);
  });

  it('si la acción falla no cambia nada: ni aviso de lista movida ni aviso al contenedor', async () => {
    const alCambiar = vi.fn();
    accionReservaAdmin.mockResolvedValue(falla('No se ha podido completar la acción.', 400));
    const { user } = await montar({ reservas: [BLOQUEO], props: { alCambiar } });
    await user.click(screen.getByRole('button', { name: 'Levantar bloqueo' }));

    expect(await screen.findByText('No se ha podido completar la acción.')).toBeInTheDocument();
    expect(screen.queryByText(/Has cambiado una reserva/)).toBeNull();
    expect(alCambiar).not.toHaveBeenCalled();
  });

  it('una acción hecha con el reembolso a medias también avisa al contenedor, que cuenta un aviso más', async () => {
    const alCambiar = vi.fn();
    accionReservaAdmin.mockResolvedValue({
      data: null,
      error: 'La reserva está cancelada, pero el reembolso no se ha podido hacer.',
      status: 502,
      codigo: 'reembolso_a_medias'
    });
    const { user } = await montar({ reservas: [ALQUILER], props: { alCambiar } });
    await user.click(screen.getByRole('button', { name: 'Cancelar reserva' }));
    await user.type(dialogo().getByLabelText('Motivo de la cancelación'), 'No puede');
    await user.click(dialogo().getByRole('button', { name: 'Revisar' }));
    await user.click(dialogo().getByRole('button', { name: 'Cancelar la reserva' }));

    await waitFor(() => expect(alCambiar).toHaveBeenCalledTimes(1));
  });

  it('un alta en el calendario recarga la lista y avisa al contenedor, sin el aviso de lista movida', async () => {
    const alCambiar = vi.fn();
    crearEnCalendarioAdmin.mockResolvedValue({ data: { reserva: BLOQUEO }, error: null, status: 201 });
    const { user } = await montar({ reservas: [], props: { alCambiar } });
    await user.click(screen.getByRole('button', { name: 'Bloquear fechas' }));
    await user.selectOptions(dialogo().getByLabelText('Pieza'), 'm3');
    fireEvent.change(dialogo().getByLabelText('Libre de nuevo el'), { target: { value: '2026-11-05' } });
    await user.type(dialogo().getByLabelText('Motivo'), 'Exposición');
    await user.click(dialogo().getByRole('button', { name: 'Bloquear fechas' }));

    await waitFor(() => expect(alCambiar).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(getReservasAdmin).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(/Has cambiado una reserva/)).toBeNull();
  });
});
