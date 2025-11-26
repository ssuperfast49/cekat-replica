import { ReactNode, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import Login from './Login';
import { useLocation, useNavigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, otpRequired, otpVerified, otpEvaluated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && otpEvaluated && user) {
      const isOnOtpPage = location.pathname === '/otp';
      const isOnResetPasswordPage = location.pathname === '/reset-password';
      const isOnInvitePage = location.pathname === '/invite';
      
      // Check if this is an invite flow by looking at URL parameters and user status
      let isInviteFlow = false;
      try {
        const url = new URL(window.location.href);
        const type = url.searchParams.get('type');
        const code = url.searchParams.get('code');
        const hash = window.location.hash || '';
        isInviteFlow = type === 'invite' || (code && !hash.includes('access_token=')) || hash.includes('type=invite') || window.location.pathname === '/invite';
      } catch {}
      
      // Always check if user needs to set password (regardless of URL parameters)
      if (user) {
        (async () => {
          try {
            const { data: profile } = await supabase
              .from('users_profile')
              .select('password_set')
              .eq('user_id', user.id)
              .single();
            if (profile && profile.password_set === false) {
              // Redirect to password creation page
              setTimeout(() => navigate('/reset-password', { replace: true }), 0);
              return; // Exit early to prevent 2FA check
            }
          } catch {}
        })();
      }
      
      // If this is an invite flow and user is not on password creation page, redirect them
      if (isInviteFlow && !isOnResetPasswordPage && !isOnInvitePage) {
        setTimeout(() => navigate('/reset-password', { replace: true }), 0);
        return;
      }
      
      // Skip 2FA if user has 2FA disabled (otpRequired should be false)
      if (otpRequired && !otpVerified && !isOnOtpPage) {
        // Determine intent (normal 2FA vs recovery)
        let intent: '2fa' | 'recovery' = '2fa';
        try {
          const url = new URL(window.location.href);
          const type = url.searchParams.get('type');
          if (type === 'recovery') intent = 'recovery';
          // Supabase recovery may also arrive via hash tokens
          if (window.location.hash?.includes('access_token=')) intent = 'recovery';
          // Or via explicit flag stored by auth listener
          if (localStorage.getItem('auth.intent') === 'recovery') intent = 'recovery';
        } catch {}
        // Defer navigation to avoid rendering null during the same commit
        setTimeout(() => navigate('/otp', { replace: true, state: { from: location.pathname, intent } }), 0);
      }
    }
  }, [user, loading, otpEvaluated, otpRequired, otpVerified, location.pathname, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const isOnOtpPage = location.pathname === '/otp';
  if (user && otpRequired && !otpVerified && !isOnOtpPage) {
    // Show a minimal placeholder while redirecting
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          <span>Redirecting…</span>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
