import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Plus, HelpCircle,  X, Upload, Trash2, MessageCircle, Globe, Send, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader as DangerHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
// Removed tabs; rendering is based on provider
import { usePlatforms, CreatePlatformData } from "@/hooks/usePlatforms";
import { supabase } from "@/lib/supabase";
import { useChannels } from "@/hooks/useChannels";
import { useAIAgents } from "@/hooks/useAIAgents";
import { useHumanAgents } from "@/hooks/useHumanAgents";
import { useToast } from "@/hooks/use-toast";
import WhatsAppPlatformForm from "./WhatsAppPlatformForm";
import TelegramPlatformForm from "./TelegramPlatformForm";
import WebPlatformForm from "./WebPlatformForm";
import WEBHOOK_CONFIG from "@/config/webhook";
import { callWebhook } from "@/lib/webhookClient";
import { useRBAC } from "@/contexts/RBACContext";
import PermissionGate from "@/components/rbac/PermissionGate";
import { MultiSelect, MultiSelectOption } from "@/components/ui/multi-select";
import { APP_ORIGIN, WAHA_BASE_URL, livechatUrl } from "@/config/urls";

const ConnectedPlatforms = () => {
  const { toast } = useToast();
  const { platforms, loading: platformsLoading, error: platformsError, createPlatform, fetchPlatforms, updatePlatform, uploadChannelAvatar, deleteChannelAvatar } = usePlatforms();
  const { aiAgents, loading: aiAgentsLoading } = useAIAgents();
  const { agents: humanAgents, loading: humanAgentsLoading } = useHumanAgents();
  const { fetchByOrgId: fetchChannelsByOrg, channelsByOrg } = useChannels();
  const { hasRole } = useRBAC();
  
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [providerTab, setProviderTab] = useState<'whatsapp' | 'telegram' | 'web'>('whatsapp');
  const [selectedAgent, setSelectedAgent] = useState<string>("");

  // Platform selection and setup state
  const [isPlatformSelectionOpen, setIsPlatformSelectionOpen] = useState(false);
  const [selectedPlatformType, setSelectedPlatformType] = useState<'whatsapp' | 'web' | 'telegram' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updatingAgents, setUpdatingAgents] = useState(false);
  const [pendingAgentIds, setPendingAgentIds] = useState<string[]>([]);
  const [savingPlatform, setSavingPlatform] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);



  // No tabs; view is determined by provider

  // Sessions state
  type WahaSession = {
    name?: string;
    status?: string;
    me?: {
      id?: string;
      pushName?: string;
    };
  };
  const [sessions, setSessions] = useState<WahaSession[]>([]);
  const [isSessionsLoading, setIsSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [loggingOutSessions, setLoggingOutSessions] = useState<Set<string>>(new Set());
  const [deletingSessions, setDeletingSessions] = useState<Set<string>>(new Set());
  const [connectingSession, setConnectingSession] = useState<string | null>(null);
  const [connectQR, setConnectQR] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [isConnectDialogOpen, setIsConnectDialogOpen] = useState(false);
  const [lastConnectSessionName, setLastConnectSessionName] = useState<string | null>(null);
  const pollConnectTimer = useRef<number | null>(null);
  const [isDeletingChannel, setIsDeletingChannel] = useState(false);

  const lastFetchedProviderRef = useRef<string | null>(null);
  const isFetchingSessionsRef = useRef<boolean>(false);
  const nextPlatformsRefreshAtRef = useRef<number>(0);

  // Get the first platform as default selected if available
  useEffect(() => {
    if (platforms.length > 0 && !selectedPlatform) {
      setSelectedPlatform(platforms[0].id);
    }
  }, [platforms, selectedPlatform]);

  // Set the first AI agent as default selected if available
  useEffect(() => {
    if (aiAgents.length > 0 && !selectedAgent) {
      setSelectedAgent(aiAgents[0].id);
    }
  }, [aiAgents, selectedAgent]);

  // Helper function to determine platform type
  const getPlatformType = (platform: any): 'whatsapp' | 'web' | 'telegram' => {
    const provider = platform?.provider;
    if (provider === 'whatsapp') return 'whatsapp';
    if (provider === 'telegram') return 'telegram';
    return 'web';
  };

  // Auto-select first platform within current tab
  useEffect(() => {
    const firstInTab = platforms.find(p => getPlatformType(p) === providerTab);
    if (!selectedPlatform || (selectedPlatform && platforms.find(p=>p.id===selectedPlatform && getPlatformType(p)!==providerTab))) {
      setSelectedPlatform(firstInTab?.id || null);
    }
  }, [platforms, providerTab]);

  // Get the selected platform data
  const selectedPlatformData = platforms.find(platform => platform.id === selectedPlatform);
  // Keep local AI agent selection in sync with the selected platform
  useEffect(() => {
    if (selectedPlatformData) {
      setSelectedAgent((selectedPlatformData as any)?.ai_profile_id || "");
    } else {
      setSelectedAgent("");
    }
  }, [selectedPlatformData?.id, (selectedPlatformData as any)?.ai_profile_id]);
  useEffect(() => {
    // Preload channels for each org once per change-set
    const uniqueOrgIds = Array.from(new Set(platforms.map(p => p.org_id)));
    if (uniqueOrgIds.length === 0) return;
    // Fire-and-forget but avoid tight loops by batching with a microtask
    Promise.resolve().then(() => {
      uniqueOrgIds.forEach(orgId => { fetchChannelsByOrg(orgId); });
    });
  }, [platforms]);

  // Listen for refresh-platforms event to refetch channels/platforms
  useEffect(() => {
    const handler = () => { fetchPlatforms(); };
    window.addEventListener('refresh-platforms' as any, handler);
    return () => window.removeEventListener('refresh-platforms' as any, handler);
  }, [fetchPlatforms]);
  const currentPlatformType = selectedPlatformData ? getPlatformType(selectedPlatformData) : null;
  const assignedHumanAgents = selectedPlatformData?.human_agents || [];
  const canEditAgents = hasRole('master_agent') || hasRole('super_agent');
  const availableAgentsToAdd = humanAgents.filter(a => a.primaryRole === 'agent' && !assignedHumanAgents.some(x => x.user_id === a.user_id));
  const multiSelectOptions: MultiSelectOption[] = availableAgentsToAdd.map(a => ({ value: a.user_id, label: a.display_name || a.email || a.user_id.slice(0,8) }));

  const renderPlatformDetails = (includeWebExtras: boolean) => (
    <>
      {/* AI Agent */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            AI Agent
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Agen AI yang akan menangani percakapan otomatis di platform ini</p>
              </TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {aiAgentsLoading ? (
            <div className="text-sm text-muted-foreground">Loading AI agents...</div>
          ) : (
            <Select 
              value={selectedAgent || ""} 
              onValueChange={async (value) => {
                if (!selectedPlatformData) return;
                await updatePlatform(selectedPlatformData.id, { ai_profile_id: value || undefined });
                setSelectedAgent(value);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose an AI agent" />
              </SelectTrigger>
              <SelectContent>
                {aiAgents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      🤖 {agent.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {/* Super Agent */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Super Agent
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Super Agent yang akan mengawasi dan mengelola platform ini (hanya master agent yang dapat mengatur)</p>
              </TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            const superAgentId = (selectedPlatformData as any)?.super_agent_id || null;
            const allAgents = humanAgents || [];
            const superAgent = allAgents.find(a => a.user_id === superAgentId && a.primaryRole === 'super_agent') || null;
            return (
              <div className="text-sm space-y-2">
                {superAgent ? (
                  <div className="inline-flex items-center gap-2 bg-muted px-3 py-1 rounded-md">
                    👤 {superAgent.display_name || superAgent.email || superAgent.user_id.slice(0, 8)}
                  </div>
                ) : (
                  <span className="text-muted-foreground">No super agent assigned. Select an AI agent to link a super agent.</span>
                )}
                <p className="text-xs text-muted-foreground">
                  Super agent assignment follows the selected AI agent. To change ownership, switch the AI agent for this platform.
                </p>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Human Agent */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Human Agent
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Agen manusia yang akan menangani percakapan yang memerlukan intervensi manual</p>
              </TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {humanAgentsLoading ? (
            <div className="text-sm text-muted-foreground">Loading human agents...</div>
          ) : assignedHumanAgents.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {assignedHumanAgents.map((agent) => (
                <div key={agent.user_id} className="flex items-center gap-2 bg-muted px-3 py-1 rounded-md">
                  <span className="text-sm">👤 {agent.display_name || agent.email || agent.user_id}</span>
                  {canEditAgents && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0"
                      disabled={updatingAgents || !selectedPlatformData}
                      onClick={async () => {
                        if (!selectedPlatformData) return;
                        try {
                          setUpdatingAgents(true);
                          const nextIds = assignedHumanAgents
                            .filter((a: any) => a.user_id !== agent.user_id)
                            .map((a: any) => a.user_id);
                          await updatePlatform(selectedPlatformData.id, { human_agent_ids: nextIds });
                        } finally {
                          setUpdatingAgents(false);
                        }
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No agents connected</p>
          )}

          {canEditAgents && selectedPlatformData && (
            <div className="mt-3 flex items-center gap-2">
              <MultiSelect options={multiSelectOptions} value={pendingAgentIds} onChange={setPendingAgentIds} placeholder="Select human agents to add" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <PermissionGate permission={'channel_agents.update'}>
                    <Button
                    variant="outline"
                    disabled={updatingAgents || pendingAgentIds.length === 0}
                    onClick={async () => {
                      if (!selectedPlatformData) return;
                      try {
                        setUpdatingAgents(true);
                        const currentIds = assignedHumanAgents.map((a: any) => a.user_id);
                        const nextIds = Array.from(new Set([...currentIds, ...pendingAgentIds]));
                        await updatePlatform(selectedPlatformData.id, { human_agent_ids: nextIds });
                        setPendingAgentIds([]);
                      } finally {
                        setUpdatingAgents(false);
                      }
                    }}
                  >
                    Add selected
                  </Button>
                  </PermissionGate>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Tambahkan agen manusia yang dipilih ke platform ini</p>
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Info Requirement */}
      {/* <Card>
        <CardHeader>
          <CardTitle className="text-base">User Info Requirement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <Switch id="user-info" />
            <Label htmlFor="user-info" className="text-sm">
              Disable
            </Label>
          </div>
        </CardContent>
      </Card> */}

      {includeWebExtras && (
        <>
          {/* Link LiveChat (project-hosted) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                Link LiveChat 
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-3 rounded-md">
                <Input
                  value={livechatUrl(String(selectedPlatformData?.id || "{platform_id}"))}
                  readOnly
                  className="bg-background"
                />
              </div>
            </CardContent>
          </Card>

          {/* Embed Code */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                Embed Code 
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={`<script>
(function(){
  // Lightweight chat embed - uses YOUR project's origin
  var w=window,d=document; if(w.chatWidgetLoaded) return; w.chatWidgetLoaded=true;
  var cfg=w.chatConfig||{}; cfg.baseUrl=cfg.baseUrl||'${APP_ORIGIN}'; cfg.platformId=cfg.platformId||'${selectedPlatformData?.id || '{platform_id}'}';
  cfg.position=cfg.position||'bottom-right'; cfg.width=cfg.width||'360px'; cfg.height=cfg.height||'560px';
  var css='#chat-bubble{position:fixed;right:20px;bottom:20px;z-index:999999;background:#1d4ed8;color:#fff;border-radius:9999px;width:56px;height:56px;box-shadow:0 8px 20px rgba(0,0,0,.2);border:0;cursor:pointer;font-size:24px;line-height:56px;text-align:center}'+
           '#chat-panel{position:fixed;right:20px;bottom:92px;width:'+cfg.width+';height:'+cfg.height+';max-width:calc(100% - 40px);max-height:70vh;z-index:999999;box-shadow:0 10px 30px rgba(0,0,0,.25);border-radius:12px;overflow:hidden;opacity:0;transform:translateY(10px);pointer-events:none;transition:opacity .2s ease,transform .2s ease;background:#fff}'+
           '#chat-panel.open{opacity:1;transform:translateY(0);pointer-events:auto}';
  var s=d.createElement('style'); s.type='text/css'; s.appendChild(d.createTextNode(css)); d.head.appendChild(s);
  var bubble=d.createElement('button'); bubble.id='chat-bubble'; bubble.setAttribute('aria-label','Open chat'); bubble.innerHTML='💬';
  var panel=d.createElement('div'); panel.id='chat-panel';
  var iframe=d.createElement('iframe'); iframe.src=cfg.baseUrl+'/livechat/'+encodeURIComponent(cfg.platformId); iframe.style.width='100%'; iframe.style.height='100%'; iframe.style.border='0'; panel.appendChild(iframe);
  bubble.addEventListener('click',function(){ panel.classList.toggle('open'); });
  d.body.appendChild(bubble); d.body.appendChild(panel);
})();
</script>`}
                readOnly
                className="font-mono text-xs h-48 bg-muted"
              />
            </CardContent>
          </Card>
        </>
      )}

      {/* Danger Zone moved out; rendered at bottom of page */}
    </>
  );

  const businessCategories = [
    "E-commerce",
    "Technology",
    "Healthcare",
    "Education",
    "Finance",
    "Real Estate",
    "Food & Beverage",
    "Travel & Tourism",
    "Entertainment",
    "Other"
  ];

  const handlePlatformSelect = (platformType: 'whatsapp' | 'web' | 'telegram') => {
    setSelectedPlatformType(platformType);
    setIsPlatformSelectionOpen(false);
  };



  const handlePlatformSetup = async (formData: any) => {
    try {
      setIsSubmitting(true);
      
      const platformData: CreatePlatformData = {
        display_name: formData.displayName || formData.platformName || formData.brandName,
        website_url: formData.websiteUrl || undefined,
        business_category: formData.businessCategory || undefined,
        description: formData.description || undefined,
        ai_profile_id: formData.selectedAIAgent || undefined,
        provider: selectedPlatformType || 'web',
        human_agent_ids: formData.selectedHumanAgents,
      };

      const created = await createPlatform(platformData);
      if (created && formData.profilePhoto) {
        try {
          await uploadChannelAvatar((created as any).id, formData.profilePhoto, (created as any).org_id);
        } catch (e: any) {
          toast({ title: 'Avatar upload failed', description: e?.message || 'Could not upload avatar', variant: 'destructive' });
        }
      }
      
      toast({
        title: "Success",
        description: "Platform created successfully!",
      });
      
      setSelectedPlatformType(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create platform",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };



  // Fetch existing WhatsApp sessions from WAHA API
  const fetchWhatsAppSessions = async () => {
    if (isFetchingSessionsRef.current) return;
    isFetchingSessionsRef.current = true;
    setIsSessionsLoading(true);
    setSessionsError(null);
    try {
      const url = `${WAHA_BASE_URL}/api/sessions`;
      const response = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
      if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
      const json = await response.json();
      const list: WahaSession[] = Array.isArray(json) ? json : [json];
      setSessions(list);
      await syncSessionsToChannels(list);
      // Avoid tight refresh loops: only refresh platforms at most once every 2s
      if (Date.now() >= nextPlatformsRefreshAtRef.current) {
        nextPlatformsRefreshAtRef.current = Date.now() + 2000;
        await fetchPlatforms();
      }
    } catch (error: any) {
      setSessionsError(error?.message || 'Failed to load sessions');
    } finally {
      setIsSessionsLoading(false);
      isFetchingSessionsRef.current = false;
    }
  };

  const syncSessionsToChannels = async (list: WahaSession[]) => {
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!user) return;
      const { data: userOrgs } = await supabase
        .from('org_members')
        .select('org_id')
        .eq('user_id', user.id)
        .limit(1);
      const orgId = userOrgs?.[0]?.org_id;
      if (!orgId) return;
      // Fetch all whatsapp channels once to avoid duplicates; use normalized name match
      const { data: existingChannels } = await supabase
        .from('channels')
        .select('id, display_name, provider, external_id, credentials')
        .eq('org_id', orgId)
        .eq('provider', 'whatsapp');

      for (const s of list) {
        const sessionName = s?.name || '';
        if (!sessionName) continue;
        const status = String(s?.status || '').toUpperCase();
        let meId = (s as any)?.me?.id || null;
        // Some WAHA deployments don't include `me` on the list endpoint; fall back to session detail.
        if (!meId && status === 'WORKING') {
          try {
            const detailUrl = `${WAHA_BASE_URL}/api/sessions/${encodeURIComponent(sessionName)}`;
            const detailRes = await fetch(detailUrl, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
            if (detailRes.ok) {
              const detailJson = await detailRes.json();
              const detail = Array.isArray(detailJson) ? detailJson[0] : detailJson;
              meId = detail?.me?.id || meId;
            }
          } catch {
            // ignore best-effort detail lookup
          }
        }
        const isActive = status === 'WORKING' && Boolean(meId);
        const normalized = (sessionName || '').toLowerCase().replace(/\s/g, '');
        const match = (existingChannels || []).find(ch => (ch.display_name || '').toLowerCase().replace(/\s/g, '') === normalized);
        if (!match) {
          // If there's no matching channel created via UI (spaced name), skip insert to avoid duplicates
          continue;
        }
        const existingCreds = (match as any)?.credentials && typeof (match as any).credentials === 'object'
          ? (match as any).credentials
          : {};
        const sessionFallback = sessionName || normalized || null;
        const nextExternalId = meId || (match as any)?.external_id || (existingCreds as any)?.waha_session_name || sessionFallback;

        await supabase
          .from('channels')
          .update({
            is_active: isActive,
            // Don't wipe external_id when the session isn't connected yet (meId is null).
            // Keep a stable identifier (session name) until we know the real WhatsApp number (me.id).
            external_id: nextExternalId,
            credentials: {
              ...existingCreds,
              waha_status: s?.status || null,
              me_id: meId,
              waha_session_name: (existingCreds as any)?.waha_session_name || sessionFallback,
            },
          })
          .eq('id', match.id);
      }
    } catch (e) {
      console.error('Failed to sync sessions to channels', e);
    }
  };

  // Load sessions for WhatsApp provider
  useEffect(() => {
    if (currentPlatformType === 'whatsapp' && lastFetchedProviderRef.current !== 'whatsapp') {
      lastFetchedProviderRef.current = 'whatsapp';
      fetchWhatsAppSessions();
    }
    if (currentPlatformType !== 'whatsapp') {
      lastFetchedProviderRef.current = currentPlatformType || null;
    }
  }, [currentPlatformType]);

  // Listen for open-wa-qr event from form to open QR dialog with fetched image
  useEffect(() => {
    const handler = (e: any) => {
      const d = e?.detail || {};
      setConnectQR(d.qr || null);
      if (d.sessionName) setLastConnectSessionName(d.sessionName);
      setIsConnectDialogOpen(true);
    };
    window.addEventListener('open-wa-qr' as any, handler);
    return () => window.removeEventListener('open-wa-qr' as any, handler);
  }, []);

  // While QR modal open, poll sessions to detect when it becomes connected
  useEffect(() => {
    const startPolling = () => {
      if (!lastConnectSessionName || !isConnectDialogOpen) return;
      const check = async () => {
        try {
          if (!lastConnectSessionName) return;
          const url = `${WAHA_BASE_URL}/api/sessions/${encodeURIComponent(lastConnectSessionName)}`;
          const response = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
          if (!response.ok) return;
          const s = await response.json();
          const status = String(s?.status || '').toUpperCase();
          const connected = Boolean(s?.me?.id) && status === 'WORKING';
          if (connected) {
            setIsConnectDialogOpen(false);
            setConnectQR(null);
            await fetchWhatsAppSessions();
            try { window.dispatchEvent(new CustomEvent('refresh-platforms')); } catch {}
            toast({ title: 'Connected', description: 'WhatsApp connected successfully.' });
          }
        } catch {}
      };
      // kick immediately then poll every 3s
      check();
      pollConnectTimer.current = window.setInterval(check, 3000) as unknown as number;
    };

    startPolling();
    return () => { if (pollConnectTimer.current) { clearInterval(pollConnectTimer.current); pollConnectTimer.current = null; } };
  }, [isConnectDialogOpen, lastConnectSessionName]);

  const logoutEndpoint = WEBHOOK_CONFIG.ENDPOINTS.WHATSAPP.LOGOUT_SESSION;
  const logoutWhatsAppSession = async (sessionName: string) => {
    if (!sessionName) return;
    setLoggingOutSessions((prev) => {
      const next = new Set(prev);
      next.add(sessionName);
      return next;
    });
    try {
      const response = await callWebhook(logoutEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session: sessionName }),
      });
      if (!response.ok) {
        throw new Error(`Logout failed with status ${response.status}`);
      }
      // Refresh sessions after successful logout
      await fetchWhatsAppSessions();
    } catch (error: any) {
      setSessionsError(error?.message || "Failed to logout session");
    } finally {
      setLoggingOutSessions((prev) => {
        const next = new Set(prev);
        next.delete(sessionName);
        return next;
      });
    }
  };

  const deleteWhatsAppSession = async (sessionName: string) => {
    if (!sessionName) return;
    setDeletingSessions((prev) => new Set(prev).add(sessionName));
    try {
      const res = await callWebhook(WEBHOOK_CONFIG.ENDPOINTS.WHATSAPP.DELETE_SESSION, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_name: sessionName }),
      });
      if (!res.ok) throw new Error(`Delete failed ${res.status}`);
      await fetchWhatsAppSessions();
      toast({ title: "Deleted", description: `Session ${sessionName} deleted` });
    } catch (e: any) {
      setSessionsError(e?.message || "Failed to delete session");
    } finally {
      setDeletingSessions((prev) => { const n = new Set(prev); n.delete(sessionName); return n; });
    }
  };

  const openConnectDialog = async (sessionName: string) => {
    setConnectingSession(sessionName);
    setConnectError(null);
    setConnectQR(null);
    setIsConnectDialogOpen(true);
    setLastConnectSessionName(sessionName);
    try {
      const res = await callWebhook(WEBHOOK_CONFIG.ENDPOINTS.WHATSAPP.GET_LOGIN_QR, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_name: sessionName }),
      });
      if (!res.ok) throw new Error(`QR request failed: ${res.status}`);
      const ct = res.headers.get('content-type');
      if (ct && ct.includes('image/')) {
        const blob = await res.blob();
        setConnectQR(URL.createObjectURL(blob));
      } else {
        try {
          const json = await res.json();
          const payload = Array.isArray(json) ? json[0] : json;
          if (!payload?.data || !payload?.mimetype) throw new Error('Invalid QR');
          setConnectQR(`data:${payload.mimetype};base64,${payload.data}`);
        } catch {
          const text = await res.text();
          if (text) setConnectQR(`data:image/png;base64,${text}`);
        }
      }
    } catch (e: any) {
      setConnectError(e?.message || 'Failed to get QR');
    } finally {
      setConnectingSession(null);
    }
  };

  // Centralized delete handler per provider
  const deleteChannelByProvider = async (channel: any) => {
    if (!channel) throw new Error('Missing channel');
    const provider = getPlatformType(channel);
    // Route per provider
    if (provider === 'telegram') {
      const res = await callWebhook(WEBHOOK_CONFIG.ENDPOINTS.TELEGRAM.DELETE_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_id: channel.id,
          org_id: channel.org_id,
          bot_token: (channel as any)?.external_id || null
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(detail || `Telegram delete failed (${res.status})`);
      }
      return;
    }
    if (provider === 'whatsapp') {
      // Normalize session name from display name (same rule used elsewhere)
      const sessionName = String(channel?.display_name || '').toLowerCase().replace(/\s/g, '');
      const res = await callWebhook(WEBHOOK_CONFIG.ENDPOINTS.WHATSAPP.DELETE_SESSION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Include channel id so backend workflows (n8n) can reliably clean up related resources.
          channel_id: channel.id,
          org_id: channel.org_id,
          session_name: sessionName,
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(detail || `WhatsApp delete failed (${res.status})`);
      }
      return;
    }
    // Web (and any other) - delete channel record directly
    const { error: delErr } = await supabase.from('channels').delete().eq('id', channel.id);
    if (delErr) throw delErr;
  };

  const disconnectWhatsAppSession = async (sessionName: string) => {
    if (!sessionName) return;
    setLoggingOutSessions((prev) => new Set(prev).add(sessionName));
    try {
      const res = await callWebhook(WEBHOOK_CONFIG.ENDPOINTS.WHATSAPP.DISCONNECT_SESSION, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_name: sessionName }),
      });
      if (!res.ok) throw new Error(`Disconnect failed ${res.status}`);
      // Poll sessions until status is not working
      const started = Date.now();
      while (Date.now() - started < 20000) {
        await fetchWhatsAppSessions();
        const s = sessions.find((x) => (x.name || "") === sessionName);
        const rawStatus = String(s?.status || "").toUpperCase();
        const hasNumber = Boolean(s?.me?.id);
        const isLoggedIn = rawStatus === "WORKING" && hasNumber;
        if (!isLoggedIn) break;
        await new Promise(r => setTimeout(r, 2000));
      }
      toast({ title: "Disconnected", description: `Session ${sessionName} disconnected` });
    } catch (e: any) {
      setSessionsError(e?.message || "Failed to disconnect session");
    } finally {
      setLoggingOutSessions((prev) => { const n = new Set(prev); n.delete(sessionName); return n; });
    }
  };

  return (
    <div className="flex h-[calc(100vh-120px)]">
      {/* Left Sidebar - Platforms List */}
      <div className="w-80 border-r border-border bg-card">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Platforms</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            This is where you can connect all your platforms
          </p>
          <Tabs value={providerTab} onValueChange={(v)=>setProviderTab(v as any)} className="mb-3">
            <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1">
              <TabsTrigger 
                value="whatsapp" 
                className="data-[state=active]:bg-white data-[state=active]:text-black data-[state=inactive]:text-muted-foreground data-[state=inactive]:bg-transparent data-[state=inactive]:hover:bg-muted/30"
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>WhatsApp</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Kelola koneksi WhatsApp Business</p>
                  </TooltipContent>
                </Tooltip>
              </TabsTrigger>
              <TabsTrigger 
                value="telegram"
                className="data-[state=active]:bg-white data-[state=active]:text-black data-[state=inactive]:text-muted-foreground data-[state=inactive]:bg-transparent data-[state=inactive]:hover:bg-muted/30"
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>Telegram</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Kelola koneksi Bot Telegram</p>
                  </TooltipContent>
                </Tooltip>
              </TabsTrigger>
              <TabsTrigger 
                value="web"
                className="data-[state=active]:bg-white data-[state=active]:text-black data-[state=inactive]:text-muted-foreground data-[state=inactive]:bg-transparent data-[state=inactive]:hover:bg-muted/30"
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>Live Chat</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Kelola koneksi widget Live Chat</p>
                  </TooltipContent>
                </Tooltip>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          {platformsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-muted"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-muted rounded w-1/2"></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : platformsError ? (
            <div className="text-sm text-red-600 p-4">{platformsError}</div>
          ) : (
            <div className="space-y-2">
              {platforms.filter(p=>getPlatformType(p)===providerTab).length === 0 ? (
                <div className="text-sm text-muted-foreground p-4 text-center">
                  No platforms found. Create your first platform to get started.
                </div>
              ) : (
                platforms.filter(p=>getPlatformType(p)===providerTab).map((platform) => (
                  <Card 
                    key={platform.id}
                    className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                      selectedPlatform === platform.id ? 'border-primary shadow-sm' : ''
                    }`}
                    onClick={() => setSelectedPlatform(platform.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                          {platform.profile_photo_url ? (
                            <img
                              src={platform.profile_photo_url}
                              alt={platform.display_name || 'Platform'}
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-xs font-medium text-foreground/70">
                              {(platform.display_name || '').charAt(0) || "?"}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm truncate">{platform.display_name || 'Unnamed Platform'}</h3>
                          <p className="text-[11px] text-muted-foreground capitalize">{getPlatformType(platform)}</p>
                          <p className="text-xs text-muted-foreground">{platform.description || platform.website_url || ''}</p>
                        </div>
                        <div
                          className={`h-2.5 w-2.5 rounded-full ${platform.status === 'active' ? 'bg-green-500' : 'bg-gray-300'}`}
                          aria-label={platform.status === 'active' ? 'Active' : 'Inactive'}
                          title={platform.status === 'active' ? 'Active' : 'Inactive'}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          <Dialog open={isPlatformSelectionOpen} onOpenChange={setIsPlatformSelectionOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Channel
                  </Button>
                </DialogTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>Tambahkan saluran atau platform baru</p>
              </TooltipContent>
            </Tooltip>
            <DialogContent className="sm:max-w-xl p-0 overflow-hidden">
              <DialogHeader className="p-6 pb-4">
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-lg font-semibold">Platform</DialogTitle>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Select the platform you wish to establish your new inbox.
                </p>
              </DialogHeader>

                             <div className="px-6 pb-6">
                 <div className="grid grid-cols-3 gap-3 mb-4">
                   <button
                     onClick={() => handlePlatformSelect('whatsapp')}
                     className="flex flex-col items-center p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-accent/50 transition-all duration-200 group"
                   >
                     <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-200">
                       <MessageCircle className="h-6 w-6 text-white" />
                     </div>
                     <span className="text-sm font-medium text-center">WhatsApp</span>
                     <span className="text-xs text-muted-foreground text-center mt-1">
                       Connect your WhatsApp Business account
                     </span>
                   </button>
                   <button
                     onClick={() => handlePlatformSelect('web')}
                     className="flex flex-col items-center p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-accent/50 transition-all duration-200 group"
                   >
                     <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-200">
                       <Globe className="h-6 w-6 text-white" />
                     </div>
                     <span className="text-sm font-medium text-center">Web Live Chat</span>
                     <span className="text-xs text-muted-foreground text-center mt-1">
                       Add live chat to your website
                     </span>
                   </button>
                   <button
                     onClick={() => handlePlatformSelect('telegram')}
                     className="flex flex-col items-center p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-accent/50 transition-all duration-200 group"
                   >
                     <div className="w-12 h-12 rounded-full bg-blue-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-200">
                       <Send className="h-6 w-6 text-white" />
                     </div>
                     <span className="text-sm font-medium text-center">Telegram Bot</span>
                     <span className="text-xs text-muted-foreground text-center mt-1">
                       Connect your Telegram bot via BotFather
                     </span>
                   </button>
                 </div>

                <div className="text-center">
                  <p className="text-xs text-muted-foreground">
                    More platforms coming soon
                  </p>
                </div>
              </div>
            </DialogContent>
          </Dialog>

                               {/* Platform Forms */}
          <WhatsAppPlatformForm
            isOpen={selectedPlatformType === 'whatsapp'}
            onClose={() => setSelectedPlatformType(null)}
            onSubmit={handlePlatformSetup}
            isSubmitting={isSubmitting}
          />
          
          <TelegramPlatformForm
            isOpen={selectedPlatformType === 'telegram'}
            onClose={() => setSelectedPlatformType(null)}
            onSubmit={handlePlatformSetup}
            isSubmitting={isSubmitting}
          />
          
          <WebPlatformForm
            isOpen={selectedPlatformType === 'web'}
            onClose={() => setSelectedPlatformType(null)}
            onSubmit={handlePlatformSetup}
            isSubmitting={isSubmitting}
          />

          <p className="text-xs text-muted-foreground mt-2 text-center">
            Add a new platform inbox
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-4xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">
                {selectedPlatformData?.display_name
                  ? selectedPlatformData.display_name.toUpperCase()
                  : 'Select Platform'}
              </h1>
              <p className="text-muted-foreground">
                {selectedPlatformData ? (selectedPlatformData.description || selectedPlatformData.website_url || '') : 'Choose a platform to manage'}
              </p>
            </div>
            <div className="flex gap-2">
              {selectedPlatformData && (
                <>
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={savingPlatform || !selectedAgent || selectedAgent === (selectedPlatformData as any)?.ai_profile_id}
                    onClick={async () => {
                      if (!selectedPlatformData) return;
                      try {
                        setSavingPlatform(true);
                        const updates: Record<string, any> = {};
                        if (selectedAgent && selectedAgent !== (selectedPlatformData as any)?.ai_profile_id) {
                          updates.ai_profile_id = selectedAgent;
                        }
                        if (Object.keys(updates).length === 0) {
                          toast({ title: 'No changes', description: 'There are no changes to save.' });
                          return;
                        }
                        await updatePlatform(selectedPlatformData.id, updates);
                        toast({ title: 'Saved', description: 'Platform settings updated.' });
                        try { window.dispatchEvent(new CustomEvent('refresh-platforms')); } catch {}
                        await fetchPlatforms();
                      } catch (e: any) {
                        toast({ title: 'Error', description: e?.message || 'Failed to save platform', variant: 'destructive' });
                      } finally {
                        setSavingPlatform(false);
                      }
                    }}
                  >
                    {savingPlatform ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={isDeletingChannel}
                    onClick={async () => {
                      if (!selectedPlatformData) return;
                      try {
                        setIsDeletingChannel(true);
                        await deleteChannelByProvider(selectedPlatformData);
                        toast({ title: 'Deleted', description: 'Channel has been deleted.' });
                        setSelectedPlatform(null);
                        await fetchPlatforms();
                      } catch (e: any) {
                        toast({ title: 'Error', description: e?.message || 'Failed to delete channel', variant: 'destructive' });
                      } finally {
                        setIsDeletingChannel(false);
                      }
                    }}
                  >
                    {isDeletingChannel ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="grid gap-6">
            {!selectedPlatformData ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <MessageCircle className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No Platform Selected</h3>
                <p className="text-muted-foreground mb-6 max-w-md">
                  Select a platform from the left panel to view its details, manage settings, and configure agents.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl">
                  <div className="p-4 border rounded-lg text-center">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <MessageCircle className="w-4 h-4 text-blue-600" />
                    </div>
                    <h4 className="font-medium mb-1">WhatsApp</h4>
                    <p className="text-sm text-muted-foreground">Connect your WhatsApp business account</p>
                  </div>
                  <div className="p-4 border rounded-lg text-center">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <Send className="w-4 h-4 text-blue-600" />
                    </div>
                    <h4 className="font-medium mb-1">Telegram</h4>
                    <p className="text-sm text-muted-foreground">Set up a Telegram bot for customer support</p>
                  </div>
                  <div className="p-4 border rounded-lg text-center">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <Globe className="w-4 h-4 text-blue-600" />
                    </div>
                    <h4 className="font-medium mb-1">Live Chat</h4>
                    <p className="text-sm text-muted-foreground">Embed chat widget on your website</p>
                  </div>
                </div>
              </div>
            ) : selectedPlatformData && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Channel Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        Provider
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Jenis platform komunikasi yang digunakan (WhatsApp, Telegram, Live Chat)</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="capitalize">{getPlatformType(selectedPlatformData)}</div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        Status
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Status koneksi platform saat ini (Aktif atau Tidak Aktif)</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div>{selectedPlatformData.status === 'active' ? 'Active' : 'Inactive'}</div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        Display Name
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Nama yang ditampilkan untuk platform ini</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div>{selectedPlatformData.display_name || '—'}</div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        AI Agent
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Agen AI yang ditugaskan untuk menangani percakapan di platform ini</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div>{aiAgents.find(a => a.id === (selectedPlatformData as any)?.ai_profile_id)?.name || '—'}</div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        Created At
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Tanggal dan waktu platform ini dibuat</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div>{selectedPlatformData.created_at ? new Date(selectedPlatformData.created_at as any).toLocaleString() : '—'}</div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        Secret Token
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Token rahasia untuk autentikasi dan keamanan platform</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div>{(() => { const t = (selectedPlatformData as any)?.secret_token as string | undefined; if (!t) return '—'; return t.length > 8 ? `${t.slice(0,4)}••••${t.slice(-2)}` : '••••'; })()}</div>
                    </div>
                  </div>
                  {/* Channel Profile block inside details with border */}
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center gap-2 text-sm font-medium mb-3">
                      Channel Profile
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Kelola foto profil atau logo untuk platform ini</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                        {selectedPlatformData?.profile_photo_url ? (
                          <img src={(selectedPlatformData as any)?.profile_photo_url || ''} alt="Avatar" className="h-12 w-12 object-cover" />
                        ) : (
                          <span className="text-xs text-foreground/70">{(selectedPlatformData?.display_name || '?').charAt(0)}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={!selectedPlatformData || uploadingAvatar || removingAvatar}>
                              {uploadingAvatar ? (
                                <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Uploading...</span>
                              ) : (
                                <span className="inline-flex items-center gap-2"><Upload className="h-4 w-4" /> Upload Avatar</span>
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Unggah foto profil atau logo untuk platform ini</p>
                          </TooltipContent>
                        </Tooltip>
                        {/* Hidden file input for avatar upload */}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.currentTarget.files?.[0];
                            if (!file || !selectedPlatformData) return;
                            try {
                              setUploadingAvatar(true);
                              await uploadChannelAvatar(selectedPlatformData.id, file, selectedPlatformData.org_id);
                              toast({ title: 'Avatar updated' });
                              await fetchPlatforms();
                            } catch (err: any) {
                              toast({ title: 'Avatar upload failed', description: err?.message || 'Please try again', variant: 'destructive' });
                            } finally {
                              setUploadingAvatar(false);
                              // reset input so the same file can be selected again if needed
                              try { (e.currentTarget as HTMLInputElement).value = ''; } catch {}
                            }
                          }}
                        />
                        {!!((selectedPlatformData as any)?.logo_url || (selectedPlatformData as any)?.profile_photo_url) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            disabled={!selectedPlatformData || uploadingAvatar || removingAvatar}
                            onClick={async()=>{
                              if (!selectedPlatformData) return;
                              try {
                                setRemovingAvatar(true);
                                await deleteChannelAvatar(selectedPlatformData.id, selectedPlatformData.org_id);
                                await fetchPlatforms();
                                toast({ title: 'Avatar removed' });
                              } catch (e:any) {
                                toast({ title: 'Failed to remove avatar', description: e?.message || 'Please try again', variant: 'destructive' });
                              } finally {
                                setRemovingAvatar(false);
                              }
                            }}
                          >
                            {removingAvatar ? (
                              <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Removing...</span>
                            ) : (
                              <span className="inline-flex items-center gap-2"><Trash2 className="h-4 w-4" /> Remove</span>
                            )}
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-2 text-xs text-muted-foreground">
                        Accepted: PNG, JPG, WEBP • Max 5 MB
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Format file yang didukung: PNG, JPG, WEBP dengan ukuran maksimal 5 MB</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {currentPlatformType === 'web' && (
              <div className="grid gap-6">
                {renderPlatformDetails(true)}
              </div>
            )}

            {currentPlatformType === 'whatsapp' && (
              <div className="grid gap-6">
                {renderPlatformDetails(false)}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">WhatsApp Sessions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isSessionsLoading && (
                      <div className="text-sm text-muted-foreground">Loading sessions...</div>
                    )}
                    {sessionsError && (
                      <div className="text-sm text-red-600">{sessionsError}</div>
                    )}
                    {!isSessionsLoading && !sessionsError && (
                      <div className="space-y-3">
                        {(() => {
                          const normalized = (selectedPlatformData?.display_name || '').toLowerCase().replace(/\s/g, '');
                          const filtered = sessions.filter(ss => ((ss?.name || '').toLowerCase().replace(/\s/g, '')) === normalized);
                          if (filtered.length === 0) {
                            return <div className="text-sm text-muted-foreground">No session found for this channel.</div>;
                          }
                          return filtered.map((s, idx) => {
                          const rawId = s?.me?.id || "";
                          const phone = rawId ? rawId.replace(/@c\.us$/, "") : "";
                          const name = s?.me?.pushName || "-";
                          const status: string = String(s?.status || "UNKNOWN").toUpperCase();
                          const sessionName = s?.name || "";
                          const isBusy = loggingOutSessions.has(sessionName) || deletingSessions.has(sessionName) || connectingSession === sessionName;
                          const hasNumber = Boolean(phone);
                          const isScanQr = status === "SCAN_QR_CODE";
                          const isLoggedIn = status === "WORKING" && hasNumber;
                          return (
                            <div key={idx} className="flex items-center justify-between rounded-md border p-3">
                              <div>
                                <div className="text-sm font-medium">{name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {isScanQr || !hasNumber ? "Not connected" : phone}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {!isLoggedIn ? (
                                  <Button
                                    variant="outline"
                                    className="text-blue-600 border-blue-200 hover:bg-blue-50"
                                    size="sm"
                                    disabled={isBusy}
                                    onClick={() => openConnectDialog(sessionName)}
                                  >
                                    {connectingSession === sessionName ? <Loader2 className="h-3 w-3 animate-spin" /> : "Connect"}
                                  </Button>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-amber-700 border-amber-200 hover:bg-amber-50"
                                    disabled={isBusy}
                                    onClick={() => disconnectWhatsAppSession(sessionName)}
                                  >
                                    {loggingOutSessions.has(sessionName) ? <Loader2 className="h-3 w-3 animate-spin" /> : "Disconnect"}
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                          });
                        })()}
                      </div>
                    )}
                  </CardContent>
                </Card>
                <Dialog open={isConnectDialogOpen} onOpenChange={setIsConnectDialogOpen}>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Connect WhatsApp</DialogTitle>
                      <DialogDescription>
                        Scan this QR with your WhatsApp app to connect.
                      </DialogDescription>
                    </DialogHeader>
                    {connectError && (
                      <div className="text-sm text-red-600">{connectError}</div>
                    )}
                    {connectQR ? (
                      <div className="flex flex-col items-center gap-3">
                        <img src={connectQR} alt="QR" className="w-56 h-56 rounded border" />
                        <Button
                          variant="outline"
                          onClick={() => openConnectDialog(lastConnectSessionName || (selectedPlatformData?.display_name || '').replace(/\s/g, ''))}
                          disabled={Boolean(connectingSession)}
                          className="text-blue-600 border-blue-200 hover:bg-blue-50"
                        >
                          {connectingSession ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh QR'}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-60">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              </div>
            )}

            {currentPlatformType === 'telegram' && (
              <div className="grid gap-6">
                {renderPlatformDetails(false)}
              </div>
            )}
          </div>

          {/* Danger Zone - always at bottom */}
          {selectedPlatformData && (
            <div className="mt-8">
              <Card className="bg-red-50 border-2 border-red-200">
                <CardHeader>
                  <CardTitle className="text-base text-red-700 flex items-center gap-2">
                    Danger Zone
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-red-600 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Zona berbahaya untuk tindakan yang tidak dapat dibatalkan seperti menghapus platform</p>
                      </TooltipContent>
                    </Tooltip>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-red-700">Delete this channel</div>
                      <div className="text-xs text-red-600/80">This action cannot be undone.</div>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button className="bg-red-600 hover:bg-red-700 text-white">Delete Channel</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <DangerHeader>
                          <AlertDialogTitle>Delete channel?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete {selectedPlatformData?.display_name || 'this channel'}. This action cannot be undone.
                          </AlertDialogDescription>
                        </DangerHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className={`bg-red-600 hover:bg-red-700 text-white ${isDeletingChannel ? 'animate-pulse cursor-wait' : ''}`}
                            aria-busy={isDeletingChannel}
                            disabled={isDeletingChannel}
                            onClick={async () => {
                              if (!selectedPlatformData) return;
                              try {
                                setIsDeletingChannel(true);
                                await deleteChannelByProvider(selectedPlatformData);
                                toast({ title: "Deleted", description: "Channel has been deleted." });
                                setSelectedPlatform(null);
                                await fetchPlatforms();
                              } catch (e: any) {
                                toast({ title: "Error", description: e?.message || "Failed to delete channel", variant: "destructive" });
                              } finally {
                                setIsDeletingChannel(false);
                              }
                            }}
                          >
                            {isDeletingChannel ? (
                              <span className="inline-flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Deleting…</span>
                              </span>
                            ) : 'Delete'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConnectedPlatforms;