import VistaImpresion from './VistaImpresion';
import { PLACEHOLDER_IMG, miniatura } from '../../utils/images';
import { BRAND } from '../../theme/brand.config';

const formatearFecha = (fechaStr) => {
  if (!fechaStr) return '—';
  try {
    const d = new Date(fechaStr);
    if (isNaN(d.getTime())) return fechaStr;
    return d.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return fechaStr;
  }
};

export const ContenidoAlbaran = ({ pedido = {}, muebles = [] }) => {
  const cliente = pedido.cliente_info || {};
  const direccion = cliente.direccion || pedido.direccion_envio;
  const items = Array.isArray(pedido.items) ? pedido.items : [];
  const refCorta = pedido.id ? pedido.id.slice(0, 8).toUpperCase() : '';
  const mueblesMap = new Map((muebles || []).map((m) => [m.id, m]));

  return (
    <article className="hoja-a4 hoja-albaran" aria-label={`Albarán de pedido ${refCorta}`}>
      <header className="albaran-cabecera">
        <div className="albaran-empresa">
          <p className="albaran-empresa-nombre">{BRAND.nombre.toUpperCase()}</p>
          <p className="albaran-empresa-datos">{`${BRAND.contacto.calle}, ${BRAND.contacto.ciudad}`}</p>
          <p className="albaran-empresa-datos">NIF: B-00000000</p>
        </div>
        <div className="albaran-tipo-doc">
          <h2 className="albaran-titulo">ALBARÁN DE PEDIDO</h2>
          {refCorta && <p className="albaran-doc-ref">Ref. {refCorta}</p>}
        </div>
      </header>

      <section className="albaran-metadatos">
        <div className="albaran-bloque albaran-datos-pedido">
          <h3 className="albaran-bloque-titulo">Datos del pedido</h3>
          <dl className="albaran-dl">
            <dt>ID Pedido:</dt>
            <dd>{pedido.id || '—'}</dd>
            <dt>Fecha:</dt>
            <dd>{formatearFecha(pedido.created_at)}</dd>
          </dl>
        </div>

        <div className="albaran-bloque albaran-datos-cliente">
          <h3 className="albaran-bloque-titulo">Datos del cliente</h3>
          <dl className="albaran-dl">
            <dt>Nombre:</dt>
            <dd>{cliente.nombre || 'Sin nombre'}</dd>
            {cliente.email && (
              <>
                <dt>Email:</dt>
                <dd>{cliente.email}</dd>
              </>
            )}
            {cliente.telefono && (
              <>
                <dt>Teléfono:</dt>
                <dd>{cliente.telefono}</dd>
              </>
            )}
            {direccion && (
              <>
                <dt>Dirección:</dt>
                <dd>{direccion}</dd>
              </>
            )}
          </dl>
        </div>
      </section>

      <section className="albaran-articulos">
        <h3 className="albaran-bloque-titulo">Piezas</h3>
        <table className="albaran-tabla">
          <thead>
            <tr>
              <th className="col-foto">Foto</th>
              <th className="col-ref">Referencia</th>
              <th className="col-nombre">Nombre</th>
              <th className="col-salida">Estado a la salida</th>
              <th className="col-obs">Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="albaran-sin-items">No hay piezas registradas en este pedido.</td>
              </tr>
            ) : (
              items.map((item, idx) => {
                const mueble = mueblesMap.get(item.productId || item.id);
                const referencia = item.referencia || mueble?.referencia || '—';
                const nombre = item.nombre || mueble?.nombre || 'Pieza';
                const fotoRaw =
                  item.imagen ||
                  (Array.isArray(item.imagenes) && item.imagenes[0]) ||
                  item.foto ||
                  (mueble?.imagenes && mueble.imagenes[0]) ||
                  mueble?.imagen;
                const foto = fotoRaw ? miniatura(fotoRaw) : PLACEHOLDER_IMG;

                return (
                  <tr key={item.id || item.productId || idx}>
                    <td className="col-foto">
                      <img
                        src={foto}
                        alt={`Miniatura de ${nombre}`}
                        className="albaran-thumb"
                        loading="lazy"
                        decoding="async"
                      />
                    </td>
                    <td className="col-ref">
                      <span className="albaran-item-ref">{referencia}</span>
                    </td>
                    <td className="col-nombre">
                      <span>{nombre}</span>
                      {item.modalidad === 'alquiler' && <span className="albaran-modalidad"> (alquiler)</span>}
                    </td>
                    <td className="col-salida" aria-label="Estado a la salida"></td>
                    <td className="col-obs" aria-label="Observaciones"></td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      <section className="albaran-firmas" aria-label="Firmas de conformidad">
        <div className="albaran-caja-firma">
          <p className="albaran-firma-titulo">
            Firma de conformidad en la Entrega (Recibido en buen estado)
          </p>
          <p className="albaran-firma-fecha">Fecha: ____</p>
        </div>
        <div className="albaran-caja-firma">
          <p className="albaran-firma-titulo">
            Firma de conformidad en la Devolución (Revisado por almacén)
          </p>
          <p className="albaran-firma-fecha">Fecha: ____</p>
        </div>
      </section>
    </article>
  );
};

const AlbaranPedido = ({ pedido = {}, muebles = [], onCerrar }) => {
  const refCorta = pedido?.id ? pedido.id.slice(0, 8).toUpperCase() : '';
  const titulo = `Albarán de pedido ${refCorta ? `Ref. ${refCorta}` : ''}`.trim();

  if (!onCerrar) {
    return <ContenidoAlbaran pedido={pedido} muebles={muebles} />;
  }

  return (
    <VistaImpresion titulo={titulo} onCerrar={onCerrar}>
      <ContenidoAlbaran pedido={pedido} muebles={muebles} />
    </VistaImpresion>
  );
};

export default AlbaranPedido;
