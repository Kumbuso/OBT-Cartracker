import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiLogin, apiLogout, setAuthToken } from '../lib/api';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'viewer';
  company: string;
  orgId: string;
  initials: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);
const USER_KEY = 'obt_user';

function toInitials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore persisted user on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(USER_KEY);
        if (stored) setUser(JSON.parse(stored));
      } catch {}
      setLoading(false);
    })();
  }, []);

  const login = async (
    email: string,
    password: string,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const data = await apiLogin(email, password);
      const authUser: AuthUser = {
        id:       data.user.id,
        name:     data.user.name,
        email:    data.user.email,
        role:     data.user.role as AuthUser['role'],
        company:  'OBT Logistics Zambia',
        orgId:    data.user.orgId,
        initials: toInitials(data.user.name),
      };
      setUser(authUser);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(authUser));
      return { success: true };
    } catch (err: any) {
      const msg = err?.message ?? 'Login failed. Please try again.';
      if (msg.toLowerCase().includes('invalid') || msg.includes('401')) {
        return { success: false, error: 'Invalid email or password. Please try again.' };
      }
      return { success: false, error: msg };
    }
  };

  const logout = async () => {
    await apiLogout();
    setAuthToken(null);
    setUser(null);
    try { await AsyncStorage.removeItem(USER_KEY); } catch {}
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
