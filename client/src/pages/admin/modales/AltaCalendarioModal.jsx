import { useState } from 'react';
import DialogoReserva from './DialogoReserva';
import CampoReserva from './CampoReserva';
import { HORAS_TRAYECTO } from '../../../utils/reservas';
import { MODOS, camposAlta, datosAlta, validarAlta } from '../reservasAdmin';

// Las tres altas en el calendario sin pago web (8.3): "Bloquear fechas", "Registrar alquiler fuera
// de la web" y "Registrar venta fuera de la web". Si chocan con algo, el servidor responde 409 con
// las fechas y la referencia de lo que choca, y ese mensaje sale aquí tal cual.
const TEXTOS = {
  bloqueo: { titulo: 'Bloquear fechas', boton: 'Bloquear fechas' },
  alquiler: { titulo: 'Registrar alquiler fuera de la web', boton: 'Registrar alquiler' },
  venta: { titulo: 'Registrar venta fuera de la web', boton: 'Registrar venta' }
};

const AltaCalendarioModal = ({ tipo, muebles, hoy, enviando, error, onEnviar, onCerrar }) => {
  const [campos, setCampos] = useState(() => camposAlta(hoy));
  const [aviso, setAviso] = useState('');

  const cambiar = (e) => {
    const { name: campo, type, value, checked } = e.target;
    setCampos((c) => ({ ...c, [campo]: type === 'checkbox' ? checked : value }));
  };

  const enviar = (e) => {
    e.preventDefault();
    const problema = validarAlta(tipo, campos, hoy);
    setAviso(problema);
    if (!problema) onEnviar(datosAlta(tipo, campos));
  };

  // Un control enlazado con su campo por `name`.
  const control = (Elemento, campo, props = {}) => (
    <Elemento name={campo} value={campos[campo]} onChange={cambiar} {...props} />
  );
  const selectorModo = (campo) => (
    <select name={campo} value={campos[campo]} onChange={cambiar}>
      {MODOS.map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
    </select>
  );
  const selectorHora = (campo) => (
    <select name={campo} value={campos[campo]} onChange={cambiar}>
      {HORAS_TRAYECTO.map((hora) => <option key={hora} value={hora}>{hora}</option>)}
    </select>
  );

  return (
    <DialogoReserva titulo={TEXTOS[tipo].titulo} onCerrar={onCerrar}>
      <form className="admin-form reservas-form" onSubmit={enviar} noValidate>
        {tipo === 'venta' && (
          <p className="reservas-dialogo-texto">
            Para una venta en la tienda o por teléfono, y también para una venta con entrega diferida: la pieza
            pasa a ser del comprador desde la fecha que pongas, sin fin, y ya no se puede reservar desde ese día.
          </p>
        )}
        <CampoReserva etiqueta="Pieza">
          <select name="mueble_id" value={campos.mueble_id} onChange={cambiar} required>
            <option value="">Elige una pieza</option>
            {muebles.map((m) => (
              <option key={m.id} value={m.id}>{m.referencia ? `${m.nombre} (${m.referencia})` : m.nombre}</option>
            ))}
          </select>
        </CampoReserva>

        {tipo === 'bloqueo' && (
          <div className="admin-form-row">
            <CampoReserva etiqueta="Primer día bloqueado">{control('input', 'fecha_inicio', { type: 'date', required: true })}</CampoReserva>
            <CampoReserva etiqueta="Libre de nuevo el" pista="El primer día que se puede volver a reservar.">
              {control('input', 'fecha_fin', { type: 'date', required: true })}
            </CampoReserva>
          </div>
        )}

        {tipo === 'venta' && (
          <CampoReserva
            etiqueta="Fecha de la venta"
            pista="Con entrega diferida, el primer día que la pieza queda libre después de sus alquileres."
          >
            {control('input', 'fecha_inicio', { type: 'date', required: true })}
          </CampoReserva>
        )}

        {tipo === 'alquiler' && (
          <>
            <CampoReserva
              etiqueta="Contrato"
              pista="Un contrato antiguo queda marcado para revisarlo hasta que se firme la fecha de fin."
            >
              <select name="origen" value={campos.origen} onChange={cambiar}>
                <option value="manual">Con fecha de fin pactada</option>
                <option value="legacy">Contrato antiguo (fecha de fin estimada)</option>
              </select>
            </CampoReserva>
            <div className="admin-form-row">
              <CampoReserva etiqueta="Día de entrega">{control('input', 'fecha_inicio', { type: 'date', required: true })}</CampoReserva>
              <CampoReserva etiqueta="Hora de entrega">{selectorHora('hora_entrega')}</CampoReserva>
              <CampoReserva etiqueta="Entrega">{selectorModo('modo_entrega')}</CampoReserva>
            </div>
            <div className="admin-form-row">
              <CampoReserva etiqueta="Día de recogida">{control('input', 'fecha_fin', { type: 'date', required: true })}</CampoReserva>
              <CampoReserva etiqueta="Hora de recogida">{selectorHora('hora_recogida')}</CampoReserva>
              <CampoReserva etiqueta="Recogida">{selectorModo('modo_devolucion')}</CampoReserva>
            </div>
            <CampoReserva etiqueta="Nombre del cliente">{control('input', 'nombre', { maxLength: 100, required: true })}</CampoReserva>
            <div className="admin-form-row">
              <CampoReserva etiqueta="Teléfono">{control('input', 'telefono', { type: 'tel', maxLength: 30 })}</CampoReserva>
              <CampoReserva etiqueta="Email">{control('input', 'email', { type: 'email', maxLength: 254 })}</CampoReserva>
            </div>
            <CampoReserva etiqueta="Dirección">{control('input', 'direccion', { maxLength: 500 })}</CampoReserva>
            <CampoReserva etiqueta="Notas">{control('textarea', 'notas', { maxLength: 500 })}</CampoReserva>
            <CampoReserva etiqueta="Importe total (€)" pista="Opcional: lo cobrado fuera de la web, por ejemplo 120,50.">
              {control('input', 'importe', { type: 'text', inputMode: 'decimal' })}
            </CampoReserva>
            <label className="reservas-check">
              <input type="checkbox" name="ya_entregado" checked={campos.ya_entregado} onChange={cambiar} />
              Ya está entregada (el cliente ya tiene la pieza)
            </label>
          </>
        )}

        {tipo !== 'alquiler' && (
          <CampoReserva etiqueta="Motivo">
            {control('input', 'motivo', {
              maxLength: 500,
              required: true,
              placeholder: tipo === 'bloqueo' ? 'Mantenimiento, exposición…' : 'Venta en tienda, entrega diferida…'
            })}
          </CampoReserva>
        )}

        {(aviso || error) && <p className="reservas-error" role="alert">{aviso || error}</p>}
        <div className="reservas-dialogo-botones">
          <button type="button" className="admin-btn-ghost" onClick={onCerrar}>Volver</button>
          <button type="submit" className="admin-btn" disabled={enviando}>{enviando ? 'Guardando…' : TEXTOS[tipo].boton}</button>
        </div>
      </form>
    </DialogoReserva>
  );
};

export default AltaCalendarioModal;
