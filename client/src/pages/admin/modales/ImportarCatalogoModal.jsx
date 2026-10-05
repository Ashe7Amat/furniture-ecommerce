import { useContext, useState } from 'react';
import { ToastContext } from '../../../context/ToastContext';
import { importarCatalogoCsv } from '../../../services/api';
import Icon from '../Icon';

// Modal "Importar catálogo (CSV)" de "Gestionar Inventario". Tres pasos:
// 1. elegir el archivo (arrastrándolo o con el selector);
// 2. "Previsualizar": el servidor comprueba cada fila sin guardar nada, y aquí se enseñan;
// 3. "Aplicar" (con confirmación): se dan de alta las filas válidas y se saltan las demás.
// Cada fila válida es una pieza NUEVA, con su referencia automática.
const esCsv = (archivo) => /\.csv$/i.test(archivo.name) || archivo.type === 'text/csv';
const piezas = (n) => `${n} pieza${n === 1 ? '' : 's'}`;
const filas = (n) => `${n} fila${n === 1 ? '' : 's'}`;

const ImportarCatalogoModal = ({ onCerrar, onImportado }) => {
  const { showToast } = useContext(ToastContext);
  const [archivo, setArchivo] = useState(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [previa, setPrevia] = useState(null);
  const [confirmando, setConfirmando] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState(null);

  const elegirArchivo = (nuevo) => {
    if (!nuevo) return;
    setPrevia(null);
    setConfirmando(false);
    if (!esCsv(nuevo)) {
      setArchivo(null);
      setError('Elige un archivo .csv.');
      return;
    }
    setError('');
    setArchivo(nuevo);
  };

  const soltar = (e) => {
    e.preventDefault();
    setArrastrando(false);
    elegirArchivo(e.dataTransfer.files?.[0]);
  };

  const previsualizar = async () => {
    setCargando(true);
    setError('');
    const { datos, error: fallo } = await importarCatalogoCsv(archivo, 'preview');
    setCargando(false);
    if (fallo) {
      setPrevia(null);
      setError(fallo);
      return;
    }
    setPrevia(datos);
  };

  const aplicar = async () => {
    setCargando(true);
    setError('');
    const { datos, error: fallo } = await importarCatalogoCsv(archivo, 'apply');
    setCargando(false);
    setConfirmando(false);
    if (fallo) {
      setError(fallo);
      return;
    }
    setResultado(datos);
    showToast(`${piezas(datos.creadas)} importada${datos.creadas === 1 ? '' : 's'}`, 'success');
    onImportado();
  };

  return (
    <div className="admin-modal-overlay">
      <div className="admin-modal-content importar-modal" role="dialog" aria-modal="true" aria-labelledby="importar-titulo">
        <div className="admin-modal-header">
          <h3 id="importar-titulo">Importar catálogo (CSV)</h3>
          <button className="admin-modal-close" onClick={onCerrar} aria-label="Cerrar"><Icon name="close" /></button>
        </div>

        {resultado ? (
          <div className="importar-resultado">
            <p className="importar-exito">
              Se han creado {piezas(resultado.creadas)}.
              {resultado.saltadas > 0 && ` Se han saltado ${filas(resultado.saltadas)}.`}
            </p>
            {resultado.errores.length > 0 && (
              <ul className="importar-errores">
                {resultado.errores.map((e) => (
                  <li key={e.linea}>Línea {e.linea}: {e.motivo}</li>
                ))}
              </ul>
            )}
            <button className="admin-btn" onClick={onCerrar}>Volver al inventario</button>
          </div>
        ) : (
          <>
            <p className="importar-ayuda">
              La primera línea lleva los nombres de las columnas: <code>nombre</code> y <code>categoria</code> son
              obligatorias; <code>descripcion</code>, <code>precio_venta</code>, <code>precio_alquiler_dia</code>,{' '}
              <code>estado</code> e <code>imagenes</code> son opcionales. Cada fila es una pieza nueva: la referencia se
              pone sola. Máximo 500 filas.
            </p>

            <label
              className={`importar-zona ${arrastrando ? 'is-arrastrando' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setArrastrando(true);
              }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={soltar}
            >
              <input
                type="file"
                accept=".csv,text/csv"
                className="importar-input"
                aria-label="Archivo CSV"
                onChange={(e) => elegirArchivo(e.target.files?.[0])}
              />
              {archivo ? (
                <span><strong>{archivo.name}</strong> — pulsa o arrastra otro para cambiarlo</span>
              ) : (
                <span>Arrastra aquí el archivo CSV o <u>pulsa para elegirlo</u></span>
              )}
            </label>

            {error && <p className="importar-error" role="alert">{error}</p>}

            <div className="importar-botones">
              <button className="admin-btn-ghost" onClick={previsualizar} disabled={!archivo || cargando}>
                {cargando && !previa ? 'Comprobando…' : 'Previsualizar'}
              </button>
              <button
                className="admin-btn"
                onClick={() => setConfirmando(true)}
                disabled={!previa || previa.validas === 0 || cargando || confirmando}
              >
                Aplicar
              </button>
            </div>

            {confirmando && (
              <div className="importar-confirmacion" role="alertdialog" aria-label="Confirmar importación">
                <p>
                  Se van a dar de alta {piezas(previa.validas)} nueva{previa.validas === 1 ? '' : 's'} en el catálogo
                  {previa.errores.length > 0 && ` y se saltarán ${filas(previa.errores.length)} con errores`}. ¿Seguir?
                </p>
                <div className="importar-botones">
                  <button className="admin-btn" onClick={aplicar} disabled={cargando}>
                    {cargando ? 'Importando…' : 'Sí, importar'}
                  </button>
                  <button className="admin-btn-ghost" onClick={() => setConfirmando(false)} disabled={cargando}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {previa && (
              <div className="importar-previa">
                <p className="importar-resumen">
                  {previa.validas} de {filas(previa.total)} se pueden importar.
                </p>
                {previa.columnasIgnoradas.length > 0 && (
                  <p className="importar-aviso">
                    Columnas que no se usan: {previa.columnasIgnoradas.join(', ')}.
                  </p>
                )}
                <table className="importar-tabla">
                  <thead>
                    <tr>
                      <th>Línea</th>
                      <th>Nombre</th>
                      <th>Categoría</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previa.filas.map((fila) => (
                      <tr key={fila.linea} className={fila.valida ? 'is-valida' : 'is-error'}>
                        <td>{fila.linea}</td>
                        <td>{fila.nombre || '—'}</td>
                        <td>{fila.categoria || '—'}</td>
                        <td>{fila.valida ? 'Lista para importar' : fila.motivo}</td>
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

export default ImportarCatalogoModal;
