import { describe, it, expect } from 'vitest';
import { productoJsonLd, migasJsonLd, urlDeFicha } from './datosEstructurados';
import { BRAND } from '../theme/brand.config';

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

describe('productoJsonLd', () => {
  it('describe la pieza con nombre, descripción limpia, fotos, referencia y categoría', () => {
    expect(productoJsonLd(MUEBLE)).toEqual({
      '@type': 'Product',
      name: 'Banco de trabajo de madera y mármol',
      url: `${BRAND.web}/mueble/m1`,
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
    expect(Object.keys(datos).sort()).toEqual(['@type', 'itemCondition', 'name', 'url']);
  });

  it.each([
    ['disponible', 'https://schema.org/InStock'],
    ['vendido', 'https://schema.org/SoldOut'],
    ['alquilado', 'https://schema.org/OutOfStock'],
  ])('con precio de venta publicado y estado %s, oferta en euros con %s', (estado, disponibilidad) => {
    expect(productoJsonLd({ ...MUEBLE, precio_venta: 950, estado }).offers).toEqual({
      '@type': 'Offer',
      url: `${BRAND.web}/mueble/m1`,
      price: '950.00',
      priceCurrency: 'EUR',
      availability: disponibilidad,
      itemCondition: 'https://schema.org/UsedCondition',
      seller: { '@type': 'Organization', name: BRAND.nombre },
    });
  });

  it('solo con precio de alquiler no hay oferta: no es un precio de venta', () => {
    expect(productoJsonLd({ ...MUEBLE, precio_alquiler_dia: 40 }).offers).toBeUndefined();
  });
});

describe('migasJsonLd', () => {
  it('Inicio, Catálogo, la categoría y la pieza, en orden', () => {
    expect(migasJsonLd(MUEBLE).itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${BRAND.web}/` },
      { '@type': 'ListItem', position: 2, name: 'Catálogo', item: `${BRAND.web}/catalogo` },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'Mesas y mobiliario',
        item: `${BRAND.web}/catalogo?categoria=Mesas%20y%20mobiliario`,
      },
      {
        '@type': 'ListItem',
        position: 4,
        name: 'Banco de trabajo de madera y mármol',
        item: `${BRAND.web}/mueble/m1`,
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
    expect(urlDeFicha('a b')).toBe(`${BRAND.web}/mueble/a%20b`);
  });
});
