import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tgrmxlbnutxpewfmofdx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRncm14bGJudXR4cGV3Zm1vZmR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDY0NzgsImV4cCI6MjA3MDQ4MjQ3OH0.ijDctaGPXK3Ce9uao72YaaYCX9fpPFZGpmrsWp9IfU8';

export const supabase = createClient(supabaseUrl, supabaseKey);

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
    if (!resolvedOrgId && resolvedUserId) {
      const { data: mem } = await supabase
        .from('org_members')
        .select('org_id')
        .eq('user_id', resolvedUserId)
        .limit(1)
        .maybeSingle();
      resolvedOrgId = mem?.org_id ?? null;
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
      } catch {}
    }
    const { error } = await supabase.rpc('log_action', {
      p_action: action,
      p_resource: resource,
      p_resource_id: resourceId,
      p_context: context as any,
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