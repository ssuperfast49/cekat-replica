import { supabase } from '@/lib/supabase';

const STORAGE_KEY = 'sb-tgrmxlbnutxpewfmofdx-auth-token';

export async function restoreSupabaseSessionFromLocalStorage(): Promise<void> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const access_token = parsed?.access_token || parsed?.currentSession?.access_token;
    const refresh_token = parsed?.refresh_token || parsed?.currentSession?.refresh_token;
    if (access_token && refresh_token) {
      await supabase.auth.setSession({ access_token, refresh_token });
    }
  } catch {
    // ignore
  }
}


