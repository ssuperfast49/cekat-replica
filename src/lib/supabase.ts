import { createClient } from '@supabase/supabase-js';

// const supabaseUrl = 'https://api.cssuper.com'; //PROD
const supabaseUrl = 'https://bkynymyhbfrhvwxqqttk.supabase.co'; //DEV
// const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRncm14bGJudXR4cGV3Zm1vZmR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDY0NzgsImV4cCI6MjA3MDQ4MjQ3OH0.ijDctaGPXK3Ce9uao72YaaYCX9fpPFZGpmrsWp9IfU8'; //PROD
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJreW55bXloYmZyaHZ3eHFxdHRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5Mzk1NzIsImV4cCI6MjA3OTUxNTU3Mn0.4ELI9s6908SdW2jd1BM_ht8pTIyLAwPpsqGiGNCdcC0'; //DEV

export const supabase = createClient(supabaseUrl, supabaseKey);

// Export protected wrapper
import { createProtectedSupabaseClient } from './supabaseProtected';
export const protectedSupabase = createProtectedSupabaseClient(supabase);

/**
 * Get current user ID from localStorage (more reliable than Supabase session)
 * Falls back to Supabase session if localStorage is not available
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    // First try localStorage (more reliable)
    const storedUserId = typeof localStorage !== 'undefined' 
      ? localStorage.getItem('app.currentUserId') 
      : null;
    if (storedUserId) {
      return storedUserId;
    }
    
    // Fallback to Supabase session
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export async function logAction(params: {
  action: string;
  resource: string;
  resourceId?: string | null;
  context?: Record<string, any>;
  ip?: string | null;
  userAgent?: string | null;
  orgId?: string | null;
  userId?: string | null;
}) {
  try {
    const { action, resource, resourceId = null, context = {}, ip = null, userAgent = null } = params;
    // Resolve user and org if not supplied
    // Prefer localStorage user_id (more reliable) over Supabase session
    let resolvedUserId = params.userId ?? null;
    if (!resolvedUserId) {
      try {
        const storedUserId = typeof localStorage !== 'undefined' 
          ? localStorage.getItem('app.currentUserId') 
          : null;
        if (storedUserId) {
          resolvedUserId = storedUserId;
        }
      } catch {}
    }
    // Fallback to Supabase session if localStorage doesn't have it
    if (!resolvedUserId) {
      const { data: authData } = await supabase.auth.getUser();
      resolvedUserId = authData?.user?.id ?? null;
    }
    let resolvedOrgId = params.orgId ?? null;
    
    // Only try to resolve org if we have a valid user and session
    if (!resolvedOrgId && resolvedUserId && authData?.user) {
      try {
        const { data: mem } = await supabase
          .from('org_members')
          .select('org_id')
          .eq('user_id', resolvedUserId)
          .limit(1)
          .maybeSingle();
        resolvedOrgId = mem?.org_id ?? null;
      } catch (error) {
        // If we can't access org_members (e.g., during logout), skip logging
        
        return;
      }
    }
    
    // If we still don't have an org_id and this is a logout action, skip logging
    if (!resolvedOrgId && action === 'auth.logout') {
      
      return;
    }
    
    if (!resolvedOrgId) {
      // Fallback to default org if available to satisfy NOT NULL
      try {
        const { data: org } = await supabase
          .from('orgs')
          .select('id')
          .limit(1)
          .maybeSingle();
        resolvedOrgId = org?.id ?? null;
      } catch (error) {
        // If we can't access orgs table, skip logging
        
        return;
      }
    }
    // Debounce frequent duplicates within a short window (e.g., auth refresh loops)
    try {
      const key = `logAction:${action}:${resource}:${resolvedUserId || 'anon'}`;
      const now = Date.now();
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
      if (raw) {
        const prev = Number(raw) || 0;
        if (now - prev < 3000) {
          return; // skip duplicate within 3s window
        }
      }
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, String(now));
    } catch {}

    // Only proceed if we have a valid org_id
    if (!resolvedOrgId) {
      
      return;
    }

    const { error } = await supabase.rpc('log_action', {
      p_action: action,
      p_resource: resource,
      p_resource_id: resourceId,
      p_context: {
        ...context,
        route: (typeof window !== 'undefined' ? window.location.pathname : null),
      } as any,
      p_ip: ip,
      p_user_agent: userAgent,
      p_org_id: resolvedOrgId,
      p_user_id: resolvedUserId,
    });
    if (error) console.warn('logAction failed', error);
  } catch (e) {
    console.warn('logAction threw', e);
  }
}