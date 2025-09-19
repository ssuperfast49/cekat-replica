import { ReactNode, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Login from './Login';
import { useLocation, useNavigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, otpRequired, otpVerified } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && user) {
      const isOnOtpPage = location.pathname === '/otp';
      if (otpRequired && !otpVerified && !isOnOtpPage) {
        // Defer navigation to avoid rendering null during the same commit
        setTimeout(() => navigate('/otp', { replace: true }), 0);
      }
    }
  }, [user, loading, otpRequired, otpVerified, location.pathname, navigate]);

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
