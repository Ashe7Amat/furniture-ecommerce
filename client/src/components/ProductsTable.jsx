// client/src/components/ProductsTable.jsx
//
// Vista de inventario compacta del catálogo (alternativa a la cuadrícula de ProductCard).
// Es la misma tabla en escritorio y en móvil: no hay dos componentes ni dos renders
// distintos, solo CSS (en Catalog.css) que reflowa cada fila de "columnas en línea" a
// "miniatura + columna apilada" por debajo de 768px. Se usan roles ARIA de tabla (no un
// <table> real) porque el reflow a tarjeta en móvil coloca cada celda en la rejilla de la
// fila, y un <table> no deja moverlas así.
//
// Accesibilidad (H10): cada celda es hija directa de su fila, sin contenedores intermedios
// ni `display: contents`, que algunos lectores de pantalla no tratan bien. La tarjeta móvil se
// consigue colocando las celdas en la rejilla (grid-row / grid-column), no agrupándolas. Y
// cada columna tiene cabecera con nombre, aunque no se vea ("Foto", "Acción"): si faltara
// alguna, el lector anunciaría cada celda con la cabecera de la columna siguiente.
import { useState } from 'react';
import { formatPrice } from '../utils/format';
import { PLACEHOLDER_IMG } from '../utils/images';
import QuickViewModal from './QuickViewModal';
// Estilos en Catalog.css (archivo existente), no en una hoja nueva: esta tabla es una
// vista alternativa DEL catálogo, no un componente independiente con identidad propia.
import '../styles/Catalog.css';

const ETIQUETA_ESTADO = {
  disponible: 'Disponible',
  vendido: 'Vendido',
  alquilado: 'Alquilado',
};

// Mismo criterio de respaldo que ya usan ProductCard/QuickViewModal: venta primero, si no
// hay, alquiler por día, si no hay ninguno, "Consultar". Solo se usa en la tarjeta móvil
// (columna única de precio); en la tabla de escritorio, venta y alquiler son dos columnas
// literales que muestran "—" cuando no aplican, no se combinan entre sí.
const precioMovil = (mueble) => {
  if (mueble.precio_venta) return `${formatPrice(mueble.precio_venta)} €`;
  if (mueble.precio_alquiler_dia) return `${formatPrice(mueble.precio_alquiler_dia)} €/día`;
  return 'Consultar';
};

const ProductsTable = ({ productos }) => {
  const [muebleActivo, setMuebleActivo] = useState(null);

  return (
    <>
      <div className="products-table" role="table" aria-label="Catálogo de muebles, vista de lista">
        <div className="products-table-headrow" role="row">
          <div className="products-table-cell products-table-col-thumb" role="columnheader">
            <span className="products-table-sr-only">Foto</span>
          </div>
          <div className="products-table-cell products-table-col-nombre" role="columnheader">Nombre</div>
          <div className="products-table-cell products-table-col-categoria" role="columnheader">Categoría</div>
          <div className="products-table-cell products-table-col-precio" role="columnheader">Precio venta</div>
          <div className="products-table-cell products-table-col-alquiler" role="columnheader">Precio alquiler/día</div>
          <div className="products-table-cell products-table-col-estado" role="columnheader">Estado</div>
          <div className="products-table-cell products-table-col-accion" role="columnheader">
            <span className="products-table-sr-only">Acción</span>
          </div>
        </div>

        {productos.map((mueble) => {
          const estado = mueble.estado || 'disponible';
          const imageUrl = mueble.imagenes && mueble.imagenes.length > 0 ? mueble.imagenes[0] : PLACEHOLDER_IMG;

          return (
            <div
              key={mueble.id}
              role="row"
              className="products-table-row"
              onClick={() => setMuebleActivo(mueble)}
            >
              <div className="products-table-cell products-table-col-thumb" role="cell">
                <img src={imageUrl} alt={mueble.nombre || 'Mueble'} loading="lazy" decoding="async" />
              </div>

              <div className="products-table-cell products-table-col-nombre" role="cell">{mueble.nombre}</div>
              <div className="products-table-cell products-table-col-categoria" role="cell">{mueble.categoria || '—'}</div>
              <div className="products-table-cell products-table-col-precio" role="cell">
                {mueble.precio_venta ? `${formatPrice(mueble.precio_venta)} €` : '—'}
              </div>
              <div className="products-table-cell products-table-col-alquiler" role="cell">
                {mueble.precio_alquiler_dia ? `${formatPrice(mueble.precio_alquiler_dia)} €/día` : '—'}
              </div>
              {/* Solo visible en la tarjeta móvil (CSS): precio único con el mismo
                  respaldo venta→alquiler→"Consultar" que usan ProductCard/QuickViewModal. En
                  escritorio está oculta con display:none, y tampoco la ve un lector de pantalla. */}
              <div className="products-table-cell products-table-col-precio-movil" role="cell">
                {precioMovil(mueble)}
              </div>
              <div className="products-table-cell products-table-col-estado" role="cell">
                <span className={`products-table-badge products-table-badge--${estado}`}>
                  {ETIQUETA_ESTADO[estado] || estado}
                </span>
              </div>
              <div className="products-table-cell products-table-col-accion" role="cell">
                <button
                  type="button"
                  className="products-table-ver-btn"
                  aria-label={`Ver ${mueble.nombre}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMuebleActivo(mueble);
                  }}
                >
                  Ver
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {muebleActivo && (
        <QuickViewModal mueble={muebleActivo} onClose={() => setMuebleActivo(null)} />
      )}
    </>
  );
};

export default ProductsTable;
