import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, Shield, Users, PlugZap, ClipboardList, BarChart2, Settings, Eraser, Trash2, ShieldCheck, Key } from "lucide-react";
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

  // Fetch retention settings
  const fetchRetentionSettings = async () => {
    try {
      const { data: settings, error } = await protectedSupabase
        .from('org_settings')
        .select('retention_days')
        .maybeSingle();
      if (error) throw error;
      setRetentionDays(settings?.retention_days ?? 90);
      setEditRetentionDays(settings?.retention_days ?? 90);
    } catch (error: any) {
      console.error('Failed to fetch retention settings:', error);
    }
  };

  // Save retention settings
  const saveRetentionDays = async () => {
    try {
      setCleanupLoading(true);
      const { error } = await protectedSupabase
        .from('org_settings')
        .update({
          retention_days: editRetentionDays,
        });
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
