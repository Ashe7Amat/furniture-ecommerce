import { useContext, useState } from 'react';
import useEstadoEnvio from '../hooks/useEstadoEnvio';
import { ToastContext } from '../../../context/ToastContext';
import { updateMueble } from '../../../services/api';
import Icon from '../Icon';
import SelectorCategoria from '../SelectorCategoria';
import GaleriaFotos from './GaleriaFotos';
import { idDeCategoria } from '../categorias';
import { prepararFotos, textoOptimizando, textoDemasiadoPeso } from '../../../utils/imagen';

// Modal "Editar Producto". Lo pinta el contenedor, fuera de <main>, y su estado (la pieza que se
// edita y las fotos nuevas) vive allí. El estado del envío es solo de este
// modal (H14): su error sale aquí, no debajo de otro formulario.
const EditarMuebleModal = ({
  mueble, setMueble,
  archivosNuevos, setArchivosNuevos,
  categorias,
  confirmarBorrado,
  onGuardado,
  onCerrar
}) => {
  const { showToast } = useContext(ToastContext);
  const envio = useEstadoEnvio();
  // La foto de antes de restaurar (el "antes y después" de la ficha): una nueva para subir, o quitar la que hay.
  const [fotoAntes, setFotoAntes] = useState(null);
  const [quitarAntes, setQuitarAntes] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!mueble) return;
    if (envio.enviando) return; // ya hay un envío en curso (p. ej. un doble clic o Intro)
    envio.empezar('Actualizando producto...');

    // Las fotos nuevas se reducen antes de subirlas (H24, ver utils/imagen.js). Si ni así caben en
    // una petición, no se manda nada.
    // La foto de antes va en la misma petición, así que se reduce y se pesa junto con las demás (al final).
    const aSubir = fotoAntes ? [...archivosNuevos, fotoAntes] : archivosNuevos;
    let fotosNuevas = archivosNuevos;
    let fotoAntesLista = fotoAntes;
    if (aSubir.length > 0) {
      const preparadas = await prepararFotos(aSubir, { alProgreso: (n, total) => envio.empezar(textoOptimizando(n, total)) });
      if (!preparadas.caben) {
        envio.acabarMal(textoDemasiadoPeso(preparadas.peso, aSubir.length));
        showToast('Las fotos pesan demasiado', 'error');
        return;
      }
      fotosNuevas = fotoAntes ? preparadas.fotos.slice(0, -1) : preparadas.fotos;
      if (fotoAntes) fotoAntesLista = preparadas.fotos[preparadas.fotos.length - 1];
      envio.empezar('Actualizando producto...');
    }

    const formDataToSend = new FormData();
    formDataToSend.append('nombre', mueble.nombre || '');
    formDataToSend.append('categoria', mueble.categoria || '');
    const categoriaId = idDeCategoria(categorias, mueble.categoria);
    if (categoriaId !== undefined) formDataToSend.append('categoria_id', categoriaId);
    formDataToSend.append('descripcion', mueble.descripcion || '');
    formDataToSend.append('precio_venta', mueble.precio_venta || '');
    formDataToSend.append('precio_alquiler', mueble.precio_alquiler ?? mueble.precio_alquiler_dia ?? '');
    formDataToSend.append('estado', mueble.estado || 'disponible');
    formDataToSend.append('imagenes_existentes', JSON.stringify(mueble.imagenes || []));

    for (const foto of fotosNuevas) {
      formDataToSend.append('imagenes', foto);
    }
    if (fotoAntesLista) formDataToSend.append('imagen_antes', fotoAntesLista);
    else if (quitarAntes) formDataToSend.append('quitar_imagen_antes', 'true');

    const res = await updateMueble(mueble.id, formDataToSend);
    if (res) {
      envio.acabarBien();
      showToast('Producto actualizado correctamente', 'success');
      onCerrar();
      setArchivosNuevos([]);
      onGuardado();
      setFotoAntes(null);
      setQuitarAntes(false);
    } else {
      envio.acabarMal('Error al actualizar.');
      showToast('Error al actualizar el producto', 'error');
    }
  };

  return (
    <div className="admin-modal-overlay">
      <div className="admin-modal-content">
        <div className="admin-modal-header">
          <h3>Editar Producto</h3>
          <button className="admin-modal-close" onClick={onCerrar} aria-label="Cerrar"><Icon name="close" /></button>
        </div>
        <form onSubmit={handleSubmit} className="admin-form">
          {/* A5: la referencia la puso el servidor al crear el mueble y no cambia nunca (ni al
              cambiar de categoría). Solo se enseña: no va en el FormData que se guarda. */}
          <div className="field-group">
            <label className="field-label">Referencia:</label>
            <input
              type="text"
              className="field-ref"
              value={mueble.referencia || ''}
              placeholder="Sin referencia"
              readOnly
              aria-describedby="editar-mueble-ref-nota"
            />
            <small id="editar-mueble-ref-nota" className="field-hint">No editable</small>
          </div>

          <div className="field-group">
            <label className="field-label">Nombre del Mueble:</label>
            <input
              type="text"
              value={mueble.nombre || ''}
              onChange={(e) => setMueble({ ...mueble, nombre: e.target.value })}
              required
            />
          </div>

          <div className="field-group">
            <label className="field-label">Categoría:</label>
            <SelectorCategoria
              categorias={categorias}
              value={mueble.categoria || ''}
              onChange={(e) => setMueble({ ...mueble, categoria: e.target.value })}
            />
          </div>

          <div className="field-group">
            <label className="field-label">Descripción:</label>
            <textarea
              value={mueble.descripcion || ''}
              onChange={(e) => setMueble({ ...mueble, descripcion: e.target.value })}
              required
            />
          </div>

          <div className="modal-form-row">
            <div className="field-group">
              <label className="field-label">Venta (€):</label>
              <input
                type="number"
                value={mueble.precio_venta || ''}
                onChange={(e) => setMueble({ ...mueble, precio_venta: e.target.value })}
              />
            </div>
            <div className="field-group">
              <label className="field-label">Alquiler (€/día):</label>
              <input
                type="number"
                value={mueble.precio_alquiler ?? mueble.precio_alquiler_dia ?? ''}
                onChange={(e) => setMueble({ ...mueble, precio_alquiler: e.target.value })}
              />
            </div>
          </div>

          <div className="field-group">
            <label className="field-label">Estado:</label>
            <select
              value={mueble.estado || 'disponible'}
              onChange={(e) => setMueble({ ...mueble, estado: e.target.value })}
            >
              <option value="disponible">Disponible</option>
              <option value="vendido">Vendido</option>
              <option value="alquilado">Alquilado</option>
            </select>
          </div>

          {mueble.imagenes && mueble.imagenes.length > 0 && (
            <div className="field-group">
              {/* H57: las fotos en grande y en orden; se arrastran para cambiarlo y la primera es la principal.
                  El orden nuevo se guarda con "Guardar Cambios" (imagenes_existentes va en ese orden). */}
              <span className="field-label">
                Fotos (la primera es la principal; arrástralas para cambiar el orden):
              </span>
              <GaleriaFotos
                fotos={mueble.imagenes}
                onCambiar={(imagenes) => setMueble({ ...mueble, imagenes })}
                alPedirQuitar={(idx) => {
                  confirmarBorrado(
                    'Eliminar Imagen de Producto',
                    '¿Estás seguro de que deseas eliminar esta imagen de este producto? Se quitará de la previsualización actual.',
                    () => {
                      const updatedImgs = mueble.imagenes.filter((_, i) => i !== idx);
                      setMueble({ ...mueble, imagenes: updatedImgs });
                    }
                  );
                }}
              />
            </div>
          )}

          <div className="file-input-wrapper">
            <label>Añadir más imágenes (Opcional):</label>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => setArchivosNuevos(Array.from(e.target.files))}
            />
          </div>

          {/* El "antes y después" de la ficha compara esta foto con la principal. Es opcional. */}
          <div className="file-input-wrapper">
            <label htmlFor="editar-mueble-foto-antes">Foto de antes de restaurar (opcional):</label>
            {mueble.imagen_antes && !quitarAntes && !fotoAntes && (
              <div className="foto-antes-actual">
                <img src={mueble.imagen_antes} alt="Foto de antes de restaurar" className="foto-antes-miniatura" />
                <button type="button" className="admin-btn-danger-ghost" onClick={() => setQuitarAntes(true)}>
                  Quitar foto de antes
                </button>
              </div>
            )}
            {quitarAntes && !fotoAntes && (
              <p className="field-hint">Se quitará al guardar.</p>
            )}
            <input
              id="editar-mueble-foto-antes"
              type="file"
              accept="image/*"
              onChange={(e) => setFotoAntes(e.target.files[0] || null)}
            />
          </div>

          <button type="submit" className="admin-btn" disabled={envio.enviando}>
            Guardar Cambios
          </button>
          {envio.mensaje && <p className="admin-status">{envio.mensaje}</p>}
        </form>
      </div>
    </div>
  );
};

export default EditarMuebleModal;
