// Ayudantes de la pestaña "Reservas" del panel (reservasAdmin.js). Tests nuevos, no de caracterización.
import { describe, it, expect } from 'vitest';
import { eurosDeCentimos } from '../../utils/reservas';
import {
  VISTAS,
  ETIQUETA_ACCION,
  etiquetaAccion,
  ORIGEN,
  horaCorta,
  momento,
  centimosDeEuros,
  centimosDeTexto,
  textoDeCentimos,
  diaEnMadrid,
  hoyMasReciente,
  datosReserva,
  maximoReembolso,
  validarCancelacion,
  limitesRecogida,
  validarRecogida,
  camposAlta,
  validarAlta,
  datosAlta
} from './reservasAdmin';

const ALQUILER = {
  tipo: 'alquiler',
  fecha_inicio: '2026-10-15',
  hora_entrega: '10:00:00',
  fecha_fin: '2026-10-20',
  hora_recogida: '18:30',
  fin_ocupacion: '2026-10-22',
  dias_margen: 2,
  modo_entrega: 'domicilio',
  modo_devolucion: 'tienda',
  direccion_entrega: 'Calle Mayor 1, Barcelona',
  importe_total: 120.5,
  pagado: true,
  reembolso: { importe: 60, solicitado_en: '2026-10-12T09:00:00Z', stripe_refund_id: 're_1' },
  motivo: 'Contrato Legacy en revisión',
  motivo_cancelacion: 'No puede recibirla',
  entregada_en: '2026-10-15T08:30:00Z',
  devuelta_en: '2026-10-21T16:00:00Z'
};

describe('Reservas del panel — textos fijos', () => {
  it('las vistas, en orden, con el valor de ?vista= y su texto', () => {
    expect(VISTAS.map((v) => v.id)).toEqual([
      'proximas', 'entregas', 'recogidas', 'retrasadas', 'conflicto', 'reembolsos', 'legacy', 'todas'
    ]);
    expect(VISTAS.map((v) => v.etiqueta)).toEqual([
      'Próximas', 'Entregas hoy y mañana', 'Recogidas hoy y mañana', 'Retrasadas', 'En conflicto',
      'Reembolsos a medias', 'Contratos antiguos', 'Todas'
    ]);
    expect(VISTAS.every((v) => v.vacia.endsWith('.'))).toBe(true);
  });

  it('un botón por cada acción conocida, y una marca para lo que no viene de la web', () => {
    expect(Object.keys(ETIQUETA_ACCION)).toEqual([
      'entregar', 'recoger', 'ampliar', 'cancelar', 'reintentar-reembolso', 'dar-por-reembolsado', 'levantar-bloqueo'
    ]);
    expect(ETIQUETA_ACCION['dar-por-reembolsado']).toBe('Dar por reembolsado');
    expect(ORIGEN).toEqual({ manual: 'Fuera de la web', legacy: 'Contrato antiguo' });
  });

  it('etiquetaAccion: cancelar una venta dice "Cancelar venta"; lo demás, su texto de siempre', () => {
    expect(etiquetaAccion({ tipo: 'venta' }, 'cancelar')).toBe('Cancelar venta');
    expect(etiquetaAccion({ tipo: 'alquiler' }, 'cancelar')).toBe('Cancelar reserva');
    expect(etiquetaAccion({ tipo: 'bloqueo' }, 'levantar-bloqueo')).toBe('Levantar bloqueo');
    expect(etiquetaAccion({ tipo: 'venta' }, 'entregar')).toBe('Marcar entregada');
  });
});

describe('Reservas del panel — horas, fechas e importes', () => {
  it('horaCorta deja HH:MM', () => {
    expect(horaCorta('10:00:00')).toBe('10:00');
    expect(horaCorta('09:30')).toBe('09:30');
  });

  it('momento: fecha, hora y modo, cada parte solo si la hay', () => {
    expect(momento('2026-10-15', '10:00:00', 'domicilio')).toBe('15/10/2026 a las 10:00, a domicilio');
    expect(momento('2026-10-15', null, 'tienda')).toBe('15/10/2026, en tienda');
    expect(momento('2026-10-15', '18:30', null)).toBe('15/10/2026 a las 18:30');
    expect(momento('2026-10-15')).toBe('15/10/2026');
  });

  it('centimosDeEuros redondea sin errores de coma flotante', () => {
    expect(centimosDeEuros(120.5)).toBe(12050);
    expect(centimosDeEuros(19.99)).toBe(1999);
    expect(centimosDeEuros(0.07)).toBe(7);
  });

  it('centimosDeTexto entiende coma o punto, y rechaza lo que no es un importe', () => {
    expect(centimosDeTexto('120')).toBe(12000);
    expect(centimosDeTexto('120,5')).toBe(12050);
    expect(centimosDeTexto('120.50')).toBe(12050);
    expect(centimosDeTexto(' 1 200,05 ')).toBe(120005);
    expect(centimosDeTexto('0')).toBe(0);
    expect(centimosDeTexto('0,07')).toBe(7);
    for (const malo of ['', 'abc', '-5', '1,234', '1.234,50', '12,', ',5', '5 €']) {
      expect(centimosDeTexto(malo)).toBeNull();
    }
  });

  it('textoDeCentimos, para el valor inicial de un campo', () => {
    expect(textoDeCentimos(12050)).toBe('120,50');
    expect(textoDeCentimos(5)).toBe('0,05');
    expect(textoDeCentimos(0)).toBe('0,00');
  });
});

describe('Reservas del panel — datos de una tarjeta', () => {
  it('un alquiler con todo: entrega, recogida, ampliación, margen, dirección, importe, reembolso, motivos y fechas reales', () => {
    expect(datosReserva(ALQUILER)).toEqual([
      ['Entrega prevista', '15/10/2026 a las 10:00, a domicilio'],
      ['Recogida prevista', '20/10/2026 a las 18:30, en tienda'],
      ['Ocupación ampliada hasta', '22/10/2026'],
      ['Margen', '2 días después de la recogida'],
      ['Dirección de entrega', 'Calle Mayor 1, Barcelona'],
      ['Importe', `${eurosDeCentimos(12050)}, pagado`],
      ['Reembolso', `${eurosDeCentimos(6000)}, solicitado el 12/10/2026, 11:00, hecho en Stripe`],
      ['Motivo', 'Contrato Legacy en revisión'],
      ['Motivo de la cancelación', 'No puede recibirla'],
      ['Entregada el', '15/10/2026, 10:30'],
      ['Recogida el', '21/10/2026, 18:00']
    ]);
  });

  it('un alquiler sin ampliar, sin margen, sin pagar en la web y con el reembolso sin confirmar', () => {
    const filas = datosReserva({
      ...ALQUILER,
      fin_ocupacion: ALQUILER.fecha_fin,
      dias_margen: 0,
      direccion_entrega: null,
      pagado: false,
      reembolso: { ...ALQUILER.reembolso, stripe_refund_id: null },
      reembolso_a_medias: true,
      motivo: null,
      motivo_cancelacion: null,
      entregada_en: null,
      devuelta_en: null
    });
    expect(filas.map(([etiqueta]) => etiqueta)).toEqual(['Entrega prevista', 'Recogida prevista', 'Importe', 'Reembolso']);
    expect(filas[2][1]).toBe(`${eurosDeCentimos(12050)}, sin pago en la web`);
    expect(filas[3][1]).toMatch(/sin confirmar en Stripe$/);
  });

  it('un reembolso sin id de Stripe que ya no está a medias se dio por hecho fuera del panel', () => {
    const filas = datosReserva({ ...ALQUILER, reembolso: { ...ALQUILER.reembolso, stripe_refund_id: null }, reembolso_a_medias: false });
    expect(filas).toContainEqual([
      'Reembolso',
      `${eurosDeCentimos(6000)}, solicitado el 12/10/2026, 11:00, dado por reembolsado (hecho fuera del panel)`
    ]);
  });

  it('el importe dice qué pasó con el pago: pendiente, no se pagó o sin pago en la web', () => {
    const importe = (cambios) => datosReserva({ ...ALQUILER, reembolso: null, ...cambios }).find(([e]) => e === 'Importe')[1];
    expect(importe({ pagado: false, estado: 'pendiente' })).toBe(`${eurosDeCentimos(12050)}, pendiente de pago`);
    expect(importe({ pagado: false, estado: 'expirada' })).toBe(`${eurosDeCentimos(12050)}, no se pagó`);
    expect(importe({ pagado: false, estado: 'confirmada' })).toBe(`${eurosDeCentimos(12050)}, sin pago en la web`);
  });

  it('las horas salen en hora de Madrid, también en verano (UTC+2) y con la fecha completa', () => {
    const filas = datosReserva({ ...ALQUILER, entregada_en: '2026-07-15T08:30:00Z', devuelta_en: '2026-12-21T16:00:00Z' });
    expect(filas).toContainEqual(['Entregada el', '15/07/2026, 10:30']);
    expect(filas).toContainEqual(['Recogida el', '21/12/2026, 17:00']);
  });

  it('un margen de 1 día va en singular, y un importe de 0 € se enseña', () => {
    const filas = datosReserva({ ...ALQUILER, dias_margen: 1, importe_total: 0, reembolso: null });
    expect(filas).toContainEqual(['Margen', '1 día después de la recogida']);
    expect(filas).toContainEqual(['Importe', `${eurosDeCentimos(0)}, pagado`]);
  });

  it('un bloqueo: desde cuándo y cuándo vuelve a estar libre, y el motivo', () => {
    expect(
      datosReserva({ tipo: 'bloqueo', fecha_inicio: '2026-11-02', fecha_fin: '2026-11-05', importe_total: null, motivo: 'Exposición' })
    ).toEqual([
      ['Desde', '02/11/2026'],
      ['Libre de nuevo', '05/11/2026'],
      ['Motivo', 'Exposición']
    ]);
  });

  it('una venta: solo desde cuándo (no tiene fin)', () => {
    expect(datosReserva({ tipo: 'venta', fecha_inicio: '2026-12-01', fecha_fin: null, importe_total: null })).toEqual([
      ['Desde', '01/12/2026']
    ]);
  });
});

describe('Reservas del panel — recogida', () => {
  it('limitesRecogida: desde el día de la entrega hasta hoy', () => {
    expect(limitesRecogida({ fecha_inicio: '2026-10-01' }, '2026-10-13')).toEqual({ minimo: '2026-10-01', maximo: '2026-10-13' });
    expect(limitesRecogida({ fecha_inicio: '2026-10-13' }, '2026-10-13')).toEqual({ minimo: '2026-10-13', maximo: '2026-10-13' });
  });

  it('limitesRecogida: si aún empieza después de hoy, el mínimo pasa del máximo; sin saber qué día es hoy, sin máximo', () => {
    expect(limitesRecogida({ fecha_inicio: '2026-10-15' }, '2026-10-13')).toEqual({ minimo: '2026-10-15', maximo: '2026-10-13' });
    expect(limitesRecogida({ fecha_inicio: '2026-10-15' }, null)).toEqual({ minimo: '2026-10-15', maximo: null });
  });

  it('limitesRecogida: el mínimo es el día de la entrega real en Madrid, si es posterior al previsto', () => {
    const reserva = { fecha_inicio: '2026-10-01', entregada_en: '2026-10-03T23:30:00Z' };
    expect(limitesRecogida(reserva, '2026-10-13')).toEqual({ minimo: '2026-10-04', maximo: '2026-10-13' });
    // Entregada el mismo día previsto, o antes de tiempo (el servidor ya mueve el inicio a ese día)
    expect(limitesRecogida({ ...reserva, entregada_en: '2026-10-01T08:00:00Z' }, '2026-10-13').minimo).toBe('2026-10-01');
    expect(limitesRecogida({ ...reserva, entregada_en: '2026-09-28T08:00:00Z' }, '2026-10-13').minimo).toBe('2026-10-01');
  });

  it('diaEnMadrid y hoyMasReciente: el día de Madrid, no el de UTC; manda el más reciente', () => {
    expect(diaEnMadrid('2026-10-13T23:30:00Z')).toBe('2026-10-14');
    expect(diaEnMadrid('2026-10-13T21:30:00Z')).toBe('2026-10-13');
    expect(diaEnMadrid('2026-01-13T23:30:00Z')).toBe('2026-01-14');
    const ahora = new Date('2026-10-13T10:00:00Z');
    expect(hoyMasReciente('2026-10-13', ahora)).toBe('2026-10-13');
    expect(hoyMasReciente('2026-10-12', ahora)).toBe('2026-10-13');
    expect(hoyMasReciente(null, ahora)).toBe('2026-10-13');
    // Un servidor por delante del reloj local manda el servidor
    expect(hoyMasReciente('2026-10-14', ahora)).toBe('2026-10-14');
  });

  it('validarRecogida acepta los dos extremos y lo de en medio', () => {
    const limites = { minimo: '2026-10-01', maximo: '2026-10-13' };
    for (const fecha of ['2026-10-01', '2026-10-07', '2026-10-13']) expect(validarRecogida(fecha, limites)).toBe('');
  });

  it('validarRecogida rechaza lo de fuera, lo vacío y lo que no es una fecha', () => {
    const limites = { minimo: '2026-10-01', maximo: '2026-10-13' };
    for (const fecha of ['2026-09-30', '2026-10-14', '', '13/10/2026']) {
      expect(validarRecogida(fecha, limites)).toBe('Elige un día entre el 01/10/2026 y el 13/10/2026.');
    }
  });

  it('validarRecogida: si aún no se ha entregado el día previsto, no hay día posible', () => {
    const limites = { minimo: '2026-10-15', maximo: '2026-10-13' };
    for (const fecha of ['2026-10-13', '2026-10-15', '']) {
      expect(validarRecogida(fecha, limites)).toBe('Todavía no se puede recoger: la entrega es el 15/10/2026.');
    }
  });

  it('validarRecogida: con un solo día posible lo nombra; sin máximo, solo pide que no sea antes', () => {
    expect(validarRecogida('2026-10-12', { minimo: '2026-10-13', maximo: '2026-10-13' })).toBe('Elige el 13/10/2026.');
    expect(validarRecogida('2026-10-13', { minimo: '2026-10-13', maximo: '2026-10-13' })).toBe('');
    expect(validarRecogida('2026-09-30', { minimo: '2026-10-01', maximo: null })).toBe('Elige el 01/10/2026 o un día posterior.');
    expect(validarRecogida('2027-01-01', { minimo: '2026-10-01', maximo: null })).toBe('');
  });
});

describe('Reservas del panel — cancelación', () => {
  it('maximoReembolso: lo pagado en la web, o 0', () => {
    expect(maximoReembolso({ pagado: true, importe_total: 120.5 })).toBe(12050);
    expect(maximoReembolso({ pagado: false, importe_total: 120.5 })).toBe(0);
    expect(maximoReembolso({ pagado: true, importe_total: null })).toBe(0);
  });

  it('maximoReembolso de una venta es 0 aunque se pagara en la web (se reembolsa en Stripe)', () => {
    expect(maximoReembolso({ tipo: 'venta', pagado: true, importe_total: 450 })).toBe(0);
    expect(maximoReembolso({ tipo: 'alquiler', pagado: true, importe_total: 450 })).toBe(45000);
  });

  it('validarCancelacion pide motivo y un reembolso válido, como mucho lo pagado', () => {
    expect(validarCancelacion({ motivo: '  ', reembolso: '10' }, 12050)).toEqual({ error: 'Escribe el motivo de la cancelación.' });
    expect(validarCancelacion({ motivo: 'Avería', reembolso: 'diez' }, 12050)).toEqual({
      error: 'El reembolso no es válido. Escríbelo así: 120 o 120,50.'
    });
    expect(validarCancelacion({ motivo: 'Avería', reembolso: '120,51' }, 12050)).toEqual({
      error: `El reembolso no puede pasar de ${eurosDeCentimos(12050)}.`
    });
    expect(validarCancelacion({ motivo: 'Avería', reembolso: '120,50' }, 12050)).toEqual({ centimos: 12050 });
    expect(validarCancelacion({ motivo: 'Avería', reembolso: '0' }, 12050)).toEqual({ centimos: 0 });
  });

  it('sin nada pagado, el reembolso es 0 aunque el campo diga otra cosa', () => {
    expect(validarCancelacion({ motivo: 'Avería', reembolso: 'lo que sea' }, 0)).toEqual({ centimos: 0 });
  });
});

describe('Reservas del panel — altas en el calendario', () => {
  const lleno = (cambios = {}) => ({
    ...camposAlta('2026-10-13'),
    mueble_id: 'm1',
    fecha_fin: '2026-10-20',
    motivo: '  Exposición  ',
    nombre: '  Ana Pérez ',
    direccion: ' Calle Mayor 1 ',
    ...cambios
  });

  it('camposAlta empieza hoy (o vacío si no se sabe qué día es)', () => {
    expect(camposAlta('2026-10-13')).toMatchObject({
      mueble_id: '',
      fecha_inicio: '2026-10-13',
      fecha_fin: '',
      hora_entrega: '10:00',
      hora_recogida: '10:00',
      modo_entrega: 'domicilio',
      modo_devolucion: 'domicilio',
      origen: 'manual',
      ya_entregado: false
    });
    expect(camposAlta(null).fecha_inicio).toBe('');
  });

  it('validarAlta: el primer problema de cada formulario', () => {
    expect(validarAlta('bloqueo', lleno({ mueble_id: '' }))).toBe('Elige la pieza.');
    expect(validarAlta('venta', lleno({ fecha_inicio: '' }))).toBe('Elige la fecha de la venta.');
    expect(validarAlta('bloqueo', lleno({ fecha_inicio: '' }))).toBe('Elige el primer día bloqueado.');
    expect(validarAlta('alquiler', lleno({ fecha_inicio: '' }))).toBe('Elige el día de entrega.');
    expect(validarAlta('bloqueo', lleno({ fecha_fin: '' }))).toBe('Elige el día en que la pieza vuelve a estar libre.');
    expect(validarAlta('alquiler', lleno({ fecha_fin: '' }))).toBe('Elige el día de recogida.');
    expect(validarAlta('bloqueo', lleno({ fecha_fin: '2026-10-13' }))).toBe(
      'El día en que vuelve a estar libre tiene que ser posterior al primer día bloqueado.'
    );
    expect(validarAlta('alquiler', lleno({ fecha_fin: '2026-10-13' }))).toBe(
      'El día de recogida tiene que ser posterior al de entrega.'
    );
    expect(validarAlta('bloqueo', lleno({ motivo: ' ' }))).toBe('Escribe el motivo.');
    expect(validarAlta('venta', lleno({ fecha_fin: '', motivo: '' }))).toBe('Escribe el motivo.');
    expect(validarAlta('alquiler', lleno({ nombre: ' ' }))).toBe('Escribe el nombre del cliente.');
    expect(validarAlta('alquiler', lleno({ importe: '12,345' }))).toBe('El importe no es válido. Escríbelo así: 120 o 120,50.');
  });

  it('validarAlta: un alquiler ya entregado no puede empezar después de hoy (si se sabe qué día es hoy)', () => {
    const futuro = lleno({ fecha_inicio: '2026-10-14', fecha_fin: '2026-10-20', ya_entregado: true });
    const texto = 'Un alquiler ya entregado no puede empezar después de hoy.';
    expect(validarAlta('alquiler', futuro, '2026-10-13')).toBe(texto);
    expect(validarAlta('alquiler', { ...futuro, fecha_inicio: '2026-10-13' }, '2026-10-13')).toBe('');
    expect(validarAlta('alquiler', { ...futuro, ya_entregado: false }, '2026-10-13')).toBe('');
    // Sin saber qué día es hoy lo decide el servidor
    expect(validarAlta('alquiler', futuro)).toBe('');
  });

  it('validarAlta: un alquiler con entrega o recogida a domicilio pide la dirección', () => {
    const sinDireccion = 'Escribe la dirección para la entrega o la recogida a domicilio.';
    expect(validarAlta('alquiler', lleno({ direccion: '  ' }))).toBe(sinDireccion);
    expect(validarAlta('alquiler', lleno({ direccion: '', modo_entrega: 'tienda' }))).toBe(sinDireccion);
    expect(validarAlta('alquiler', lleno({ direccion: '', modo_devolucion: 'tienda' }))).toBe(sinDireccion);
    expect(validarAlta('alquiler', lleno({ direccion: '', modo_entrega: 'tienda', modo_devolucion: 'tienda' }))).toBe('');
    expect(validarAlta('bloqueo', lleno({ direccion: '' }))).toBe('');
  });

  it('validarAlta: bien rellenos, sin problemas (la venta no tiene fin; el alquiler no pide motivo ni importe)', () => {
    expect(validarAlta('bloqueo', lleno())).toBe('');
    expect(validarAlta('venta', lleno({ fecha_fin: '' }))).toBe('');
    expect(validarAlta('alquiler', lleno({ motivo: '' }))).toBe('');
    expect(validarAlta('alquiler', lleno({ importe: '120,50' }))).toBe('');
  });

  it('datosAlta de un bloqueo y de una venta', () => {
    expect(datosAlta('bloqueo', lleno())).toEqual({
      mueble_id: 'm1',
      fecha_inicio: '2026-10-13',
      fecha_fin: '2026-10-20',
      motivo: 'Exposición'
    });
    expect(datosAlta('venta', lleno())).toEqual({ mueble_id: 'm1', fecha_inicio: '2026-10-13', motivo: 'Exposición' });
  });

  it('datosAlta de un alquiler: el contacto sin campos vacíos y sin importe si no se escribe', () => {
    expect(datosAlta('alquiler', lleno({ telefono: ' 600111222 ', email: '', direccion: '', modo_entrega: 'tienda', modo_devolucion: 'tienda' }))).toEqual({
      mueble_id: 'm1',
      fecha_inicio: '2026-10-13',
      hora_entrega: '10:00',
      fecha_fin: '2026-10-20',
      hora_recogida: '10:00',
      modo_entrega: 'tienda',
      modo_devolucion: 'tienda',
      contacto: { nombre: 'Ana Pérez', telefono: '600111222' },
      origen: 'manual',
      ya_entregado: false
    });
  });

  it('datosAlta de un alquiler con todo: importe en céntimos enteros', () => {
    const datos = datosAlta(
      'alquiler',
      lleno({
        email: 'ana@example.com',
        direccion: 'Calle Mayor 1',
        notas: 'Tercero',
        telefono: '600',
        importe: '120,5',
        origen: 'legacy',
        ya_entregado: true
      })
    );
    expect(datos.contacto).toEqual({ nombre: 'Ana Pérez', telefono: '600', email: 'ana@example.com', direccion: 'Calle Mayor 1', notas: 'Tercero' });
    expect(datos.importe_total_centimos).toBe(12050);
    expect(datos).toMatchObject({ origen: 'legacy', ya_entregado: true });
  });
});
