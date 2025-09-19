import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, logAction } from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      // Prefer LocalStorage first to avoid flicker/empty state on refresh
      try {
        const raw = localStorage.getItem('sb-tgrmxlbnutxpewfmofdx-auth-token');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.access_token && parsed?.user) {
            setSession(parsed as any);
            setUser(parsed.user as User);
          }
        }
      } catch {}

      // Then reconcile with Supabase to ensure validity
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        try {
          if (event === 'SIGNED_IN') {
            await logAction({ action: 'auth.login', resource: 'auth', userId: session?.user?.id || null, context: {} });
            // Persist last login payload for immediate reuse on next refresh
            try { localStorage.setItem('app.lastAuthEvent', JSON.stringify({ event, at: Date.now(), user: session?.user })); } catch {}
          } else if (event === 'SIGNED_OUT') {
            await logAction({ action: 'auth.logout', resource: 'auth', userId: user?.id || null, context: {} });
            try { localStorage.removeItem('app.lastAuthEvent'); } catch {}
          }
        } catch {}
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const refreshUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  };

  const value = {
    user,
    session,
    loading,
    signOut,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
