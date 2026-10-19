// Sin el email confirmado no se puede reservar (T8 de docs/reservas-diseno.md). Como el aviso de Mi
// cuenta (Profile.jsx), se ofrece otro correo con el enlace: "Enviar enlace" lo pide al servidor y
// aquí mismo se dice si se ha enviado o por qué no. Lo usan la ficha y el paso de confirmación.
import { useState } from 'react';
import { reenviarVerificacion } from '../../services/api';

const PedirEnlaceVerificacion = () => {
  const [correo, setCorreo] = useState({ enviando: false, mensaje: '' });

  const pedir = async () => {
    // aria-disabled y no disabled: el botón no pierde el foco (y con él, el diálogo en el que está).
    if (correo.enviando) return;
    setCorreo({ enviando: true, mensaje: '' });
    const res = await reenviarVerificacion();
    setCorreo({ enviando: false, mensaje: res.error || 'Te hemos enviado el correo.' });
  };

  return (
    <div className="reserva-verificar">
      <p>Si no tienes el correo con el enlace, te mandamos uno nuevo.</p>
      <button type="button" className="reserva-enlace" onClick={pedir} aria-disabled={correo.enviando || undefined}>
        {correo.enviando ? 'Enviando...' : 'Enviar enlace'}
      </button>
      {/* Siempre en la página, vacía al principio: una región viva que nace con el texto no se anuncia. */}
      <p role="status">{correo.mensaje}</p>
    </div>
  );
};

export default PedirEnlaceVerificacion;
