import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { productoJsonLd, migasJsonLd, useJsonLd, urlDeFicha } from './datosEstructurados';

const MUEBLE = {
  id: 'm1',
  nombre: 'Banco de trabajo de madera y mármol',
  categoria: 'Mesas y mobiliario',
  descripcion: '  Banco   de trabajo\nrestaurado.  ',
  precio_venta: null,
  precio_alquiler_dia: null,
  imagenes: ['https://img.test/1.webp', 'https://img.test/2.webp'],
  estado: 'disponible',
  referencia: 'NAV-MES-011',
};

const bloques = () => [...document.head.querySelectorAll('script[type="application/ld+json"]')];

describe('productoJsonLd', () => {
  it('describe la pieza con nombre, descripción limpia, fotos, referencia y categoría', () => {
    expect(productoJsonLd(MUEBLE)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Banco de trabajo de madera y mármol',
      url: 'https://www.nave5barcelona.com/mueble/m1',
      itemCondition: 'https://schema.org/UsedCondition',
      description: 'Banco de trabajo restaurado.',
      image: MUEBLE.imagenes,
      sku: 'NAV-MES-011',
      category: 'Mesas y mobiliario',
    });
  });

  it('sin precio (precios ocultos), no hay oferta', () => {
    expect(productoJsonLd(MUEBLE).offers).toBeUndefined();
  });

  it('sin descripción, fotos, referencia ni categoría, no pone esos campos vacíos', () => {
    const datos = productoJsonLd({ id: 'x', nombre: 'Pieza', imagenes: [] });
    expect(Object.keys(datos).sort()).toEqual(['@context', '@type', 'itemCondition', 'name', 'url']);
  });

  it.each([
    ['disponible', 'https://schema.org/InStock'],
    ['vendido', 'https://schema.org/SoldOut'],
    ['alquilado', 'https://schema.org/OutOfStock'],
  ])('con precio de venta publicado y estado %s, oferta en euros con %s', (estado, disponibilidad) => {
    expect(productoJsonLd({ ...MUEBLE, precio_venta: 950, estado }).offers).toEqual({
      '@type': 'Offer',
      url: 'https://www.nave5barcelona.com/mueble/m1',
      price: '950.00',
      priceCurrency: 'EUR',
      availability: disponibilidad,
      itemCondition: 'https://schema.org/UsedCondition',
      seller: { '@type': 'Organization', name: 'Nave 5 Barcelona' },
    });
  });

  it('solo con precio de alquiler no hay oferta: no es un precio de venta', () => {
    expect(productoJsonLd({ ...MUEBLE, precio_alquiler_dia: 40 }).offers).toBeUndefined();
  });
});

describe('migasJsonLd', () => {
  it('Inicio, Catálogo, la categoría y la pieza, en orden', () => {
    expect(migasJsonLd(MUEBLE).itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: 'https://www.nave5barcelona.com/' },
      { '@type': 'ListItem', position: 2, name: 'Catálogo', item: 'https://www.nave5barcelona.com/catalogo' },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'Mesas y mobiliario',
        item: 'https://www.nave5barcelona.com/catalogo?categoria=Mesas%20y%20mobiliario',
      },
      {
        '@type': 'ListItem',
        position: 4,
        name: 'Banco de trabajo de madera y mármol',
        item: 'https://www.nave5barcelona.com/mueble/m1',
      },
    ]);
  });

  it('sin categoría, se la salta', () => {
    expect(migasJsonLd({ ...MUEBLE, categoria: null }).itemListElement.map((m) => m.name)).toEqual([
      'Inicio',
      'Catálogo',
      'Banco de trabajo de madera y mármol',
    ]);
  });
});

describe('urlDeFicha', () => {
  it('codifica el id', () => {
    expect(urlDeFicha('a b')).toBe('https://www.nave5barcelona.com/mueble/a%20b');
  });
});

describe('useJsonLd', () => {
  it('pone un bloque JSON-LD mientras está montado y lo quita al desmontar', () => {
    const { unmount } = renderHook(() => useJsonLd('prueba', { a: 1 }));
    expect(bloques()).toHaveLength(1);
    expect(bloques()[0].dataset.jsonld).toBe('prueba');
    expect(JSON.parse(bloques()[0].textContent)).toEqual({ a: 1 });
    unmount();
    expect(bloques()).toHaveLength(0);
  });

  it('sin datos no pone nada', () => {
    renderHook(() => useJsonLd('prueba', null));
    expect(bloques()).toHaveLength(0);
  });

  it('al cambiar los datos, sustituye el bloque en vez de añadir otro', () => {
    const { rerender, unmount } = renderHook(({ datos }) => useJsonLd('prueba', datos), {
      initialProps: { datos: { a: 1 } },
    });
    rerender({ datos: { a: 2 } });
    expect(bloques()).toHaveLength(1);
    expect(JSON.parse(bloques()[0].textContent)).toEqual({ a: 2 });
    unmount();
  });

  it('escapa "<" para que un texto no pueda cerrar el <script>', () => {
    const { unmount } = renderHook(() => useJsonLd('prueba', { d: '</script><img>' }));
    expect(bloques()[0].textContent).not.toContain('</script>');
    expect(JSON.parse(bloques()[0].textContent)).toEqual({ d: '</script><img>' });
    unmount();
  });
});
