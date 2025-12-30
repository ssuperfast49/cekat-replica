import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export default function Logout() {
  const navigate = useNavigate();
  useEffect(() => {
    const run = async () => {
      try {
        // Clear all cache before signing out
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
          console.warn('Error clearing cache:', cacheError);
        }
        
        // Sign out from Supabase
        await supabase.auth.signOut();
      } catch {}
      navigate('/', { replace: true });
    };
    run();
  }, [navigate]);
  return null;
}


