import { createContext, useContext, useEffect, useRef, useState, ReactNode, useMemo, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, logAction } from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  otpRequired: boolean;
  otpVerified: boolean;
  setOtpVerified: (value: boolean) => void;
  otpEvaluated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const sent2faForUserIdRef = useRef<string | null>(null);
  const [otpRequired, setOtpRequired] = useState<boolean>(false);
  const [otpVerified, setOtpVerifiedState] = useState<boolean>(() => {
    try { return localStorage.getItem('otpVerified') === 'true'; } catch { return false; }
  });
  const [otpEvaluated, setOtpEvaluated] = useState<boolean>(false);
  const lastLoginLoggedUserIdRef = useRef<string | null>(null);

  const setOtpVerified = useCallback((value: boolean) => {
    setOtpVerifiedState(value);
    try {
      const key = session?.user?.id ? `otpVerified:${session.user.id}` : 'otpVerified';
      if (value) localStorage.setItem(key, 'true');
      else localStorage.removeItem(key);
    } catch {}
  }, [session?.user?.id]);

  const updateOtpRequirementFromProfile = async (currentSession: Session | null) => {
    const userId = currentSession?.user?.id;
    if (!userId) {
      setOtpRequired(false);
      try {
        const key = currentSession?.user?.id ? `otpRequired:${currentSession.user.id}` : 'otpRequired';
        localStorage.removeItem(key);
      } catch {}
      return false;
    }
    try {
      const { data, error } = await supabase
        .from('users_profile')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      // If profile row is missing, fail closed (require OTP) to avoid bypass
      if (!data) {
        setOtpRequired(true);
        try {
          const key = currentSession?.user?.id ? `otpRequired:${currentSession.user.id}` : 'otpRequired';
          localStorage.setItem(key, 'true');
        } catch {}
        return true;
      }
      const isEnabled = (data as any)?.is_2fa_email_enabled === true || (data as any)?.is_f2a_email_enabled === true;
      setOtpRequired(!!isEnabled);
      try {
        const key = currentSession?.user?.id ? `otpRequired:${currentSession.user.id}` : 'otpRequired';
        if (isEnabled) localStorage.setItem(key, 'true');
        else localStorage.removeItem(key);
      } catch {}
      return !!isEnabled;
    } catch (e) {
      console.warn('Failed to evaluate 2FA profile flag', e);
      // Fail closed on errors as well to avoid bypass
      setOtpRequired(true);
      try {
        const key = currentSession?.user?.id ? `otpRequired:${currentSession.user.id}` : 'otpRequired';
        localStorage.setItem(key, 'true');
      } catch {}
      return true;
    }
  };

  useEffect(() => {
    // Get initial session, then compute OTP requirement before finishing loading
    const init = async () => {
      setLoading(true);
      setOtpEvaluated(false);
      try {
        // Purge legacy keys from older builds to avoid stale gating
        try {
          localStorage.removeItem('otpRequired');
          localStorage.removeItem('otpVerified');
        } catch {}

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

        const { data: { session: initialSession } } = await supabase.auth.getSession();
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        // Validate that the persisted session actually has a valid user
        const { data: { user: validUser } } = await supabase.auth.getUser();
        if (!validUser) {
          // Clear any stale auth state and OTP flags, treat as signed out
          setSession(null);
          setUser(null);
          setOtpRequired(false);
          setOtpVerified(false);
          setOtpEvaluated(true);
          return;
        }
        if (initialSession) {
          // Defer OTP decision until profile evaluation completes to avoid flicker
          setLoading(false);
          // Evaluate in background
          updateOtpRequirementFromProfile(initialSession)
            .then((enabled) => {
              if (enabled) setOtpVerified(false);
              setOtpRequired(!!enabled);
            })
            .finally(() => setOtpEvaluated(true));
          return;
        } else {
          setOtpRequired(false);
          setOtpVerified(false);
          setOtpEvaluated(true);
        }
      } finally {
        setLoading(false);
      }
    };

    init();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, nextSession) => {
        // Always keep session/user in sync immediately
        setSession(nextSession);
        setUser(nextSession?.user ?? null);

        try {
          if (event === 'SIGNED_IN') {
            // Non-blocking log once per user per lifecycle
            const uid = nextSession?.user?.id || null;
            if (uid && lastLoginLoggedUserIdRef.current !== uid) {
              logAction({ action: 'auth.login', resource: 'auth', userId: uid, context: {} }).catch(() => {});
              lastLoginLoggedUserIdRef.current = uid;
            }
            // Reset verification at start of session
            setOtpVerified(false);
            // Defer OTP decision until profile is fetched to prevent flicker
            try {
              const key = nextSession?.user?.id ? `otpRequired:${nextSession.user.id}` : 'otpRequired';
              localStorage.removeItem(key);
            } catch {}
            // Do NOT block UI on profile fetch or 2FA send when tab visibility changes
            setOtpEvaluated(false);
            setLoading(false);
            updateOtpRequirementFromProfile(nextSession)
              .then((enabled) => {
                if (enabled) {
                  const currentUserId = nextSession?.user?.id || null;
                  if (currentUserId && sent2faForUserIdRef.current !== currentUserId) {
                    supabase.functions.invoke('send-2fa-email', {
                      headers: nextSession?.access_token ? { Authorization: `Bearer ${nextSession.access_token}` } : undefined,
                    }).then(() => {
                      sent2faForUserIdRef.current = currentUserId;
                    }).catch((fnErr) => {
                      console.warn('2FA send function failed', fnErr);
                    });
                  }
                }
                setOtpRequired(!!enabled);
              })
              .finally(() => setOtpEvaluated(true));
            // Persist last login payload for immediate reuse on next refresh
            try { localStorage.setItem('app.lastAuthEvent', JSON.stringify({ event, at: Date.now(), user: nextSession?.user || null })); } catch {}
            return; // early exit; we've already set loading state
          }
          // Ignore refresh-related events for logging to reduce noise
          if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED' || event === 'PASSWORD_RECOVERY') {
            return;
          }

          if (event === 'SIGNED_OUT') {
            // Non-blocking log
            logAction({ action: 'auth.logout', resource: 'auth', userId: user?.id || null, context: {} }).catch(() => {});
            setOtpRequired(false);
            setOtpVerified(false);
            try {
              const vid = user?.id ? `otpVerified:${user.id}` : 'otpVerified';
              const rid = user?.id ? `otpRequired:${user.id}` : 'otpRequired';
              localStorage.removeItem(vid);
              localStorage.removeItem(rid);
              localStorage.removeItem('app.lastAuthEvent');
            } catch {}
          }
        } catch {}

        // For non-auth-critical events (TOKEN_REFRESHED, USER_UPDATED, etc.), never block UI
        setOtpEvaluated(true);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  }, []);

  const value = useMemo(() => ({
    user,
    session,
    loading,
    signOut,
    refreshUser,
    otpRequired,
    otpVerified,
    setOtpVerified,
    otpEvaluated,
  }), [user, session, loading, signOut, refreshUser, otpRequired, otpVerified, setOtpVerified, otpEvaluated]);

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
