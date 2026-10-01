import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useContext } from 'react';
import { FavoritesProvider, FavoritesContext } from './FavoritesContext';
import { AuthContext } from './AuthContext';

const montar = ({ user = null } = {}) => {
  let sesion = { user };
  const wrapper = ({ children }) => (
    <AuthContext.Provider value={sesion}>
      <FavoritesProvider>{children}</FavoritesProvider>
    </AuthContext.Provider>
  );
  const utils = renderHook(() => useContext(FavoritesContext), { wrapper });
  const cambiarUsuario = (nuevo) => {
    sesion = { user: nuevo };
    utils.rerender();
  };
  return { ...utils, cambiarUsuario };
};

beforeEach(() => {
  localStorage.clear();
});

describe('FavoritesContext', () => {
  it('marcar y desmarcar un favorito', () => {
    const { result } = montar();

    act(() => result.current.toggleFavorite('m1'));
    act(() => result.current.toggleFavorite('m2'));
    expect(result.current.favorites).toEqual(['m1', 'm2']);
    expect(result.current.isFavorite('m1')).toBe(true);

    act(() => result.current.toggleFavorite('m1'));
    expect(result.current.favorites).toEqual(['m2']);
    expect(result.current.isFavorite('m1')).toBe(false);
  });

  it('sin sesión se guardan como los del invitado y se recuperan al volver', () => {
    const { result, unmount } = montar();
    act(() => result.current.toggleFavorite('m1'));
    unmount();

    expect(JSON.parse(localStorage.getItem('kaveFavorites_guest'))).toEqual(['m1']);
    expect(montar().result.current.favorites).toEqual(['m1']);
  });

  it('cada usuario tiene los suyos; al cambiar de usuario se cargan los de él', () => {
    localStorage.setItem('kaveFavorites_ana@nave5.test', JSON.stringify(['m9']));
    const { result, cambiarUsuario } = montar({ user: { email: 'luis@nave5.test' } });
    act(() => result.current.toggleFavorite('m1'));

    cambiarUsuario({ email: 'ana@nave5.test' });

    expect(result.current.favorites).toEqual(['m9']);
    expect(JSON.parse(localStorage.getItem('kaveFavorites_luis@nave5.test'))).toEqual(['m1']);
  });
});
