// Ayudantes comunes de los tests de caracterización del panel (Admin.*.test.jsx, tarea 4).
// No es un archivo de test: no lo recoge Vitest, y la aplicación no lo importa.
//
// Cada archivo de test tiene que declarar su propio vi.mock('../services/api') (vi.mock solo se
// eleva dentro del archivo donde se escribe). Este módulo importa esas mismas funciones ya
// simuladas para darles los datos de partida.
import { vi } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import Admin from './Admin';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import * as api from '../services/api';

export const ADMIN = { id: 'u-admin', email: 'admin@nave5.test', nombre: 'Admin', rol: 'admin' };

// valorTotalVenta llega ya formateado como texto: el servidor lo calcula así mismo
// (categoriasController.js), con un espacio duro (U+00A0) entre la cifra y el €.
const statsVacias = {
  totalProductos: 0,
  disponibles: 0,
  vendidos: 0,
  alquilados: 0,
  valorTotalVenta: (0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
};

// Categorías como las devuelve getCategorias(): ordenadas por nombre (el servidor pide
// .order('nombre', { ascending: true })), con sus estadísticas, las generales sin
// categoria_padre_id y las específicas colgando de ellas. Por el orden alfabético, la primera
// específica es "Lámparas" (de "Decoración y hogar").
export const CATEGORIAS = [
  { id: 2, nombre: 'Decoración y hogar', categoria_padre_id: null, imagen_url: null, stats: statsVacias },
  { id: 21, nombre: 'Lámparas', categoria_padre_id: 2, imagen_url: null, stats: statsVacias },
  { id: 12, nombre: 'Mesas', categoria_padre_id: 1, imagen_url: null, stats: statsVacias },
  { id: 1, nombre: 'Mobiliario', categoria_padre_id: null, imagen_url: null, stats: statsVacias },
  { id: 11, nombre: 'Sillas', categoria_padre_id: 1, imagen_url: null, stats: statsVacias }
];

// Monta <Admin /> con sus dos contextos y con las tres cargas iniciales (getMuebles,
// getCategorias, getPedidos) devolviendo los datos que se pasen. Las cargas son promesas ya
// resueltas: el act async deja que se asienten antes de comprobar nada.
export const renderAdmin = async ({
  user = ADMIN,
  muebles = [],
  categorias = [],
  pedidos = [],
  showToast = vi.fn()
} = {}) => {
  if (!vi.isMockFunction(api.getMuebles)) {
    throw new Error("Falta vi.mock('../services/api') en el archivo de test: sin él, el panel llamaría a la API real.");
  }
  api.getMuebles.mockResolvedValue(muebles);
  api.getCategorias.mockResolvedValue(categorias);
  api.getPedidos.mockResolvedValue(pedidos);

  let utils;
  await act(async () => {
    utils = render(
      <AuthContext.Provider value={{ user }}>
        <ToastContext.Provider value={{ showToast }}>
          <Admin />
        </ToastContext.Provider>
      </AuthContext.Provider>
    );
  });
  return { ...utils, showToast };
};

// La barra lateral es el <nav> del panel; sus botones se llaman como su texto ("Resumen",
// "Añadir Mueble", "Gestionar Inventario", "Pedidos", "Gestionar Categorías"). El de pedidos
// añade la insignia de pendientes a su nombre ("Pedidos 2"), de ahí que se busque con /^Pedidos/.
export const barraLateral = () => within(screen.getByRole('navigation'));

export const irAPestana = (user, nombre) => user.click(barraLateral().getByRole('button', { name: nombre }));
