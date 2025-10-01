import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Settings, Camera, HelpCircle, ExternalLink, Code, X, Upload, Trash2, MessageCircle, Globe, Send, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useRBAC } from "@/contexts/RBACContext";
import { MultiSelect, MultiSelectOption } from "@/components/ui/multi-select";

const ConnectedPlatforms = () => {
  const { toast } = useToast();
  const { platforms, loading: platformsLoading, error: platformsError, createPlatform, deletePlatform, uploadProfilePhoto, fetchPlatforms, updatePlatform } = usePlatforms();
  const { aiAgents, loading: aiAgentsLoading } = useAIAgents();
  const { agents: humanAgents, loading: humanAgentsLoading } = useHumanAgents();
  const { fetchByOrgId: fetchChannelsByOrg, channelsByOrg } = useChannels();
  const { hasRole } = useRBAC();
  
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [providerTab, setProviderTab] = useState<'whatsapp' | 'telegram' | 'web'>('whatsapp');
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [selectedHumanAgent, setSelectedHumanAgent] = useState<string>("");

  // Platform selection and setup state
  const [isPlatformSelectionOpen, setIsPlatformSelectionOpen] = useState(false);
  const [selectedPlatformType, setSelectedPlatformType] = useState<'whatsapp' | 'web' | 'telegram' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updatingAgents, setUpdatingAgents] = useState(false);
  const [pendingAgentIds, setPendingAgentIds] = useState<string[]>([]);
  const [savingPlatform, setSavingPlatform] = useState(false);



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

  const n8nBaseUrl = WEBHOOK_CONFIG.BASE_URL;

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
  const canEditSuperAgent = hasRole('master_agent');
  const availableAgentsToAdd = humanAgents.filter(a => a.primaryRole === 'agent' && !assignedHumanAgents.some(x => x.user_id === a.user_id));
  const multiSelectOptions: MultiSelectOption[] = availableAgentsToAdd.map(a => ({ value: a.user_id, label: a.display_name || a.email || a.user_id.slice(0,8) }));

  const renderPlatformDetails = (includeWebExtras: boolean) => (
    <>
      {/* AI Agent */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI Agent</CardTitle>
        </CardHeader>
        <CardContent>
          {aiAgentsLoading ? (
            <div className="text-sm text-muted-foreground">Loading AI agents...</div>
          ) : (
            <Select 
              value={selectedAgent || ""} 
              onValueChange={(value) => {
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
          <CardTitle className="text-base">Super Agent</CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            const superAgentId = (selectedPlatformData as any)?.super_agent_id || (selectedPlatformData as any)?.credentials?.super_agent_id || null;
            const allAgents = humanAgents || [];
            const superAgent = allAgents.find(a => a.user_id === superAgentId && a.primaryRole === 'super_agent') || null;
            const superAgentsOnly = allAgents.filter(a => a.primaryRole === 'super_agent');
            if (!canEditSuperAgent) {
              return (
                <div className="text-sm">
                  {superAgent ? (
                    <div className="inline-flex items-center gap-2 bg-muted px-3 py-1 rounded-md">👤 {superAgent.display_name || superAgent.email}</div>
                  ) : (
                    <span className="text-muted-foreground">No super agent assigned</span>
                  )}
                </div>
              );
            }
            return (
              <div className="flex items-center gap-2">
                <Select
                  value={superAgentId || ""}
                  onValueChange={async (val) => {
                    if (!selectedPlatformData) return;
                    await updatePlatform(selectedPlatformData.id, { super_agent_id: val || undefined });
                  }}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Assign super agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {superAgentsOnly.map(sa => (
                      <SelectItem key={sa.user_id} value={sa.user_id}>
                        👤 {sa.display_name || sa.email || sa.user_id.slice(0,8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">(master agent only)</span>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Human Agent */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Human Agent</CardTitle>
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chat Distribution Method */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Chat Distribution Method</CardTitle>
        </CardHeader>
        <CardContent>
          <Select defaultValue="least-assigned">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="least-assigned">Least Assigned First</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Customer Satisfaction Feature */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Customer Satisfaction Feature (CSAT) 
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Tingkatkan review kualitas live chat Anda melalui fitur agent
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Frequently Asked Questions (FAQ)</Label>
              <div className="mt-2 flex gap-2">
                <Input placeholder="0 Question" className="flex-1" />
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  ADD FAQ →
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">Social Link</Label>
              <div className="mt-2 flex gap-2">
                <Input placeholder="0 Social Link" className="flex-1" />
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  ADD LINK →
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User Info Requirement */}
      <Card>
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
      </Card>

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
                  value={`https://classy-frangollo-337599.netlify.app/livechat/${selectedPlatformData?.id || '{platform_id}'}`}
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
  var cfg=w.chatConfig||{}; cfg.baseUrl=cfg.baseUrl||'https://classy-frangollo-337599.netlify.app'; cfg.platformId=cfg.platformId||'${selectedPlatformData?.id || '{platform_id}'}';
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
      
      let profilePhotoUrl = "";
      if (formData.profilePhoto) {
        profilePhotoUrl = await uploadProfilePhoto(formData.profilePhoto);
      }

      const platformData: CreatePlatformData = {
        display_name: formData.displayName || formData.platformName || formData.brandName,
        website_url: formData.websiteUrl || undefined,
        business_category: formData.businessCategory || undefined,
        description: formData.description || undefined,
        profile_photo_url: profilePhotoUrl || undefined,
        ai_profile_id: formData.selectedAIAgent || undefined,
        provider: selectedPlatformType || 'web',
        human_agent_ids: formData.selectedHumanAgents
      };

      await createPlatform(platformData);
      
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



  // Fetch existing WhatsApp sessions
  const fetchWhatsAppSessions = async () => {
    setIsSessionsLoading(true);
    setSessionsError(null);
    try {
      let response = await fetch(WEBHOOK_CONFIG.buildUrl(WEBHOOK_CONFIG.ENDPOINTS.WHATSAPP.GET_SESSIONS), { method: "POST" });
      if (!response.ok) {
        // Fallback to POST if GET is not supported
        response = await fetch(WEBHOOK_CONFIG.buildUrl(WEBHOOK_CONFIG.ENDPOINTS.WHATSAPP.GET_SESSIONS), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
      }
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      const json = await response.json();
      const list: WahaSession[] = Array.isArray(json) ? json : [json];
      setSessions(list);
      // Sync sessions to channels table
      await syncSessionsToChannels(list);
      await fetchPlatforms();
    } catch (error: any) {
      setSessionsError(error?.message || "Failed to load sessions");
    } finally {
      setIsSessionsLoading(false);
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
        .select('id, display_name, provider')
        .eq('org_id', orgId)
        .eq('provider', 'whatsapp');

      for (const s of list) {
        const sessionName = s?.name || '';
        if (!sessionName) continue;
        const status = String(s?.status || '').toUpperCase();
        const meId = s?.me?.id || null;
        const isActive = status === 'WORKING' && Boolean(meId);
        const normalized = (sessionName || '').toLowerCase().replace(/\s/g, '');
        const match = (existingChannels || []).find(ch => (ch.display_name || '').toLowerCase().replace(/\s/g, '') === normalized);
        if (!match) {
          // If there's no matching channel created via UI (spaced name), skip insert to avoid duplicates
          continue;
        }
        await supabase
          .from('channels')
          .update({
            is_active: isActive,
            external_id: meId,
            credentials: { waha_status: s?.status || null, me_id: meId },
          })
          .eq('id', match.id);
      }
    } catch (e) {
      console.error('Failed to sync sessions to channels', e);
    }
  };

  // Load sessions for WhatsApp provider
  useEffect(() => {
    if (currentPlatformType === 'whatsapp') {
      fetchWhatsAppSessions();
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
          let response = await fetch(WEBHOOK_CONFIG.buildUrl(WEBHOOK_CONFIG.ENDPOINTS.WHATSAPP.GET_SESSIONS), { method: "POST" });
          if (!response.ok) {
            response = await fetch(WEBHOOK_CONFIG.buildUrl(WEBHOOK_CONFIG.ENDPOINTS.WHATSAPP.GET_SESSIONS), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({}),
            });
          }
          if (!response.ok) return;
          const json = await response.json();
          const list: WahaSession[] = Array.isArray(json) ? json : [json];
          const s = (list || []).find((x: any) => (x?.name || '') === lastConnectSessionName);
          const status = String(s?.status || '').toUpperCase();
          const connected = Boolean(s?.me?.id) && status === 'WORKING';
          if (connected) {
            // Close QR modal and mark active
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

  const logoutEndpoint = WEBHOOK_CONFIG.buildUrl(WEBHOOK_CONFIG.ENDPOINTS.WHATSAPP.LOGOUT_SESSION);
  const logoutWhatsAppSession = async (sessionName: string) => {
    if (!sessionName) return;
    setLoggingOutSessions((prev) => {
      const next = new Set(prev);
      next.add(sessionName);
      return next;
    });
    try {
      const response = await fetch(logoutEndpoint, {
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
      const endpoint = WEBHOOK_CONFIG.buildUrl(WEBHOOK_CONFIG.ENDPOINTS.WHATSAPP.DELETE_SESSION || "/delete_session");
      const res = await fetch(endpoint, {
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
      const res = await fetch(WEBHOOK_CONFIG.buildUrl(WEBHOOK_CONFIG.ENDPOINTS.WHATSAPP.GET_LOGIN_QR), {
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

  const disconnectWhatsAppSession = async (sessionName: string) => {
    if (!sessionName) return;
    setLoggingOutSessions((prev) => new Set(prev).add(sessionName));
    try {
      const endpoint = WEBHOOK_CONFIG.buildUrl(WEBHOOK_CONFIG.ENDPOINTS.WHATSAPP.DISCONNECT_SESSION || "/disconnect_session");
      const res = await fetch(endpoint, {
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
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            This is where you can connect all your platforms
          </p>
          <Tabs value={providerTab} onValueChange={(v)=>setProviderTab(v as any)} className="mb-3">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
              <TabsTrigger value="telegram">Telegram</TabsTrigger>
              <TabsTrigger value="web">Live Chat</TabsTrigger>
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
                    className={`cursor-pointer transition-colors hover:bg-accent ${
                      selectedPlatform === platform.id ? 'bg-accent border-primary' : ''
                    }`}
                    onClick={() => setSelectedPlatform(platform.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                          {platform.profile_photo_url ? (
                            <img
                              src={platform.profile_photo_url}
                              alt={platform.display_name || 'Platform'}
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-xs font-medium text-blue-600">
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
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full mt-4 text-blue-600 border-blue-200 hover:bg-blue-50">
                <Plus className="h-4 w-4 mr-2" />
                Add Channel
              </Button>
            </DialogTrigger>
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
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-muted rounded-lg flex items-center justify-center">
                <Camera className="h-6 w-6 text-muted-foreground" />
              </div>
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
                        // Call provider-specific webhook cleanup before deleting
                        const provider = getPlatformType(selectedPlatformData);
                        if (provider === 'telegram') {
                          const url = WEBHOOK_CONFIG.buildUrl(WEBHOOK_CONFIG.ENDPOINTS.TELEGRAM.DELETE_WEBHOOK);
                          await fetch(url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ channel_id: selectedPlatformData.id })
                          });
                        }
                        if (provider === 'whatsapp') {
                          const url = WEBHOOK_CONFIG.buildUrl(WEBHOOK_CONFIG.ENDPOINTS.WHATSAPP.DELETE_SESSION || '/delete_session');
                          const sessionName = (selectedPlatformData.display_name || '').replace(/\s/g, '');
                          await fetch(url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ session_name: sessionName })
                          });
                        }
                        await deletePlatform(selectedPlatformData.id);
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
            {selectedPlatformData && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Channel Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Provider</div>
                      <div className="capitalize">{getPlatformType(selectedPlatformData)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Status</div>
                      <div>{selectedPlatformData.status === 'active' ? 'Active' : 'Inactive'}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Display Name</div>
                      <div>{selectedPlatformData.display_name || '—'}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">AI Agent</div>
                      <div>{aiAgents.find(a => a.id === (selectedPlatformData as any)?.ai_profile_id)?.name || '—'}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Created At</div>
                      <div>{selectedPlatformData.created_at ? new Date(selectedPlatformData.created_at as any).toLocaleString() : '—'}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">External ID</div>
                      <div>{(selectedPlatformData as any)?.external_id || '—'}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Secret Token</div>
                      <div>{(() => { const t = (selectedPlatformData as any)?.secret_token as string | undefined; if (!t) return '—'; return t.length > 8 ? `${t.slice(0,4)}••••${t.slice(-2)}` : '••••'; })()}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Channel ID</div>
                      <div>{selectedPlatformData.id}</div>
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
                        {sessions.length === 0 && (
                          <div className="text-sm text-muted-foreground">No sessions found.</div>
                        )}
                        {sessions.map((s, idx) => {
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
                        })}
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
              <Card className="bg-red-50">
                <CardHeader>
                  <CardTitle className="text-base text-red-700">Danger Zone</CardTitle>
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
                            className="bg-red-600 hover:bg-red-700 text-white"
                            disabled={isDeletingChannel}
                            onClick={async () => {
                              if (!selectedPlatformData) return;
                              try {
                                setIsDeletingChannel(true);
                                const provider = getPlatformType(selectedPlatformData);
                                if (provider === 'whatsapp') {
                                  const url = WEBHOOK_CONFIG.buildUrl(WEBHOOK_CONFIG.ENDPOINTS.WHATSAPP.DELETE_SESSION || '/delete_session');
                                  const sessionName = (selectedPlatformData.display_name || '').replace(/\s/g, '');
                                  await fetch(url, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ session_name: sessionName })
                                  });
                                } else if (provider === 'telegram') {
                                  const url = WEBHOOK_CONFIG.buildUrl(WEBHOOK_CONFIG.ENDPOINTS.TELEGRAM.DELETE_WEBHOOK);
                                  await fetch(url, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ channel_id: selectedPlatformData.id })
                                  });
                                }
                                await deletePlatform(selectedPlatformData.id);
                                toast({ title: "Deleted", description: "Channel has been deleted." });
                                setSelectedPlatform(null);
                              } catch (e: any) {
                                toast({ title: "Error", description: e?.message || "Failed to delete channel", variant: "destructive" });
                              } finally {
                                setIsDeletingChannel(false);
                              }
                            }}
                          >
                            {isDeletingChannel ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
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