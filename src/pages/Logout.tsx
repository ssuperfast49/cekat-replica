import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function Logout() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const run = async () => {
      await signOut();
      navigate('/login', { replace: true });
    };
    run();
  }, [signOut, navigate]);

  return null;
}


