import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, EmployeeWithLeads } from '../types';
import { authApi } from '../services/api';

interface AuthContextType {
  user: EmployeeWithLeads | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<EmployeeWithLeads | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState<boolean>(true);

  const fetchProfile = async () => {
    try {
      const profile = await authApi.me();
      setUser(profile);
      localStorage.setItem('user', JSON.stringify(profile));
    } catch (err) {
      console.error('Failed to fetch profile', err);
      logout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    localStorage.setItem('token', res.access_token);
    setToken(res.access_token);
    await fetchProfile();
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    await fetchProfile();
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
