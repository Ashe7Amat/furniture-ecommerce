import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import ReservasTab from './ReservasTab';
import { ToastContext } from '../../../context/ToastContext';
import {
  getReservasAdmin,
  entregarReservaAdmin,
  recogerReservaAdmin,
  cancelarReservaAdmin,
  bloquearFechasAdmin,
  accionReservaAdmin
} from '../../../services/api';

// Los casos que no cubren ReservasTab.test.jsx, ReservasTabBasico.test.jsx y ReservasTabFianza.test.jsx:
// formas alternativas de los datos del servidor, errores de cada acción, la vista calendario por pieza
// y los detalles de la vista master. «Hoy» se fija en el 3 de noviembre de 2026.
vi.mock('../../../services/api', () => ({
  getReservasAdmin: vi.fn(),
  entregarReservaAdmin: vi.fn(),
  recogerReservaAdmin: vi.fn(),
  cancelarReservaAdmin: vi.fn(),
  bloquearFechasAdmin: vi.fn(),
  accionReservaAdmin: vi.fn()
}));

const HOY = '2026-11-03';

const CONFIRMADA_HOY = {
  id: 'r1',
  estado: 'confirmada',
  mueble_id: 'm1',
  fecha_inicio: HOY,
  fecha_fin: '2026-11-05',
  importe_total: 150,
  pieza: { id: 'm1', nombre: 'Espejo vintage', referencia: 'NAV-ESP-004' },
  contacto: { nombre: 'Ana Pons', email: 'ana@ejemplo.com', telefono: '600111222' }
};

// Con «mueble» y «datos_contacto» en lugar de «pieza» y «contacto».
const EN_CURSO_TERMINA_HOY = {
  id: 'r2',
  estado: 'en_curso',
  fecha_inicio: '2026-11-01',
  fecha_fin: HOY,
  importe_total: 80,
  mueble: { id: 'm2', nombre: 'Silla Tolix', referencia: 'NAV-SIL-001' },
  datos_contacto: { nombre: 'Carlos Ruiz', email: 'carlos@ejemplo.com', telefono: '611222333' }
};

// Un bloqueo de una pieza que solo trae la referencia.
const BLOQUEO = {
  id: 'r3',
  tipo: 'bloqueo',
  estado: 'confirmada',
  fecha_inicio: '2026-11-10',
  fecha_fin: '2026-11-12',
  motivo: 'Restauración',
  pieza: { referencia: 'NAV-MES-009' }
};

// Sin pieza ni fechas, con los datos en «cliente».
const CANCELADA_SIN_PIEZA = {
  id: 'r4',
  estado: 'cancelada',
  fecha_inicio: null,
  fecha_fin: '2026/11/20',
  importe_total: 40,
  cliente: { nombre: 'Marta Vidal', email: 'marta@ejemplo.com' }
};

const pintar = async (reservas, props = {}) => {
  getReservasAdmin.mockResolvedValue({ data: { reservas } });
  const showToast = vi.fn();
  const utils = render(
    <ToastContext.Provider value={{ showToast }}>
      <ReservasTab {...props} />
    </ToastContext.Provider>
  );
  await waitFor(() => expect(screen.getByRole('button', { name: 'Actualizar' })).toBeEnabled());
  return { ...utils, showToast };
};

const pintarSinEsperar = (props = {}) => {
  const showToast = vi.fn();
  render(
    <ToastContext.Provider value={{ showToast }}>
      <ReservasTab {...props} />
    </ToastContext.Provider>
  );
  return { showToast };
};

const fila = (texto) => screen.getByText(texto).closest('tr');

describe('ReservasTab — cobertura de casos restantes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(`${HOY}T10:00:00Z`));
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('carga de la lista', () => {
    it('acepta la lista en «reservas» sin envolver', async () => {
      getReservasAdmin.mockResolvedValue({ reservas: [CONFIRMADA_HOY] });
      pintarSinEsperar();
      expect(await screen.findByText('Espejo vintage')).toBeInTheDocument();
      expect(screen.getByText('1 reserva registrada')).toBeInTheDocument();
    });

    it('acepta la lista como array en «data»', async () => {
      getReservasAdmin.mockResolvedValue({ data: [CONFIRMADA_HOY, EN_CURSO_TERMINA_HOY] });
      pintarSinEsperar();
      expect(await screen.findByText('Silla Tolix')).toBeInTheDocument();
      expect(screen.getByText('2 reservas registradas')).toBeInTheDocument();
    });

    it('con una respuesta sin lista, queda vacía', async () => {
      getReservasAdmin.mockResolvedValue({ data: { reservas: 'nada' } });
      pintarSinEsperar();
      expect(
        await screen.findByText('Todavía no se ha registrado ninguna reserva.')
      ).toBeInTheDocument();
    });

    it('si la carga falla, avisa con un toast de error', async () => {
      getReservasAdmin.mockRejectedValue(new Error('caída'));
      const { showToast } = pintarSinEsperar();
      await waitFor(() =>
        expect(showToast).toHaveBeenCalledWith('Error al cargar las reservas', 'error')
      );
    });

    it('mientras carga por primera vez lo dice', async () => {
      getReservasAdmin.mockReturnValue(new Promise(() => {}));
      pintarSinEsperar();
      expect(screen.getByText('Cargando reservas…')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cargando…' })).toBeDisabled();
    });
  });

  describe('lista: datos alternativos y KPIs', () => {
    it('pinta cada forma de los datos con sus valores por defecto', async () => {
      await pintar([CONFIRMADA_HOY, EN_CURSO_TERMINA_HOY, BLOQUEO, CANCELADA_SIN_PIEZA]);

      // KPIs: una entrega hoy, una recogida hoy, ingresos 150 + 80 (el bloqueo y la cancelada no cuentan).
      const kpis = screen.getByRole('region', { name: 'Hoy en el almacén' });
      const valores = kpis.querySelectorAll('.n5-kpi-value');
      expect(valores[0]).toHaveTextContent('1');
      expect(valores[1]).toHaveTextContent('1');
      expect(valores[2]).toHaveTextContent('230 €');

      // «mueble» y «datos_contacto»
      const filaEnCurso = fila('Silla Tolix');
      expect(within(filaEnCurso).getByText('Carlos Ruiz')).toBeInTheDocument();
      expect(within(filaEnCurso).getByText('611222333')).toBeInTheDocument();

      // Bloqueo sin nombre de pieza: concepto, motivo y sin total.
      const filaBloqueo = fila('Bloqueo administrativo');
      expect(filaBloqueo).toHaveClass('n5-row-bloqueo');
      expect(within(filaBloqueo).getByText('Restauración')).toBeInTheDocument();
      expect(within(filaBloqueo).getByText('—')).toBeInTheDocument();

      // Sin pieza ni fecha de inicio, con fecha en otro formato y datos en «cliente».
      const filaCancelada = fila('Pieza de alquiler');
      expect(within(filaCancelada).getByText('Marta Vidal')).toBeInTheDocument();
      expect(within(filaCancelada).getByText('marta@ejemplo.com')).toBeInTheDocument();
      expect(within(filaCancelada).getByText('— - 2026/11/20')).toBeInTheDocument();
      expect(within(filaCancelada).getAllByText('—').length).toBeGreaterThanOrEqual(1);
    });

    it('un estado desconocido se enseña tal cual, y un cliente sin datos como «Cliente»', async () => {
      await pintar([
        { id: 'x', estado: 'pendiente_pago', fecha_inicio: '2026-12-01', fecha_fin: '2026-12-02' }
      ]);
      const filaRara = fila('pendiente_pago');
      expect(within(filaRara).getByText('Cliente')).toBeInTheDocument();
      expect(within(filaRara).getByText('0 €')).toBeInTheDocument();
    });

    it('un bloqueo sin motivo se ve como «Bloqueo manual»', async () => {
      await pintar([{ ...BLOQUEO, motivo: undefined }]);
      expect(screen.getByText('Bloqueo manual')).toBeInTheDocument();
    });

    it('una cancelación solicitada sin motivo: aviso genérico en el título y sin cita', async () => {
      await pintar([
        { ...CONFIRMADA_HOY, cancelacion_solicitada: true, cancelacion_solicitada_motivo: 'Sin motivo.' }
      ]);
      const aviso = screen.getByText(/Cancelación solicitada/);
      expect(aviso).toHaveAttribute('title', 'Motivo: Sin motivo.');
      expect(screen.queryByText('«Sin motivo.»')).not.toBeInTheDocument();
    });

    it('una cancelación solicitada sin texto de motivo usa el título por defecto', async () => {
      await pintar([{ ...CONFIRMADA_HOY, cancelacion_solicitada: true }]);
      expect(screen.getByText(/Cancelación solicitada/)).toHaveAttribute(
        'title',
        'El cliente ha solicitado cancelar'
      );
    });
  });

  describe('filtros', () => {
    it('busca por email, teléfono y motivo de bloqueo, y «Limpiar filtros» lo deshace', async () => {
      await pintar([CONFIRMADA_HOY, EN_CURSO_TERMINA_HOY, BLOQUEO, CANCELADA_SIN_PIEZA]);
      const buscador = screen.getByRole('searchbox', { name: 'Buscar reservas' });

      fireEvent.change(buscador, { target: { value: 'marta@' } });
      expect(screen.getByText('Marta Vidal')).toBeInTheDocument();
      expect(screen.queryByText('Espejo vintage')).not.toBeInTheDocument();

      fireEvent.change(buscador, { target: { value: '611222' } });
      expect(screen.getByText('Silla Tolix')).toBeInTheDocument();
      expect(screen.queryByText('Marta Vidal')).not.toBeInTheDocument();

      fireEvent.change(buscador, { target: { value: 'restaur' } });
      expect(screen.getByText('Bloqueo administrativo')).toBeInTheDocument();
      expect(screen.queryByText('Silla Tolix')).not.toBeInTheDocument();

      fireEvent.change(buscador, { target: { value: 'nadie así' } });
      expect(
        screen.getByText('No se encontraron reservas que coincidan con los filtros aplicados.')
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
      expect(buscador).toHaveValue('');
      expect(screen.getByText('Espejo vintage')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument();
    });

    it('el filtro de fecha deja las que ocupan ese día (con su margen de ocupación)', async () => {
      await pintar([
        CONFIRMADA_HOY,
        { ...EN_CURSO_TERMINA_HOY, fin_ocupacion: '2026-11-06' }
      ]);
      fireEvent.change(screen.getByLabelText('Filtrar por fecha activa'), {
        target: { value: '2026-11-06' }
      });
      expect(screen.getByText('Silla Tolix')).toBeInTheDocument();
      expect(screen.queryByText('Espejo vintage')).not.toBeInTheDocument();
    });
  });

  describe('entregar y recoger: errores', () => {
    it('entregar: un error del servidor se avisa y la reserva no cambia', async () => {
      const { showToast } = await pintar([CONFIRMADA_HOY]);
      entregarReservaAdmin.mockResolvedValue({ error: 'Ya entregada' });
      fireEvent.click(screen.getByRole('button', { name: 'Marcar Entregada' }));
      await waitFor(() => expect(showToast).toHaveBeenCalledWith('Ya entregada', 'error'));
      expect(screen.getByRole('button', { name: 'Marcar Entregada' })).toBeEnabled();
    });

    it('entregar: si la petición falla, avisa', async () => {
      const { showToast } = await pintar([CONFIRMADA_HOY]);
      entregarReservaAdmin.mockRejectedValue(new Error('red'));
      fireEvent.click(screen.getByRole('button', { name: 'Marcar Entregada' }));
      await waitFor(() =>
        expect(showToast).toHaveBeenCalledWith('No se pudo marcar como entregada', 'error')
      );
    });

    it('entregar: mientras guarda, el botón dice «Guardando…»', async () => {
      await pintar([CONFIRMADA_HOY]);
      let terminar;
      entregarReservaAdmin.mockReturnValue(new Promise((r) => (terminar = r)));
      fireEvent.click(screen.getByRole('button', { name: 'Marcar Entregada' }));
      expect(await screen.findByRole('button', { name: 'Guardando…' })).toBeDisabled();
      terminar({});
      expect(await screen.findByRole('button', { name: 'Marcar Recogida' })).toBeInTheDocument();
    });

    it('recoger: un error del servidor se avisa', async () => {
      const { showToast } = await pintar([EN_CURSO_TERMINA_HOY]);
      recogerReservaAdmin.mockResolvedValue({ error: 'No está en curso' });
      fireEvent.click(screen.getByRole('button', { name: 'Marcar Recogida' }));
      await waitFor(() => expect(showToast).toHaveBeenCalledWith('No está en curso', 'error'));
    });

    it('recoger: si la petición falla, avisa', async () => {
      const { showToast } = await pintar([EN_CURSO_TERMINA_HOY]);
      recogerReservaAdmin.mockRejectedValue(new Error('red'));
      fireEvent.click(screen.getByRole('button', { name: 'Marcar Recogida' }));
      await waitFor(() =>
        expect(showToast).toHaveBeenCalledWith('No se pudo marcar como recogida', 'error')
      );
    });

    it('al entregar se refrescan el inventario y los avisos del panel', async () => {
      const recargarMuebles = vi.fn();
      const alCambiar = vi.fn();
      await pintar([CONFIRMADA_HOY], { recargarMuebles, alCambiar });
      entregarReservaAdmin.mockResolvedValue({});
      fireEvent.click(screen.getByRole('button', { name: 'Marcar Entregada' }));
      await waitFor(() => expect(recargarMuebles).toHaveBeenCalled());
      expect(alCambiar).toHaveBeenCalled();
    });
  });

  describe('modal de cancelación', () => {
    const abrirCancelar = () => fireEvent.click(screen.getByRole('button', { name: '✕ Cancelar' }));

    it('enseña el motivo del cliente y «Volver» cierra sin mandar nada', async () => {
      await pintar([{ ...CONFIRMADA_HOY, cancelacion_solicitada_motivo: 'Cambio de fecha' }]);
      abrirCancelar();
      expect(screen.getByText('Motivo indicado por el cliente:')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
      expect(screen.queryByText('¿Cancelar reserva?')).not.toBeInTheDocument();
      expect(cancelarReservaAdmin).not.toHaveBeenCalled();
    });

    it('volver a marcar el 100% recupera el importe total', async () => {
      await pintar([CONFIRMADA_HOY]);
      abrirCancelar();
      const importe = screen.getByLabelText('Importe a reembolsar (€):');
      const casilla = screen.getByRole('checkbox');
      fireEvent.click(casilla);
      fireEvent.change(importe, { target: { value: '20' } });
      expect(screen.getByText(/2000\s+céntimos/)).toBeInTheDocument();
      fireEvent.click(casilla);
      expect(importe).toHaveValue(150);
      expect(screen.getByText(/15000\s+céntimos/)).toBeInTheDocument();
    });

    it('con el importe vacío se manda 0', async () => {
      await pintar([CONFIRMADA_HOY]);
      cancelarReservaAdmin.mockResolvedValue({});
      abrirCancelar();
      fireEvent.change(screen.getByLabelText('Importe a reembolsar (€):'), { target: { value: '' } });
      expect(screen.getByText(/^0\s+céntimos/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar reserva' }));
      await waitFor(() =>
        expect(cancelarReservaAdmin).toHaveBeenCalledWith('r1', {
          motivo: 'Cancelada por el administrador',
          reembolso_centimos: 0
        })
      );
    });

    it('un error del servidor se avisa y el modal sigue abierto', async () => {
      const { showToast } = await pintar([CONFIRMADA_HOY]);
      cancelarReservaAdmin.mockResolvedValue({ error: 'Stripe no responde' });
      abrirCancelar();
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar reserva' }));
      await waitFor(() => expect(showToast).toHaveBeenCalledWith('Stripe no responde', 'error'));
      expect(screen.getByText('¿Cancelar reserva?')).toBeInTheDocument();
    });

    it('si la petición falla, avisa', async () => {
      const { showToast } = await pintar([CONFIRMADA_HOY]);
      cancelarReservaAdmin.mockRejectedValue(new Error('red'));
      abrirCancelar();
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar reserva' }));
      await waitFor(() =>
        expect(showToast).toHaveBeenCalledWith('No se pudo cancelar la reserva', 'error')
      );
    });

    it('mientras cancela, los botones se bloquean y «Volver» no cierra', async () => {
      await pintar([{ ...CONFIRMADA_HOY, importe_total: undefined }]);
      let terminar;
      cancelarReservaAdmin.mockReturnValue(new Promise((r) => (terminar = r)));
      abrirCancelar();
      expect(screen.getByText(/Reembolsar el 100% del importe \(0 €\)/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar reserva' }));
      expect(
        await screen.findByRole('button', { name: 'Cancelando y reembolsando…' })
      ).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Volver' })).toBeDisabled();
      terminar({ error: 'no' });
      expect(await screen.findByRole('button', { name: 'Cancelar reserva' })).toBeEnabled();
    });
  });

  describe('modal de fianza: casos restantes', () => {
    const DEVUELTA = {
      id: 'r5',
      estado: 'devuelta',
      fecha_inicio: '2026-10-20',
      fecha_fin: '2026-10-23',
      importe_total: 130,
      mueble: { nombre: 'Mesa Bistro' },
      fianza: { importe: 30, estado: 'garantizada' },
      acciones: ['devolver-fianza']
    };

    it('un error «reembolso_a_medias» recarga la lista', async () => {
      await pintar([DEVUELTA]);
      accionReservaAdmin.mockResolvedValue({ error: 'Quedó a medias', codigo: 'reembolso_a_medias' });
      fireEvent.click(screen.getByRole('button', { name: 'Gestionar fianza' }));
      fireEvent.click(screen.getByRole('button', { name: /Devolver 30,00/ }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Quedó a medias');
      await waitFor(() => expect(getReservasAdmin).toHaveBeenCalledTimes(2));
    });

    it('si la petición falla, lo dice en el modal', async () => {
      await pintar([DEVUELTA]);
      accionReservaAdmin.mockRejectedValue(new Error('red'));
      fireEvent.click(screen.getByRole('button', { name: 'Gestionar fianza' }));
      fireEvent.click(screen.getByRole('button', { name: /Devolver 30,00/ }));
      expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido resolver la fianza.');
    });

    it('mientras guarda, «Volver» no cierra', async () => {
      await pintar([DEVUELTA]);
      let terminar;
      accionReservaAdmin.mockReturnValue(new Promise((r) => (terminar = r)));
      fireEvent.click(screen.getByRole('button', { name: 'Gestionar fianza' }));
      fireEvent.click(screen.getByRole('button', { name: /Devolver 30,00/ }));
      expect(await screen.findByRole('button', { name: 'Guardando…' })).toBeDisabled();
      fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      terminar({});
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('una fianza a medias con parte retenida lo explica', async () => {
      await pintar([
        { ...DEVUELTA, fianza: { importe: 30, estado: 'en_resolucion', retenido: 12.5 } }
      ]);
      fireEvent.click(screen.getByRole('button', { name: 'Gestionar fianza' }));
      expect(screen.getByText(/retener 12,50/)).toBeInTheDocument();
    });

    it('sin datos de fianza ni de pieza, cuenta 0 y llama «Pieza» a la pieza', async () => {
      await pintar([{ ...DEVUELTA, mueble: undefined, fianza: undefined }]);
      fireEvent.click(screen.getByRole('button', { name: 'Gestionar fianza' }));
      expect(within(screen.getByRole('dialog')).getByText(/Pieza · fianza cobrada/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Retener la fianza entera' })).toBeInTheDocument();
    });
  });

  describe('modal de bloqueo: validaciones y errores', () => {
    const MUEBLES = [{ id: 'm1', nombre: 'Espejo vintage', referencia: 'NAV-ESP-004' }];

    const abrirYRellenar = async ({ inicio = '2026-11-20', fin = '2026-11-22', motivo = '' } = {}) => {
      fireEvent.click(screen.getByRole('button', { name: '🔒 Bloquear fechas' }));
      const modal = screen.getByText('🔒 Bloquear fechas manualmente').closest('.admin-modal-card');
      const fechas = modal.querySelectorAll('input[type="date"]');
      fireEvent.change(fechas[0], { target: { value: inicio } });
      fireEvent.change(fechas[1], { target: { value: fin } });
      fireEvent.change(within(modal).getByPlaceholderText(/Exposición/), { target: { value: motivo } });
      return modal;
    };

    it('abre con hoy y la primera pieza, y rechaza un fin anterior al inicio', async () => {
      await pintar([], { muebles: MUEBLES });
      fireEvent.click(screen.getByRole('button', { name: '🔒 Bloquear fechas' }));
      const modal = screen.getByText('🔒 Bloquear fechas manualmente').closest('.admin-modal-card');
      expect(within(modal).getByLabelText('Mueble:')).toHaveValue('m1');
      const fechas = modal.querySelectorAll('input[type="date"]');
      expect(fechas[0]).toHaveValue(HOY);
      fireEvent.change(fechas[1], { target: { value: '2026-11-01' } });
      fireEvent.change(within(modal).getByPlaceholderText(/Exposición/), { target: { value: 'x' } });
      fireEvent.submit(modal.querySelector('form'));
      expect(
        screen.getByText('La fecha de fin no puede ser anterior a la fecha de inicio.')
      ).toBeInTheDocument();
      expect(bloquearFechasAdmin).not.toHaveBeenCalled();
    });

    it('sin piezas no se puede guardar', async () => {
      await pintar([]);
      fireEvent.click(screen.getByRole('button', { name: '🔒 Bloquear fechas' }));
      const modal = screen.getByText('🔒 Bloquear fechas manualmente').closest('.admin-modal-card');
      fireEvent.submit(modal.querySelector('form'));
      expect(
        screen.getByText('Por favor completa todos los campos de fechas y mueble.')
      ).toBeInTheDocument();
    });

    it('sin motivo manda «Bloqueo administrativo», y «Cancelar» cierra el modal', async () => {
      await pintar([], { muebles: MUEBLES });
      bloquearFechasAdmin.mockResolvedValue({ error: 'Se solapa' });
      const modal = await abrirYRellenar({ motivo: '   ' });
      fireEvent.submit(modal.querySelector('form'));
      await waitFor(() =>
        expect(bloquearFechasAdmin).toHaveBeenCalledWith({
          mueble_id: 'm1',
          fecha_inicio: '2026-11-20',
          fecha_fin: '2026-11-22',
          motivo: 'Bloqueo administrativo'
        })
      );
      expect(await within(modal).findByText('Se solapa')).toBeInTheDocument();
      fireEvent.click(within(modal).getByRole('button', { name: 'Cancelar' }));
      expect(screen.queryByText('🔒 Bloquear fechas manualmente')).not.toBeInTheDocument();
    });

    it('si la petición falla, lo dice en el modal y con un toast', async () => {
      const { showToast } = await pintar([], { muebles: MUEBLES });
      bloquearFechasAdmin.mockRejectedValue(new Error('red'));
      const modal = await abrirYRellenar({ motivo: 'Feria' });
      fireEvent.submit(modal.querySelector('form'));
      expect(await within(modal).findByText('Error al bloquear fechas')).toBeInTheDocument();
      expect(showToast).toHaveBeenCalledWith('Error al bloquear fechas', 'error');
    });

    it('mientras guarda, «Cancelar» no cierra', async () => {
      await pintar([], { muebles: MUEBLES });
      let terminar;
      bloquearFechasAdmin.mockReturnValue(new Promise((r) => (terminar = r)));
      const modal = await abrirYRellenar({ motivo: 'Feria' });
      fireEvent.submit(modal.querySelector('form'));
      expect(await within(modal).findByRole('button', { name: 'Guardando bloqueo…' })).toBeDisabled();
      fireEvent.click(within(modal).getByRole('button', { name: 'Cancelar' }));
      expect(screen.getByText('🔒 Bloquear fechas manualmente')).toBeInTheDocument();
      terminar({});
      await waitFor(() =>
        expect(screen.queryByText('🔒 Bloquear fechas manualmente')).not.toBeInTheDocument()
      );
    });
  });

  describe('vista calendario por pieza', () => {
    const verCalendario = () => fireEvent.click(screen.getByRole('button', { name: /Vista Calendario/ }));

    it('pinta las reservas y bloqueos de la pieza elegida, y cambia de pieza y de mes', async () => {
      await pintar([CONFIRMADA_HOY, BLOQUEO, { ...BLOQUEO, id: 'r6', mueble_id: 'm1', motivo: undefined, fecha_inicio: '2026-11-20', fecha_fin: '2026-11-20' }]);
      verCalendario();

      const selector = screen.getByLabelText('Mueble a consultar');
      expect(selector).toHaveValue('m1');
      expect(screen.getByText('noviembre de 2026')).toBeInTheDocument();
      expect(screen.getByText('2 eventos activos para este mueble')).toBeInTheDocument();

      // Hoy y la reserva
      const celdaHoy = document.querySelector('.n5-cal-cell.is-today');
      expect(celdaHoy).toHaveClass('is-booked');
      expect(celdaHoy).toHaveAttribute('title', expect.stringContaining('Reserva: Ana Pons (confirmada)'));
      expect(screen.getAllByText('📦 Ana Pons').length).toBe(3);

      // Bloqueo sin motivo
      const bloqueado = document.querySelector('.n5-cal-cell.is-blocked');
      expect(bloqueado).toHaveAttribute('title', 'Bloqueo: Mantenimiento');
      expect(within(bloqueado).getByText('🔒 Bloqueado')).toBeInTheDocument();

      // La otra pieza (solo con referencia): su bloqueo con motivo
      fireEvent.change(selector, { target: { value: 'NAV-MES-009' } });
      expect(screen.getByText('1 evento activo para este mueble')).toBeInTheDocument();
      expect(screen.getAllByText('🔒 Restauración').length).toBe(3);

      // Navegar meses
      fireEvent.click(screen.getByRole('button', { name: /Mes siguiente/ }));
      expect(screen.getByText('diciembre de 2026')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Mes anterior/ }));
      fireEvent.click(screen.getByRole('button', { name: /Mes anterior/ }));
      expect(screen.getByText('octubre de 2026')).toBeInTheDocument();
    });

    it('un día ocupado abre el detalle, con sus acciones', async () => {
      const { showToast } = await pintar([CONFIRMADA_HOY]);
      entregarReservaAdmin.mockResolvedValue({});
      verCalendario();
      fireEvent.click(document.querySelector('.n5-cal-cell.is-today'));
      const panel = screen.getByRole('complementary', { name: 'Detalle de reserva seleccionada' });
      expect(within(panel).getByText('Fecha seleccionada · 03/11/2026')).toBeInTheDocument();
      expect(within(panel).getByText('ana@ejemplo.com')).toBeInTheDocument();
      expect(within(panel).getByText('150 €')).toBeInTheDocument();
      expect(document.querySelector('.n5-cal-cell.is-today')).toHaveClass('is-selected');

      // Entregar desde el panel: se actualiza el panel a «En curso»
      fireEvent.click(within(panel).getByRole('button', { name: 'Marcar Entregada' }));
      await waitFor(() => expect(showToast).toHaveBeenCalledWith(expect.stringContaining('entregada'), 'success'));
      expect(within(panel).getByText('En curso')).toBeInTheDocument();
      recogerReservaAdmin.mockResolvedValue({});
      fireEvent.click(within(panel).getByRole('button', { name: 'Marcar Recogida' }));
      await waitFor(() => expect(within(panel).getByText('Devuelta')).toBeInTheDocument());
      expect(within(panel).queryByRole('button', { name: '✕ Cancelar' })).not.toBeInTheDocument();
    });

    it('desde el detalle se puede abrir la cancelación', async () => {
      await pintar([CONFIRMADA_HOY]);
      verCalendario();
      fireEvent.click(document.querySelector('.n5-cal-cell.is-today'));
      fireEvent.click(screen.getByRole('button', { name: '✕ Cancelar' }));
      expect(screen.getByText('¿Cancelar reserva?')).toBeInTheDocument();
    });

    it('el detalle de un bloqueo y de una reserva sin datos de contacto', async () => {
      await pintar([
        { ...BLOQUEO, mueble_id: 'm1', motivo: undefined },
        { id: 'r7', estado: 'en_curso', mueble_id: 'm1', fecha_inicio: '2026-11-15', fecha_fin: '2026-11-16' }
      ]);
      verCalendario();
      const bloqueado = document.querySelector('.n5-cal-cell.is-blocked');
      fireEvent.click(bloqueado);
      let panel = screen.getByRole('complementary', { name: 'Detalle de reserva seleccionada' });
      expect(within(panel).getByText('Bloqueo de Almacén')).toBeInTheDocument();
      expect(within(panel).getByText('Bloqueo administrativo')).toBeInTheDocument();
      expect(within(panel).queryByText('Email de contacto')).not.toBeInTheDocument();

      const reservado = document.querySelector('.n5-cal-cell.is-booked');
      expect(reservado).toHaveAttribute('title', expect.stringContaining('Reserva: Cliente (en_curso)'));
      expect(within(reservado).getByText('📦 Alquilado')).toBeInTheDocument();
      fireEvent.click(reservado);
      panel = screen.getByRole('complementary', { name: 'Detalle de reserva seleccionada' });
      expect(within(panel).getByText('Cliente')).toBeInTheDocument();
      expect(within(panel).getByText('No especificado')).toBeInTheDocument();
      expect(within(panel).getByText('0 €')).toBeInTheDocument();
    });

    it('un día libre abre el bloqueo con ese día y esa pieza; cambiar de pieza cierra el detalle', async () => {
      await pintar([CONFIRMADA_HOY], {
        muebles: [{ id: 'm9', nombre: 'Banco', referencia: null }, CONFIRMADA_HOY.pieza]
      });
      verCalendario();
      const selector = screen.getByLabelText('Mueble a consultar');
      expect(within(selector).getByRole('option', { name: 'Banco' })).toBeInTheDocument();
      fireEvent.change(selector, { target: { value: 'm1' } });

      fireEvent.click(document.querySelector('.n5-cal-cell.is-today'));
      expect(screen.getByRole('complementary')).toBeInTheDocument();
      fireEvent.change(selector, { target: { value: 'm9' } });
      expect(screen.queryByRole('complementary')).not.toBeInTheDocument();

      const libre = [...document.querySelectorAll('.n5-cal-cell.is-free')].find(
        (c) => c.getAttribute('title') === 'Día disponible (20/11/2026) — Clic para bloquear fecha'
      );
      fireEvent.click(libre);
      const modal = screen.getByText('🔒 Bloquear fechas manualmente').closest('.admin-modal-card');
      expect(within(modal).getByLabelText('Mueble:')).toHaveValue('m9');
      expect(modal.querySelectorAll('input[type="date"]')[0]).toHaveValue('2026-11-20');
    });

    it('las celdas vacías del mes no hacen nada', async () => {
      await pintar([CONFIRMADA_HOY]);
      verCalendario();
      const vacia = document.querySelector('.n5-cal-cell.is-empty');
      fireEvent.click(vacia);
      expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    });
  });

  describe('vista master', () => {
    const verMaster = () => fireEvent.click(screen.getByRole('button', { name: /Vista Master/ }));

    it('sin piezas lo dice', async () => {
      await pintar([]);
      verMaster();
      expect(screen.getByText('No hay muebles disponibles en el catálogo.')).toBeInTheDocument();
      expect(screen.getByText('0 muebles en catálogo')).toBeInTheDocument();
    });

    it('pinta reservas, bloqueos y días libres, y navega por meses', async () => {
      await pintar([
        CONFIRMADA_HOY,
        { ...BLOQUEO, motivo: undefined },
        { ...CONFIRMADA_HOY, id: 'r8', estado: 'cancelada', fecha_inicio: '2026-11-25', fecha_fin: '2026-11-26' },
        { id: 'r9', estado: 'confirmada', mueble_id: 'm1', fecha_inicio: '2026-11-28', fecha_fin: '2026-11-28' }
      ]);
      verMaster();
      expect(screen.getByText('2 muebles en catálogo')).toBeInTheDocument();
      expect(screen.getByText('Ref. NAV-MES-009')).toBeInTheDocument();
      expect(document.querySelector('.n5-master-th-dia.is-today')).toHaveTextContent('3');

      const bloqueo = document.querySelector('.n5-master-cell.is-blocked');
      expect(bloqueo).toHaveAttribute('title', 'Pieza · Bloqueo: Mantenimiento');

      const celdas = [...document.querySelectorAll('.n5-master-cell.is-booked')];
      expect(celdas.some((c) => c.getAttribute('title') === 'Espejo vintage · Reserva: Ana Pons (confirmada)')).toBe(true);
      expect(celdas.some((c) => c.getAttribute('title') === 'Espejo vintage · Reserva: Cliente (confirmada)')).toBe(true);
      // La cancelada no ocupa.
      const libre = [...document.querySelectorAll('.n5-master-cell.is-free')].find(
        (c) => c.getAttribute('title') === 'Espejo vintage · Disponible (25/11/2026) — Clic para bloquear'
      );
      expect(libre).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: /Mes siguiente/ }));
      expect(screen.getByText('diciembre de 2026')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Mes anterior/ }));
      expect(screen.getByText('noviembre de 2026')).toBeInTheDocument();
    });

    it('una celda libre abre el bloqueo; una ocupada, el detalle seleccionado', async () => {
      await pintar([CONFIRMADA_HOY]);
      verMaster();
      const libre = [...document.querySelectorAll('.n5-master-cell.is-free')].find(
        (c) => c.getAttribute('title') === 'Espejo vintage · Disponible (20/11/2026) — Clic para bloquear'
      );
      fireEvent.click(libre);
      const modal = screen.getByText('🔒 Bloquear fechas manualmente').closest('.admin-modal-card');
      expect(within(modal).getByLabelText('Mueble:')).toHaveValue('m1');
      expect(modal.querySelectorAll('input[type="date"]')[0]).toHaveValue('2026-11-20');
      fireEvent.click(within(modal).getByRole('button', { name: 'Cancelar' }));

      const ocupada = document.querySelector('.n5-master-cell.is-booked.is-today');
      fireEvent.click(ocupada);
      expect(document.querySelector('.n5-master-cell.is-booked.is-today')).toHaveClass('is-selected');
      expect(screen.getByRole('complementary')).toBeInTheDocument();
    });

    it('selecciona también la fila cuando la reserva solo trae la pieza con su id', async () => {
      const soloPieza = { ...CONFIRMADA_HOY, mueble_id: undefined };
      await pintar([soloPieza]);
      verMaster();
      fireEvent.click(document.querySelector('.n5-master-cell.is-booked.is-today'));
      expect(document.querySelector('.n5-master-cell.is-today')).toHaveClass('is-selected');
    });

    it('una reserva sin pieza ocupa una fila propia, «Pieza»', async () => {
      await pintar([{ ...CANCELADA_SIN_PIEZA, estado: 'confirmada', fecha_inicio: '2026-11-04', fecha_fin: '2026-11-04' }]);
      verMaster();
      expect(screen.getByText('1 mueble en catálogo')).toBeInTheDocument();
      expect(screen.getByText('Pieza')).toBeInTheDocument();
      expect(
        [...document.querySelectorAll('.n5-master-cell.is-booked')].map((c) => c.getAttribute('title'))
      ).toEqual(['Pieza · Reserva: Marta Vidal (confirmada)']);
    });
  });
});
