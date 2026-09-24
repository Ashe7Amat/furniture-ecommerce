import { useState } from 'react';

// Estado del único ConfirmModal del panel. confirmarBorrado(título, mensaje, acción) lo abre; al
// confirmar se ejecuta la acción y, cuando termina, se cierra.
const useConfirmacion = () => {
  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null
  });

  const confirmarBorrado = (title, message, action) => {
    setConfirmConfig({
      isOpen: true,
      title,
      message,
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
