import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import EditarMuebleModal from './EditarMuebleModal';
import { ToastContext } from '../../../context/ToastContext';
import { updateMueble } from '../../../services/api';
import { prepararFotos } from '../../../utils/imagen';

vi.mock('../../../services/api', () => ({ updateMueble: vi.fn() }));
// jsdom no reduce fotos (no hay canvas): las deja tal cual, y caben.
vi.mock('../../../utils/imagen', async (original) => ({
  ...(await original()),
  prepararFotos: vi.fn(async (archivos) => ({ fotos: archivos, peso: 0, caben: true }))
}));

// La foto de antes de restaurar, para el "antes y después" de la ficha (server/src/__tests__/imagenAntes.test.js).
const SOFA = {
  id: 'm1',
  referencia: 'NAV-SIL-001',
  nombre: 'Sofá',
  categoria: 'Sillas y asientos',
  descripcion: 'Sofá de tres plazas',
  estado: 'disponible',
  imagenes: ['https://img.test/1.jpg']
};

const Editor = ({ inicial = SOFA }) => {
  const [mueble, setMueble] = useState(inicial);
  const [archivos, setArchivos] = useState([]);
  return (
    <ToastContext.Provider value={{ showToast: vi.fn() }}>
      <EditarMuebleModal
        mueble={mueble}
        setMueble={setMueble}
        archivosNuevos={archivos}
        setArchivosNuevos={setArchivos}
        categorias={[
          { id: 17, nombre: 'Mobiliario', categoria_padre_id: null },
          { id: 20, nombre: 'Sillas y asientos', categoria_padre_id: 17 }
        ]}
        confirmarBorrado={(_titulo, _texto, aceptar) => aceptar()}
        onGuardado={vi.fn()}
        onCerrar={vi.fn()}
      />
    </ToastContext.Provider>
  );
};
const enviado = () => updateMueble.mock.calls[0][1];
const guardar = async (user) => {
  await user.click(screen.getByRole('button', { name: 'Guardar Cambios' }));
  await waitFor(() => expect(updateMueble).toHaveBeenCalledTimes(1));
};

beforeEach(() => {
  updateMueble.mockReset();
  updateMueble.mockResolvedValue({ success: true });
  prepararFotos.mockClear();
});

describe('EditarMuebleModal — foto de antes de restaurar', () => {
  it('la foto elegida se manda en su propio campo, y no entre las fotos de la pieza', async () => {
    const user = userEvent.setup();
    render(<Editor />);
    const antes = new File(['x'], 'antes.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByLabelText('Foto de antes de restaurar (opcional):'), antes);
    await guardar(user);

    expect(enviado().get('imagen_antes')).toBe(antes);
    expect(enviado().getAll('imagenes')).toEqual([]);
    expect(enviado().has('quitar_imagen_antes')).toBe(false);
    // Se reduce junto con las demás fotos de la petición.
    expect(prepararFotos.mock.calls[0][0]).toEqual([antes]);
  });

  it('con fotos nuevas y foto de antes, cada una va a su campo', async () => {
    const user = userEvent.setup();
    const { container } = render(<Editor />);
    const nueva = new File(['n'], 'nueva.jpg', { type: 'image/jpeg' });
    const antes = new File(['a'], 'antes.jpg', { type: 'image/jpeg' });
    await user.upload(container.querySelector('input[type="file"][multiple]'), nueva);
    await user.upload(screen.getByLabelText('Foto de antes de restaurar (opcional):'), antes);
    await guardar(user);

    expect(enviado().getAll('imagenes')).toEqual([nueva]);
    expect(enviado().get('imagen_antes')).toBe(antes);
  });

  it('la que ya tiene se ve, y "Quitar foto de antes" la quita al guardar', async () => {
    const user = userEvent.setup();
    render(<Editor inicial={{ ...SOFA, imagen_antes: 'https://img.test/antes.jpg' }} />);
    expect(screen.getByRole('img', { name: 'Foto de antes de restaurar' })).toHaveAttribute('src', 'https://img.test/antes.jpg');

    await user.click(screen.getByRole('button', { name: 'Quitar foto de antes' }));
    expect(screen.queryByRole('img', { name: 'Foto de antes de restaurar' })).toBeNull();
    expect(screen.getByText('Se quitará al guardar.')).toBeInTheDocument();
    await guardar(user);

    expect(enviado().get('quitar_imagen_antes')).toBe('true');
    expect(enviado().has('imagen_antes')).toBe(false);
  });

  it('sin tocarla, no se manda nada de la foto de antes', async () => {
    const user = userEvent.setup();
    render(<Editor inicial={{ ...SOFA, imagen_antes: 'https://img.test/antes.jpg' }} />);
    await guardar(user);
    expect(enviado().has('imagen_antes')).toBe(false);
    expect(enviado().has('quitar_imagen_antes')).toBe(false);
    expect(prepararFotos).not.toHaveBeenCalled();
  });
});
