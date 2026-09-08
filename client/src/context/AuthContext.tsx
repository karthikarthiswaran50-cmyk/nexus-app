import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { User, UserSettings } from '../types';
import { signInWithGoogle, trackUserActivity } from '../config/firebase';

interface AuthContextType {
  user: User | null;
  settings: UserSettings | null;
  token: string | null;
  loading: boolean;
  login: (login: string, pass: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (data: { email: string; username: string; password: string; full_name: string; avatar_url?: string; bio?: string; country?: string }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  updateSettings: (data: Partial<UserSettings>) => Promise<void>;
  claimUsername: (username: string) => Promise<void>;
  loginDemoUser: (username: string) => Promise<void>;
}


const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('nexus_auth_token'));
  const [user, setUser] = useState<User | null>(() => {
    try {
      const cached = localStorage.getItem('nexus_cached_user');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [settings, setSettings] = useState<UserSettings | null>(() => {
    try {
      const cached = localStorage.getItem('nexus_cached_settings');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(() => {
    const hasToken = !!localStorage.getItem('nexus_auth_token');
    const hasCachedUser = !!localStorage.getItem('nexus_cached_user');
    // If token and cached user exist, render immediately without blocking spinner
    return hasToken && !hasCachedUser;
  });

  const persistUser = (newUser: User | null) => {
    setUser(newUser);
    if (newUser) {
      localStorage.setItem('nexus_cached_user', JSON.stringify(newUser));
    } else {
      localStorage.removeItem('nexus_cached_user');
    }
  };

  const persistSettings = (newSettings: UserSettings | null) => {
    setSettings(newSettings);
    if (newSettings) {
      localStorage.setItem('nexus_cached_settings', JSON.stringify(newSettings));
    } else {
      localStorage.removeItem('nexus_cached_settings');
    }
  };

  // Set default axios header
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common['Authorization'];
  }

  const fetchSession = async (currentToken: string) => {
    try {
      axios.defaults.headers.common['Authorization'] = `Bearer ${currentToken}`;
      // Allow up to 30 seconds for Render server to wake up from sleep
      const res = await axios.get('/api/auth/me', { timeout: 30000 });
      if (res.data?.user) {
        persistUser(res.data.user);
        persistSettings(res.data.settings);
      } else {
        logout();
      }
    } catch (err: any) {
      // ONLY log out if the server explicitly rejected the token (401 / 403)
      // Never log out on network disconnects, timeouts, or temporary 502/503/504 server sleep errors!
      if (err.response?.status === 401 || err.response?.status === 403) {
        logout();
      } else {
        console.warn('Backend server cold-starting or offline; preserving active user session.');
      }
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
    persistUser(res.data.user);
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    
    // Log user activity to Firebase
    trackUserActivity({
      userId: res.data.user?.id,
      username: res.data.user?.username,
      action: 'login',
      details: { method: 'credentials', role: res.data.user?.plan_id || 'free' },
    });

    // Fetch settings
    try {
      const setRes = await axios.get('/api/users/settings');
      persistSettings(setRes.data.settings);
    } catch (e) {}
  };

  const loginDemoUser = async (username: string) => {
    await login(username, 'password123');
  };

  const loginWithGoogle = async () => {
    const { idToken } = await signInWithGoogle();
    const res = await axios.post('/api/auth/firebase-login', { idToken });
    const newToken = res.data.token;
    localStorage.setItem('nexus_auth_token', newToken);
    setToken(newToken);
    persistUser(res.data.user);
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;

    if (res.data.user?.username) {
      localStorage.setItem('nexus_saved_username', res.data.user.username);
    }

    // Log Google sign-in activity to Firebase
    trackUserActivity({
      userId: res.data.user?.id,
      username: res.data.user?.username,
      action: 'login',
      details: { method: 'google', email: res.data.user?.email },
    });

    try {
      const setRes = await axios.get('/api/users/settings');
      persistSettings(setRes.data.settings);
    } catch (e) {}
  };

  const claimUsername = async (newUsername: string) => {
    const res = await axios.post('/api/auth/set-username', { username: newUsername });
    if (res.data?.token) {
      localStorage.setItem('nexus_auth_token', res.data.token);
      setToken(res.data.token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
    }
    if (res.data?.user) {
      persistUser(res.data.user);
      localStorage.setItem('nexus_saved_username', res.data.user.username);
    }
  };

  const register = async (data: { email: string; username: string; password: string; full_name: string; avatar_url?: string; bio?: string; country?: string }) => {

    const res = await axios.post('/api/auth/register', data);
    const newToken = res.data.token;
    localStorage.setItem('nexus_auth_token', newToken);
    setToken(newToken);
    persistUser(res.data.user);
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;

    // Log registration activity to Firebase
    trackUserActivity({
      userId: res.data.user?.id,
      username: res.data.user?.username,
      action: 'login',
      details: { method: 'new_registration', email: data.email },
    });

    try {
      const setRes = await axios.get('/api/users/settings');
      persistSettings(setRes.data.settings);
    } catch (e) {}
  };

  const logout = () => {
    if (user) {
      trackUserActivity({
        userId: user.id,
        username: user.username,
        action: 'logout',
      });
    }
    localStorage.removeItem('nexus_auth_token');
    localStorage.removeItem('nexus_cached_user');
    localStorage.removeItem('nexus_cached_settings');
    setToken(null);
    setUser(null);
    setSettings(null);
    delete axios.defaults.headers.common['Authorization'];
  };

  const refreshUser = async () => {
    if (!token) return;
    try {
      const res = await axios.get('/api/auth/me');
      persistUser(res.data.user);
      persistSettings(res.data.settings);
    } catch (err) {
      console.error('Failed to refresh user:', err);
    }
  };

  const updateProfile = async (data: Partial<User>) => {
    const res = await axios.put('/api/users/profile', data);
    persistUser(res.data.user);
  };

  const updateSettings = async (data: Partial<UserSettings>) => {
    const res = await axios.put('/api/users/settings', data);
    persistSettings(res.data.settings);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        settings,
        token,
        loading,
        login,
        loginWithGoogle,
        register,
        logout,
        refreshUser,
        updateProfile,
        updateSettings,
        claimUsername,
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
