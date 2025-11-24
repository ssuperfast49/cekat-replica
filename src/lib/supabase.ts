import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://api.cssuper.com'; //PROD
// const supabaseUrl = 'https://yoekcpoppfudmqtvjcby.supabase.co'; //DEV
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRncm14bGJudXR4cGV3Zm1vZmR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDY0NzgsImV4cCI6MjA3MDQ4MjQ3OH0.ijDctaGPXK3Ce9uao72YaaYCX9fpPFZGpmrsWp9IfU8'; //PROD
// const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvZWtjcG9wcGZ1ZG1xdHZqY2J5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMjU4NzgsImV4cCI6MjA3ODYwMTg3OH0.3ShE7q1XYiuf-dg_dTzgpAYL2WrH8dNeAXSnhqQMJVA'; //DEV

export const supabase = createClient(supabaseUrl, supabaseKey);

// Export protected wrapper
import { createProtectedSupabaseClient } from './supabaseProtected';
export const protectedSupabase = createProtectedSupabaseClient(supabase);

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
    const { data: authData } = await supabase.auth.getUser();
    const resolvedUserId = params.userId ?? authData?.user?.id ?? null;
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