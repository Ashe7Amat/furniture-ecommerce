// Datos estructurados (schema.org en JSON-LD) para que Google entienda qué es cada página: la
// ficha de una pieza como un Product, con sus migas de pan. ProductDetail los junta en un @graph y
// se los pasa a useDocumentMeta (jsonLd), que los pone con JavaScript (H34: no hay render en el
// servidor); Google los lee al renderizar la página.
export const WEB_PUBLICA = 'https://www.nave5barcelona.com';

export const urlDeFicha = (id) => `${WEB_PUBLICA}/mueble/${encodeURIComponent(id)}`;
export const urlDeCategoria = (categoria) =>
  `${WEB_PUBLICA}/catalogo?categoria=${encodeURIComponent(categoria)}`;

// Precios ocultos (MOSTRAR_PRECIOS): la API los devuelve a null, y entonces no hay `offers`. Solo
// se publica un precio que la propia ficha ya enseña, nunca uno que no llegue de la API.
const ofertaDe = (mueble, url) => {
  if (!mueble.precio_venta) return undefined;
  const disponibilidad =
    mueble.estado === 'vendido'
      ? 'https://schema.org/SoldOut'
      : mueble.estado === 'alquilado'
        ? 'https://schema.org/OutOfStock'
        : 'https://schema.org/InStock';
  return {
    '@type': 'Offer',
    url,
    price: Number(mueble.precio_venta).toFixed(2),
    priceCurrency: 'EUR',
    availability: disponibilidad,
    itemCondition: 'https://schema.org/UsedCondition',
    seller: { '@type': 'Organization', name: 'Nave 5 Barcelona' },
  };
};

export const productoJsonLd = (mueble) => {
  const url = urlDeFicha(mueble.id);
  const descripcion = (mueble.descripcion || '').replace(/\s+/g, ' ').trim();
  const datos = {
    '@type': 'Product',
    name: mueble.nombre,
    url,
    itemCondition: 'https://schema.org/UsedCondition',
  };
  if (descripcion) datos.description = descripcion;
  if (mueble.imagenes?.length) datos.image = mueble.imagenes;
  if (mueble.referencia) datos.sku = mueble.referencia;
  if (mueble.categoria) datos.category = mueble.categoria;
  const oferta = ofertaDe(mueble, url);
  if (oferta) datos.offers = oferta;
  return datos;
};

export const migasJsonLd = (mueble) => {
  const migas = [
    { name: 'Inicio', item: `${WEB_PUBLICA}/` },
    { name: 'Catálogo', item: `${WEB_PUBLICA}/catalogo` },
  ];
  if (mueble.categoria) migas.push({ name: mueble.categoria, item: urlDeCategoria(mueble.categoria) });
  migas.push({ name: mueble.nombre, item: urlDeFicha(mueble.id) });
  return {
    '@type': 'BreadcrumbList',
    itemListElement: migas.map((miga, i) => ({ '@type': 'ListItem', position: i + 1, ...miga })),
  };
};
