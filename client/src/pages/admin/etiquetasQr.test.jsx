// Etiquetas con QR en "Gestionar Inventario" (21 oct 2026). No son tests de caracterización (los
// Admin.*.test.jsx, congelados): describen lo nuevo. scripts/mutantes/etiquetas.js los usa para la
// comprobación por mutación.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import qrcode from 'qrcode-generator';
import { renderAdmin, irAPestana, CATEGORIAS } from '../adminTestUtils';
import { WEB_PUBLICA, urlFicha, enHojas, trazadoQr, ETIQUETAS_POR_HOJA } from './etiquetas';

vi.mock('../../services/api');

const mueble = (id, nombre, referencia, extra = {}) => ({
  id,
  nombre,
  referencia,
  categoria: 'Sillas',
  estado: 'disponible',
  imagenes: [],
  descripcion: '',
  ...extra
});
const SILLA = mueble('3f2a9c1e-7b41-4d2a-9e0f-1a2b3c4d5e6f', 'Silla Thonet', 'NAV-SIL-001');
const MESA = mueble('m2', 'Mesa de roble con un nombre bastante largo para ver cómo se corta en dos líneas', 'NAV-MES-004');
const LAMPARA = mueble('m3', 'Lámpara de pie', 'NAV-ILU-002');
const ANTIGUA = mueble('m4', 'Baúl sin referencia', null);
const CATALOGO = [SILLA, MESA, LAMPARA, ANTIGUA];

const abrirInventario = async (muebles = CATALOGO) => {
  const user = userEvent.setup();
  const utils = await renderAdmin({ muebles, categorias: CATEGORIAS });
  await irAPestana(user, 'Gestionar Inventario');
  return { user, ...utils };
};
const fila = (nombre) => within(screen.getByRole('checkbox', { name: `Seleccionar ${nombre}` }).closest('.inventory-list-item'));
const vista = () => within(screen.getByRole('dialog'));
const etiquetas = () => screen.queryAllByRole('article');

beforeEach(() => {
  vi.resetAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('Etiquetas — ayudantes', () => {
  it('urlFicha: la ficha pública de la web, con el id', () => {
    expect(WEB_PUBLICA).toBe('https://www.nave5barcelona.com');
    expect(urlFicha(SILLA)).toBe('https://www.nave5barcelona.com/mueble/3f2a9c1e-7b41-4d2a-9e0f-1a2b3c4d5e6f');
    expect(urlFicha({ id: 'a b/c' })).toBe('https://www.nave5barcelona.com/mueble/a%20b%2Fc');
  });

  it('enHojas: de 6 en 6, la última con las que sobren', () => {
    expect(ETIQUETAS_POR_HOJA).toBe(6);
    const trece = Array.from({ length: 13 }, (_, i) => i);
    expect(enHojas(trece)).toEqual([[0, 1, 2, 3, 4, 5], [6, 7, 8, 9, 10, 11], [12]]);
    expect(enHojas([1, 2, 3, 4, 5, 6])).toHaveLength(1);
    expect(enHojas([])).toEqual([]);
  });

  it('trazadoQr: un cuadrado por cada módulo oscuro del QR (corrección M), en su sitio', () => {
    const texto = urlFicha(SILLA);
    const referencia = qrcode(0, 'M');
    referencia.addData(texto);
    referencia.make();
    const { tamano, d } = trazadoQr(texto);

    expect(tamano).toBe(referencia.getModuleCount());
    const cuadrados = d.match(/M\d+ \d+h1v1h-1z/g);
    expect(cuadrados.join('')).toBe(d);
    const oscuros = [];
    for (let fila = 0; fila < tamano; fila += 1) {
      for (let col = 0; col < tamano; col += 1) {
        if (referencia.isDark(fila, col)) oscuros.push(`M${col} ${fila}h1v1h-1z`);
      }
    }
    expect(cuadrados).toEqual(oscuros);
    // Las tres esquinas de posición del QR: la de arriba a la izquierda empieza en 0,0, y las otras
    // dos en la última columna y en la última fila menos 6.
    expect(d.startsWith('M0 0h1v1h-1z')).toBe(true);
    expect(d).toContain(`M${tamano - 7} 0h1v1h-1z`);
    expect(d).toContain(`M0 ${tamano - 7}h1v1h-1z`);
  });

  it('trazadoQr: un texto más largo da un QR más grande', () => {
    expect(trazadoQr('corto').tamano).toBeLessThan(trazadoQr(urlFicha(SILLA)).tamano);
  });
});

describe('Etiquetas — una pieza', () => {
  it('el botón del QR en la fila abre la vista previa con su etiqueta', async () => {
    const { user } = await abrirInventario();

    await user.click(fila('Silla Thonet').getByRole('button', { name: 'Imprimir etiqueta de Silla Thonet' }));

    expect(vista().getByRole('heading', { level: 3, name: 'Etiqueta de 1 pieza' })).toBeInTheDocument();
    expect(etiquetas()).toHaveLength(1);
    const etiqueta = within(etiquetas()[0]);
    expect(etiquetas()[0]).toHaveAccessibleName('Etiqueta de Silla Thonet');
    expect(etiqueta.getByText('NAVE 5 BARCELONA')).toHaveClass('etiqueta-marca');
    expect(etiqueta.getByText('NAV-SIL-001')).toHaveClass('etiqueta-ref');
    expect(etiqueta.getByText('Silla Thonet')).toHaveClass('etiqueta-nombre');
  });

  it('el QR lleva a la ficha pública de la pieza, y mide 100 × 100', async () => {
    const { user } = await abrirInventario();

    await user.click(fila('Silla Thonet').getByRole('button', { name: 'Imprimir etiqueta de Silla Thonet' }));

    const qr = within(etiquetas()[0]).getByRole('img', { name: 'Código QR de la ficha de Silla Thonet' });
    expect(qr).toHaveAttribute('data-qr', 'https://www.nave5barcelona.com/mueble/3f2a9c1e-7b41-4d2a-9e0f-1a2b3c4d5e6f');
    expect(qr).toHaveAttribute('width', '100');
    expect(qr).toHaveAttribute('height', '100');
    // Lo que se pinta es el QR de esa URL, con 4 módulos de margen blanco alrededor.
    const { tamano, d } = trazadoQr(urlFicha(SILLA));
    expect(qr).toHaveAttribute('viewBox', `-4 -4 ${tamano + 8} ${tamano + 8}`);
    expect(qr.querySelector('path')).toHaveAttribute('d', d);
    expect(qr.querySelector('rect')).toHaveAttribute('fill', '#fff');
  });

  it('una pieza sin referencia lo dice en la etiqueta', async () => {
    const { user } = await abrirInventario();

    await user.click(fila('Baúl sin referencia').getByRole('button', { name: 'Imprimir etiqueta de Baúl sin referencia' }));

    expect(within(etiquetas()[0]).getByText('Sin referencia')).toHaveClass('etiqueta-ref', 'sin-ref');
  });

  it('«Imprimir» llama a la impresión del navegador', async () => {
    const imprimir = vi.spyOn(window, 'print').mockImplementation(() => {});
    const { user } = await abrirInventario();
    await user.click(fila('Silla Thonet').getByRole('button', { name: 'Imprimir etiqueta de Silla Thonet' }));

    await user.click(vista().getByRole('button', { name: 'Imprimir' }));

    expect(imprimir).toHaveBeenCalledTimes(1);
  });

  it('mientras está abierta, <body> lleva la clase de impresión; «Cerrar» la quita y cierra', async () => {
    const { user } = await abrirInventario();
    await user.click(fila('Silla Thonet').getByRole('button', { name: 'Imprimir etiqueta de Silla Thonet' }));

    expect(document.body).toHaveClass('con-impresion');
    // La vista cuelga de <body>, para que la hoja de impresión pueda esconder todo lo demás.
    expect(screen.getByRole('dialog').closest('.zona-impresion').parentElement).toBe(document.body);

    await user.click(vista().getByRole('button', { name: 'Cerrar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body).not.toHaveClass('con-impresion');
  });

  it('Escape también cierra', async () => {
    const { user } = await abrirInventario();
    await user.click(fila('Silla Thonet').getByRole('button', { name: 'Imprimir etiqueta de Silla Thonet' }));

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('Etiquetas — en lote', () => {
  it('con 3 piezas seleccionadas, «Imprimir etiquetas» abre las 3 en una hoja', async () => {
    const { user } = await abrirInventario();
    for (const nombre of ['Silla Thonet', 'Lámpara de pie', 'Baúl sin referencia']) {
      await user.click(screen.getByRole('checkbox', { name: `Seleccionar ${nombre}` }));
    }

    await user.click(screen.getByRole('button', { name: 'Imprimir etiquetas' }));

    expect(vista().getByRole('heading', { level: 3, name: 'Etiquetas de 3 piezas (1 hoja)' })).toBeInTheDocument();
    expect(etiquetas()).toHaveLength(3);
    expect(etiquetas().map((e) => e.getAttribute('aria-label'))).toEqual([
      'Etiqueta de Silla Thonet',
      'Etiqueta de Lámpara de pie',
      'Etiqueta de Baúl sin referencia'
    ]);
    expect(within(etiquetas()[1]).getByRole('img')).toHaveAttribute('data-qr', 'https://www.nave5barcelona.com/mueble/m3');
    expect(screen.getAllByRole('region', { name: /^Hoja / })).toHaveLength(1);
  });

  it('con 13 piezas salen 3 hojas A4: 6, 6 y 1', async () => {
    const muchas = Array.from({ length: 13 }, (_, i) => mueble(`p${i}`, `Pieza ${String(i).padStart(2, '0')}`, `NAV-SIL-${String(100 + i)}`));
    const { user } = await abrirInventario(muchas);
    await user.click(screen.getByRole('checkbox', { name: 'Seleccionar todos' }));

    await user.click(screen.getByRole('button', { name: 'Imprimir etiquetas' }));

    expect(vista().getByRole('heading', { level: 3, name: 'Etiquetas de 13 piezas (3 hojas)' })).toBeInTheDocument();
    const hojas = screen.getAllByRole('region', { name: /^Hoja / });
    expect(hojas.map((h) => h.getAttribute('aria-label'))).toEqual(['Hoja 1 de 3', 'Hoja 2 de 3', 'Hoja 3 de 3']);
    expect(hojas.map((h) => within(h).getAllByRole('article').length)).toEqual([6, 6, 1]);
    expect(hojas[0]).toHaveClass('hoja-a4', 'hoja-etiquetas');
  });
});
