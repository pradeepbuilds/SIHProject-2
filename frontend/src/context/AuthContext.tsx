import React, { createContext, useContext, useState, useEffect } from 'react';
import type { AuthUser, UserRole } from '../types/api';

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  loginAsDemo: (role: UserRole, regionId?: string) => void;
  login: (user: AuthUser) => void;
  signup: (user: Omit<AuthUser, 'id'>) => void;
  logout: () => void;
  updateUserContext: (updates: Partial<AuthUser>) => void;
}

const AUTH_STORAGE_KEY = 'krishimitra_auth_session';

const DEMO_ACCOUNTS: Record<UserRole, (regionId: string) => AuthUser> = {
  farmer: (regionId: string) => ({
    id: 'demo-farmer-01',
    name: 'Ramesh Gowda',
    role: 'farmer',
    phone: '+91 98765 43210',
    regionId: regionId || 'ka-tumakuru',
    panchayatId: 'PNC-KA-0001',
    selectedCrop: 'ragi',
    selectedStage: 'vegetative',
    isDemo: true
  }),
  officer: (regionId: string) => ({
    id: 'demo-officer-01',
    name: 'Dr. Ananya Sharma',
    role: 'officer',
    email: 'ananya.sharma@imd.gov.in',
    regionId: regionId || 'ka-tumakuru',
    designation: 'Senior Agromet Intelligence Officer',
    department: 'Ministry of Earth Sciences (MoES / IMD)',
    isDemo: true
  })
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore
    }
    // Default initial demo session as Farmer for immediate demo usability
    return DEMO_ACCOUNTS.farmer('ka-tumakuru');
  });

  useEffect(() => {
    try {
      if (user) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    } catch (e) {
      console.error('Failed to save auth state:', e);
    }
  }, [user]);

  const loginAsDemo = (role: UserRole, regionId: string = 'ka-tumakuru') => {
    const demoUser = DEMO_ACCOUNTS[role](regionId);
    setUser(demoUser);
  };

  const login = (newUser: AuthUser) => {
    setUser(newUser);
  };

  const signup = (newUser: Omit<AuthUser, 'id'>) => {
    const userWithId: AuthUser = {
      ...newUser,
      id: `user-${Date.now()}`
    };
    setUser(userWithId);
  };

  const logout = () => {
    setUser(null);
  };

  const updateUserContext = (updates: Partial<AuthUser>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : null));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loginAsDemo,
        login,
        signup,
        logout,
        updateUserContext
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
