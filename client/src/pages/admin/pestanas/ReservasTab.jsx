import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ToastContext } from '../../../context/ToastContext';
import { getReservasAdmin, accionReservaAdmin, crearEnCalendarioAdmin } from '../../../services/api';
import { eurosDeCentimos, fechaCorta, fechaLarga } from '../../../utils/reservas';
import { VISTAS, centimosDeEuros, hoyMasReciente } from '../reservasAdmin';
import TarjetaReserva from '../TarjetaReserva';
import AgendaReservas from '../AgendaReservas';
import useAgendaReservas from '../hooks/useAgendaReservas';
import ConfirmarReservaModal from '../modales/ConfirmarReservaModal';
import AmpliarReservaModal from '../modales/AmpliarReservaModal';
import CancelarReservaModal from '../modales/CancelarReservaModal';
import AltaCalendarioModal from '../modales/AltaCalendarioModal';
import RecogerReservaModal from '../modales/RecogerReservaModal';
import '../../../styles/AdminReservas.css';

// Pestaña "Reservas" (docs/reservas-diseno.md, 8.1 y 8.3; bloque R-d, commit 15): la lista por
// vistas y las acciones, lo mínimo para lanzar (los calendarios llegan después). Solo existe con el
// interruptor VITE_RESERVAS_ACTIVAS encendido: Admin.jsx no la pinta si está apagado.
// Las acciones van de una en una: mientras se guarda una, los botones están desactivados y un
// segundo envío (doble clic, Intro en un formulario) no sale. Si va bien, la reserva que devuelve
// el servidor sustituye a la de la lista (con su aviso, si lo trae, en la tarjeta); si no, su mensaje
// sale tal cual. Un 502 con el código 'reembolso_a_medias' es una acción hecha con el reembolso a
// medias (8.6; un 502 sin él, de la pasarela, es un error más, que pudo guardarse): su mensaje (con la
// reserva) se queda arriba hasta que se cierra, y se pasa a «Reembolsos a medias», donde está su
// botón «Reintentar». Un 409 o un 404 que no pide confirmar es una lista que ya no está al día: se
// recarga conservando el mensaje. Los que sí piden confirmar llevan un `codigo`: entregar antes de
// tiempo, y dar por reembolsado algo que Stripe no muestra (solo si se devolvió por otro medio).

const EXITO = {
  entregar: 'Reserva marcada como entregada',
  recoger: 'Reserva marcada como recogida',
  ampliar: 'Ocupación ampliada',
  cancelar: 'Reserva cancelada',
  'reintentar-reembolso': 'Reembolso registrado',
  'dar-por-reembolsado': 'Reembolso dado por hecho',
  'levantar-bloqueo': 'Bloqueo levantado'
};
// Un 409 con alguno de estos códigos no es una lista desfasada: pide confirmar y volver a mandar.
const CODIGOS_CON_CONFIRMACION = ['entrega_anticipada', 'reembolso_no_consta'];
// El código del 502 del servidor cuando la acción se hizo y el reembolso quedó a medias.
const CODIGO_A_MEDIAS = 'reembolso_a_medias';
const esReembolsoAMedias = ({ status, codigo }) => status === 502 && codigo === CODIGO_A_MEDIAS;
const EXITO_ALTA = { bloqueo: 'Fechas bloqueadas', alquiler: 'Alquiler registrado', venta: 'Venta registrada' };
// «Todas» muestra como mucho las 200 más recientes (MAX_TODAS del servidor).
const MAX_TODAS = 200;
// Lo que se añade a un error sin respuesta del servidor (red, un 504, un 500): la acción pudo hacerse.
const PUDO_GUARDARSE = ' Puede que sí se haya guardado: pulsa «Actualizar» y mira cómo ha quedado antes de repetirlo.';
const ALTAS = [
  ['bloqueo', 'Bloquear fechas'],
  ['alquiler', 'Registrar alquiler fuera de la web'],
  ['venta', 'Registrar venta fuera de la web']
];

const ReservasTab = ({ muebles, resumen = null, alCambiar }) => {
  const { showToast } = useContext(ToastContext);
  const [vista, setVista] = useState('proximas');
  // La vista de ahora mismo, para lo que responde el servidor después: una respuesta tardía no recarga
  // la vista que ya se dejó.
  const vistaRef = useRef(vista);
  vistaRef.current = vista;
  const [lista, setLista] = useState({ cargando: true, error: '', hoy: null, reservas: [] });
  // Error y aviso de la última acción de cada reserva (por id), debajo de su tarjeta.
  const [errores, setErrores] = useState({});
  const [avisos, setAvisos] = useState({});
  // El mensaje de un 502 (reembolso a medias), arriba de la lista hasta que se cierra.
  const [avisoGeneral, setAvisoGeneral] = useState('');
  // El error de un alta del calendario cuyo diálogo se cerró mientras se guardaba (no tiene tarjeta donde salir).
  const [avisoAlta, setAvisoAlta] = useState('');
  // El diálogo abierto: { tipo: 'confirmar' | 'recoger' | 'ampliar' | 'cancelar' | 'alta', ... }, y su error.
  const [dialogo, setDialogo] = useState(null);
  const [errorDialogo, setErrorDialogo] = useState('');
  // El diálogo abierto ahora mismo, para lo que responde el servidor después: si se cerró mientras
  // se guardaba (Escape, la "X"), su error no tiene dónde salir y va a un aviso.
  const dialogoAbierto = useRef(null);
  dialogoAbierto.current = dialogo;
  // Lo que se está guardando ('<id>:<acción>' o 'alta'): desactiva los botones. La ref es la guarda
  // del doble envío, que no espera a que se pinte el botón desactivado.
  const [enviando, setEnviando] = useState(null);
  const enviandoRef = useRef(false);
  // La reserva a la que llevar el foco cuando acabe una acción cuyo botón ya no está (si no, el foco
  // cae en el <body>).
  const [foco, setFoco] = useState(null);
  // Número de la última carga: si se cambia de vista antes de que llegue una respuesta, esa
  // respuesta ya no se pinta.
  const ultimaCarga = useRef(0);
  // true después de una acción: la tarjeta cambiada se queda en su sitio con su estado nuevo (si
  // desapareciera, no se vería el resultado), pero la lista ya puede no ser la de esta vista. Lo dice
  // un aviso con el botón «Actualizar» hasta la siguiente carga.
  const [listaMovida, setListaMovida] = useState(false);
  // La agenda de hoy y mañana, encima de las vistas. «Ver reserva» lleva a la tarjeta de su reserva: la
  // vista de destino se carga primero (`tarjetaPendiente`) y entonces se enfoca (`enfocar`).
  const { datos: datosAgenda, error: errorAgenda, recargar: recargarAgenda } = useAgendaReservas();
  const tarjetaPendiente = useRef(null);
  const [enfocar, setEnfocar] = useState(null);

  // `conservar`: la recarga de una lista que ya no estaba al día no borra el mensaje de la tarjeta.
  const cargar = useCallback(async (vistaPedida, conservar = false) => {
    const numero = ++ultimaCarga.current;
    setListaMovida(false);
    setLista((l) => ({ ...l, cargando: true, error: '' }));
    const { data, error } = await getReservasAdmin({ vista: vistaPedida });
    if (numero !== ultimaCarga.current) return;
    if (!conservar) {
      setErrores({});
      setAvisos({});
    }
    setLista({
      cargando: false,
      error: error ?? '',
      hoy: data?.hoy ?? null,
      reservas: Array.isArray(data?.reservas) ? data.reservas : []
    });
    if (tarjetaPendiente.current) {
      setEnfocar(tarjetaPendiente.current);
      tarjetaPendiente.current = null;
    }
  }, []);

  useEffect(() => {
    cargar(vista);
  }, [cargar, vista]);

  // `hoy` del diálogo: el de la lista o, si la pestaña lleva abierta desde ayer, el del reloj.
  const abrir = (nuevo) => {
    setErrorDialogo('');
    if (nuevo.tipo === 'alta') setAvisoAlta('');
    setDialogo({ ...nuevo, hoy: hoyMasReciente(lista.hoy) });
  };

  useEffect(() => {
    if (!foco || dialogo) return;
    if (!document.activeElement || document.activeElement === document.body) {
      document.getElementById(`reserva-tarjeta-${foco}`)?.focus();
    }
    setFoco(null);
  }, [foco, dialogo]);

  // Llevar el foco (y la vista) a una tarjeta que se pidió desde la agenda, cuando ya está pintada.
  useEffect(() => {
    if (!enfocar) return;
    const tarjeta = document.getElementById(`reserva-tarjeta-${enfocar}`);
    tarjeta?.focus();
    tarjeta?.scrollIntoView?.({ block: 'start' });
    setEnfocar(null);
  }, [enfocar]);

  // Algo cambió (una acción, un alta, «Actualizar»): lo que cuenta el contenedor y la agenda ya no es lo mismo.
  const avisarCambio = () => {
    alCambiar?.();
    recargarAgenda();
  };

  // Manda una petición si no hay otra en curso. Devuelve su resultado, o null si no se mandó.
  const enviar = async (clave, peticion) => {
    if (enviandoRef.current) return null;
    enviandoRef.current = true;
    setEnviando(clave);
    const resultado = await peticion();
    enviandoRef.current = false;
    setEnviando(null);
    return resultado;
  };

  const ejecutar = async (reserva, accion, datos = {}) => {
    let resultado = await enviar(`${reserva.id}:${accion}`, () => accionReservaAdmin(reserva.id, accion, datos));
    if (!resultado) return resultado;
    const aMedias = esReembolsoAMedias(resultado);
    if (resultado.error && !aMedias && (resultado.status === 0 || resultado.status >= 500)) {
      resultado = { ...resultado, error: `${resultado.error}${PUDO_GUARDARSE}` };
    }
    const { status, codigo } = resultado;
    if (aMedias) {
      setAvisoGeneral(
        `Reserva ${reserva.referencia} (${reserva.pieza.nombre}): ${resultado.error} Está en «Reembolsos a medias».`
      );
      showToast(resultado.error, 'error');
      avisarCambio();
      if (vistaRef.current === 'reembolsos') cargar('reembolsos');
      else setVista('reembolsos');
    } else if (!resultado.error) {
      const nueva = resultado.data?.reserva;
      if (nueva) {
        setLista((l) => ({ ...l, reservas: l.reservas.map((r) => (r.id === nueva.id ? nueva : r)) }));
        setListaMovida(true);
        setFoco(nueva.id);
      } else {
        cargar(vistaRef.current);
      }
      avisarCambio();
      if (resultado.data?.aviso) setAvisos((a) => ({ ...a, [reserva.id]: resultado.data.aviso }));
      // El aviso de arriba era de un reembolso a medias: ya está resuelto.
      if (accion === 'reintentar-reembolso' || accion === 'dar-por-reembolsado') setAvisoGeneral('');
      showToast(accion === 'cancelar' && reserva.tipo === 'venta' ? 'Venta cancelada' : EXITO[accion], 'success');
    } else if ((status === 409 && !CODIGOS_CON_CONFIRMACION.includes(codigo)) || status === 404) {
      // Otra pestaña (u otra persona) cambió la reserva: se recarga, y el mensaje se queda.
      // La recarga desmonta las tarjetas, y con ellas el botón que se pulsó: al volver, el foco va a la tarjeta.
      cargar(vistaRef.current, true).then(() => setFoco(reserva.id));
      resultado = { ...resultado, obsoleta: true };
    }
    return resultado;
  };

  const pulsarAccion = async (reserva, accion) => {
    setErrores((e) => ({ ...e, [reserva.id]: '' }));
    setAvisos((a) => ({ ...a, [reserva.id]: '' }));
    if (['ampliar', 'cancelar', 'recoger'].includes(accion)) {
      abrir({ tipo: accion, reserva, accion });
      return;
    }
    // Mueve dinero (aunque antes se comprueba en Stripe si ya se hizo): se dice cuánto.
    if (accion === 'reintentar-reembolso') {
      const cuanto = reserva.reembolso ? `${eurosDeCentimos(centimosDeEuros(reserva.reembolso.importe))} ` : '';
      abrir({
        tipo: 'confirmar',
        reserva,
        accion,
        datos: {},
        titulo: 'Reintentar el reembolso',
        mensaje:
          `Se devolverán ${cuanto}al cliente en Stripe por la reserva ${reserva.referencia} (${reserva.pieza.nombre}). ` +
          'Antes se comprueba en Stripe si ya se devolvió, para no devolverlo dos veces.',
        textoConfirmar: 'Reintentar reembolso'
      });
      return;
    }
    // No mueve dinero: cierra un reembolso a medias que ya se hizo desde el Dashboard de Stripe.
    if (accion === 'dar-por-reembolsado') {
      abrir({
        tipo: 'confirmar',
        reserva,
        accion,
        datos: {},
        titulo: 'Dar por reembolsado',
        mensaje:
          `Esto no mueve dinero: solo da por cerrado el reembolso a medias de la reserva ${reserva.referencia} ` +
          `(${reserva.pieza.nombre}). Úsalo solo si ya has devuelto el dinero desde el Dashboard de Stripe: ` +
          'antes se comprueba allí que conste.',
        textoConfirmar: 'Dar por reembolsado'
      });
      return;
    }
    const resultado = await ejecutar(reserva, accion);
    // Un reembolso a medias ya sale arriba (y la recarga puede haber llegado antes): no se repite en la tarjeta.
    if (!resultado?.error || esReembolsoAMedias(resultado)) return;
    // Entregar antes de la fecha prevista: el servidor responde 409 con el código 'entrega_anticipada'.
    // Se pide confirmación y se vuelve a mandar con antes_de_tiempo.
    if (accion === 'entregar' && resultado.codigo === 'entrega_anticipada') {
      abrir({
        tipo: 'confirmar',
        reserva,
        accion,
        datos: { antes_de_tiempo: true },
        titulo: 'Entregar antes de la fecha',
        mensaje:
          `La entrega está prevista para el ${fechaCorta(reserva.fecha_inicio)}. ` +
          `¿Marcas la reserva ${reserva.referencia} (${reserva.pieza.nombre}) como entregada antes de tiempo? ` +
          'El alquiler pasará a empezar hoy.',
        textoConfirmar: 'Marcar entregada'
      });
      return;
    }
    setErrores((e) => ({ ...e, [reserva.id]: resultado.error }));
    // Si la reserva ya no está en esta vista, su tarjeta (y el mensaje) desaparece con la recarga.
    if (resultado.obsoleta) showToast(resultado.error, 'error');
  };

  // El error de lo que se mandó desde un diálogo sale en él. Si ya se cerró (Escape, la "X"), sale en un
  // toast (se ve aunque se haya cambiado de vista o de pestaña) y además en un aviso que se queda y que el
  // lector de pantalla lee (el toast dura 3 s y no se anuncia): bajo la tarjeta de su reserva, o arriba, con
  // el nombre del alta, si es un alta del calendario (no tiene tarjeta).
  const errorDeDialogo = (error, reserva, nombreAlta) => {
    if (dialogoAbierto.current) {
      setErrorDialogo(error);
      return;
    }
    showToast(error, 'error');
    if (reserva) setErrores((e) => ({ ...e, [reserva.id]: error }));
    else setAvisoAlta(`${nombreAlta}: ${error}`);
  };

  // Lo que se manda desde un diálogo de acción: si falla, el error sale en el diálogo. Con un 502
  // la acción sí se ha hecho: el diálogo se cierra y el mensaje sale arriba.
  const enviarDialogo = async (datos) => {
    const resultado = await ejecutar(dialogo.reserva, dialogo.accion, datos);
    if (!resultado) return;
    // El reembolso no consta en Stripe: segundo paso, solo si se hizo por otro medio.
    if (resultado.codigo === 'reembolso_no_consta' && dialogoAbierto.current) {
      abrir({
        tipo: 'confirmar',
        reserva: dialogo.reserva,
        accion: dialogo.accion,
        datos: { aunque_no_conste: true },
        titulo: 'No consta en Stripe',
        mensaje:
          `${resultado.error} Si el dinero se devolvió por otro medio, por ejemplo con una transferencia, ` +
          'puedes darlo por reembolsado igualmente. Si solo devolviste una parte desde el Dashboard de Stripe, ' +
          'devuelve el resto allí y vuelve a pulsar «Dar por reembolsado». Si no has devuelto nada, ' +
          'vuelve y usa «Reintentar reembolso».',
        textoConfirmar: 'Dar por reembolsado igualmente'
      });
      return;
    }
    if (resultado.error && !esReembolsoAMedias(resultado)) {
      errorDeDialogo(resultado.error, dialogo.reserva);
    } else {
      setDialogo(null);
    }
  };

  const enviarAlta = async (datos) => {
    const tipo = dialogo.alta;
    const resultado = await enviar('alta', () => crearEnCalendarioAdmin(tipo, datos));
    if (!resultado) return;
    if (resultado.error) {
      const pudoGuardarse = resultado.status === 0 || resultado.status >= 500;
      const nombreAlta = ALTAS.find(([clave]) => clave === tipo)[1];
      errorDeDialogo(pudoGuardarse ? `${resultado.error}${PUDO_GUARDARSE}` : resultado.error, null, nombreAlta);
      return;
    }
    setDialogo(null);
    showToast(EXITO_ALTA[tipo], 'success');
    cargar(vistaRef.current);
    avisarCambio();
  };

  const actualizar = () => {
    cargar(vista);
    avisarCambio();
  };

  const elegirVista = (id) => {
    tarjetaPendiente.current = null;
    setVista(id);
  };

  // «Ver reserva» de la agenda: la vista donde está esa entrega o recogida, recargada, y el foco en su tarjeta.
  const verTrayecto = ({ tipo, reserva }) => {
    const destino = tipo === 'entrega' ? 'entregas' : 'recogidas';
    tarjetaPendiente.current = reserva.id;
    if (vistaRef.current === destino) cargar(destino);
    else setVista(destino);
  };

  const cerrarDialogo = () => setDialogo(null);
  const propsDialogo = { enviando: enviando !== null, error: errorDialogo, onCerrar: cerrarDialogo };
  const { cargando, error, hoy, reservas } = lista;

  let contenido;
  if (cargando) {
    contenido = <p className="admin-empty-note" role="status">Cargando reservas…</p>;
  } else if (error) {
    contenido = (
      <div className="mensajes-error" role="alert">
        <p>{error}</p>
        <button type="button" className="admin-btn-ghost" onClick={actualizar}>Reintentar</button>
      </div>
    );
  } else if (reservas.length === 0) {
    contenido = <p className="admin-empty-note">{VISTAS.find((v) => v.id === vista).vacia}</p>;
  } else {
    contenido = (
      <>
        <p className="admin-result-count">
          {reservas.length === 1 ? '1 reserva' : `${reservas.length} reservas`}
          {vista === 'todas' && reservas.length >= MAX_TODAS && ', las más recientes'}
        </p>
        {listaMovida && (
          <div className="reservas-lista-movida" role="status">
            <p>Has cambiado una reserva. Actualiza la lista para quitar de esta vista las que ya no encajan.</p>
            <button type="button" className="admin-btn-ghost" onClick={actualizar}>Actualizar la lista</button>
          </div>
        )}
        <ul className="reservas-lista">
          {reservas.map((r) => (
            <TarjetaReserva
              key={r.id}
              reserva={r}
              aviso={avisos[r.id]}
              error={errores[r.id]}
              enviando={enviando}
              onAccion={pulsarAccion}
            />
          ))}
        </ul>
      </>
    );
  }

  return (
    <div className="admin-view fade-in">
      <div className="admin-view-head">
        <h2>Reservas</h2>
        <p>{hoy ? `Hoy es ${fechaLarga(hoy)}` : 'Alquileres, bloqueos y ventas del calendario'}</p>
      </div>

      <AgendaReservas datos={datosAgenda} error={errorAgenda} onRecargar={recargarAgenda} onVer={verTrayecto} />

      <div className="reservas-vistas" role="group" aria-label="Qué reservas ver">
        {VISTAS.map((v) => (
          <button
            key={v.id}
            type="button"
            className="reservas-vista"
            aria-pressed={v.id === vista}
            onClick={() => elegirVista(v.id)}
          >
            {v.etiqueta}
            {v.aviso && resumen?.[v.aviso] > 0 && (
              <>
                {' '}
                <span className="reservas-vista-n">{resumen[v.aviso]}</span>
              </>
            )}
          </button>
        ))}
      </div>
      <p className="reservas-vista-ayuda">{VISTAS.find((v) => v.id === vista).descripcion}</p>

      <div className="admin-toolbar">
        <button type="button" className="admin-btn-ghost" onClick={actualizar}>Actualizar</button>
        <div className="admin-toolbar-acciones reservas-altas">
          {ALTAS.map(([tipo, texto]) => (
            <button
              key={tipo}
              type="button"
              className="admin-btn-ghost"
              disabled={enviando !== null}
              onClick={() => abrir({ tipo: 'alta', alta: tipo })}
            >
              {texto}
            </button>
          ))}
        </div>
      </div>

      {avisoGeneral && (
        <div className="reservas-aviso-general" role="alert">
          <p>{avisoGeneral}</p>
          <button type="button" className="admin-btn-ghost" onClick={() => setAvisoGeneral('')}>Entendido</button>
        </div>
      )}

      {avisoAlta && (
        <div className="reservas-aviso-general" role="alert">
          <p>{avisoAlta}</p>
          <button type="button" className="admin-btn-ghost" onClick={() => setAvisoAlta('')}>Entendido</button>
        </div>
      )}

      {contenido}

      {dialogo?.tipo === 'confirmar' && (
        <ConfirmarReservaModal
          key={dialogo.titulo}
          {...propsDialogo}
          titulo={dialogo.titulo}
          mensaje={dialogo.mensaje}
          textoConfirmar={dialogo.textoConfirmar}
          onConfirmar={() => enviarDialogo(dialogo.datos)}
        />
      )}
      {dialogo?.tipo === 'recoger' && (
        <RecogerReservaModal {...propsDialogo} reserva={dialogo.reserva} hoy={dialogo.hoy} onEnviar={enviarDialogo} />
      )}
      {dialogo?.tipo === 'ampliar' && (
        <AmpliarReservaModal {...propsDialogo} reserva={dialogo.reserva} hoy={dialogo.hoy} onEnviar={enviarDialogo} />
      )}
      {dialogo?.tipo === 'cancelar' && (
        <CancelarReservaModal
          {...propsDialogo}
          reserva={dialogo.reserva}
          onEnviar={enviarDialogo}
          onBorrarError={() => setErrorDialogo('')}
        />
      )}
      {dialogo?.tipo === 'alta' && (
        <AltaCalendarioModal {...propsDialogo} tipo={dialogo.alta} muebles={muebles} hoy={dialogo.hoy} onEnviar={enviarAlta} />
      )}
    </div>
  );
};

export default ReservasTab;
