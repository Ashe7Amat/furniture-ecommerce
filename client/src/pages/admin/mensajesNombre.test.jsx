// Mensajes: piezas encontradas por su nombre y buscador manual (21 oct 2026). Completa
// mensajesPiezas.test.jsx (las de referencia). No son tests de caracterización (los Admin.*.test.jsx,
// congelados): describen lo nuevo. scripts/mutantes/mensajes-nombre.js los usa para la mutación.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getMensajes } from '../../services/api';
import { renderAdmin, irAPestana, CATEGORIAS } from '../adminTestUtils';
import { normalizar, piezasDelMensaje, buscarPiezas } from './mensajes';

vi.mock('../../services/api');

const pieza = (id, nombre, referencia, extra = {}) => ({
  id,
  nombre,
  referencia,
  categoria: 'Sillas',
  estado: 'disponible',
  imagenes: [`https://img.test/${id}.jpg`],
  descripcion: `Descripción de ${nombre}.`,
  ...extra
});
const CHESTER = pieza('p1', 'Sillón Chester de cuero', 'NAV-SIL-010');
const PLEGABLE = pieza('p2', 'Silla plegable azul intenso', 'NAV-SIL-011');
const THONET = pieza('p3', 'Silla Thonet', 'NAV-SIL-001');
const COPIA = pieza('p4', 'Silla Thonet (Copia)', 'NAV-SIL-012', { imagenes: [] });
const APARADOR = pieza('p5', 'Aparador de roble', 'NAV-MES-004', { categoria: 'Mesas', estado: 'vendido' });
const MESA = pieza('p6', 'Mesa', 'NAV-MES-005', { categoria: 'Mesas' });
// Una pieza antigua, sin el campo referencia.
const ANTIGUA = pieza('p7', 'Lámpara de pie italiana');
delete ANTIGUA.referencia;
const MUEBLES = [CHESTER, PLEGABLE, THONET, COPIA, APARADOR, MESA, ANTIGUA];

const mensaje = (texto) => ({
  id: 'c1',
  nombre: 'Marta Ruiz',
  email: 'marta@example.com',
  mensaje: texto,
  leido: true,
  created_at: '2026-10-20T09:00:00Z'
});
const nombresDe = (lista) => lista.map((p) => p.mueble.nombre);

const abrirMensaje = async (texto, muebles = MUEBLES) => {
  const user = userEvent.setup();
  getMensajes.mockResolvedValue([mensaje(texto)]);
  const datos = await renderAdmin({ muebles, categorias: CATEGORIAS });
  await irAPestana(user, /^Mensajes/);
  await user.click(screen.getByRole('button', { name: 'Marta Ruiz' }));
  return { ...datos, user };
};
const modal = () => within(screen.getByRole('dialog', { name: 'Mensaje de Marta Ruiz' }));
const tarjetas = () => modal().queryAllByRole('listitem');
const buscador = () => within(screen.getByRole('dialog', { name: 'Buscar pieza relacionada' }));
const resultados = () => buscador().queryAllByRole('listitem');

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Mensajes — piezas por nombre (ayudantes)', () => {
  it('normalizar: sin mayúsculas, sin acentos (ñ y ü también) y con los espacios juntados', () => {
    expect(normalizar('  Sillón  ÑANDÚ\npingüino ')).toBe('sillon nandu pinguino');
    expect(normalizar(null)).toBe('');
  });

  it('el nombre exacto de una pieza la detecta por nombre', () => {
    const { porReferencia, porNombre } = piezasDelMensaje(mensaje('¿Tenéis aún el Sillón Chester de cuero?'), MUEBLES);
    expect(porReferencia).toEqual([]);
    expect(porNombre).toEqual([{ referencia: 'NAV-SIL-010', mueble: CHESTER }]);
  });

  it('en minúsculas también', () => {
    expect(nombresDe(piezasDelMensaje(mensaje('me gusta el sillón chester de cuero'), MUEBLES).porNombre)).toEqual([CHESTER.nombre]);
  });

  it('y sin acentos', () => {
    expect(nombresDe(piezasDelMensaje(mensaje('Hola, el sillon chester de cuero sigue?'), MUEBLES).porNombre)).toEqual([CHESTER.nombre]);
  });

  it('«silla» sola no detecta la «Silla plegable azul intenso»', () => {
    expect(piezasDelMensaje(mensaje('Busco una silla azul para un rodaje'), MUEBLES).porNombre).toEqual([]);
  });

  it('un nombre corto (menos de 10 letras y de 3 palabras) no cuenta aunque salga entero', () => {
    expect(piezasDelMensaje(mensaje('Necesito una mesa grande'), MUEBLES).porNombre).toEqual([]);
  });

  it('cuenta un nombre de 3 palabras aunque tenga menos de 10 letras', () => {
    const TE = pieza('p8', 'Té de ron', 'NAV-DEC-001');
    expect(nombresDe(piezasDelMensaje(mensaje('el te de ron'), [TE]).porNombre)).toEqual(['Té de ron']);
  });

  it('cuenta un nombre de 10 letras aunque tenga menos de 3 palabras', () => {
    const BANCO = pieza('p9', 'Banco alto', 'NAV-SIL-020');
    expect(nombresDe(piezasDelMensaje(mensaje('ese banco alto'), [BANCO]).porNombre)).toEqual(['Banco alto']);
  });

  it('referencia y nombre de la misma pieza: sale una vez, por referencia', () => {
    const { porReferencia, porNombre } = piezasDelMensaje(mensaje('Me interesa la pieza "Silla Thonet" (ref. NAV-SIL-001).'), MUEBLES);
    expect(porReferencia).toEqual([{ referencia: 'NAV-SIL-001', mueble: THONET }]);
    expect(porNombre).toEqual([]);
  });

  it('referencia de una pieza y nombre de otra: las dos', () => {
    const { porReferencia, porNombre } = piezasDelMensaje(mensaje('La NAV-MES-004 y también el aparador... y el Sillón Chester de cuero'), MUEBLES);
    expect(nombresDe(porReferencia)).toEqual(['Aparador de roble']);
    expect(nombresDe(porNombre)).toEqual([CHESTER.nombre]);
  });

  it('varios nombres salen en el orden del texto', () => {
    const { porNombre } = piezasDelMensaje(mensaje('El aparador de roble y el sillón chester de cuero'), MUEBLES);
    expect(nombresDe(porNombre)).toEqual(['Aparador de roble', CHESTER.nombre]);
  });

  it('si un nombre está dentro de otro que también sale, solo cuenta el más largo', () => {
    expect(nombresDe(piezasDelMensaje(mensaje('Quiero la Silla Thonet (Copia)'), MUEBLES).porNombre)).toEqual(['Silla Thonet (Copia)']);
    expect(nombresDe(piezasDelMensaje(mensaje('Quiero la Silla Thonet de la foto'), MUEBLES).porNombre)).toEqual(['Silla Thonet']);
  });

  it('una pieza sin referencia también se detecta por nombre', () => {
    expect(piezasDelMensaje(mensaje('la lampara de pie italiana'), MUEBLES).porNombre).toEqual([{ referencia: null, mueble: ANTIGUA }]);
  });

  it('buscarPiezas: por nombre o referencia, sin mayúsculas ni acentos; sin nada escrito, ninguna', () => {
    expect(nombresDe(buscarPiezas(MUEBLES, 'silla').map((mueble) => ({ mueble })))).toEqual([PLEGABLE.nombre, THONET.nombre, COPIA.nombre]);
    expect(buscarPiezas(MUEBLES, 'SILLON')).toEqual([CHESTER]);
    expect(buscarPiezas(MUEBLES, 'nav-mes-004')).toEqual([APARADOR]);
    expect(buscarPiezas(MUEBLES, '   ')).toEqual([]);
  });
});

describe('Mensajes — tarjetas por nombre', () => {
  it('la tarjeta de una pieza encontrada por su nombre lo dice', async () => {
    await abrirMensaje('Hola, ¿el sillon chester de cuero está disponible?');

    expect(tarjetas()).toHaveLength(1);
    const tarjeta = within(tarjetas()[0]);
    expect(tarjeta.getByText('Sillón Chester de cuero')).toBeInTheDocument();
    expect(tarjeta.getByText('NAV-SIL-010')).toBeInTheDocument();
    expect(tarjeta.getByText('Detectada por nombre')).toHaveClass('mensaje-pieza-origen', 'nombre');
    expect(tarjeta.getByRole('button', { name: 'Ver/Editar pieza' })).toBeInTheDocument();
  });

  it('referencia de una y nombre de otra: dos tarjetas, primero la de referencia', async () => {
    await abrirMensaje('Del sillón Chester de cuero y de la NAV-MES-004');

    expect(modal().getByRole('heading', { level: 4, name: 'Piezas del mensaje' })).toBeInTheDocument();
    expect(tarjetas()).toHaveLength(2);
    expect(within(tarjetas()[0]).getByText('Aparador de roble')).toBeInTheDocument();
    expect(within(tarjetas()[0]).getByText('Detectada por referencia')).toHaveClass('mensaje-pieza-origen', 'referencia');
    expect(within(tarjetas()[1]).getByText('Sillón Chester de cuero')).toBeInTheDocument();
    expect(within(tarjetas()[1]).getByText('Detectada por nombre')).toBeInTheDocument();
  });

  it('referencia y nombre de la misma pieza: una sola tarjeta, por referencia', async () => {
    await abrirMensaje('Me interesa la pieza "Silla Thonet" (ref. NAV-SIL-001).');

    expect(tarjetas()).toHaveLength(1);
    expect(within(tarjetas()[0]).getByText('Detectada por referencia')).toBeInTheDocument();
    expect(modal().queryByText('Detectada por nombre')).not.toBeInTheDocument();
  });

  it('una pieza sin referencia no enseña referencia vacía', async () => {
    await abrirMensaje('la lampara de pie italiana');

    expect(tarjetas()[0].querySelector('.mensaje-pieza-ref')).toBeNull();
  });
});

describe('Mensajes — buscar pieza a mano', () => {
  it('si no se detecta ninguna pieza, sale «Buscar pieza relacionada»', async () => {
    await abrirMensaje('Hola, ¿abrís los sábados?');

    expect(tarjetas()).toHaveLength(0);
    expect(modal().getByRole('button', { name: 'Buscar pieza relacionada' })).toBeInTheDocument();
  });

  it('con una referencia que no está en el inventario también sale', async () => {
    await abrirMensaje('Me interesa la NAV-SIL-999');

    expect(modal().getByText('Pieza no encontrada (NAV-SIL-999)')).toBeInTheDocument();
    expect(modal().getByRole('button', { name: 'Buscar pieza relacionada' })).toBeInTheDocument();
  });

  it('si se detecta alguna pieza, no sale', async () => {
    await abrirMensaje('el sillon chester de cuero');

    expect(modal().queryByRole('button', { name: 'Buscar pieza relacionada' })).not.toBeInTheDocument();
  });

  it('el botón abre el buscador, que avisa de que no guarda nada', async () => {
    const { user } = await abrirMensaje('Hola, ¿abrís los sábados?');

    await user.click(modal().getByRole('button', { name: 'Buscar pieza relacionada' }));

    expect(buscador().getByText('Esto no guarda la relación en la base de datos: solo ayuda a encontrar la pieza mientras respondes.')).toBeInTheDocument();
    expect(buscador().getByRole('searchbox', { name: 'Buscar en el inventario' })).toHaveFocus();
    expect(resultados()).toHaveLength(0);
  });

  it('buscar «silla» deja solo las piezas con «silla» en el nombre, con foto y referencia', async () => {
    const { user } = await abrirMensaje('Hola, ¿abrís los sábados?');
    await user.click(modal().getByRole('button', { name: 'Buscar pieza relacionada' }));

    await user.type(buscador().getByRole('searchbox'), 'silla');

    expect(resultados()).toHaveLength(3);
    expect(resultados().map((r) => r.querySelector('strong').textContent)).toEqual([PLEGABLE.nombre, THONET.nombre, COPIA.nombre]);
    expect(within(resultados()[1]).getByText('NAV-SIL-001')).toBeInTheDocument();
    expect(resultados()[1].querySelector('img')).toHaveAttribute('src', 'https://img.test/p3.jpg');
    expect(resultados()[2].querySelector('.sin-foto')).not.toBeNull();
  });

  it('sin coincidencias lo dice', async () => {
    const { user } = await abrirMensaje('Hola');
    await user.click(modal().getByRole('button', { name: 'Buscar pieza relacionada' }));

    await user.type(buscador().getByRole('searchbox'), 'xyz');

    expect(buscador().getByText('Ninguna pieza coincide.')).toBeInTheDocument();
  });

  it('elegir un resultado cierra el buscador y el mensaje y abre el editor de esa pieza', async () => {
    const { user } = await abrirMensaje('Hola, ¿abrís los sábados?');
    await user.click(modal().getByRole('button', { name: 'Buscar pieza relacionada' }));
    await user.type(buscador().getByRole('searchbox'), 'aparador');

    await user.click(within(resultados()[0]).getByRole('button'));

    const editor = within(screen.getByRole('heading', { level: 3, name: 'Editar Producto' }).closest('.admin-modal-content'));
    expect(editor.getByDisplayValue('Aparador de roble')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Buscar pieza relacionada' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Mensaje de Marta Ruiz' })).not.toBeInTheDocument();

    // Al volver a abrir el mensaje, el buscador no sale abierto.
    await user.click(editor.getByRole('button', { name: 'Cerrar' }));
    await user.click(screen.getByRole('button', { name: 'Marta Ruiz' }));
    expect(screen.queryByRole('dialog', { name: 'Buscar pieza relacionada' })).not.toBeInTheDocument();
  });

  it('«Volver al mensaje» cierra solo el buscador', async () => {
    const { user } = await abrirMensaje('Hola, ¿abrís los sábados?');
    await user.click(modal().getByRole('button', { name: 'Buscar pieza relacionada' }));

    await user.click(buscador().getByRole('button', { name: 'Volver al mensaje' }));

    expect(screen.queryByRole('dialog', { name: 'Buscar pieza relacionada' })).not.toBeInTheDocument();
    expect(modal().getByText('Hola, ¿abrís los sábados?')).toBeInTheDocument();
  });

  it('cerrar el mensaje cierra también el buscador, y el siguiente mensaje no lo abre', async () => {
    const { user } = await abrirMensaje('Hola, ¿abrís los sábados?');
    await user.click(modal().getByRole('button', { name: 'Buscar pieza relacionada' }));
    await user.keyboard('{Escape}');
    await user.click(modal().getByRole('button', { name: 'Volver a la lista' }));

    await user.click(screen.getByRole('button', { name: 'Marta Ruiz' }));

    expect(screen.queryByRole('dialog', { name: 'Buscar pieza relacionada' })).not.toBeInTheDocument();
  });

  it('con más de 20 resultados enseña 20 y cuántas faltan', async () => {
    const muchas = Array.from({ length: 22 }, (_, i) => pieza(`s${i}`, `Silla número ${i}`, `NAV-SIL-${String(100 + i)}`));
    const { user } = await abrirMensaje('Hola', muchas);
    await user.click(modal().getByRole('button', { name: 'Buscar pieza relacionada' }));

    await user.type(buscador().getByRole('searchbox'), 'silla');
    expect(resultados()).toHaveLength(20);
    expect(buscador().getByText('Hay 2 piezas más: escribe más para afinar.')).toBeInTheDocument();

    await user.type(buscador().getByRole('searchbox'), ' número 2');
    expect(buscador().queryByText(/piezas? más/)).not.toBeInTheDocument();
  });

  it('con 21 resultados, «Hay 1 pieza más»', async () => {
    const muchas = Array.from({ length: 21 }, (_, i) => pieza(`s${i}`, `Silla número ${i}`, `NAV-SIL-${String(100 + i)}`));
    const { user } = await abrirMensaje('Hola', muchas);
    await user.click(modal().getByRole('button', { name: 'Buscar pieza relacionada' }));

    await user.type(buscador().getByRole('searchbox'), 'silla');

    expect(buscador().getByText('Hay 1 pieza más: escribe más para afinar.')).toBeInTheDocument();
  });
});
