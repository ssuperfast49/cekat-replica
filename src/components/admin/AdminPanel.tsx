import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, Shield, Users, PlugZap, ClipboardList, BarChart2, Settings, Eraser, Trash2, ShieldCheck, Key, PauseCircle, PlayCircle } from "lucide-react";
import CircuitBreakerStatus from "@/components/admin/CircuitBreakerStatus";
import PermissionGate from "@/components/rbac/PermissionGate";
import RoleGate from "@/components/rbac/RoleGate";
import { ROLES } from "@/types/rbac";
import { toast } from "@/components/ui/sonner";
import { defaultFallbackHandler } from "@/lib/fallbackHandler";
import { useContacts } from "@/hooks/useContacts";
import { protectedSupabase, logAction } from "@/lib/supabase";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export default function AdminPanel() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { deleteMultipleContacts } = useContacts();
  const [deleteIds, setDeleteIds] = useState("");
  const [deleting, setDeleting] = useState(false);
  // Data retention & GDPR state (moved from Analytics)
  const [retentionDays, setRetentionDays] = useState<number | null>(null);
  const [showRetentionModal, setShowRetentionModal] = useState(false);
  const [editRetentionDays, setEditRetentionDays] = useState<number>(90);
  const [showGdprModal, setShowGdprModal] = useState(false);
  const [gdprContactId, setGdprContactId] = useState<string>("");
  const [cleanupResult, setCleanupResult] = useState<any>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [gdprLoading, setGdprLoading] = useState(false);
  // AI Auto Response Pause state
  const [aiPaused, setAiPaused] = useState<boolean | null>(null);
  const [aiPausedReason, setAiPausedReason] = useState<string | null>(null);
  const [aiPausedAt, setAiPausedAt] = useState<string | null>(null);
  const [aiPausedByUserId, setAiPausedByUserId] = useState<string | null>(null);
  const [aiPausedByName, setAiPausedByName] = useState<string | null>(null);
  const [aiPauseLoading, setAiPauseLoading] = useState<boolean>(false);
  const [showAiPauseModal, setShowAiPauseModal] = useState<boolean>(false);
  const [aiPauseReasonInput, setAiPauseReasonInput] = useState<string>("");

  const idsParsed = useMemo(() => {
    return Array.from(new Set(
      deleteIds
        .split(/[\s,\n]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    ));
  }, [deleteIds]);

  const goTo = (menu: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("menu", menu);
    setSearchParams(next);
  };

  const clearCaches = () => {
    try {
      defaultFallbackHandler.clear();
      toast.success("Local caches cleared");
    } catch {
      toast.error("Failed to clear cache");
    }
  };

  // Resolve current org_id from membership (first org)
  const resolveCurrentOrgId = async (): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: membership } = await supabase
        .from('org_members')
        .select('org_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      return membership?.org_id ?? null;
    } catch {
      return null;
    }
  };

  // Fetch retention settings
  const fetchRetentionSettings = async () => {
    try {
      const orgId = await resolveCurrentOrgId();
      if (!orgId) return;
      const { data: settings, error } = await protectedSupabase
        .from('org_settings')
        .select('retention_days')
        .eq('org_id', orgId)
        .maybeSingle();
      if (error) throw error;
      setRetentionDays(settings?.retention_days ?? 90);
      setEditRetentionDays(settings?.retention_days ?? 90);
    } catch (error: any) {
      console.error('Failed to fetch retention settings:', error);
    }
  };

  // Fetch AI auto response pause status
  const fetchAiPauseStatus = async () => {
    try {
      const orgId = await resolveCurrentOrgId();
      if (!orgId) return;
      const { data: settings, error } = await protectedSupabase
        .from('org_settings')
        .select('ai_paused, ai_paused_reason, ai_paused_at, ai_paused_by_user_id')
        .eq('org_id', orgId)
        .maybeSingle();
      if (error) throw error;
      setAiPaused(!!settings?.ai_paused);
      setAiPausedReason(settings?.ai_paused_reason ?? null);
      setAiPausedAt(settings?.ai_paused_at ?? null);
      const byId = settings?.ai_paused_by_user_id ?? null;
      setAiPausedByUserId(byId);

      // Resolve display name if available
      if (byId) {
        try {
          const { data: prof } = await protectedSupabase
            .from('users_profile')
            .select('user_id, display_name')
            .eq('user_id', byId)
            .maybeSingle();
          if (prof?.display_name) {
            setAiPausedByName(prof.display_name);
          } else {
            const { data: vuser } = await protectedSupabase
              .from('v_users')
              .select('id, email')
              .eq('id', byId)
              .maybeSingle();
            setAiPausedByName(vuser?.email ?? byId);
          }
        } catch {
          setAiPausedByName(byId);
        }
      } else {
        setAiPausedByName(null);
      }
    } catch (error: any) {
      console.error('Failed to fetch AI pause status:', error);
    }
  };

  const resumeAiResponses = async () => {
    try {
      setAiPauseLoading(true);
      const orgId = await resolveCurrentOrgId();
      if (!orgId) throw new Error('Unable to resolve organization');
      const { error } = await protectedSupabase
        .from('org_settings')
        .update({
          ai_paused: false,
          ai_paused_reason: null,
          ai_paused_at: null,
          ai_paused_by_user_id: null,
        })
        .eq('org_id', orgId);
      if (error) throw error;
      setAiPaused(false);
      setAiPausedReason(null);
      setAiPausedAt(null);
      setAiPausedByUserId(null);
      setAiPausedByName(null);
      toast.success('AI auto responses resumed');
      try { await logAction({ action: 'ai.resume', resource: 'org_settings' }); } catch {}
    } catch (error: any) {
      toast.error(error?.message || 'Failed to resume AI responses');
    } finally {
      setAiPauseLoading(false);
    }
  };

  const confirmPauseAiResponses = async () => {
    try {
      setAiPauseLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      const byUserId = user?.id ?? null;
      const orgId = await resolveCurrentOrgId();
      if (!orgId) throw new Error('Unable to resolve organization');
      const { error } = await protectedSupabase
        .from('org_settings')
        .update({
          ai_paused: true,
          ai_paused_reason: aiPauseReasonInput?.trim() || null,
          ai_paused_at: new Date().toISOString(),
          ai_paused_by_user_id: byUserId,
        })
        .eq('org_id', orgId);
      if (error) throw error;
      setAiPaused(true);
      setAiPausedReason(aiPauseReasonInput?.trim() || null);
      setAiPausedAt(new Date().toISOString());
      setAiPausedByUserId(byUserId);
      setAiPausedByName(null);
      setShowAiPauseModal(false);
      toast.success('AI auto responses paused');
      try { await logAction({ action: 'ai.pause', resource: 'org_settings', context: { reason: aiPauseReasonInput?.trim() || null } }); } catch {}
      // Refresh pauser display name
      void fetchAiPauseStatus();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to pause AI responses');
    } finally {
      setAiPauseLoading(false);
      setAiPauseReasonInput("");
    }
  };

  // Save retention settings
  const saveRetentionDays = async () => {
    try {
      setCleanupLoading(true);
      const orgId = await resolveCurrentOrgId();
      if (!orgId) throw new Error('Unable to resolve organization');
      const { error } = await protectedSupabase
        .from('org_settings')
        .update({
          retention_days: editRetentionDays,
        })
        .eq('org_id', orgId);
      if (error) throw error;
      setRetentionDays(editRetentionDays);
      setShowRetentionModal(false);
      toast.success(`Retention period updated to ${editRetentionDays} days`);
      try { await logAction({ action: 'retention.update', resource: 'org_settings', context: { retention_days: editRetentionDays } }); } catch {}
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update retention settings');
    } finally {
      setCleanupLoading(false);
    }
  };

  // Manual cleanup trigger
  const triggerCleanup = async () => {
    try {
      setCleanupLoading(true);
      const { data, error } = await protectedSupabase.rpc('cleanup_old_chat_data', {
        p_days: retentionDays ?? 90,
      });
      if (error) throw error;
      setCleanupResult(data);
      toast.success(`Cleanup completed: ${data?.threads_deleted || 0} threads, ${data?.messages_deleted || 0} messages deleted`);
      try { await logAction({ action: 'retention.cleanup', resource: 'chat_data', context: data }); } catch {}
    } catch (error: any) {
      toast.error(error?.message || 'Failed to run cleanup');
    } finally {
      setCleanupLoading(false);
    }
  };

  // GDPR deletion
  const executeGdprDeletion = async () => {
    if (!gdprContactId.trim()) {
      toast.error('Please enter contact UUID');
      return;
    }
    try {
      setGdprLoading(true);
      const { data, error } = await protectedSupabase.rpc('gdpr_delete_user_data', {
        p_contact_id: gdprContactId.trim(),
      });
      if (error) throw error;
      toast.success(`GDPR deletion completed: ${data?.threads_deleted || 0} threads, ${data?.messages_deleted || 0} messages, ${data?.contact_deleted || 0} contacts deleted`);
      setShowGdprModal(false);
      setGdprContactId("");
      try { await logAction({ action: 'gdpr.delete_request', resource: 'contact', resourceId: gdprContactId, context: data }); } catch {}
    } catch (error: any) {
      toast.error(error?.message || 'Failed to execute GDPR deletion');
    } finally {
      setGdprLoading(false);
    }
  };

  useEffect(() => {
    fetchRetentionSettings();
    fetchAiPauseStatus();
  }, []);

  const confirmBulkDelete = async () => {
    if (idsParsed.length === 0) {
      toast.error("Provide at least one contact UUID");
      return;
    }
    if (!window.confirm(`Delete ${idsParsed.length} contact(s)? This cannot be undone.`)) return;
    try {
      setDeleting(true);
      await deleteMultipleContacts(idsParsed);
      setDeleteIds("");
      toast.success("Contacts deleted");
    } catch {
      toast.error("Bulk delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <RoleGate role={ROLES.MASTER_AGENT} fallback={<div className="text-sm text-muted-foreground">Admin Panel is available to Master Agents only.</div>}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Admin Panel</h1>
            <p className="text-sm text-muted-foreground">Centralized controls for master agents.</p>
          </div>
          <Badge className="bg-blue-100 text-blue-700 border-0">Master Agent</Badge>
        </div>

        {/* Quick Links */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Shield className="h-4 w-4"/> Access & Management</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Button variant="outline" className="justify-start" onClick={()=>goTo('permissions')}>
              <ShieldCheck className="h-4 w-4 mr-2"/> Manage Roles & Permissions
            </Button>
            <Button variant="outline" className="justify-start" onClick={()=>goTo('humanagents')}>
              <Users className="h-4 w-4 mr-2"/> Human Agents
            </Button>
            <Button variant="outline" className="justify-start" onClick={()=>goTo('platforms')}>
              <PlugZap className="h-4 w-4 mr-2"/> Platforms & Integrations
            </Button>
            <Button variant="outline" className="justify-start" onClick={()=>goTo('analytics')}>
              <BarChart2 className="h-4 w-4 mr-2"/> Analytics
            </Button>
            <Button variant="outline" className="justify-start" onClick={()=>goTo('logs')}>
              <ClipboardList className="h-4 w-4 mr-2"/> Audit Logs
            </Button>
            <Button variant="outline" className="justify-start" onClick={()=>goTo('contacts')}>
              <Key className="h-4 w-4 mr-2"/> Contacts
            </Button>
          </CardContent>
        </Card>

        {/* Reliability */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Settings className="h-4 w-4"/> Reliability & Circuit Breaker</CardTitle>
          </CardHeader>
          <CardContent>
            <CircuitBreakerStatus />
          </CardContent>
        </Card>

        {/* AI Auto Responses */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Settings className="h-4 w-4"/> AI Auto Responses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Status:</span>
                  {aiPaused ? (
                    <Badge className="bg-red-100 text-red-700 border-0">Paused</Badge>
                  ) : (
                    <Badge className="bg-emerald-100 text-emerald-700 border-0">Active</Badge>
                  )}
                </div>
                {aiPaused && (
                  <div className="mt-2 text-xs text-muted-foreground space-y-1">
                    {aiPausedReason ? <div><span className="font-medium">Reason:</span> {aiPausedReason}</div> : null}
                    <div>
                      <span className="font-medium">Paused</span>
                      {aiPausedByName ? <> by {aiPausedByName}</> : null}
                      {aiPausedAt ? <> at {new Date(aiPausedAt).toLocaleString()}</> : null}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {aiPaused ? (
                  <Button onClick={resumeAiResponses} disabled={aiPauseLoading}>
                    <PlayCircle className="h-4 w-4 mr-2" /> {aiPauseLoading ? 'Resuming...' : 'Resume AI Responses'}
                  </Button>
                ) : (
                  <Button variant="destructive" onClick={() => setShowAiPauseModal(true)} disabled={aiPauseLoading}>
                    <PauseCircle className="h-4 w-4 mr-2" /> Pause AI Responses
                  </Button>
                )}
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              When paused, AI will not auto reply across all channels until resumed.
            </div>
          </CardContent>
        </Card>

        {/* Utilities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Eraser className="h-4 w-4"/> Utilities</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={clearCaches}><Eraser className="h-4 w-4 mr-2"/> Clear Local Cache</Button>
          </CardContent>
        </Card>

        {/* Data Retention & GDPR Controls - Admin Only */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Data Retention Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">Data Retention Policy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Label className="text-sm font-medium">Retention Period (days)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={retentionDays ?? 90}
                  onChange={(e) => setEditRetentionDays(parseInt(e.target.value) || 90)}
                  className="max-w-xs"
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditRetentionDays(retentionDays ?? 90);
                    setShowRetentionModal(true);
                  }}
                >
                  Edit
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                Current: {retentionDays ?? 90} days. Chats older than this will be automatically deleted.
              </div>
              <Button onClick={triggerCleanup} disabled={cleanupLoading} className="w-full">
                {cleanupLoading ? 'Running Cleanup...' : 'Run Cleanup Now'}
              </Button>
              {cleanupResult && (
                <div className="text-xs text-muted-foreground">
                  Last cleanup: {cleanupResult.threads_deleted} threads, {cleanupResult.messages_deleted} messages, {cleanupResult.contacts_deleted} contacts
                </div>
              )}
            </CardContent>
          </Card>

          {/* GDPR Deletion */}
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-700">GDPR/PDPA Right to Erasure</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Label className="text-sm font-medium">Contact ID</Label>
              <Input
                placeholder="Enter contact UUID"
                value={gdprContactId}
                onChange={(e) => setGdprContactId(e.target.value)}
              />
              <div className="text-xs text-muted-foreground">
                Enter the contact ID (UUID) gotten from contact detail to delete all associated data permanently.
              </div>
              <PermissionGate permission={'contacts.delete'}>
                <Button variant="destructive" onClick={() => setShowGdprModal(true)} disabled={!gdprContactId.trim() || gdprLoading} className="w-full">
                  Delete User Data
                </Button>
              </PermissionGate>
              <div className="text-xs text-red-600">Warning: This action permanently deletes all data and cannot be undone.</div>
            </CardContent>
          </Card>
        </div>

        {/* Retention Settings Modal */}
        <Dialog open={showRetentionModal} onOpenChange={setShowRetentionModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Configure Data Retention</DialogTitle>
              <DialogDescription>Set how many days to retain chat data. Data older than this period will be automatically deleted.</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div>
                <Label htmlFor="retention-days">Retention Period (days)</Label>
                <Input
                  id="retention-days"
                  type="number"
                  value={editRetentionDays}
                  onChange={(e) => setEditRetentionDays(parseInt(e.target.value) || 90)}
                />
              </div>
              <div className="text-xs text-muted-foreground">
                Automatic cleanup runs daily at 2 AM UTC. You can also trigger manual cleanup from the main panel.
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRetentionModal(false)}>Cancel</Button>
              <Button onClick={saveRetentionDays} disabled={cleanupLoading}>
                {cleanupLoading ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Pause AI Confirmation Modal */}
        <Dialog open={showAiPauseModal} onOpenChange={setShowAiPauseModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Pause AI Auto Responses</DialogTitle>
              <DialogDescription>
                This will pause all AI auto replies across all platforms. You can resume anytime.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div>
                <Label htmlFor="pause-reason">Reason (optional)</Label>
                <Textarea
                  id="pause-reason"
                  placeholder="Enter a reason for pausing (visible to admins)"
                  value={aiPauseReasonInput}
                  onChange={(e) => setAiPauseReasonInput(e.target.value)}
                  className="min-h-[90px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAiPauseModal(false)} disabled={aiPauseLoading}>Cancel</Button>
              <Button variant="destructive" onClick={confirmPauseAiResponses} disabled={aiPauseLoading}>
                {aiPauseLoading ? 'Pausing...' : 'Confirm Pause'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* GDPR Deletion Confirmation Modal */}
        <Dialog open={showGdprModal} onOpenChange={setShowGdprModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Confirm GDPR Data Deletion</DialogTitle>
              <DialogDescription>
                This action will permanently delete all data associated with contact ID: <code className="bg-muted px-1 rounded">{gdprContactId}</code>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowGdprModal(false)}>Cancel</Button>
              <Button variant="destructive" onClick={executeGdprDeletion} disabled={gdprLoading}>
                {gdprLoading ? 'Deleting...' : 'Confirm Deletion'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Danger Zone */}
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700"><AlertTriangle className="h-4 w-4"/> Danger Zone</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Paste contact UUIDs (comma/newline separated) to delete permanently.</p>
              <Textarea value={deleteIds} onChange={(e)=>setDeleteIds(e.target.value)} placeholder="uuid-1, uuid-2, uuid-3" className="min-h-[120px]"/>
              <div className="mt-2 flex items-center justify-between">
                <div className="text-xs text-muted-foreground">Parsed: {idsParsed.length}</div>
                <PermissionGate permission={'contacts.delete'}>
                  <Button variant="destructive" onClick={confirmBulkDelete} disabled={deleting || idsParsed.length===0}>
                    <Trash2 className="h-4 w-4 mr-2"/> Delete {idsParsed.length || ''} Contact{idsParsed.length>1?'s':''}
                  </Button>
                </PermissionGate>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </RoleGate>
  );
}
