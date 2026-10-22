import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ModalContacto from './ModalContacto';
import { enviarContacto } from '../services/api';

vi.mock('../services/api', () => ({
  enviarContacto: vi.fn(),
}));

const MUEBLE = {
  id: '123',
  nombre: 'Mesa de nogal',
  referencia: 'NAV-MES-010',
  imagenes: ['https://img.test/mesa.jpg']
};

describe('ModalContacto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza la información de la pieza y el mensaje pre-rellenado con la referencia', () => {
    render(<ModalContacto mueble={MUEBLE} onClose={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'Solicitar información' })).toBeInTheDocument();
    expect(screen.getByText('Mesa de nogal')).toBeInTheDocument();
    expect(screen.getByText('Ref. NAV-MES-010')).toBeInTheDocument();
    expect(screen.getByLabelText('Mensaje')).toHaveValue(
      'Hola, me interesa la pieza "Mesa de nogal" (ref. NAV-MES-010). ¿Me podéis dar más información?'
    );
  });

  it('valida campos obligatorios antes de enviar', async () => {
    const user = userEvent.setup();
    render(<ModalContacto mueble={MUEBLE} onClose={vi.fn()} />);

    // Intentar enviar sin nombre
    await user.click(screen.getByRole('button', { name: 'Enviar solicitud' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Indica tu nombre.');
    expect(enviarContacto).not.toHaveBeenCalled();

    // Rellenar nombre pero email inválido
    await user.type(screen.getByLabelText('Nombre completo'), 'Carlos Perez');
    await user.type(screen.getByLabelText('Correo electrónico'), 'invalido');
    await user.click(screen.getByRole('button', { name: 'Enviar solicitud' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Indica un correo electrónico válido.');
  });

  it('envía los datos correctamente y muestra mensaje de éxito', async () => {
    enviarContacto.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ModalContacto mueble={MUEBLE} onClose={onClose} />);

    await user.type(screen.getByLabelText('Nombre completo'), 'Laura Gómez');
    await user.type(screen.getByLabelText('Correo electrónico'), 'laura@test.com');
    await user.click(screen.getByRole('button', { name: 'Enviar solicitud' }));

    expect(enviarContacto).toHaveBeenCalledWith(expect.objectContaining({
      nombre: 'Laura Gómez',
      email: 'laura@test.com',
      mensaje: expect.stringContaining('NAV-MES-010')
    }));

    expect(await screen.findByRole('status')).toHaveTextContent('Solicitud recibida');
    await user.click(screen.getByRole('button', { name: 'Cerrar y volver a la pieza' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('cierra con la tecla Escape o el botón de cerrar', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ModalContacto mueble={MUEBLE} onClose={onClose} />);

    await user.click(screen.getByLabelText('Cerrar ventana'));
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
