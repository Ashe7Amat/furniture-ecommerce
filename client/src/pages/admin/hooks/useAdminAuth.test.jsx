import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAdminAuth } from './useAdminAuth';
import { AuthContext } from '../../../context/AuthContext';

describe('useAdminAuth hook', () => {
  it('identifica correctamente a un usuario administrador', () => {
    const adminUser = { id: 'admin-1', email: 'admin@test.com', rol: 'admin' };
    const wrapper = ({ children }) => (
      <AuthContext.Provider value={{ user: adminUser, loading: false }}>
        {children}
      </AuthContext.Provider>
    );

    const { result } = renderHook(() => useAdminAuth(), { wrapper });
    expect(result.current.autorizado).toBe(true);
    expect(result.current.esAdmin).toBe(true);
    expect(result.current.user).toBe(adminUser);
  });

  it('detecta usuario no autorizado cuando el rol no es admin', () => {
    const clientUser = { id: 'client-1', email: 'user@test.com', rol: 'cliente' };
    const wrapper = ({ children }) => (
      <AuthContext.Provider value={{ user: clientUser, loading: false }}>
        {children}
      </AuthContext.Provider>
    );

    const { result } = renderHook(() => useAdminAuth(), { wrapper });
    expect(result.current.autorizado).toBe(false);
    expect(result.current.esAdmin).toBe(false);
  });

  it('gestiona usuario nulo correctamente', () => {
    const wrapper = ({ children }) => (
      <AuthContext.Provider value={{ user: null, loading: false }}>
        {children}
      </AuthContext.Provider>
    );

    const { result } = renderHook(() => useAdminAuth(), { wrapper });
    expect(result.current.autorizado).toBe(false);
    expect(result.current.user).toBeNull();
  });
});
