// Catálogo: el selector "Ordenar por". Sale siempre, con "Recomendados" (el orden de la API) y la
// referencia (A-Z y Z-A). Las dos opciones de precio solo salen si hay precios (fase C): con los
// precios ocultos (MOSTRAR_PRECIOS), todas las piezas llegan sin precio y ordenar por precio no
// haría nada. El orden elegido va en la URL (?orden=), como la categoría.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import Catalog from './Catalog';
import { FavoritesContext } from '../context/FavoritesContext';
import { CartContext } from '../context/CartContext';
import { getMuebles, getCategorias } from '../services/api';

vi.mock('../services/api');

const pieza = (id, nombre, precio_venta = null, precio_alquiler_dia = null) => ({
  id, nombre, categoria: 'Sillas', descripcion: '', imagenes: [], estado: 'disponible', referencia: null,
  precio_venta, precio_alquiler_dia
});
const conReferencia = (id, nombre, referencia, extra = {}) => ({ ...pieza(id, nombre), referencia, ...extra });
const SIN_PRECIOS = [pieza('a', 'Aparador'), pieza('b', 'Banco'), pieza('c', 'Cómoda')];

// Sin precios (como en producción hoy), en el orden en que llegan de la API. Dos sin referencia: una
// null (Banco) y otra vacía (Escritorio). Aparador lleva NAV-SIL-010, que comparando texto letra a
// letra iría antes que la NAV-SIL-002 de Diván.
const CON_REFERENCIAS = [
  conReferencia('a', 'Aparador', 'NAV-SIL-010'),
  pieza('b', 'Banco'),
  conReferencia('c', 'Cómoda', 'NAV-MES-001'),
  conReferencia('d', 'Diván', 'NAV-SIL-002'),
  conReferencia('e', 'Escritorio', '')
];
const ORDEN_API = ['Aparador', 'Banco', 'Cómoda', 'Diván', 'Escritorio'];
const REFERENCIA_A_Z = ['Cómoda', 'Diván', 'Aparador', 'Banco', 'Escritorio'];
const REFERENCIA_Z_A = ['Aparador', 'Diván', 'Cómoda', 'Banco', 'Escritorio'];

const CATEGORIAS = [
  { id: 1, nombre: 'Mobiliario', categoria_padre_id: null },
  { id: 2, nombre: 'Sillas', categoria_padre_id: 1 },
  { id: 3, nombre: 'Mesas', categoria_padre_id: 1 }
];

// Pinta la parte ?... de la URL del MemoryRouter, para comprobar lo que el catálogo escribe en ella.
const BusquedaActual = () => <div data-testid="busqueda-url">{useLocation().search}</div>;
const busquedaUrl = () => screen.getByTestId('busqueda-url').textContent;
const parametroUrl = (nombre) => new URLSearchParams(busquedaUrl()).get(nombre);

// `ruta` es la URL con la que se entra (p. ej. '/catalogo?orden=referencia_desc', como al recargar
// o al abrir un enlace compartido). `enTabla` monta la vista de tabla en vez de la de tarjetas.
const montar = async (muebles, { ruta = '/catalogo', categorias = [], favoritos = [], enTabla = false } = {}) => {
  getMuebles.mockResolvedValue(muebles);
  getCategorias.mockResolvedValue(categorias);
  if (enTabla) localStorage.setItem('kaveCatalogView', 'table');
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <CartContext.Provider value={{ addToCart: vi.fn() }}>
        <FavoritesContext.Provider value={{ favorites: favoritos, toggleFavorite: vi.fn(), isFavorite: () => false }}>
          <Catalog />
          <BusquedaActual />
        </FavoritesContext.Provider>
      </CartContext.Provider>
    </MemoryRouter>
  );
  if (enTabla) {
    await screen.findByRole('table', { name: 'Catálogo de muebles, vista de lista' });
    return;
  }
  // CAMBIADO A PROPÓSITO (5 oct 2026, H43): el nombre de cada pieza es un h2 (antes h3, que saltaba
  // un nivel después del h1 del catálogo).
  await screen.findByRole('heading', { level: 2, name: muebles[0].nombre });
};
// CAMBIADO A PROPÓSITO (9 oct 2026, orden por referencia): la etiqueta es "Ordenar por" (antes
// "Ordenar por precio"), porque ya no solo ordena por precio.
const selectorOrden = () => screen.queryByLabelText('Ordenar por');
const valoresOrden = () => [...selectorOrden().options].map((o) => o.value);
const nombres = () => [...document.querySelectorAll('.product-title')].map((h) => h.textContent);
// En la tabla, el nombre de cada fila es el texto alternativo de su miniatura (la celda del nombre
// lleva también la referencia debajo).
const nombresEnTabla = () =>
  [...document.querySelectorAll('.products-table-row .products-table-col-thumb img')].map((img) => img.alt);

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
});

describe('Catalog — el selector "Ordenar por"', () => {
  // CAMBIADO A PROPÓSITO (9 oct 2026, orden por referencia): sin precios el selector ya sale (antes
  // no salía), porque por referencia se puede ordenar igual; lo que no sale son las opciones de precio.
  it('sin ningún precio en el catálogo (precios ocultos), el selector sale, pero sin las opciones de precio', async () => {
    await montar(SIN_PRECIOS);

    expect(selectorOrden()).toBeInTheDocument();
    expect(selectorOrden()).toHaveAttribute('id', 'sort-select');
    expect(selectorOrden()).toHaveValue('recomendados');
    expect(valoresOrden()).toEqual(['recomendados', 'referencia_asc', 'referencia_desc']);
    expect(screen.getByRole('option', { name: 'Recomendados' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Referencia (A-Z)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Referencia (Z-A)' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Precio: Menor a Mayor' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Precio: Mayor a Menor' })).not.toBeInTheDocument();
  });

  // CAMBIADO A PROPÓSITO (9 oct 2026, orden por referencia): con precios hay cinco opciones (antes
  // tres): las de referencia van entre "Recomendados" y las de precio.
  it('con precios, el selector sale también con las dos opciones de precio, y ordena', async () => {
    const user = userEvent.setup();
    await montar([pieza('a', 'Aparador', 300), pieza('b', 'Banco', 100), pieza('c', 'Cómoda', 200)]);

    expect(selectorOrden()).toBeInTheDocument();
    expect(valoresOrden()).toEqual(['recomendados', 'referencia_asc', 'referencia_desc', 'menor', 'mayor']);

    await user.selectOptions(selectorOrden(), 'menor');
    expect(nombres()).toEqual(['Banco', 'Cómoda', 'Aparador']);
    await user.selectOptions(selectorOrden(), 'mayor');
    expect(nombres()).toEqual(['Aparador', 'Cómoda', 'Banco']);
  });

  // CAMBIADO A PROPÓSITO (9 oct 2026, orden por referencia): el selector sale siempre; lo que se
  // comprueba ahora es que salgan las opciones de precio.
  it('con una mezcla (algunas con precio, otras sin), salen las opciones de precio', async () => {
    await montar([pieza('a', 'Aparador'), pieza('b', 'Banco', null, 15), pieza('c', 'Cómoda')]);
    expect(valoresOrden()).toEqual(['recomendados', 'referencia_asc', 'referencia_desc', 'menor', 'mayor']);
  });

  it('mientras carga, el selector y sus opciones de precio se quedan (no aparecen y desaparecen al llegar los datos)', async () => {
    getMuebles.mockReturnValue(new Promise(() => {}));
    getCategorias.mockResolvedValue([]);
    render(
      <MemoryRouter initialEntries={['/catalogo']}>
        <FavoritesContext.Provider value={{ favorites: [], toggleFavorite: vi.fn(), isFavorite: () => false }}>
          <Catalog />
        </FavoritesContext.Provider>
      </MemoryRouter>
    );
    await act(async () => {}); // deja que CategorySlider reciba sus categorías (vacías)
    expect(selectorOrden()).toBeInTheDocument();
    expect(valoresOrden()).toEqual(['recomendados', 'referencia_asc', 'referencia_desc', 'menor', 'mayor']);
  });
});

describe('Catalog — ordenar por referencia', () => {
  it('"Referencia (A-Z)" y "(Z-A)" ordenan en orden natural, con las piezas sin referencia al final en los dos sentidos', async () => {
    const user = userEvent.setup();
    await montar(CON_REFERENCIAS);
    expect(nombres()).toEqual(ORDEN_API);

    await user.selectOptions(selectorOrden(), 'referencia_asc');
    expect(nombres()).toEqual(REFERENCIA_A_Z);

    await user.selectOptions(selectorOrden(), 'referencia_desc');
    expect(nombres()).toEqual(REFERENCIA_Z_A);

    // Volver a "Recomendados" deja otra vez el orden de la API (la lista cargada no se ha tocado).
    await user.selectOptions(selectorOrden(), 'recomendados');
    expect(nombres()).toEqual(ORDEN_API);
  });

  it('con precios también se puede ordenar por referencia', async () => {
    const user = userEvent.setup();
    await montar([
      conReferencia('a', 'Aparador', 'NAV-SIL-002', { precio_venta: 100 }),
      conReferencia('b', 'Banco', 'NAV-MES-001', { precio_venta: 300 }),
      conReferencia('c', 'Cómoda', null, { precio_venta: 200 })
    ]);

    await user.selectOptions(selectorOrden(), 'referencia_asc');
    expect(nombres()).toEqual(['Banco', 'Aparador', 'Cómoda']);
  });

  it('en la vista de tabla, el mismo orden', async () => {
    const user = userEvent.setup();
    await montar(CON_REFERENCIAS, { enTabla: true });
    expect(nombresEnTabla()).toEqual(ORDEN_API);

    await user.selectOptions(selectorOrden(), 'referencia_asc');
    expect(nombresEnTabla()).toEqual(REFERENCIA_A_Z);

    await user.selectOptions(selectorOrden(), 'referencia_desc');
    expect(nombresEnTabla()).toEqual(REFERENCIA_Z_A);
  });

  it('se combina con los filtros: ordena solo lo que queda tras filtrar por categoría y por "Disponible"', async () => {
    const user = userEvent.setup();
    await montar(
      [
        conReferencia('a', 'Aparador', 'NAV-SIL-010'),
        conReferencia('b', 'Banco', 'NAV-MES-001', { categoria: 'Mesas' }),
        conReferencia('c', 'Cómoda', 'NAV-SIL-001', { estado: 'vendido' }),
        conReferencia('d', 'Diván', 'NAV-SIL-002')
      ],
      { ruta: '/catalogo?categoria=Sillas&orden=referencia_asc' }
    );
    expect(nombres()).toEqual(['Cómoda', 'Diván', 'Aparador']);

    await user.click(screen.getByText('Disponible', { exact: true }));
    expect(nombres()).toEqual(['Diván', 'Aparador']);
  });
});

describe('Catalog — el orden en la URL (?orden=)', () => {
  it('elegir un orden lo escribe en la URL, y volver a "Recomendados" lo quita (no se escribe)', async () => {
    const user = userEvent.setup();
    await montar(CON_REFERENCIAS);
    expect(busquedaUrl()).toBe('');

    await user.selectOptions(selectorOrden(), 'referencia_asc');
    expect(parametroUrl('orden')).toBe('referencia_asc');

    await user.selectOptions(selectorOrden(), 'referencia_desc');
    expect(parametroUrl('orden')).toBe('referencia_desc');

    await user.selectOptions(selectorOrden(), 'recomendados');
    expect(busquedaUrl()).toBe('');
  });

  it('al entrar con ?orden= (recargar la página o abrir un enlace compartido), el catálogo sale ya ordenado', async () => {
    await montar(CON_REFERENCIAS, { ruta: '/catalogo?orden=referencia_desc' });

    expect(selectorOrden()).toHaveValue('referencia_desc');
    expect(nombres()).toEqual(REFERENCIA_Z_A);
  });

  it('un valor desconocido en la URL se trata como "Recomendados"', async () => {
    await montar(CON_REFERENCIAS, { ruta: '/catalogo?orden=patata' });

    expect(selectorOrden()).toHaveValue('recomendados');
    expect(nombres()).toEqual(ORDEN_API);
  });

  it('un orden de precio en la URL sin precios en el catálogo se comporta como "Recomendados"', async () => {
    await montar(CON_REFERENCIAS, { ruta: '/catalogo?orden=menor' });

    expect(selectorOrden()).toHaveValue('recomendados');
    expect(nombres()).toEqual(ORDEN_API);
  });

  it('un orden de precio en la URL con precios se aplica', async () => {
    await montar([pieza('a', 'Aparador', 300), pieza('b', 'Banco', 100), pieza('c', 'Cómoda', 200)], {
      ruta: '/catalogo?orden=mayor'
    });

    expect(selectorOrden()).toHaveValue('mayor');
    expect(nombres()).toEqual(['Aparador', 'Cómoda', 'Banco']);
  });

  it('cambiar el orden no pierde la categoría de la URL, y cambiar la categoría no pierde el orden', async () => {
    const user = userEvent.setup();
    await montar(CON_REFERENCIAS, { ruta: '/catalogo?categoria=Sillas', categorias: CATEGORIAS });

    await user.selectOptions(selectorOrden(), 'referencia_asc');
    expect(parametroUrl('categoria')).toBe('Sillas');
    expect(parametroUrl('orden')).toBe('referencia_asc');

    await user.selectOptions(screen.getByLabelText('Categoría'), 'Mesas');
    expect(parametroUrl('categoria')).toBe('Mesas');
    expect(parametroUrl('orden')).toBe('referencia_asc');
    expect(selectorOrden()).toHaveValue('referencia_asc');
  });

  it('en los favoritos, cambiar el orden no los quita de la URL y los ordena', async () => {
    const user = userEvent.setup();
    await montar(CON_REFERENCIAS, { ruta: '/catalogo?favorites=true', favoritos: ['a', 'b', 'd'] });
    expect(nombres()).toEqual(['Aparador', 'Banco', 'Diván']);

    await user.selectOptions(selectorOrden(), 'referencia_asc');

    expect(parametroUrl('favorites')).toBe('true');
    expect(parametroUrl('orden')).toBe('referencia_asc');
    expect(nombres()).toEqual(['Diván', 'Aparador', 'Banco']);
  });

  it('"Ver toda la colección" lo deja todo limpio, también el orden', async () => {
    const user = userEvent.setup();
    await montar(CON_REFERENCIAS, { ruta: '/catalogo?categoria=Sillas&orden=referencia_desc' });
    expect(nombres()).toEqual(REFERENCIA_Z_A);

    await user.click(screen.getByRole('button', { name: '← Ver toda la colección' }));

    expect(busquedaUrl()).toBe('');
    expect(selectorOrden()).toHaveValue('recomendados');
    expect(nombres()).toEqual(ORDEN_API);
  });
});
