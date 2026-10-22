// client/src/utils/useCatalogView.js
//
// Vista elegida en el catálogo ('grid-large' | 'grid-normal' | 'grid-compact' | 'table'),
// persistida en localStorage bajo 'kaveCatalogView'. Aislado en su propio hook para
// poder probarlo sin montar la página completa.
import { useState, useEffect } from 'react';

export const STORAGE_KEY = 'kaveCatalogView';
export const VISTAS_VALIDAS = ['grid-large', 'grid-normal', 'grid-compact', 'table'];
export const VISTA_POR_DEFECTO = 'grid-normal';

export const esVistaValida = (valor) => VISTAS_VALIDAS.includes(valor);

export const normalizarVista = (valor) => {
  // Compatibilidad hacia atrás: si existía 'grid' en localStorage, se mapea a 'grid-normal'
  if (valor === 'grid') return 'grid-normal';
  return esVistaValida(valor) ? valor : VISTA_POR_DEFECTO;
};

export const useCatalogView = () => {
  const [vista, setVista] = useState(() => {
    const guardada = localStorage.getItem(STORAGE_KEY);
    return normalizarVista(guardada);
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, vista);
  }, [vista]);

  return [vista, setVista];
};
