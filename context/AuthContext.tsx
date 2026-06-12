import React, { createContext, useContext, useState } from 'react';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'viewer';
  company: string;
  orgId?: string;
  initials: string;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const DEMO_ACCOUNTS: (AuthUser & { password: string })[] = [
  {
    id: 'u1',
    name: 'Chanda Mwape',
    email: 'admin@obt.zm',
    password: 'obt2026',
    role: 'admin',
    company: 'OBT Fleet Systems',
    initials: 'CM',
  },
  {
    id: 'u2',
    name: 'Mutale Phiri',
    email: 'manager@obt.zm',
    password: 'obt2026',
    role: 'manager',
    company: 'Zambia Courier Services Ltd',
    orgId: 'org1',
    initials: 'MP',
  },
  {
    id: 'u3',
    name: 'Kapambwe Banda',
    email: 'viewer@obt.zm',
    password: 'obt2026',
    role: 'viewer',
    company: 'Zambia Courier Services Ltd',
    orgId: 'org1',
    initials: 'KB',
  },
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  const login = async (
    email: string,
    password: string,
  ): Promise<{ success: boolean; error?: string }> => {
    await new Promise((r) => setTimeout(r, 800));
    const found = DEMO_ACCOUNTS.find(
      (a) => a.email.toLowerCase() === email.trim().toLowerCase() && a.password === password,
    );
    if (found) {
      const { password: _pw, ...userData } = found;
      setUser(userData);
      return { success: true };
    }
    return { success: false, error: 'Invalid email or password. Please try again.' };
  };

  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
