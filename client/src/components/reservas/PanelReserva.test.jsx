// "Alquilar por fechas" en la ficha (PanelReserva.jsx): reglas y precio por día, horas y trayectos, el
// precio en vivo del servidor, y el botón "Reservar" según la sesión y el email de la cuenta, con el
// paso de confirmación, el inicio de sesión y el 409 de unas fechas que se acaban de ocupar.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, within, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import PanelReserva from './PanelReserva';
import { AuthContext } from '../../context/AuthContext';
import { ToastContext } from '../../context/ToastContext';
import {
  getPresupuestoReserva,
  reenviarVerificacion,
  crearSesionPagoReserva,
  loginUser
} from '../../services/api';
import { eurosDeCentimos, HORAS_TRAYECTO } from '../../utils/reservas';

// Los importes llevan un espacio duro antes del "€"; toHaveTextContent compara con los espacios normalizados.
const euros = (centimos) => eurosDeCentimos(centimos).replace(/\s/g, ' ');

vi.mock('../../services/api', () => ({
  getPresupuestoReserva: vi.fn(),
  reenviarVerificacion: vi.fn(),
  crearSesionPagoReserva: vi.fn(),
  loginUser: vi.fn(),
  registerUser: vi.fn()
}));

const MUEBLE = { id: 'm1', nombre: 'Aparador de roble' };
// Hoy es el lunes 2 de noviembre de 2026 (ver CalendarioReserva.test.jsx).
const DISP = {
  mueble_id: 'm1',
  hoy: '2026-11-02',
  alquilable: true,
  comprable: true,
  precio_dia_centimos: 2500,
  reglas: {
    duracion_min_dias: 1,
    duracion_max_dias: 30,
    dias_margen: 2,
    tramos_descuento: [
      { desde_dias: 7, porcentaje: 10 },
      { desde_dias: 30, porcentaje: 0 }
    ]
  },
  primer_inicio_posible: '2026-11-04',
  ultimo_inicio_posible: '2026-12-02',
  ocupado: [{ desde: '2026-11-10', hasta: '2026-11-15', tipo: 'reservado' }]
};
const presupuesto = (extra = {}) => ({
  mueble_id: 'm1',
  fecha_inicio: '2026-11-04',
  hora_entrega: '10:00',
  fecha_fin: '2026-11-07',
  hora_recogida: '10:00',
  dias: 3,
  precio_dia_centimos: 2500,
  subtotal_alquiler_centimos: 7500,
  tramo: null,
  descuento_centimos: 0,
  entrega: { modo: 'domicilio', importe_centimos: 3000 },
  recogida: { modo: 'domicilio', importe_centimos: 3000 },
  importe_total_centimos: 13500,
  lineas: [],
  ...extra
});
const ok = (data) => ({ data, error: null, status: 200 });
const ANA = { nombre: 'Ana', email: 'ana@correo.es', email_verificado: true };

// Una sesión de verdad (con estado): login() la cambia, como AuthProvider.
const ConSesion = ({ inicial, children }) => {
  const [user, setUser] = useState(inicial);
  return <AuthContext.Provider value={{ user, login: (u) => setUser(u) }}>{children}</AuthContext.Provider>;
};

const montar = ({ user = ANA, disponibilidad = DISP } = {}) => {
  const onRecargar = vi.fn();
  const showToast = vi.fn();
  const usuario = userEvent.setup();
  render(
    <MemoryRouter>
      <ToastContext.Provider value={{ showToast }}>
        <ConSesion inicial={user}>
          <PanelReserva mueble={MUEBLE} disponibilidad={disponibilidad} onRecargar={onRecargar} />
        </ConSesion>
      </ToastContext.Provider>
    </MemoryRouter>
  );
  return { user: usuario, onRecargar };
};

const dia = (nombre) => screen.getByRole('button', { name: nombre });
const elegirDel4Al7 = async (user) => {
  await user.click(dia('miércoles, 4 de noviembre de 2026'));
  await user.click(dia('sábado, 7 de noviembre de 2026'));
};
const trayecto = (nombre) => within(screen.getByRole('group', { name: nombre }));
const total = () => document.querySelector('.reserva-desglose-fila--total dd');
const reservar = () => screen.getByRole('button', { name: /^(Reservar|Inicia sesión para reservar)$/ });

beforeEach(() => {
  vi.resetAllMocks();
});

describe('PanelReserva — qué se enseña', () => {
  it('título, precio por día y reglas, con los descuentos que existen', () => {
    montar();

    expect(screen.getByRole('region', { name: 'Alquilar por fechas' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Alquilar por fechas' })).toBeInTheDocument();
    expect(document.querySelector('.reserva-panel-precio')).toHaveTextContent(`${euros(2500)} al día`);
    expect(screen.getByText('Mínimo 1 día, máximo 30 días. Descuento: 10 % desde 7 días.')).toBeInTheDocument();
  });

  it('sin descuentos, solo la duración', () => {
    montar({
      disponibilidad: { ...DISP, reglas: { ...DISP.reglas, duracion_min_dias: 2, tramos_descuento: [] } }
    });
    expect(screen.getByText('Mínimo 2 días, máximo 30 días.')).toBeInTheDocument();
  });

  it('horas de entrega y recogida (10:00 por defecto) y los dos trayectos a domicilio por defecto', () => {
    montar();

    for (const nombre of ['Entrega', 'Recogida']) {
      const grupo = trayecto(nombre);
      const hora = grupo.getByLabelText(`Hora de ${nombre.toLowerCase()}`);
      expect(hora).toHaveValue('10:00');
      expect(within(hora).getAllByRole('option').map((o) => o.value)).toEqual(HORAS_TRAYECTO);
      expect(grupo.getByRole('radio', { name: 'A domicilio' })).toBeChecked();
      expect(grupo.getByRole('radio', { name: 'En la tienda' })).not.toBeChecked();
    }
    expect(screen.getByText('Cada día de alquiler son 24 horas desde la hora de entrega.')).toBeInTheDocument();
  });
});

describe('PanelReserva — precio en vivo', () => {
  it('con las dos fechas pide el presupuesto, avisa mientras llega y enseña el desglose', async () => {
    let responder;
    getPresupuestoReserva.mockReturnValue(new Promise((r) => (responder = r)));
    const { user } = montar();

    await user.click(dia('miércoles, 4 de noviembre de 2026'));
    expect(getPresupuestoReserva).not.toHaveBeenCalled();
    await user.click(dia('sábado, 7 de noviembre de 2026'));

    expect(getPresupuestoReserva).toHaveBeenCalledWith('m1', {
      fecha_inicio: '2026-11-04',
      hora_entrega: '10:00',
      fecha_fin: '2026-11-07',
      hora_recogida: '10:00',
      entrega: 'domicilio',
      recogida: 'domicilio'
    });
    expect(screen.getByText('Calculando el precio...')).toBeInTheDocument();
    expect(reservar()).toBeDisabled();

    await act(async () => responder(ok(presupuesto())));
    expect(screen.queryByText('Calculando el precio...')).not.toBeInTheDocument();
    expect(total()).toHaveTextContent(`${euros(13500)} IVA incluido`);
    expect(reservar()).toBeEnabled();
  });

  it('cambiar una hora o un trayecto pide otro presupuesto; una respuesta vieja no se enseña', async () => {
    const pendientes = [];
    getPresupuestoReserva.mockImplementation(() => new Promise((r) => pendientes.push(r)));
    const { user } = montar();
    await elegirDel4Al7(user);

    await user.selectOptions(trayecto('Recogida').getByLabelText('Hora de recogida'), '12:30');
    await user.click(trayecto('Entrega').getByRole('radio', { name: 'En la tienda' }));

    expect(getPresupuestoReserva).toHaveBeenCalledTimes(3);
    expect(getPresupuestoReserva).toHaveBeenLastCalledWith('m1', {
      fecha_inicio: '2026-11-04',
      hora_entrega: '10:00',
      fecha_fin: '2026-11-07',
      hora_recogida: '12:30',
      entrega: 'tienda',
      recogida: 'domicilio'
    });

    // Llega tarde la primera: no se enseña
    await act(async () => pendientes[0](ok(presupuesto({ importe_total_centimos: 1 }))));
    expect(total()).toBeNull();
    expect(screen.getByText('Calculando el precio...')).toBeInTheDocument();

    await act(async () => pendientes[2](ok(presupuesto({ dias: 4, importe_total_centimos: 13000 }))));
    expect(total()).toHaveTextContent(euros(13000));
  });

  it('si una regla no se cumple, el mensaje del servidor, y no se puede reservar', async () => {
    getPresupuestoReserva.mockResolvedValue({
      data: null,
      error: 'El alquiler no puede pasar de 30 días.',
      status: 400
    });
    const { user } = montar();
    await elegirDel4Al7(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('El alquiler no puede pasar de 30 días.');
    expect(total()).toBeNull();
    expect(reservar()).toBeDisabled();
  });

  it('al empezar otra selección desaparece el desglose', async () => {
    getPresupuestoReserva.mockResolvedValue(ok(presupuesto()));
    const { user } = montar();
    await elegirDel4Al7(user);
    await waitFor(() => expect(total()).not.toBeNull());

    await user.click(dia('domingo, 15 de noviembre de 2026'));
    expect(total()).toBeNull();
    expect(reservar()).toBeDisabled();
  });
});

describe('PanelReserva — reservar', () => {
  it('con la cuenta confirmada y sin fechas, "Reservar" está desactivado y dice qué falta', () => {
    montar();
    expect(reservar()).toHaveTextContent('Reservar');
    expect(reservar()).toBeDisabled();
    expect(reservar()).toHaveAccessibleDescription('Elige en el calendario los días de entrega y de recogida.');
  });

  it('con precio, "Reservar" abre el paso de confirmación; al cerrarlo, el foco vuelve al botón', async () => {
    getPresupuestoReserva.mockResolvedValue(ok(presupuesto()));
    const { user } = montar();
    await elegirDel4Al7(user);
    await waitFor(() => expect(reservar()).toBeEnabled());
    expect(reservar()).not.toHaveAttribute('aria-describedby');

    await user.click(reservar());
    const dialogo = screen.getByRole('dialog', { name: 'Confirma tu reserva' });
    expect(within(dialogo).getByLabelText('Nombre y apellidos')).toHaveValue('Ana');

    await user.click(within(dialogo).getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(reservar()).toHaveFocus();
  });

  it('sin el email confirmado: lo explica, no deja reservar y ofrece otro correo con el enlace', async () => {
    getPresupuestoReserva.mockResolvedValue(ok(presupuesto()));
    let responder;
    reenviarVerificacion.mockReturnValueOnce(new Promise((r) => (responder = r)));
    const { user } = montar({ user: { ...ANA, email_verificado: false } });
    await elegirDel4Al7(user);
    await waitFor(() => expect(total()).not.toBeNull());

    expect(reservar()).toBeDisabled();
    expect(reservar()).toHaveAccessibleDescription('Confirma tu email para poder reservar.');
    expect(screen.getByText('Si no tienes el correo con el enlace, te mandamos uno nuevo.')).toBeInTheDocument();

    // La región de aviso ya está, vacía, antes de pedir nada
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    await user.click(screen.getByRole('button', { name: 'Enviar enlace' }));
    // Mientras envía no se vuelve a pedir, pero el botón conserva el foco
    const enviando = screen.getByRole('button', { name: 'Enviando...' });
    expect(enviando).toHaveAttribute('aria-disabled', 'true');
    expect(enviando).toHaveFocus();
    await user.click(enviando);
    expect(reenviarVerificacion).toHaveBeenCalledTimes(1);
    await act(async () => responder({ success: true }));
    expect(screen.getByRole('status')).toHaveTextContent('Te hemos enviado el correo.');

    reenviarVerificacion.mockResolvedValueOnce({ error: 'Ya te hemos enviado varios correos.' });
    await user.click(screen.getByRole('button', { name: 'Enviar enlace' }));
    expect(await screen.findByText('Ya te hemos enviado varios correos.')).toHaveAttribute('role', 'status');
  });

  it('una sesión de antes del campo email_verificado cuenta como sin confirmar', () => {
    const deAntes = { ...ANA };
    delete deAntes.email_verificado;
    montar({ user: deAntes });
    expect(reservar()).toHaveAccessibleDescription('Confirma tu email para poder reservar.');
  });

  it('sin sesión, el botón explica que hace falta una cuenta y abre el inicio de sesión; al entrar, sigue', async () => {
    getPresupuestoReserva.mockResolvedValue(ok(presupuesto()));
    loginUser.mockResolvedValue({ success: true, user: ANA, token: 'tk' });
    const { user } = montar({ user: null });
    await elegirDel4Al7(user);
    await waitFor(() => expect(total()).not.toBeNull());

    expect(reservar()).toHaveTextContent('Inicia sesión para reservar');
    expect(reservar()).toBeEnabled();
    expect(reservar()).toHaveAccessibleDescription('Para reservar necesitas una cuenta. Puedes crearla en un momento.');

    await user.click(reservar());
    const acceso = await screen.findByRole('dialog', { name: 'Iniciar Sesión' });
    // El acceso habla de la reserva, no de la cesta
    expect(within(acceso).getByText('Entra en tu cuenta para reservar esta pieza.')).toBeInTheDocument();
    expect(within(acceso).queryByText(/finalizar la compra/)).not.toBeInTheDocument();
    await user.type(within(acceso).getByPlaceholderText('tu@correo.com'), 'ana@correo.es');
    await user.type(within(acceso).getByPlaceholderText('••••••••'), 'secreta');
    await user.click(within(acceso).getByRole('button', { name: 'Entrar y seguir con la reserva' }));

    expect(loginUser).toHaveBeenCalledWith('ana@correo.es', 'secreta');
    expect(await screen.findByRole('dialog', { name: 'Confirma tu reserva' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Iniciar Sesión' })).not.toBeInTheDocument();
  });

  it('si al entrar aún no hay precio, o el email no está confirmado, no se abre la confirmación', async () => {
    loginUser.mockResolvedValue({ success: true, user: { ...ANA, email_verificado: false }, token: 'tk' });
    const { user } = montar({ user: null });

    await user.click(reservar());
    const acceso = await screen.findByRole('dialog', { name: 'Iniciar Sesión' });
    await user.type(within(acceso).getByPlaceholderText('tu@correo.com'), 'ana@correo.es');
    await user.type(within(acceso).getByPlaceholderText('••••••••'), 'secreta');
    await user.click(within(acceso).getByRole('button', { name: 'Entrar y seguir con la reserva' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(reservar()).toHaveTextContent('Reservar');
    expect(reservar()).toHaveAccessibleDescription('Confirma tu email para poder reservar.');
  });
});

describe('PanelReserva — errores al crear la reserva', () => {
  const abrirConfirmacion = async (user) => {
    await elegirDel4Al7(user);
    await waitFor(() => expect(reservar()).toBeEnabled());
    await user.click(reservar());
    const dialogo = screen.getByRole('dialog', { name: 'Confirma tu reserva' });
    await user.type(within(dialogo).getByLabelText('Teléfono'), '600123123');
    await user.type(within(dialogo).getByLabelText('Dirección de entrega y recogida'), 'Calle Mayor 1');
    await user.click(within(dialogo).getByRole('checkbox'));
    await user.click(within(dialogo).getByRole('button', { name: /^Pagar/ }));
  };

  it('409: cierra la confirmación, quita las fechas, avisa y vuelve a pedir el calendario', async () => {
    getPresupuestoReserva.mockResolvedValue(ok(presupuesto()));
    crearSesionPagoReserva.mockResolvedValue({
      data: null,
      error: 'Esas fechas se acaban de reservar. Elige otras.',
      status: 409
    });
    const { user, onRecargar } = montar();

    await abrirConfirmacion(user);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Esas fechas se acaban de reservar. Elige otras.');
    // "Reservar" queda desactivado (no hay fechas): el foco va al aviso
    expect(reservar()).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveFocus();
    expect(onRecargar).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Elige el día de entrega.')).toBeInTheDocument();
    expect(total()).toBeNull();

    // Al elegir otra fecha, el aviso se va
    await user.click(dia('domingo, 15 de noviembre de 2026'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('401: "Iniciar sesión" cierra la confirmación y abre el acceso; al entrar, vuelve a la confirmación', async () => {
    getPresupuestoReserva.mockResolvedValue(ok(presupuesto()));
    crearSesionPagoReserva.mockResolvedValue({ data: null, error: 'Tu sesión ha caducado.', status: 401 });
    loginUser.mockResolvedValue({ success: true, user: ANA, token: 'tk-nuevo' });
    const { user } = montar();

    await abrirConfirmacion(user);
    await user.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Iniciar sesión' }));

    const acceso = await screen.findByRole('dialog', { name: 'Iniciar Sesión' });
    expect(screen.queryByRole('dialog', { name: 'Confirma tu reserva' })).not.toBeInTheDocument();
    await user.type(within(acceso).getByPlaceholderText('tu@correo.com'), 'ana@correo.es');
    await user.type(within(acceso).getByPlaceholderText('••••••••'), 'secreta');
    await user.click(within(acceso).getByRole('button', { name: 'Entrar y seguir con la reserva' }));

    expect(await screen.findByRole('dialog', { name: 'Confirma tu reserva' })).toBeInTheDocument();
  });

  it('401 con la sesión ya cerrada en el contexto (renovación rechazada): sigue la confirmación y pide iniciar sesión', async () => {
    getPresupuestoReserva.mockResolvedValue(ok(presupuesto()));
    let cerrarSesion;
    const Cierra = ({ children }) => {
      const [sesion, setSesion] = useState(ANA);
      cerrarSesion = () => setSesion(null);
      return <AuthContext.Provider value={{ user: sesion, login: (u) => setSesion(u) }}>{children}</AuthContext.Provider>;
    };
    // apiFetch cierra la sesión local (setUser(null)) antes de devolver el 401
    crearSesionPagoReserva.mockImplementation(async () => {
      cerrarSesion();
      return { data: null, error: 'No has iniciado sesión.', status: 401 };
    });
    const usuario = userEvent.setup();
    render(
      <MemoryRouter>
        <ToastContext.Provider value={{ showToast: vi.fn() }}>
          <Cierra>
            <PanelReserva mueble={MUEBLE} disponibilidad={DISP} onRecargar={vi.fn()} />
          </Cierra>
        </ToastContext.Provider>
      </MemoryRouter>
    );

    await abrirConfirmacion(usuario);

    const dialogo = screen.getByRole('dialog', { name: 'Confirma tu reserva' });
    expect(within(dialogo).getByRole('alert')).toHaveTextContent(
      'Tu sesión ha caducado. Vuelve a iniciar sesión para reservar.'
    );
    expect(within(dialogo).getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });

  it('cerrar el acceso sin entrar no abre nada', async () => {
    const { user } = montar({ user: null });
    await user.click(reservar());
    const acceso = await screen.findByRole('dialog', { name: 'Iniciar Sesión' });

    await user.click(within(acceso).getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(reservar()).toHaveTextContent('Inicia sesión para reservar');
  });
});
