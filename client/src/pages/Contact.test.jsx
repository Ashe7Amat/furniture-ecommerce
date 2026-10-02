import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Contact from './Contact';
import { enviarContacto } from '../services/api';

vi.mock('../services/api');

// Las etiquetas del formulario no están asociadas a sus campos (no llevan htmlFor), así que los
// campos se buscan por su rol y su orden: nombre, email y mensaje. El honeypot lleva aria-hidden y
// no sale en getAllByRole.
const campos = () => {
  const [nombre, email, mensaje] = screen.getAllByRole('textbox');
  return { nombre, email, mensaje };
};
const rellenar = ({ nombre = 'Ana García', email = 'ana@correo.es', mensaje = 'Quería preguntar por el aparador de roble.' } = {}) => {
  const c = campos();
  fireEvent.change(c.nombre, { target: { value: nombre } });
  fireEvent.change(c.email, { target: { value: email } });
  fireEvent.change(c.mensaje, { target: { value: mensaje } });
};
// Se envía con el evento submit, como en los tests del panel: así se prueba la validación propia
// del formulario, no la del navegador (los campos llevan `required`).
const enviar = () =>
  act(async () => {
    fireEvent.submit(screen.getByRole('button', { name: /Enviar/ }).closest('form'));
  });

// CAMBIADO A PROPÓSITO (fase C, 2 oct 2026): Contact lee la URL (?pieza=…, C3), así que se monta
// dentro de un router, con la ruta que se quiera.
const montar = (ruta = '/contacto') =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <Contact />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.resetAllMocks();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Contact — validación', () => {
  it.each([
    ['un nombre de una letra', { nombre: 'A' }, 'Indica tu nombre.'],
    ['un nombre de solo espacios', { nombre: '   ' }, 'Indica tu nombre.'],
    ['un correo sin punto en el dominio', { email: 'ana@correo' }, 'Indica un correo electrónico válido.'],
    ['un mensaje de menos de 10 caracteres', { mensaje: 'Hola' }, 'Cuéntanos un poco más — el mensaje debe tener al menos 10 caracteres.'],
  ])('%s: avisa y no manda nada', async (_caso, datos, aviso) => {
    montar();
    rellenar(datos);

    await enviar();

    expect(screen.getByText(aviso)).toBeInTheDocument();
    expect(enviarContacto).not.toHaveBeenCalled();
  });
});

describe('Contact — envío', () => {
  it('manda los datos (con el honeypot vacío), vacía el formulario y da las gracias', async () => {
    enviarContacto.mockResolvedValue({ success: true });
    montar();
    rellenar();

    await enviar();

    expect(enviarContacto).toHaveBeenCalledWith({
      nombre: 'Ana García',
      email: 'ana@correo.es',
      mensaje: 'Quería preguntar por el aparador de roble.',
      web: '',
    });
    expect(screen.getByText(/Mensaje enviado con éxito/)).toBeInTheDocument();
    expect(Object.values(campos()).map((c) => c.value)).toEqual(['', '', '']);
  });

  it('mientras envía, el botón dice "Enviando…" y está desactivado', async () => {
    let terminar;
    enviarContacto.mockReturnValue(new Promise((resolve) => (terminar = resolve)));
    montar();
    rellenar();

    await enviar();

    expect(screen.getByRole('button', { name: 'Enviando…' })).toBeDisabled();
    await act(async () => terminar({ success: true }));
    expect(screen.getByRole('button', { name: 'Enviar Mensaje' })).toBeEnabled();
  });

  it('el aviso de enviado desaparece a los 6 segundos', async () => {
    vi.useFakeTimers();
    enviarContacto.mockResolvedValue({ success: true });
    montar();
    rellenar();
    await enviar();
    expect(screen.getByText(/Mensaje enviado con éxito/)).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(6000));

    expect(screen.queryByText(/Mensaje enviado con éxito/)).not.toBeInTheDocument();
  });

  it('si el servidor lo rechaza, enseña su motivo y conserva lo escrito', async () => {
    enviarContacto.mockResolvedValue({ error: 'Has enviado demasiados mensajes. Espera unos minutos antes de volver a intentarlo.' });
    montar();
    rellenar();

    await enviar();

    expect(screen.getByText(/Has enviado demasiados mensajes/)).toBeInTheDocument();
    expect(campos().nombre).toHaveValue('Ana García');
    expect(screen.queryByText(/Mensaje enviado con éxito/)).not.toBeInTheDocument();
  });

  it('pone el título de la página', () => {
    montar();
    expect(screen.getByRole('heading', { level: 1, name: 'Conecta con Nosotros' })).toBeInTheDocument();
    expect(document.title).toMatch(/Conecta con Nosotros/);
  });
});

// C3: desde "Preguntar por esta pieza" se llega con la pieza en la URL, y el mensaje empieza escrito.
describe('Contact — llegando desde "Preguntar por esta pieza" (fase C)', () => {
  it('el mensaje empieza con la pieza y su referencia; el resto del formulario, vacío', () => {
    montar('/contacto?pieza=Aparador+de+roble&ref=NAV-MES-004');
    const c = campos();
    expect(c.mensaje).toHaveValue('Hola, me interesa la pieza "Aparador de roble" (ref. NAV-MES-004). ¿Me podéis dar más información?');
    expect(c.nombre).toHaveValue('');
    expect(c.email).toHaveValue('');
  });

  it('sin pieza en la URL, el mensaje empieza vacío, como siempre', () => {
    montar('/contacto');
    expect(campos().mensaje).toHaveValue('');
  });

  it('el mensaje precargado se puede cambiar, y es lo que se envía', async () => {
    enviarContacto.mockResolvedValue({ success: true });
    montar('/contacto?pieza=Aparador');
    rellenar({ mensaje: 'Hola, ¿el aparador sigue disponible para verlo el viernes?' });
    await enviar();

    expect(enviarContacto).toHaveBeenCalledWith(expect.objectContaining({
      mensaje: 'Hola, ¿el aparador sigue disponible para verlo el viernes?'
    }));
  });

  it('el mensaje precargado ya cumple el mínimo de 10 caracteres y se envía tal cual', async () => {
    enviarContacto.mockResolvedValue({ success: true });
    montar('/contacto?pieza=Baúl');
    const c = campos();
    fireEvent.change(c.nombre, { target: { value: 'Ana García' } });
    fireEvent.change(c.email, { target: { value: 'ana@correo.es' } });
    await enviar();

    expect(enviarContacto).toHaveBeenCalledWith(expect.objectContaining({
      mensaje: 'Hola, me interesa la pieza "Baúl". ¿Me podéis dar más información?'
    }));
  });
});
