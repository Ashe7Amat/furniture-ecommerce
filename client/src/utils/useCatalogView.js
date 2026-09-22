// client/src/utils/useCatalogView.js
//
// Vista elegida en el catálogo ('grid' | 'table'), persistida en localStorage bajo
// 'kaveCatalogView'. Aislado en su propio hook (en vez de vivir dentro de Catalog.jsx)
// para poder probarlo sin montar la página completa (que depende de getMuebles/
// getCategorias/FavoritesContext).
import { useState, useEffect } from 'react';

const STORAGE_KEY = 'kaveCatalogView';
const VISTA_POR_DEFECTO = 'grid';

const esVistaValida = (valor) => valor === 'grid' || valor === 'table';

export const useCatalogView = () => {
  const [vista, setVista] = useState(() => {
    const guardada = localStorage.getItem(STORAGE_KEY);
    return esVistaValida(guardada) ? guardada : VISTA_POR_DEFECTO;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, vista);
  }, [vista]);

  return [vista, setVista];
};
