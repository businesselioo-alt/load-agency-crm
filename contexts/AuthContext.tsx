'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  CRMUser,
  loadUsers,
  saveUser,
  deleteUserById,
  authenticateWithSupabase,
  migrateLocalStorageToSupabase,
  SESSION_LS_KEY,
} from '@/lib/users';

interface AuthContextType {
  user: CRMUser | null;
  users: CRMUser[];
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  addUser: (user: CRMUser) => Promise<void>;
  updateUser: (user: CRMUser) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  refreshUsers: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  users: [],
  login: async () => false,
  logout: () => {},
  addUser: async () => {},
  updateUser: async () => {},
  deleteUser: async () => {},
  refreshUsers: async () => {},
  isLoading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]           = useState<CRMUser | null>(null);
  const [users, setUsers]         = useState<CRMUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUsers = useCallback(async () => {
    const all = await loadUsers();
    setUsers(all);
    const sessionId = typeof window !== 'undefined' ? localStorage.getItem(SESSION_LS_KEY) : null;
    if (sessionId) {
      const fresh = all.find((u) => u.id === sessionId);
      if (fresh && fresh.status === 'active') {
        setUser(fresh);
      } else {
        setUser(null);
        localStorage.removeItem(SESSION_LS_KEY);
      }
    }
  }, []);

  useEffect(() => {
    (async () => {
      // Migrate any localStorage users to Supabase first
      await migrateLocalStorageToSupabase();
      const all = await loadUsers();
      setUsers(all);
      const sessionId = typeof window !== 'undefined' ? localStorage.getItem(SESSION_LS_KEY) : null;
      if (sessionId) {
        const found = all.find((u) => u.id === sessionId && u.status === 'active');
        if (found) setUser(found);
        else localStorage.removeItem(SESSION_LS_KEY);
      }
      setIsLoading(false);
    })();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    const found = await authenticateWithSupabase(email, password);
    if (found) {
      setUser(found);
      setUsers((prev) =>
        prev.some((u) => u.id === found.id)
          ? prev.map((u) => (u.id === found.id ? found : u))
          : [...prev, found]
      );
      localStorage.setItem(SESSION_LS_KEY, found.id);
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(SESSION_LS_KEY);
  };

  const addUser = async (newUser: CRMUser) => {
    await saveUser(newUser);
    setUsers((prev) => [...prev, newUser]);
  };

  const updateUser = async (updatedUser: CRMUser) => {
    await saveUser(updatedUser);
    setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
    if (user?.id === updatedUser.id) setUser(updatedUser);
  };

  const deleteUser = async (id: string) => {
    await deleteUserById(id);
    setUsers((prev) => prev.filter((u) => u.id !== id));
  };

  return (
    <AuthContext.Provider
      value={{ user, users, login, logout, addUser, updateUser, deleteUser, refreshUsers, isLoading }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
