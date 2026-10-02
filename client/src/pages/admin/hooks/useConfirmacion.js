import { useState } from 'react';

// Estado del único ConfirmModal del panel. confirmarBorrado(título, mensaje, acción) lo abre; al
// confirmar se ejecuta la acción y, cuando termina, se cierra. El cuarto argumento, opcional, es el
// texto del botón de aceptar (por defecto, el de ConfirmModal: "Eliminar").
const useConfirmacion = () => {
  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    textoConfirmar: undefined
  });

  const confirmarBorrado = (title, message, action, textoConfirmar) => {
    setConfirmConfig({
      isOpen: true,
      title,
      message,
      textoConfirmar,
      onConfirm: async () => {
        await action();
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const cerrarConfirmacion = () => setConfirmConfig(prev => ({ ...prev, isOpen: false }));

  return { confirmConfig, confirmarBorrado, cerrarConfirmacion };
};

export default useConfirmacion;
