// El paso de confirmación de una reserva (ReservaModal.jsx): resumen y desglose, datos de contacto,
// aceptación obligatoria de las condiciones, paso al pago de Stripe y cada error del servidor.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ReservaModal from './ReservaModal';
import { crearSesionPagoReserva, reenviarVerificacion } from '../../services/api';
import { eurosDeCentimos } from '../../utils/reservas';

// Los importes llevan un espacio duro antes del "€"; getByText compara con los espacios normalizados.
const euros = (centimos) => eurosDeCentimos(centimos).replace(/\s/g, ' ');

vi.mock('../../services/api', () => ({ crearSesionPagoReserva: vi.fn(), reenviarVerificacion: vi.fn() }));

const MUEBLE = { id: 'm1', nombre: 'Aparador de roble' };
const SELECCION = {
  fecha_inicio: '2026-11-04',
  hora_entrega: '10:00',
  fecha_fin: '2026-11-07',
  hora_recogida: '12:30',
  entrega: 'domicilio',
  recogida: 'tienda'
};
const PRESUPUESTO = {
  mueble_id: 'm1',
  ...SELECCION,
  dias: 4,
  precio_dia_centimos: 2500,
  subtotal_alquiler_centimos: 10000,
  tramo: null,
  descuento_centimos: 0,
  entrega: { modo: 'domicilio', importe_centimos: 3000 },
  recogida: { modo: 'tienda', importe_centimos: 0 },
  importe_total_centimos: 13000,
  lineas: []
};
const ANA = { nombre: 'Ana', email: 'ana@correo.es', email_verificado: true };

const abrir = ({ seleccion = SELECCION, user = ANA } = {}) => {
  const props = { onClose: vi.fn(), onConflicto: vi.fn(), onPedirSesion: vi.fn() };
  const usuario = userEvent.setup();
  render(
    <MemoryRouter>
      <button type="button">Reservar</button>
      <ReservaModal mueble={MUEBLE} seleccion={seleccion} presupuesto={PRESUPUESTO} user={user} {...props} />
    </MemoryRouter>
  );
  return { user: usuario, ...props };
};

const dialogo = () => screen.getByRole('dialog', { name: 'Confirma tu reserva' });
const pagar = () => screen.getByRole('button', { name: /^Pagar|Conectando/ });
const rellenar = async (user, { telefono = '600 123 123', direccion = 'Calle Mayor 1, Barcelona' } = {}) => {
  await user.type(screen.getByLabelText('Teléfono'), telefono);
  if (direccion) await user.type(screen.getByLabelText(/^Dirección/), direccion);
  await user.click(screen.getByRole('checkbox', { name: 'He leído y acepto las condiciones del alquiler' }));
};

let locationOriginal;
beforeEach(() => {
  vi.resetAllMocks();
  // jsdom no navega: window.location se sustituye por un objeto con assign.
  locationOriginal = window.location;
  delete window.location;
  window.location = { assign: vi.fn() };
});
afterEach(() => {
  window.location = locationOriginal;
});

describe('ReservaModal — resumen', () => {
  it('es un diálogo modal con la pieza, las fechas, las horas, los trayectos y el desglose', () => {
    abrir();
    const d = within(dialogo());

    expect(dialogo()).toHaveAttribute('aria-modal', 'true');
    expect(d.getByText('Aparador de roble')).toBeInTheDocument();
    expect(d.getByText('miércoles, 4 de noviembre de 2026, a las 10:00, a domicilio')).toBeInTheDocument();
    expect(d.getByText('sábado, 7 de noviembre de 2026, a las 12:30, en la tienda')).toBeInTheDocument();
    expect(d.getByText(`4 días × ${euros(2500)}`)).toBeInTheDocument();
    expect(d.getByText('Recogida en la tienda')).toBeInTheDocument();
    expect(d.getByRole('button', { name: `Pagar ${eurosDeCentimos(13000)}` })).toBeEnabled();
  });

  it('al abrir, el foco entra en el diálogo; "Cerrar" y Escape lo cierran', async () => {
    const { user, onClose } = abrir();
    expect(dialogo()).toContainElement(document.activeElement);

    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('las condiciones se abren en otra pestaña, sin perder lo escrito', () => {
    abrir();
    const enlace = screen.getByRole('link', { name: 'condiciones del alquiler' });
    expect(enlace).toHaveAttribute('href', '/terminos');
    expect(enlace).toHaveAttribute('target', '_blank');
    expect(enlace).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

describe('ReservaModal — datos de contacto', () => {
  it('el nombre viene de la cuenta; sin nombre en la cuenta, vacío', () => {
    abrir();
    expect(screen.getByLabelText('Nombre y apellidos')).toHaveValue('Ana');
  });

  it('una cuenta sin nombre deja el campo vacío', () => {
    abrir({ user: { email: 'x@correo.es', email_verificado: true } });
    expect(screen.getByLabelText('Nombre y apellidos')).toHaveValue('');
  });

  it.each([
    ['domicilio', 'tienda', 'Dirección de entrega'],
    ['tienda', 'domicilio', 'Dirección de recogida'],
    ['domicilio', 'domicilio', 'Dirección de entrega y recogida']
  ])('entrega %s y recogida %s: pide "%s"', (entrega, recogida, etiqueta) => {
    abrir({ seleccion: { ...SELECCION, entrega, recogida } });
    expect(screen.getByLabelText(etiqueta)).toBeInTheDocument();
  });

  it('con los dos trayectos en la tienda no pide dirección', () => {
    abrir({ seleccion: { ...SELECCION, entrega: 'tienda', recogida: 'tienda' } });
    expect(screen.queryByLabelText(/^Dirección/)).not.toBeInTheDocument();
  });

  it('los campos tienen los límites del servidor', () => {
    abrir();
    expect(screen.getByLabelText('Nombre y apellidos')).toHaveAttribute('maxLength', '100');
    expect(screen.getByLabelText('Teléfono')).toHaveAttribute('maxLength', '30');
    expect(screen.getByLabelText('Dirección de entrega')).toHaveAttribute('maxLength', '500');
    expect(screen.getByLabelText('Notas (opcional)')).toHaveAttribute('maxLength', '500');
  });

  it('sin rellenar lo obligatorio no pide nada: marca los errores y lleva el foco al primero', async () => {
    const { user } = abrir();
    await user.clear(screen.getByLabelText('Nombre y apellidos'));

    await user.click(pagar());

    expect(crearSesionPagoReserva).not.toHaveBeenCalled();
    const nombre = screen.getByLabelText('Nombre y apellidos');
    expect(nombre).toHaveFocus();
    expect(nombre).toHaveAttribute('aria-invalid', 'true');
    expect(nombre).toHaveAccessibleDescription('Escribe tu nombre.');
    expect(screen.getByLabelText('Teléfono')).toHaveAccessibleDescription('Escribe un teléfono de contacto.');
    expect(screen.getByLabelText('Dirección de entrega')).toHaveAccessibleDescription('Escribe la dirección.');
    expect(screen.getByRole('checkbox')).toHaveAccessibleDescription('Tienes que aceptar las condiciones del alquiler.');
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('la casilla de las condiciones es obligatoria', async () => {
    const { user } = abrir();
    await user.type(screen.getByLabelText('Teléfono'), '600123123');
    await user.type(screen.getByLabelText('Dirección de entrega'), 'Calle Mayor 1');

    await user.click(pagar());

    expect(crearSesionPagoReserva).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox')).toHaveFocus();
    expect(screen.getByLabelText('Teléfono')).not.toHaveAttribute('aria-invalid');
  });
});

describe('ReservaModal — pago', () => {
  it('crea la reserva con la selección y los datos (sin espacios de más) y lleva a Stripe', async () => {
    crearSesionPagoReserva.mockResolvedValue({ data: { url: 'https://checkout.stripe.com/c/pay/cs_1' }, error: null, status: 200 });
    const { user } = abrir();
    await rellenar(user, { telefono: ' 600 123 123 ', direccion: '  Calle Mayor 1  ' });
    await user.type(screen.getByLabelText('Notas (opcional)'), ' Tercer piso, sin ascensor ');

    await user.click(pagar());

    expect(crearSesionPagoReserva).toHaveBeenCalledWith({
      mueble_id: 'm1',
      ...SELECCION,
      contacto: {
        nombre: 'Ana',
        telefono: '600 123 123',
        direccion: 'Calle Mayor 1',
        notas: 'Tercer piso, sin ascensor'
      },
      acepta_condiciones: true
    });
    expect(window.location.assign).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_1');
    // Mientras se va a Stripe, el botón sigue desactivado
    expect(screen.getByRole('button', { name: 'Conectando con el pago...' })).toBeDisabled();
  });

  it('sin notas ni trayectos a domicilio, el contacto lleva solo nombre y teléfono', async () => {
    crearSesionPagoReserva.mockResolvedValue({ data: { url: 'https://checkout.stripe.com/x' }, error: null, status: 200 });
    const { user } = abrir({ seleccion: { ...SELECCION, entrega: 'tienda', recogida: 'tienda' } });
    await rellenar(user, { direccion: null });

    await user.click(pagar());

    expect(crearSesionPagoReserva.mock.calls[0][0].contacto).toEqual({ nombre: 'Ana', telefono: '600 123 123' });
  });

  it('mientras se crea no se puede pedir otra vez ni cerrar el diálogo', async () => {
    let responder;
    crearSesionPagoReserva.mockReturnValue(new Promise((r) => (responder = r)));
    const { user, onClose } = abrir();
    await rellenar(user);

    await user.click(pagar());
    expect(pagar()).toBeDisabled();
    expect(pagar()).toHaveTextContent('Conectando con el pago...');
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeDisabled();
    await user.keyboard('{Escape}');
    // Un segundo envío del formulario (por ejemplo, un doble clic muy rápido) tampoco repite la petición
    fireEvent.submit(pagar().closest('form'));
    expect(onClose).not.toHaveBeenCalled();
    expect(crearSesionPagoReserva).toHaveBeenCalledTimes(1);

    await act(async () => responder({ data: null, error: 'No se pudo iniciar el pago.', status: 503 }));
    expect(pagar()).toBeEnabled();
  });

  it('409: avisa a la ficha con el mensaje del servidor (recarga el calendario y quita las fechas)', async () => {
    crearSesionPagoReserva.mockResolvedValue({
      data: null,
      error: 'Esas fechas se acaban de reservar. Elige otras.',
      status: 409
    });
    const { user, onConflicto } = abrir();
    await rellenar(user);

    await user.click(pagar());

    expect(onConflicto).toHaveBeenCalledWith('Esas fechas se acaban de reservar. Elige otras.');
    expect(window.location.assign).not.toHaveBeenCalled();
  });

  it('401: pide volver a iniciar sesión, con un botón que lo abre', async () => {
    crearSesionPagoReserva.mockResolvedValue({ data: null, error: 'No has iniciado sesión.', status: 401 });
    const { user, onPedirSesion } = abrir();
    await rellenar(user);

    await user.click(pagar());

    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('Tu sesión ha caducado. Vuelve a iniciar sesión para reservar.');
    await user.click(within(alerta).getByRole('button', { name: 'Iniciar sesión' }));
    expect(onPedirSesion).toHaveBeenCalledTimes(1);
    expect(pagar()).toBeEnabled();
  });

  it('403 sin código (el alquiler cerrado): el mensaje del servidor tal cual', async () => {
    crearSesionPagoReserva.mockResolvedValue({
      data: null,
      error: 'El alquiler online no está disponible en este momento.',
      status: 403
    });
    const { user } = abrir();
    await rellenar(user);

    await user.click(pagar());

    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('El alquiler online no está disponible en este momento.');
    expect(within(alerta).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar enlace' })).not.toBeInTheDocument();
  });

  it('403 por el email sin confirmar: "Confirma tu email para poder reservar." y otro correo con el enlace', async () => {
    crearSesionPagoReserva.mockResolvedValue({
      data: null,
      error: 'Otro texto del servidor.',
      status: 403,
      codigo: 'email_no_verificado'
    });
    reenviarVerificacion.mockResolvedValue({ success: true });
    const { user } = abrir();
    await rellenar(user);

    await user.click(pagar());

    expect(screen.getByRole('alert')).toHaveTextContent('Confirma tu email para poder reservar.');
    expect(screen.getByText('Si no tienes el correo con el enlace, te mandamos uno nuevo.')).toBeInTheDocument();
    await user.click(within(dialogo()).getByRole('button', { name: 'Enviar enlace' }));
    expect(reenviarVerificacion).toHaveBeenCalledTimes(1);
    expect(await within(dialogo()).findByRole('status')).toHaveTextContent('Te hemos enviado el correo.');
    expect(pagar()).toBeEnabled();
  });

  it('un código en otro status no cambia nada: el mensaje del servidor', async () => {
    crearSesionPagoReserva.mockResolvedValue({
      data: null,
      error: 'Revisa los datos.',
      status: 400,
      codigo: 'email_no_verificado'
    });
    const { user } = abrir();
    await rellenar(user);

    await user.click(pagar());

    expect(screen.getByRole('alert')).toHaveTextContent('Revisa los datos.');
    expect(screen.queryByRole('button', { name: 'Enviar enlace' })).not.toBeInTheDocument();
  });

  it('una respuesta correcta sin url: un mensaje por defecto; al volver a intentarlo se quita', async () => {
    crearSesionPagoReserva.mockResolvedValueOnce({ data: {}, error: null, status: 200 });
    const { user } = abrir();
    await rellenar(user);

    await user.click(pagar());
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo iniciar el pago.');

    crearSesionPagoReserva.mockReturnValueOnce(new Promise(() => {}));
    await user.click(pagar());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
