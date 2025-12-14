import { createContext, useContext, useEffect, useRef, useState, ReactNode, useMemo, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, logAction } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';

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
  accountDeactivated: boolean;
  setAccountDeactivated: (value: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const sent2faForUserIdRef = useRef<string | null>(null);
  const [otpRequired, setOtpRequired] = useState<boolean>(false);
  const [otpVerified, setOtpVerifiedState] = useState<boolean>(() => {
    try {
      // Global flag
      const global = localStorage.getItem('otpVerified') === 'true';
      if (global) return true;
      // Try user-scoped flag using last auth event snapshot
      const lastRaw = localStorage.getItem('app.lastAuthEvent');
      if (lastRaw) {
        try {
          const last = JSON.parse(lastRaw);
          const uid = last?.user?.id;
          if (uid) {
            return localStorage.getItem(`otpVerified:${uid}`) === 'true';
          }
        } catch {}
      }
      return false;
    } catch { return false; }
  });
  const [otpEvaluated, setOtpEvaluated] = useState<boolean>(false);
  const [accountDeactivated, setAccountDeactivated] = useState<boolean>(false);
  const [accountStatusChecked, setAccountStatusChecked] = useState<boolean>(false);
  const [isCheckingAccount, setIsCheckingAccount] = useState<boolean>(false);
  const [checkAccountStatusCallCount, setCheckAccountStatusCallCount] = useState<number>(0);
  
  // Removed noisy debug logging for accountDeactivated state changes
  
  // Reset account status check when user changes
  useEffect(() => {
    setAccountStatusChecked(false);
  }, [user?.id]);
  const [isSigningOut, setIsSigningOut] = useState<boolean>(false);
  const lastLoginLoggedUserIdRef = useRef<string | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  useEffect(() => { currentUserIdRef.current = user?.id ?? null; }, [user?.id]);

  const setOtpVerified = useCallback((value: boolean) => {
    setOtpVerifiedState(value);
    try {
      const key = session?.user?.id ? `otpVerified:${session.user.id}` : 'otpVerified';
      if (value) {
        localStorage.setItem(key, 'true');
        // Also set a global flag so refresh before session hydration still honors verification
        localStorage.setItem('otpVerified', 'true');
      } else {
        localStorage.removeItem(key);
        localStorage.removeItem('otpVerified');
      }
    } catch {}
  }, [session?.user?.id]);

  const checkAccountStatus = async (currentSession: Session | null) => {
    const userId = currentSession?.user?.id;
    const callCount = checkAccountStatusCallCount + 1;
    setCheckAccountStatusCallCount(callCount);
    // Trimmed verbose debug logs from account status check
    
    if (!userId) {
      setAccountDeactivated(false);
      return true;
    }
    
    // Avoid duplicate checks for the same user within this lifecycle
    if (isCheckingAccount) {
      return !accountDeactivated;
    }
    if (accountStatusChecked && currentSession?.user?.id === user?.id) {
      return !accountDeactivated;
    }
    setIsCheckingAccount(true);
    
    try {
      const { data, error } = await supabase
        .from('users_profile')
        .select('is_active')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (error) {
        console.error('Error checking account status:', error);
        // On transient errors (e.g., during tab resume), do not block access.
        // We'll keep previous state and allow UI to continue.
        return !accountDeactivated;
      }
      
      // If profile row is missing, block access (fail closed for security)
      if (!data) {
        // Treat as transient during resume to avoid false blocks; allow UI and re-check later
        return !accountDeactivated;
      }
      
      const isActive = data.is_active === true;
      
      if (!isActive) {
        // Account is deactivated - redirect to warning page
        navigate('/account-deactivated', { replace: true });
        return false;
      }
      
      setAccountDeactivated(false);
      setAccountStatusChecked(true);
      return true;
    } catch (e) {
      console.error('Failed to check account status', e);
      // On unexpected errors, keep previous state and allow UI
      return !accountDeactivated;
    } finally {
      setIsCheckingAccount(false);
    }
  };

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
        .select('is_2fa_email_enabled')
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
      const isEnabled = (data as any)?.is_2fa_email_enabled === true;
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

  const evaluateOtpWithGuard = (promise: Promise<unknown>) => {
    let settled = false;
    const guardId = window.setTimeout(() => {
      if (!settled) {
        setOtpEvaluated(true);
      }
    }, 5000);
    return promise.finally(() => {
      settled = true;
      window.clearTimeout(guardId);
      setOtpEvaluated(true);
    });
  };

  useEffect(() => {
    // Get initial session, then compute OTP requirement before finishing loading
    const init = async () => {
      setLoading(true);
      setOtpEvaluated(false);
      let loadingGuardTriggered = false;
      const loadingGuard = window.setTimeout(() => {
        loadingGuardTriggered = true;
        setLoading(false);
        setOtpEvaluated(true);
      }, 5000);
      try {
        // Purge legacy keys from older builds to avoid stale gating
        try {
          localStorage.removeItem('otpRequired');
          localStorage.removeItem('otpVerified');
        } catch {}

        // Prefer LocalStorage first to avoid flicker/empty state on refresh
        try {
          // Scan for any Supabase auth token key and hydrate the most recent-looking one
          const keys = Object.keys(localStorage).filter(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
          for (const key of keys) {
            try {
              const raw = localStorage.getItem(key);
              if (!raw) continue;
              const parsed = JSON.parse(raw);
              if (parsed?.access_token && parsed?.user) {
                setSession(parsed as any);
                setUser(parsed.user as User);
                break;
              }
            } catch {}
          }
          // Clean up any obviously stale project refs we used previously
          localStorage.removeItem('sb-tgrmxlbnutxpewfmofdx-auth-token');
          localStorage.removeItem('sb-yoekcpoppfudmqtvjcby-auth-token');
        } catch {}

        const sessionResult = await Promise.race([
          supabase.auth.getSession().catch(() => ({ data: { session: null } })),
          new Promise<{ data: { session: Session | null } }>((resolve) => {
            setTimeout(() => resolve({ data: { session: null } }), 4000);
          })
        ]);
        const initialSession = sessionResult?.data?.session ?? null;
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        // Validate that the persisted session actually has a valid user
        const userResult = await Promise.race([
          supabase.auth.getUser().catch(() => ({ data: { user: null } })),
          new Promise<{ data: { user: User | null } }>((resolve) => {
            setTimeout(() => resolve({ data: { user: null } }), 4000);
          })
        ]);
        const validUser = userResult?.data?.user ?? null;
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
          // Check account status first before setting user as signed in
          const isAccountActive = await Promise.race([
            checkAccountStatus(initialSession),
            new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 3000))
          ]);
          if (!isAccountActive) {
            // Account is deactivated, show modal but keep session for now
            setSession(initialSession);
            setUser(initialSession.user);
            setOtpRequired(false);
            setOtpVerified(false);
            setOtpEvaluated(true);
            setLoading(false);
            return;
          }
          // Only set user as signed in if account is active
          setSession(initialSession);
          setUser(initialSession.user);
          
          // Store user_id in localStorage for reliable access (since Supabase sessioning can be unreliable)
          try {
            if (initialSession.user?.id) {
              localStorage.setItem('app.currentUserId', initialSession.user.id);
              localStorage.setItem('app.currentUserEmail', initialSession.user.email || '');
            }
          } catch {}
          // Defer OTP decision until profile evaluation completes to avoid flicker
          if (!loadingGuardTriggered) {
            window.clearTimeout(loadingGuard);
            setLoading(false);
          }
          // Evaluate in background
          evaluateOtpWithGuard(
            updateOtpRequirementFromProfile(initialSession)
            .then((enabled) => {
              // On hard refresh, preserve any existing OTP verification state.
              // Only set whether OTP is required; do not reset verification here.
              setOtpRequired(!!enabled);
            })
          );
          return;
        } else {
          setOtpRequired(false);
          setOtpVerified(false);
          setOtpEvaluated(true);
        }
      } finally {
        if (!loadingGuardTriggered) {
          window.clearTimeout(loadingGuard);
          setLoading(false);
        }
      }
    };

    init();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, nextSession) => {
        try {
          if (event === 'SIGNED_IN') {
            // Detect silent re-auth/refresh where the user didn't actually sign in again
            const prevUserId = currentUserIdRef.current;
            const nextUserId = nextSession?.user?.id || null;
            const isSilentReauth = !!prevUserId && !!nextUserId && prevUserId === nextUserId;
            if (isSilentReauth) {
              // Just update session/user and skip heavy checks to avoid blocking UI on tab resume
              setSession(nextSession);
              setUser(nextSession?.user ?? null);
              return;
            }
            // Skip processing if user is signing out
            if (isSigningOut) {
              setSession(nextSession);
              setUser(nextSession?.user ?? null);
              return;
            }
            
            // Check account status first before setting user as signed in
            const isAccountActive = await Promise.race([
              checkAccountStatus(nextSession),
              new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 3000))
            ]);
            if (!isAccountActive) {
              // Account is deactivated, show modal but keep session for now
              setSession(nextSession);
              setUser(nextSession?.user ?? null);
              setOtpRequired(false);
              setOtpVerified(false);
              setOtpEvaluated(true);
              setLoading(false);
              return;
            }
            
            // Set user as signed in (account status is checked during login)
            setSession(nextSession);
            setUser(nextSession?.user ?? null);
            
            // Non-blocking log once per user per lifecycle
            const uid = nextSession?.user?.id || null;
            if (uid && lastLoginLoggedUserIdRef.current !== uid) {
              logAction({ action: 'auth.login', resource: 'auth', userId: uid, context: {} }).catch(() => {});
              lastLoginLoggedUserIdRef.current = uid;
              
              // Store user_id in localStorage for reliable access (since Supabase sessioning can be unreliable)
              try {
                localStorage.setItem('app.currentUserId', uid);
                localStorage.setItem('app.currentUserEmail', nextSession?.user?.email || '');
              } catch {}
            }
            
            // Preserve OTP verification if it was already satisfied for this user
            let persistedVerified = false;
            try {
              const key = uid ? `otpVerified:${uid}` : 'otpVerified';
              persistedVerified = localStorage.getItem(key) === 'true' || localStorage.getItem('otpVerified') === 'true';
            } catch {}
            setOtpVerified(!!persistedVerified);
            
            // Defer OTP decision until profile is fetched to prevent flicker
            try {
              const key = nextSession?.user?.id ? `otpRequired:${nextSession.user.id}` : 'otpRequired';
              localStorage.removeItem(key);
            } catch {}
            
            // Do NOT block UI on profile fetch or 2FA send when tab visibility changes
            setOtpEvaluated(false);
            setLoading(false);
            
            evaluateOtpWithGuard(
              updateOtpRequirementFromProfile(nextSession)
              .then((enabled) => {
                if (enabled && !persistedVerified) {
                  const currentUserId = nextSession?.user?.id || null;
                  if (currentUserId && sent2faForUserIdRef.current !== currentUserId) {
                    supabase.functions.invoke('send-2fa-login-email', {
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
            );
            // Persist last login payload for immediate reuse on next refresh
            try { localStorage.setItem('app.lastAuthEvent', JSON.stringify({ event, at: Date.now(), user: nextSession?.user || null })); } catch {}
            return; // early exit; we've already set loading state
          }
          // If user is in password recovery, only require OTP if enabled in profile
          if (event === 'PASSWORD_RECOVERY') {
            try { localStorage.setItem('auth.intent', 'recovery'); } catch {}
            setOtpEvaluated(false);
            evaluateOtpWithGuard(
              (async () => {
                try {
                  const enabled = await updateOtpRequirementFromProfile(nextSession);
                  setOtpRequired(!!enabled);
                  if (enabled) setOtpVerified(false);
                } catch {
                  // On errors during recovery, prefer not to block with OTP
                  setOtpRequired(false);
                }
              })()
            );
            return;
          }
          // Ignore refresh-related events for logging to reduce noise
          if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
            return;
          }

          if (event === 'SIGNED_OUT') {
            // Non-blocking log - only if we have a valid user and org context
            if (user?.id) {
              // Try to log the logout action, but don't fail if it doesn't work
              logAction({ 
                action: 'auth.logout', 
                resource: 'auth', 
                userId: user.id, 
                context: {} 
              }).catch(() => {});
            }
            setOtpRequired(false);
            setOtpVerified(false);
            setIsSigningOut(false);
            setAccountDeactivated(false);
            
            // Clear all cache on sign out
            try {
              // Clear all localStorage items
              const keysToRemove: string[] = [];
              for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key) {
                  keysToRemove.push(key);
                }
              }
              keysToRemove.forEach(key => {
                try {
                  localStorage.removeItem(key);
                } catch {}
              });
              
              // Clear all sessionStorage
              const sessionKeysToRemove: string[] = [];
              for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                if (key) {
                  sessionKeysToRemove.push(key);
                }
              }
              sessionKeysToRemove.forEach(key => {
                try {
                  sessionStorage.removeItem(key);
                } catch {}
              });
            } catch (cacheError) {
              console.warn('Error clearing cache on sign out:', cacheError);
            }
          }
        } catch {}

        // For non-auth-critical events (TOKEN_REFRESHED, USER_UPDATED, etc.), never block UI
        if (event !== 'SIGNED_IN') {
          setSession(nextSession);
          setUser(nextSession?.user ?? null);
        }
        setOtpEvaluated(true);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Refresh session on window focus / tab visibility to recover after long idle or sleep
  useEffect(() => {
    const refreshSession = async () => {
      try {
        await supabase.auth.getSession();
      } catch {}
    };
    const onVisibilityChange = () => {
      try {
        if (document.visibilityState === 'visible') {
          refreshSession();
        }
      } catch {}
    };
    window.addEventListener('focus', refreshSession);
    document.addEventListener('visibilitychange', onVisibilityChange);
    // Lightweight keepalive while visible to proactively refresh tokens
    const keepaliveId = window.setInterval(() => {
      try {
        if (document.visibilityState === 'visible') {
          supabase.auth.getSession().catch(() => {});
        }
      } catch {}
    }, 4 * 60 * 1000);
    return () => {
      window.removeEventListener('focus', refreshSession);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      try { clearInterval(keepaliveId); } catch {}
    };
  }, []);

  const signOut = useCallback(async () => {
    try {
      setIsSigningOut(true);
      
      // Clear all cache before signing out
      try {
        // Clear all localStorage items (including cached data)
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => {
          try {
            localStorage.removeItem(key);
          } catch {}
        });
        
        // Clear all sessionStorage
        const sessionKeysToRemove: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key) {
            sessionKeysToRemove.push(key);
          }
        }
        sessionKeysToRemove.forEach(key => {
          try {
            sessionStorage.removeItem(key);
          } catch {}
        });
        
        // Specifically clear common cache keys
        const cachePatterns = [
          'app.cached',
          'app.lastAuthEvent',
          'app.currentUserId',
          'app.currentUserEmail',
          'otpVerified',
          'otpRequired',
          'auth.intent',
          'sb-',
        ];
        
        // Clear any remaining keys matching patterns
        Object.keys(localStorage).forEach(key => {
          if (cachePatterns.some(pattern => key.includes(pattern))) {
            try {
              localStorage.removeItem(key);
            } catch {}
          }
        });
      } catch (cacheError) {
        console.warn('Error clearing cache:', cacheError);
      }
      
      // Sign out from Supabase
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setIsSigningOut(false);
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
    accountDeactivated,
    setAccountDeactivated,
  }), [user, session, loading, signOut, refreshUser, otpRequired, otpVerified, setOtpVerified, otpEvaluated, accountDeactivated, setAccountDeactivated]);

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
