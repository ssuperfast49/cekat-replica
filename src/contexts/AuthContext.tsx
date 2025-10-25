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
  
  // Debug accountDeactivated state changes
  useEffect(() => {
    console.log('AuthContext: accountDeactivated changed to:', accountDeactivated);
    console.trace('AuthContext: accountDeactivated change stack trace');
    
    // Add a timestamp to see timing
    console.log('AuthContext: accountDeactivated change at:', new Date().toISOString());
  }, [accountDeactivated]);
  
  // Reset account status check when user changes
  useEffect(() => {
    console.log('AuthContext: Resetting accountStatusChecked due to user change');
    console.log('AuthContext: New user ID:', user?.id);
    setAccountStatusChecked(false);
  }, [user?.id]);
  const [isSigningOut, setIsSigningOut] = useState<boolean>(false);
  const lastLoginLoggedUserIdRef = useRef<string | null>(null);

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
    console.log('AuthContext: checkAccountStatus called with userId:', userId);
    console.log('AuthContext: accountStatusChecked:', accountStatusChecked);
    console.log('AuthContext: isCheckingAccount:', isCheckingAccount);
    console.log('AuthContext: checkAccountStatus call count:', callCount);
    console.log('AuthContext: checkAccountStatus called at:', new Date().toISOString());
    
    if (!userId) {
      console.log('AuthContext: No userId, setting accountDeactivated to false');
      setAccountDeactivated(false);
      return true;
    }
    
    // Temporarily disable the isCheckingAccount check to see if it's causing issues
    // if (isCheckingAccount) {
    //   console.log('AuthContext: Already checking account status, skipping');
    //   return !accountDeactivated;
    // }
    
    // Temporarily disable the accountStatusChecked check to see if it's causing issues
    // if (accountStatusChecked && currentSession?.user?.id === user?.id) {
    //   console.log('AuthContext: Account status already checked for this user, skipping');
    //   console.log('AuthContext: Current accountDeactivated state:', accountDeactivated);
    //   return !accountDeactivated;
    // }
    
    // Temporarily disable the checking flag to see if it's causing issues
    // setIsCheckingAccount(true);
    
    try {
      console.log('AuthContext: Checking account status for user:', userId);
      const { data, error } = await supabase
        .from('users_profile')
        .select('is_active')
        .eq('user_id', userId)
        .maybeSingle();
      
      console.log('AuthContext: Profile data:', data);
      console.log('AuthContext: Profile error:', error);
      
      if (error) {
        console.error('Error checking account status:', error);
        // If we can't check the status, block access for security
        setAccountDeactivated(true);
        return false;
      }
      
      // If profile row is missing, block access (fail closed for security)
      if (!data) {
        console.warn('No user profile found for user:', userId);
        setAccountDeactivated(true);
        return false;
      }
      
      const isActive = data.is_active === true;
      console.log('AuthContext: User is active:', isActive);
      
      if (!isActive) {
        // Account is deactivated - redirect to warning page
        console.log('AuthContext: Account is deactivated, redirecting to warning page');
        navigate('/account-deactivated', { replace: true });
        return false;
      }
      
      console.log('AuthContext: Account is active, setting accountDeactivated to false');
      setAccountDeactivated(false);
      // Temporarily disable the status checked flag
      // setAccountStatusChecked(true);
      return true;
    } catch (e) {
      console.error('Failed to check account status', e);
      // Fail closed on errors for security
      setAccountDeactivated(true);
      return false;
    } finally {
      // Temporarily disable the checking flag reset
      // setIsCheckingAccount(false);
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
          // Check account status first before setting user as signed in
          console.log('AuthContext: Checking account status for initial session');
          const isAccountActive = await checkAccountStatus(initialSession);
          console.log('AuthContext: Account is active:', isAccountActive);
          if (!isAccountActive) {
            console.log('AuthContext: Account is deactivated, showing modal');
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
          // Defer OTP decision until profile evaluation completes to avoid flicker
          setLoading(false);
          // Evaluate in background
          updateOtpRequirementFromProfile(initialSession)
            .then((enabled) => {
              // On hard refresh, preserve any existing OTP verification state.
              // Only set whether OTP is required; do not reset verification here.
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
        try {
          if (event === 'SIGNED_IN') {
            // Skip processing if user is signing out
            if (isSigningOut) {
              setSession(nextSession);
              setUser(nextSession?.user ?? null);
              return;
            }
            
            // Check account status first before setting user as signed in
            console.log('AuthContext: Checking account status for SIGNED_IN event');
            const isAccountActive = await checkAccountStatus(nextSession);
            console.log('AuthContext: Account is active:', isAccountActive);
            if (!isAccountActive) {
              console.log('AuthContext: Account is deactivated, showing modal');
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
            
            updateOtpRequirementFromProfile(nextSession)
              .then((enabled) => {
                if (enabled && !persistedVerified) {
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
          // If user is in password recovery, only require OTP if enabled in profile
          if (event === 'PASSWORD_RECOVERY') {
            try { localStorage.setItem('auth.intent', 'recovery'); } catch {}
            setOtpEvaluated(false);
            try {
              const enabled = await updateOtpRequirementFromProfile(nextSession);
              setOtpRequired(!!enabled);
              if (enabled) setOtpVerified(false);
            } catch {
              // On errors during recovery, prefer not to block with OTP
              setOtpRequired(false);
            } finally {
              setOtpEvaluated(true);
            }
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
              }).catch(() => {
                // Silently fail - logging is not critical for logout
                console.debug('Logout action logging failed, continuing with logout');
              });
            }
            setOtpRequired(false);
            setOtpVerified(false);
            setIsSigningOut(false);
            setAccountDeactivated(false);
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

  const signOut = useCallback(async () => {
    try {
      setIsSigningOut(true);
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
