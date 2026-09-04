import React, { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('kaveUser');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  // token es opcional: el login "Google" de demo no genera uno real
  const login = (userData, token) => {
    setUser(userData);
    localStorage.setItem('kaveUser', JSON.stringify(userData));
    if (token) {
      localStorage.setItem('kaveToken', token);
    } else {
      localStorage.removeItem('kaveToken');
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('kaveUser');
    localStorage.removeItem('kaveToken');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
