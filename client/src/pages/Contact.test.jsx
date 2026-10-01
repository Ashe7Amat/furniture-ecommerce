import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
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
    render(<Contact />);
    rellenar(datos);

    await enviar();

    expect(screen.getByText(aviso)).toBeInTheDocument();
    expect(enviarContacto).not.toHaveBeenCalled();
  });
});

describe('Contact — envío', () => {
  it('manda los datos (con el honeypot vacío), vacía el formulario y da las gracias', async () => {
    enviarContacto.mockResolvedValue({ success: true });
    render(<Contact />);
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
    render(<Contact />);
    rellenar();

    await enviar();

    expect(screen.getByRole('button', { name: 'Enviando…' })).toBeDisabled();
    await act(async () => terminar({ success: true }));
    expect(screen.getByRole('button', { name: 'Enviar Mensaje' })).toBeEnabled();
  });

  it('el aviso de enviado desaparece a los 6 segundos', async () => {
    vi.useFakeTimers();
    enviarContacto.mockResolvedValue({ success: true });
    render(<Contact />);
    rellenar();
    await enviar();
    expect(screen.getByText(/Mensaje enviado con éxito/)).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(6000));

    expect(screen.queryByText(/Mensaje enviado con éxito/)).not.toBeInTheDocument();
  });

  it('si el servidor lo rechaza, enseña su motivo y conserva lo escrito', async () => {
    enviarContacto.mockResolvedValue({ error: 'Has enviado demasiados mensajes. Espera unos minutos antes de volver a intentarlo.' });
    render(<Contact />);
    rellenar();

    await enviar();

    expect(screen.getByText(/Has enviado demasiados mensajes/)).toBeInTheDocument();
    expect(campos().nombre).toHaveValue('Ana García');
    expect(screen.queryByText(/Mensaje enviado con éxito/)).not.toBeInTheDocument();
  });

  it('pone el título de la página', () => {
    render(<Contact />);
    expect(screen.getByRole('heading', { level: 1, name: 'Conecta con Nosotros' })).toBeInTheDocument();
    expect(document.title).toMatch(/Conecta con Nosotros/);
  });
});
