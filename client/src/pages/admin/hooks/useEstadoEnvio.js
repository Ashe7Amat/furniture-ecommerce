import { useState } from 'react';

// Estado de envío de UN formulario del panel (arreglo de H14). Antes había un solo `status` para
// los cuatro formularios, y eso traía tres efectos: el error de un formulario salía debajo de otro,
// "Crear Categoría" no se desactivaba nunca (un doble clic creaba dos) y quedaba una condición muerta
// ("Subiendo", que no se escribía en ningún sitio). Ahora cada formulario tiene el suyo: el botón se
// desactiva mientras ESE envío está en curso, y el mensaje (progreso o error) sale junto a él.
const useEstadoEnvio = () => {
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  const empezar = (texto = '') => {
    setEnviando(true);
    setMensaje(texto);
  };
  const acabarBien = () => {
    setEnviando(false);
    setMensaje('');
  };
  const acabarMal = (texto = '') => {
    setEnviando(false);
    setMensaje(texto);
  };

  return { enviando, mensaje, empezar, acabarBien, acabarMal };
};

export default useEstadoEnvio;
