import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export default function Logout() {
  const navigate = useNavigate();
  useEffect(() => {
    const run = async () => {
      try {
        await supabase.auth.signOut();
      } catch {}
      try {
        localStorage.removeItem('otpVerified');
        localStorage.removeItem('otpRequired');
      } catch {}
      navigate('/', { replace: true });
    };
    run();
  }, [navigate]);
  return null;
}


