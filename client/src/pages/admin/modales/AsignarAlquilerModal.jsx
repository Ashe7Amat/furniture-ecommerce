import { useState } from 'react';
import { updateMueble } from '../../../services/api';
import Icon from '../Icon';
import { ejecutarLote } from '../lotes';
import { formatoPrecio, leerPrecio, precioAlquilerPara, precioDe, textoPiezas, textoResultadoAlquiler } from '../precios';

// Modal "Asignar precio de alquiler" de la barra de acciones en lote del inventario. Tres pasos:
// 1. elegir cómo: un precio fijo por día, o un porcentaje del precio de venta (5 %, 10 % u otro)
//    redondeado a euros enteros o a 0,50 €;
// 2. confirmar, viendo el precio que le toca a cada pieza;
// 3. el resultado: "X de Y piezas actualizadas".
// El porcentaje no sirve para una pieza sin precio de venta: si ninguna de las elegidas lo tiene,
// la opción sale desactivada; si solo faltan algunas, esas se quedan como están (y se dice antes).
// `onAplicado({ hechos, fallidos, total })` llega al acabar, con los ids que fallaron.
const PORCENTAJES = [5, 10];
const euros = (valor) => `${formatoPrecio(valor)} €`;

const AsignarAlquilerModal = ({ piezas: piezasElegidas, onCerrar, onAplicado }) => {
  // Las piezas se fijan al abrir: al acabar, el inventario se recarga y la selección cambia, y el
  // resultado tiene que seguir hablando de las que se eligieron.
  const [piezas] = useState(piezasElegidas);
  const [modo, setModo] = useState('fijo');
  const [fijo, setFijo] = useState('');
  const [porcentaje, setPorcentaje] = useState('10');
  const [personalizado, setPersonalizado] = useState('');
  const [redondeo, setRedondeo] = useState('entero');
  const [confirmando, setConfirmando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const total = piezas.length;
  const sinVenta = piezas.filter((m) => precioDe(m.precio_venta) === null).length;
  const porcentajeDisponible = sinVenta < total;

  // La opción elegida, o null si lo escrito no vale (vacío, 0, negativo o más del 100 %).
  const opcion = (() => {
    if (modo === 'fijo') {
      const { valor } = leerPrecio(fijo);
      return valor > 0 ? { modo, fijo: valor } : null;
    }
    const pct = Number(porcentaje === 'otro' ? personalizado : porcentaje);
    return pct > 0 && pct <= 100 ? { modo, porcentaje: pct, redondeo } : null;
  })();
  const propuesta = opcion ? piezas.map((m) => ({ mueble: m, precio: precioAlquilerPara(m, opcion) })) : [];
  const aplicables = propuesta.filter((p) => p.precio !== null);

  const aplicar = async () => {
    setAplicando(true);
    const precioPorId = new Map(aplicables.map((p) => [p.mueble.id, p.precio]));
    const { hechos, fallidos } = await ejecutarLote([...precioPorId.keys()], (id) =>
      updateMueble(id, { precio_alquiler: String(precioPorId.get(id)) })
    );
    setAplicando(false);
    setConfirmando(false);
    setResultado({ hechos, fallidos: piezas.filter((m) => fallidos.includes(m.id)) });
    onAplicado({ hechos, fallidos, total });
  };

  // Cambiar cualquier opción cierra la confirmación: lo que se confirma es siempre lo que se ve.
  const cambiar = (setter) => (valor) => {
    setter(valor);
    setConfirmando(false);
  };
  const elegirModo = cambiar(setModo);
  const elegirPorcentaje = cambiar(setPorcentaje);
  const elegirRedondeo = cambiar(setRedondeo);

  return (
    <div className="admin-modal-overlay">
      <div className="admin-modal-content importar-modal" role="dialog" aria-modal="true" aria-labelledby="alquiler-titulo">
        <div className="admin-modal-header">
          <h3 id="alquiler-titulo">Asignar precio de alquiler</h3>
          <button className="admin-modal-close" onClick={onCerrar} aria-label="Cerrar"><Icon name="close" /></button>
        </div>

        {resultado ? (
          <div className="importar-resultado">
            <p className="importar-exito">{textoResultadoAlquiler(resultado.hechos, total)}</p>
            {resultado.fallidos.length > 0 && (
              <p className="importar-error">
                No se pudo guardar: {resultado.fallidos.map((m) => m.nombre).join(', ')}. Siguen seleccionadas para reintentarlo.
              </p>
            )}
            <button className="admin-btn" onClick={onCerrar}>Volver al inventario</button>
          </div>
        ) : (
          <>
            <p className="importar-ayuda">Precio por día para {textoPiezas(total)} seleccionada{total === 1 ? '' : 's'}.</p>

            <fieldset className="alquiler-grupo">
              <legend>¿Cómo?</legend>
              <label className="alquiler-opcion">
                <input type="radio" name="alquiler-modo" checked={modo === 'fijo'} onChange={() => elegirModo('fijo')} />
                Precio fijo por día
              </label>
              {modo === 'fijo' && (
                <div className="alquiler-detalle">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    aria-label="Precio por día (€)"
                    placeholder="€/día"
                    value={fijo}
                    onChange={(e) => cambiar(setFijo)(e.target.value)}
                  />
                </div>
              )}

              <label className={`alquiler-opcion ${porcentajeDisponible ? '' : 'is-desactivada'}`}>
                <input
                  type="radio"
                  name="alquiler-modo"
                  checked={modo === 'porcentaje'}
                  disabled={!porcentajeDisponible}
                  onChange={() => elegirModo('porcentaje')}
                />
                Porcentaje del precio de venta
              </label>
              {!porcentajeDisponible && (
                <p className="importar-aviso">
                  {total === 1 ? 'Esta pieza no tiene' : 'Ninguna de las piezas seleccionadas tiene'} precio de venta.
                </p>
              )}
              {modo === 'porcentaje' && (
                <div className="alquiler-detalle">
                  <div className="alquiler-fila" role="radiogroup" aria-label="Porcentaje">
                    {PORCENTAJES.map((p) => (
                      <label key={p} className="alquiler-opcion">
                        <input
                          type="radio"
                          name="alquiler-porcentaje"
                          checked={porcentaje === String(p)}
                          onChange={() => elegirPorcentaje(String(p))}
                        />
                        {p} %
                      </label>
                    ))}
                    <label className="alquiler-opcion">
                      <input
                        type="radio"
                        name="alquiler-porcentaje"
                        checked={porcentaje === 'otro'}
                        onChange={() => elegirPorcentaje('otro')}
                      />
                      Personalizado
                    </label>
                    {porcentaje === 'otro' && (
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        aria-label="Porcentaje personalizado (%)"
                        placeholder="%"
                        value={personalizado}
                        onChange={(e) => cambiar(setPersonalizado)(e.target.value)}
                      />
                    )}
                  </div>
                  <div className="alquiler-fila" role="radiogroup" aria-label="Redondeo">
                    <label className="alquiler-opcion">
                      <input
                        type="radio"
                        name="alquiler-redondeo"
                        checked={redondeo === 'entero'}
                        onChange={() => elegirRedondeo('entero')}
                      />
                      Redondear a euros enteros
                    </label>
                    <label className="alquiler-opcion">
                      <input
                        type="radio"
                        name="alquiler-redondeo"
                        checked={redondeo === 'medio'}
                        onChange={() => elegirRedondeo('medio')}
                      />
                      Redondear a 0,50 €
                    </label>
                  </div>
                  {sinVenta > 0 && (
                    <p className="importar-aviso">
                      {sinVenta === 1
                        ? `1 de las ${total} piezas no tiene precio de venta: se quedará como está.`
                        : `${sinVenta} de las ${total} piezas no tienen precio de venta: se quedarán como están.`}
                    </p>
                  )}
                </div>
              )}
            </fieldset>

            <div className="importar-botones">
              <button
                className="admin-btn"
                onClick={() => setConfirmando(true)}
                disabled={aplicables.length === 0 || confirmando}
              >
                Revisar y aplicar
              </button>
              <button className="admin-btn-ghost" onClick={onCerrar}>Cancelar</button>
            </div>

            {confirmando && (
              <div className="importar-confirmacion" role="alertdialog" aria-label="Confirmar precio de alquiler">
                <p>
                  Se va a cambiar el precio de alquiler de {textoPiezas(aplicables.length)}
                  {total - aplicables.length === 1 && ' (la otra se queda como está)'}
                  {total - aplicables.length > 1 && ` (las otras ${total - aplicables.length} se quedan como están)`}. ¿Seguir?
                </p>
                <div className="importar-botones">
                  <button className="admin-btn" onClick={aplicar} disabled={aplicando}>
                    {aplicando ? 'Guardando…' : 'Sí, asignar'}
                  </button>
                  <button className="admin-btn-ghost" onClick={() => setConfirmando(false)} disabled={aplicando}>
                    Volver
                  </button>
                </div>
              </div>
            )}

            {propuesta.length > 0 && (
              <div className="importar-previa">
                <table className="importar-tabla">
                  <thead>
                    <tr>
                      <th>Pieza</th>
                      <th>Venta</th>
                      <th>Alquiler ahora</th>
                      <th>Alquiler nuevo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {propuesta.map(({ mueble, precio }) => (
                      <tr key={mueble.id} className={precio === null ? 'is-error' : 'is-valida'}>
                        <td>{mueble.nombre}</td>
                        <td>{precioDe(mueble.precio_venta) === null ? '—' : euros(mueble.precio_venta)}</td>
                        <td>{precioDe(mueble.precio_alquiler_dia) === null ? '—' : `${euros(mueble.precio_alquiler_dia)}/día`}</td>
                        <td>{precio === null ? 'Sin cambios' : `${euros(precio)}/día`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AsignarAlquilerModal;
