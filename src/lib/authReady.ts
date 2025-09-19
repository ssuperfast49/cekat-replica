import { supabase } from '@/lib/supabase';

let resolved = false;
let promise: Promise<void> | null = null;

export function waitForAuthReady(): Promise<void> {
  if (resolved) return Promise.resolve();
  if (!promise) {
    promise = supabase.auth.getSession().then(() => { resolved = true; }).catch(() => { resolved = true; });
  }
  return promise;
}


