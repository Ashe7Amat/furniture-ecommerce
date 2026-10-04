// Panel "Mensajes": los mensajes del formulario de contacto (pendiente de la migración
// mensajes_contacto). No son tests de caracterización: describen lo nuevo.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getMensajes, marcarMensajeLeido } from '../../services/api';
import { renderAdmin, irAPestana, barraLateral, CATEGORIAS } from '../adminTestUtils';
import { recortar, fechaMensaje } from './mensajes';

vi.mock('../../services/api');

const LARGO = 'Hola, me interesa mucho el aparador de roble que tenéis en la web. ¿Sigue disponible para verlo?';
const MENSAJES = [
  {
    id: 'c2',
    nombre: 'Luis',
    email: 'un.email.bastante.largo.de.verdad@example.com',
    mensaje: LARGO,
    leido: false,
    created_at: '2026-10-03T08:05:00Z'
  },
  { id: 'c1', nombre: 'Ana', email: 'ana@example.com', mensaje: 'Gracias', leido: true, created_at: '2026-10-01T10:00:00Z' }
];

beforeEach(() => {
  vi.resetAllMocks();
});

const abrirMensajes = async (mensajes = MENSAJES) => {
  const user = userEvent.setup();
  getMensajes.mockResolvedValue(mensajes);
  const datos = await renderAdmin({ categorias: CATEGORIAS });
  await irAPestana(user, /^Mensajes/);
  return { ...datos, user };
};
const filasTabla = () => screen.getAllByRole('row').slice(1);

describe('Mensajes — ayudantes', () => {
  it('recortar: deja igual lo corto, corta lo largo con "…" y junta los espacios', () => {
    expect(recortar('Hola', 10)).toBe('Hola');
    expect(recortar('uno dos tres cuatro', 10)).toBe('uno dos t…');
    expect(recortar('uno dos tres', 9)).toBe('uno dos…'); // sin espacio colgando antes de los puntos
    expect(recortar('  dos\n\nlíneas  ', 20)).toBe('dos líneas');
    expect(recortar(null, 5)).toBe('');
  });

  it('fechaMensaje: fecha y hora cortas en hora de Madrid', () => {
    expect(fechaMensaje('2026-10-03T08:05:00Z')).toBe('3/10/26, 10:05');
  });
});

describe('Mensajes — barra lateral', () => {
  it('la insignia cuenta los no leídos', async () => {
    await abrirMensajes();
    expect(barraLateral().getByRole('button', { name: /^Mensajes/ })).toHaveTextContent('Mensajes1');
  });

  it('sin mensajes sin leer, no hay insignia', async () => {
    await abrirMensajes([MENSAJES[1]]);
    expect(barraLateral().getByRole('button', { name: 'Mensajes' }).querySelector('.sidebar-badge')).toBeNull();
  });
});

describe('Mensajes — la lista', () => {
  it('cabecera con el recuento, y cada fila con nombre, email y mensaje recortados, fecha y estado', async () => {
    await abrirMensajes();

    expect(screen.getByRole('heading', { level: 2, name: 'Mensajes' })).toBeInTheDocument();
    expect(screen.getByText('2 mensajes · 1 sin leer')).toBeInTheDocument();
    const [luis, ana] = filasTabla();
    const celdas = within(luis).getAllByRole('cell');
    expect(celdas.map((c) => c.textContent)).toEqual([
      'Luis',
      'un.email.bastante.largo.de.…',
      'Hola, me interesa mucho el aparador de roble que tenéis en…',
      '3/10/26, 10:05',
      'Sin leer'
    ]);
    expect(celdas[2]).toHaveAttribute('title', LARGO);
    expect(luis).toHaveClass('is-no-leido');
    expect(ana).toHaveClass('is-leido');
  });

  it('el filtro "No leídos" deja solo los que faltan por leer', async () => {
    const { user } = await abrirMensajes();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrar mensajes' }), 'no-leidos');

    expect(filasTabla()).toHaveLength(1);
    expect(filasTabla()[0]).toHaveTextContent('Luis');
  });

  it('sin mensajes, lo dice', async () => {
    await abrirMensajes([]);
    expect(screen.getByText('Todavía no ha llegado ningún mensaje.')).toBeInTheDocument();
  });

  it('con todo leído y el filtro "No leídos", lo dice', async () => {
    const { user } = await abrirMensajes([MENSAJES[1]]);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrar mensajes' }), 'no-leidos');
    expect(screen.getByText('No hay mensajes sin leer.')).toBeInTheDocument();
  });

  it('si no se pudieron cargar (p. ej. sin la tabla), lo dice y deja reintentar', async () => {
    const { user } = await abrirMensajes(null);

    expect(screen.getByRole('alert')).toHaveTextContent('No se pudieron cargar los mensajes.');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    getMensajes.mockResolvedValue(MENSAJES);
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(filasTabla()).toHaveLength(2);
  });
});

describe('Mensajes — el mensaje entero', () => {
  it('pulsar una fila abre el mensaje completo, con su email para responder', async () => {
    const { user } = await abrirMensajes();

    await user.click(within(filasTabla()[0]).getByText('Hola, me interesa mucho el aparador de roble que tenéis en…'));

    const dialogo = within(screen.getByRole('dialog', { name: 'Mensaje de Luis' }));
    expect(dialogo.getByText(LARGO)).toBeInTheDocument();
    expect(dialogo.getByRole('link', { name: MENSAJES[0].email })).toHaveAttribute('href', `mailto:${MENSAJES[0].email}`);
    expect(dialogo.getByText('Sin leer')).toBeInTheDocument();
  });

  it('el nombre también es un botón (se llega con el teclado)', async () => {
    const { user } = await abrirMensajes();
    await user.click(screen.getByRole('button', { name: 'Ana' }));
    expect(screen.getByRole('dialog', { name: 'Mensaje de Ana' })).toBeInTheDocument();
  });

  it('"Marcar como leído" lo guarda, actualiza la fila y la insignia, y avisa', async () => {
    marcarMensajeLeido.mockResolvedValue({ ...MENSAJES[0], leido: true });
    const { user, showToast } = await abrirMensajes();
    await user.click(screen.getByRole('button', { name: 'Luis' }));

    await user.click(screen.getByRole('button', { name: 'Marcar como leído' }));

    expect(marcarMensajeLeido).toHaveBeenCalledWith('c2');
    expect(showToast).toHaveBeenCalledWith('Mensaje marcado como leído', 'success');
    const dialogo = within(screen.getByRole('dialog'));
    expect(dialogo.getByText('Leído')).toBeInTheDocument();
    expect(dialogo.queryByRole('button', { name: 'Marcar como leído' })).not.toBeInTheDocument();
    await user.click(dialogo.getByRole('button', { name: 'Volver a la lista' }));
    expect(filasTabla()[0]).toHaveClass('is-leido');
    expect(screen.getByText('2 mensajes · 0 sin leer')).toBeInTheDocument();
    expect(barraLateral().getByRole('button', { name: 'Mensajes' }).querySelector('.sidebar-badge')).toBeNull();
  });

  it('si no se puede marcar, avisa del error y sigue sin leer', async () => {
    marcarMensajeLeido.mockResolvedValue(null);
    const { user, showToast } = await abrirMensajes();
    await user.click(screen.getByRole('button', { name: 'Luis' }));

    await user.click(screen.getByRole('button', { name: 'Marcar como leído' }));

    expect(showToast).toHaveBeenCalledWith('No se pudo marcar el mensaje como leído', 'error');
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Marcar como leído' })).toBeEnabled();
  });

  it('mientras se guarda, el botón dice "Guardando…" y no se puede pulsar', async () => {
    let terminar;
    marcarMensajeLeido.mockReturnValue(new Promise((resolver) => (terminar = resolver)));
    const { user } = await abrirMensajes();
    await user.click(screen.getByRole('button', { name: 'Luis' }));

    await user.click(screen.getByRole('button', { name: 'Marcar como leído' }));

    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
    terminar({ ...MENSAJES[0], leido: true });
    expect(await screen.findByText('Leído', { selector: 'dd' })).toBeInTheDocument();
  });

  it('un mensaje ya leído no tiene el botón, y la X cierra', async () => {
    const { user } = await abrirMensajes();
    await user.click(screen.getByRole('button', { name: 'Ana' }));

    expect(screen.queryByRole('button', { name: 'Marcar como leído' })).not.toBeInTheDocument();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
