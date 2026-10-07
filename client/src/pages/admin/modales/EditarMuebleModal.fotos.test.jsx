import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import EditarMuebleModal from './EditarMuebleModal';
import { ToastContext } from '../../../context/ToastContext';
import { updateMueble } from '../../../services/api';

vi.mock('../../../services/api', () => ({ updateMueble: vi.fn() }));

// H57: el orden de las fotos se guarda con "Guardar Cambios". El servidor guarda imagenes_existentes en el orden
// en que llega (server/src/__tests__/mueblesImagenes.test.js), así que lo que se comprueba aquí es que el editor
// la manda en el orden que se ve.
const SOFA = {
  id: 'm1',
  referencia: 'NAV-SIL-001',
  nombre: 'Sofá',
  categoria: 'Sillas y asientos',
  descripcion: 'Sofá de tres plazas',
  estado: 'disponible',
  imagenes: ['https://img.test/1.jpg', 'https://img.test/2.jpg', 'https://img.test/3.jpg']
};

// Con el estado del contenedor (Admin.jsx), y una confirmación que acepta en el acto.
const Editor = ({ onGuardado = vi.fn() }) => {
  const [mueble, setMueble] = useState(SOFA);
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
        onGuardado={onGuardado}
        onCerrar={vi.fn()}
      />
    </ToastContext.Provider>
  );
};
const enviadas = () => JSON.parse(updateMueble.mock.calls[0][1].get('imagenes_existentes'));

beforeEach(() => {
  updateMueble.mockReset();
  updateMueble.mockResolvedValue({ success: true });
});

describe('EditarMuebleModal — orden de las fotos (H57)', () => {
  it('"Usar como principal" y guardar manda las fotos en el orden nuevo', async () => {
    const user = userEvent.setup();
    render(<Editor />);
    const tercera = screen.getAllByRole('listitem')[2];
    await user.click(within(tercera).getByRole('button', { name: 'Usar como principal' }));
    await user.click(screen.getByRole('button', { name: 'Guardar Cambios' }));

    await waitFor(() => expect(updateMueble).toHaveBeenCalledTimes(1));
    expect(enviadas()).toEqual(['https://img.test/3.jpg', 'https://img.test/1.jpg', 'https://img.test/2.jpg']);
  });

  it('quitar una foto la saca del orden que se manda, y las demás siguen en su sitio', async () => {
    const user = userEvent.setup();
    render(<Editor />);
    await user.click(screen.getByRole('button', { name: 'Quitar la foto 1' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Guardar Cambios' }));

    await waitFor(() => expect(updateMueble).toHaveBeenCalledTimes(1));
    expect(enviadas()).toEqual(['https://img.test/2.jpg', 'https://img.test/3.jpg']);
  });

  it('sin tocar el orden, se manda tal cual', async () => {
    const user = userEvent.setup();
    render(<Editor />);
    await user.click(screen.getByRole('button', { name: 'Guardar Cambios' }));
    await waitFor(() => expect(updateMueble).toHaveBeenCalledTimes(1));
    expect(enviadas()).toEqual(SOFA.imagenes);
  });
});
