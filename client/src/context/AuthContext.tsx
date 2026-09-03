import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { User, UserSettings } from '../types';

interface AuthContextType {
  user: User | null;
  settings: UserSettings | null;
  token: string | null;
  loading: boolean;
  login: (login: string, pass: string) => Promise<void>;
  register: (data: { email: string; username: string; password: string; full_name: string; avatar_url?: string; bio?: string; country?: string }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  updateSettings: (data: Partial<UserSettings>) => Promise<void>;
  loginDemoUser: (username: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('nexus_auth_token'));
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Set default axios header
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common['Authorization'];
  }

  const fetchSession = async (currentToken: string) => {
    try {
      axios.defaults.headers.common['Authorization'] = `Bearer ${currentToken}`;
      const res = await axios.get('/api/auth/me', { timeout: 5000 });
      if (res.data?.user) {
        setUser(res.data.user);
        setSettings(res.data.settings);
      } else {
        logout();
      }
    } catch (err) {
      console.error('Session restore failed:', err);
      logout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchSession(token);
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (loginStr: string, passwordStr: string) => {
    const res = await axios.post('/api/auth/login', { login: loginStr, password: passwordStr });
    const newToken = res.data.token;
    localStorage.setItem('nexus_auth_token', newToken);
    setToken(newToken);
    setUser(res.data.user);
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    
    // Fetch settings
    try {
      const setRes = await axios.get('/api/users/settings');
      setSettings(setRes.data.settings);
    } catch (e) {}
  };

  const loginDemoUser = async (username: string) => {
    await login(username, 'password123');
  };

  const register = async (data: { email: string; username: string; password: string; full_name: string; avatar_url?: string; bio?: string; country?: string }) => {
    const res = await axios.post('/api/auth/register', data);
    const newToken = res.data.token;
    localStorage.setItem('nexus_auth_token', newToken);
    setToken(newToken);
    setUser(res.data.user);
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;

    try {
      const setRes = await axios.get('/api/users/settings');
      setSettings(setRes.data.settings);
    } catch (e) {}
  };

  const logout = () => {
    localStorage.removeItem('nexus_auth_token');
    setToken(null);
    setUser(null);
    setSettings(null);
    delete axios.defaults.headers.common['Authorization'];
  };

  const refreshUser = async () => {
    if (!token) return;
    try {
      const res = await axios.get('/api/auth/me');
      setUser(res.data.user);
      setSettings(res.data.settings);
    } catch (err) {
      console.error('Failed to refresh user:', err);
    }
  };

  const updateProfile = async (data: Partial<User>) => {
    const res = await axios.put('/api/users/profile', data);
    setUser(res.data.user);
  };

  const updateSettings = async (data: Partial<UserSettings>) => {
    const res = await axios.put('/api/users/settings', data);
    setSettings(res.data.settings);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        settings,
        token,
        loading,
        login,
        register,
        logout,
        refreshUser,
        updateProfile,
        updateSettings,
        loginDemoUser,
      }}
    >
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
