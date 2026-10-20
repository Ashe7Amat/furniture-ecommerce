// "Mis reservas" en Mi cuenta (MisReservas.jsx): la lista con fechas, estado y total, los estados de
// carga, vacío, error y email sin confirmar, y la solicitud de cancelación con motivo opcional.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import MisReservas from './MisReservas';
import { getMisReservas, solicitarCancelacionReserva } from '../../services/api';
import { eurosDeCentimos } from '../../utils/reservas';
import { PLACEHOLDER_IMG } from '../../utils/images';

vi.mock('../../services/api', () => ({
  getMisReservas: vi.fn(),
  solicitarCancelacionReserva: vi.fn()
}));

// Los importes llevan un espacio duro antes del "€"; getByText compara con los espacios normalizados.
const euros = (centimos) => eurosDeCentimos(centimos).replace(/\s/g, ' ');

const reserva = (extra = {}) => ({
  id: 'r1',
  referencia: 'A1B2C3D4',
  estado: 'confirmada',
  pieza: { id: 'm1', nombre: 'Aparador de roble', imagen: 'https://img.test/aparador.jpg' },
  fecha_inicio: '2026-11-04',
  hora_entrega: '10:00',
  fecha_fin: '2026-11-07',
  hora_recogida: '12:30',
  modo_entrega: 'domicilio',
  modo_devolucion: 'tienda',
  direccion_entrega: 'Calle Mayor 1, Barcelona',
  dias: 4,
  importe_total_centimos: 13000,
  cancelacion_solicitada: false,
  puede_solicitar_cancelacion: true,
  ...extra
});
const ok = (data) => ({ data, error: null, status: 200 });

const montar = () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <MisReservas />
    </MemoryRouter>
  );
  return { user };
};
const tarjeta = async (nombre = 'Aparador de roble') =>
  within((await screen.findByRole('link', { name: nombre })).closest('article'));

beforeEach(() => {
  vi.resetAllMocks();
});

describe('MisReservas — la lista', () => {
  it('mientras carga lo dice', () => {
    getMisReservas.mockReturnValue(new Promise(() => {}));
    montar();
    expect(screen.getByText('Cargando tus reservas...')).toBeInTheDocument();
  });

  it('cada reserva: pieza con enlace a su ficha, referencia, estado, entrega, recogida, dirección y total', async () => {
    getMisReservas.mockResolvedValue(ok([reserva()]));
    montar();
    const t = await tarjeta();

    expect(screen.getByRole('article', { name: 'Aparador de roble' })).toBeInTheDocument();
    expect(t.getByRole('link', { name: 'Aparador de roble' })).toHaveAttribute('href', '/mueble/m1');
    expect(t.getByRole('heading', { level: 3, name: 'Aparador de roble' })).toBeInTheDocument();
    expect(t.getByText('Reserva A1B2C3D4')).toBeInTheDocument();
    expect(t.getByText('Confirmada')).toHaveClass('order-status', 'badge-success');
    expect(t.getByText('miércoles, 4 de noviembre de 2026, a las 10:00, a domicilio')).toBeInTheDocument();
    expect(t.getByText('sábado, 7 de noviembre de 2026, a las 12:30, en la tienda')).toBeInTheDocument();
    expect(t.getByText('Calle Mayor 1, Barcelona')).toBeInTheDocument();
    expect(t.getByText(`${euros(13000)} (4 días)`)).toBeInTheDocument();
    expect(document.querySelector('.reserva-item-foto')).toHaveAttribute('src', 'https://img.test/aparador.jpg');
    expect(t.queryByText('Cancelación solicitada')).not.toBeInTheDocument();
  });

  it.each([
    ['esperando_pago', 'Esperando pago', 'badge-warning'],
    ['confirmada', 'Confirmada', 'badge-success'],
    ['en_curso', 'En curso', 'badge-info'],
    ['devuelta', 'Devuelta', 'badge-info'],
    ['cancelada', 'Cancelada', 'badge-danger'],
    ['no_confirmada', 'No se pudo confirmar', 'badge-danger'],
    ['otro_estado', 'otro_estado', 'badge-warning']
  ])('estado %s: "%s"', async (estado, etiqueta, clase) => {
    getMisReservas.mockResolvedValue(ok([reserva({ estado, puede_solicitar_cancelacion: false })]));
    montar();
    expect((await tarjeta()).getByText(etiqueta)).toHaveClass(clase);
  });

  it('sin foto ni dirección (recogida en tienda), la foto genérica y sin línea de dirección; 1 día en singular', async () => {
    getMisReservas.mockResolvedValue(
      ok([
        reserva({
          pieza: { id: 'm2', nombre: 'Lámpara', imagen: null },
          direccion_entrega: null,
          modo_entrega: 'tienda',
          dias: 1,
          importe_total_centimos: 2500
        })
      ])
    );
    montar();
    const t = await tarjeta('Lámpara');

    expect(document.querySelector('.reserva-item-foto')).toHaveAttribute('src', PLACEHOLDER_IMG);
    expect(t.queryByText('Dirección')).not.toBeInTheDocument();
    expect(t.getByText(`${euros(2500)} (1 día)`)).toBeInTheDocument();
  });

  it('con la cancelación ya pedida: "Cancelación solicitada" y sin botón', async () => {
    getMisReservas.mockResolvedValue(
      ok([reserva({ cancelacion_solicitada: true, puede_solicitar_cancelacion: false })])
    );
    montar();
    const t = await tarjeta();
    expect(t.getByText('Cancelación solicitada')).toHaveClass('order-status');
    expect(t.queryByRole('button', { name: 'Solicitar cancelación' })).not.toBeInTheDocument();
  });

  it('sin reservas: "Todavía no tienes reservas." y un enlace al catálogo', async () => {
    getMisReservas.mockResolvedValue(ok([]));
    montar();

    expect(await screen.findByText('Todavía no tienes reservas.')).toBeInTheDocument();
    const enlace = screen.getByRole('link', { name: 'Explorar catálogo' });
    expect(enlace).toHaveAttribute('href', '/catalogo');
    expect(enlace.closest('.empty-tab')).toHaveClass('empty-tab--reservas');
  });

  it('una respuesta que no es una lista cuenta como vacía', async () => {
    getMisReservas.mockResolvedValue(ok(null));
    montar();
    expect(await screen.findByText('Todavía no tienes reservas.')).toBeInTheDocument();
  });

  it('403 (email sin confirmar): el aviso de confirmar el email, como en los pedidos', async () => {
    getMisReservas.mockResolvedValue({
      data: null,
      error: 'Otro texto del servidor.',
      status: 403,
      codigo: 'email_no_verificado'
    });
    montar();
    expect(await screen.findByText('Confirma tu email para ver tus reservas.')).toHaveClass('empty-tab-text');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('403 sin código (el alquiler cerrado): el mensaje del servidor, no el del email', async () => {
    getMisReservas.mockResolvedValue({
      data: null,
      error: 'El alquiler online no está disponible en este momento.',
      status: 403
    });
    montar();
    expect(await screen.findByRole('alert')).toHaveTextContent('El alquiler online no está disponible en este momento.');
    expect(screen.queryByText('Confirma tu email para ver tus reservas.')).not.toBeInTheDocument();
  });

  it('si falla, el motivo del servidor', async () => {
    getMisReservas.mockResolvedValue({ data: null, error: 'No se han podido cargar tus reservas.', status: 500 });
    montar();
    expect(await screen.findByRole('alert')).toHaveTextContent('No se han podido cargar tus reservas.');
  });

  it('si se sale antes de que lleguen, no hace nada con la respuesta', async () => {
    let responder;
    getMisReservas.mockReturnValue(new Promise((r) => (responder = r)));
    const { unmount } = render(
      <MemoryRouter>
        <MisReservas />
      </MemoryRouter>
    );
    unmount();
    await act(async () => responder(ok([reserva()])));
    expect(screen.queryByText('Aparador de roble')).not.toBeInTheDocument();
  });
});

describe('MisReservas — solicitar la cancelación', () => {
  it('pide un motivo opcional, lo envía y enseña la respuesta del servidor', async () => {
    getMisReservas.mockResolvedValue(ok([reserva(), reserva({ id: 'r2', pieza: { id: 'm2', nombre: 'Lámpara', imagen: null } })]));
    solicitarCancelacionReserva.mockResolvedValue(ok({ mensaje: 'Hemos recibido tu solicitud. Te escribiremos pronto.' }));
    const { user } = montar();
    const t = await tarjeta();

    await user.click(t.getByRole('button', { name: 'Solicitar cancelación' }));
    const motivo = t.getByLabelText('Motivo (opcional)');
    expect(motivo).toHaveFocus();
    expect(motivo).toHaveAttribute('maxLength', '500');
    await user.type(motivo, '  Cambio de fechas del rodaje  ');
    await user.click(t.getByRole('button', { name: 'Enviar solicitud' }));

    expect(solicitarCancelacionReserva).toHaveBeenCalledWith('r1', 'Cambio de fechas del rodaje');
    const mensaje = t.getByRole('status');
    expect(mensaje).toHaveTextContent('Hemos recibido tu solicitud. Te escribiremos pronto.');
    expect(mensaje).toHaveFocus();
    expect(t.getByText('Cancelación solicitada')).toBeInTheDocument();
    expect(t.queryByRole('button', { name: 'Solicitar cancelación' })).not.toBeInTheDocument();
    expect(t.queryByLabelText('Motivo (opcional)')).not.toBeInTheDocument();
    // La otra reserva sigue igual
    const otra = await tarjeta('Lámpara');
    expect(otra.getByRole('button', { name: 'Solicitar cancelación' })).toBeInTheDocument();
  });

  it('sin motivo no lo manda; sin mensaje del servidor, uno por defecto', async () => {
    getMisReservas.mockResolvedValue(ok([reserva()]));
    solicitarCancelacionReserva.mockResolvedValue(ok(null));
    const { user } = montar();
    const t = await tarjeta();

    await user.click(t.getByRole('button', { name: 'Solicitar cancelación' }));
    await user.type(t.getByLabelText('Motivo (opcional)'), '   ');
    await user.click(t.getByRole('button', { name: 'Enviar solicitud' }));

    expect(solicitarCancelacionReserva).toHaveBeenCalledWith('r1', undefined);
    expect(t.getByRole('status')).toHaveTextContent('Hemos recibido tu solicitud.');
  });

  it('mientras se envía, los botones están desactivados; si falla, el motivo del servidor y se puede reintentar', async () => {
    getMisReservas.mockResolvedValue(ok([reserva()]));
    let responder;
    solicitarCancelacionReserva.mockReturnValueOnce(new Promise((r) => (responder = r)));
    const { user } = montar();
    const t = await tarjeta();
    await user.click(t.getByRole('button', { name: 'Solicitar cancelación' }));

    await user.click(t.getByRole('button', { name: 'Enviar solicitud' }));
    expect(t.getByRole('button', { name: 'Enviando...' })).toBeDisabled();
    expect(t.getByRole('button', { name: 'No, volver' })).toBeDisabled();

    await act(async () =>
      responder({ data: null, error: 'Ya no se puede pedir la cancelación de esta reserva.', status: 409 })
    );
    expect(t.getByRole('alert')).toHaveTextContent('Ya no se puede pedir la cancelación de esta reserva.');
    expect(t.getByLabelText('Motivo (opcional)')).toBeInTheDocument();

    solicitarCancelacionReserva.mockResolvedValueOnce(ok({ mensaje: 'Recibido.' }));
    await user.click(t.getByRole('button', { name: 'Enviar solicitud' }));
    expect(t.queryByRole('alert')).not.toBeInTheDocument();
    expect(t.getByRole('status')).toHaveTextContent('Recibido.');
  });

  it('"No, volver" cierra el formulario sin enviar y devuelve el foco al botón; al abrirlo otra vez, sin el error de antes', async () => {
    getMisReservas.mockResolvedValue(ok([reserva()]));
    solicitarCancelacionReserva.mockResolvedValue({ data: null, error: 'Demasiadas solicitudes.', status: 429 });
    const { user } = montar();
    const t = await tarjeta();
    await user.click(t.getByRole('button', { name: 'Solicitar cancelación' }));
    await user.click(t.getByRole('button', { name: 'Enviar solicitud' }));
    expect(t.getByRole('alert')).toBeInTheDocument();

    await user.click(t.getByRole('button', { name: 'No, volver' }));
    expect(t.queryByLabelText('Motivo (opcional)')).not.toBeInTheDocument();
    expect(t.getByRole('button', { name: 'Solicitar cancelación' })).toHaveFocus();

    await user.click(t.getByRole('button', { name: 'Solicitar cancelación' }));
    expect(t.queryByRole('alert')).not.toBeInTheDocument();
    expect(solicitarCancelacionReserva).toHaveBeenCalledTimes(1);
  });
});
