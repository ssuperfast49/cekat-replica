import { ReactNode, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
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

  if (loading || !otpEvaluated) {
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
