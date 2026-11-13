import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<User | null>;
  logout: () => Promise<void>;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  // Keep ID token strictly in memory (never in localStorage)
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        try {
          tokenRef.current = await nextUser.getIdToken();
        } catch {
          tokenRef.current = null;
        }
      } else {
        tokenRef.current = null;
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const result = await signInWithPopup(auth, googleAuthProvider);
    tokenRef.current = await result.user.getIdToken();
    setUser(result.user);
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    tokenRef.current = null;
    setUser(null);
  }, []);

  const getIdToken = useCallback(
    async (forceRefresh = false) => {
      const current = auth.currentUser || user;
      if (!current) return null;
      const token = await current.getIdToken(forceRefresh);
      tokenRef.current = token;
      return token;
    },
    [user]
  );

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, logout, getIdToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
