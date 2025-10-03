import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Upload, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { useAIAgents } from "@/hooks/useAIAgents";
import { useHumanAgents } from "@/hooks/useHumanAgents";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import WEBHOOK_CONFIG from "@/config/webhook";

interface WhatsAppPlatformFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: any) => Promise<void>;
  isSubmitting?: boolean;
}

const WhatsAppPlatformForm = ({ isOpen, onClose, onSubmit, isSubmitting = false }: WhatsAppPlatformFormProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { aiAgents, loading: aiAgentsLoading, setFilterBySuper } = useAIAgents();
  const { agents: humanAgents, loading: humanAgentsLoading } = useHumanAgents();

  const [formData, setFormData] = useState({
    platformName: "",
    description: "",
    profilePhoto: null as File | null,
    phoneNumber: "",
    selectedAIAgent: "",
    selectedHumanAgents: [] as string[]
  });

  // WhatsApp QR connection state
  const [isWhatsAppConnected, setIsWhatsAppConnected] = useState(false);
  const [isFetchingQR, setIsFetchingQR] = useState(false);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [sessionName, setSessionName] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const isFetchingRef = useRef(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedSuperAgentId, setSelectedSuperAgentId] = useState<string | null>(null);

  // WAHA base URL
  const WAHA_BASE = 'https://waha-plus-production-97c1.up.railway.app';

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFormData(prev => ({ ...prev, profilePhoto: file }));
    }
  };

  const handleHumanAgentToggle = (agentId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedHumanAgents: prev.selectedHumanAgents.includes(agentId)
        ? prev.selectedHumanAgents.filter(id => id !== agentId)
        : [...prev.selectedHumanAgents, agentId]
    }));
  };

  const handleSuperAgentSelect = (userId: string) => {
    setSelectedSuperAgentId((prev) => (prev === userId ? userId : userId));
    // Reset human agents when changing super agent to avoid cross-super selections
    setFormData((prev) => ({ ...prev, selectedHumanAgents: [] }));
  };

  // Filter AI Agents by selected super agent
  useEffect(() => {
    try { setFilterBySuper(selectedSuperAgentId || null as any); } catch {}
  }, [selectedSuperAgentId]);

  const getUserOrgId = async () => {
    if (!user) return null;
    
    const { data: userOrgMember } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .single();
    
    return userOrgMember?.org_id || null;
  };

  const handleWhatsAppConnection = async (): Promise<{ qr: string; sessionName: string } | null> => {
    try {
      setIsFetchingQR(true);
      setQrError(null);
      setQrImageUrl(null);
      
      // 1) Create a WAHA session first to ensure an empty session exists
      const createSessionUrl = 'https://primary-production-376c.up.railway.app/webhook/create_session';
      const webhookUrlForWaha = 'https://primary-production-376c.up.railway.app/webhook/2f6f9767-c3cb-4af3-b749-a496eefc2b74/waha';
      const sName = (formData.platformName || 'default').replace(/\s/g, '');
      const sessionPayload = {
        name: sName,
        start: true,
        config: {
          metadata: {
            'user.id': user?.id || '',
            'user.email': user?.email || ''
          },
          proxy: null,
          debug: false,
          noweb: {
            store: { enabled: true, fullSync: false }
          },
          webhooks: [
            {
              url: webhookUrlForWaha,
              events: [
                'message',
                'session.status',
                'message.reaction',
                'message.any',
                'message.ack',
                'message.waiting',
                'message.revoked',
                'state.change',
                'group.join',
                'group.leave',
                'presence.update',
                'poll.vote',
                'poll.vote.failed',
                'chat.archive',
                'call.received',
                'call.accepted',
                'call.rejected',
                'label.upsert',
                'label.deleted',
                'label.chat.added',
                'label.chat.deleted',
                'engine.event'
              ],
              hmac: null,
              retries: null,
              customHeaders: null
            }
          ]
        }
      } as const;

      try {
        const createRes = await fetch(createSessionUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sessionPayload),
        });
        if (!createRes.ok) {
          // If session already exists, continue; otherwise surface error
          const text = await createRes.text();
          if (createRes.status !== 409) {
            throw new Error(`Create session failed (${createRes.status}): ${text || 'Unknown error'}`);
          }
        }
      } catch (e: any) {
        // Bubble up create-session errors
        throw e;
      }

      // 2) Fetch QR for login
      const response = await fetch(WEBHOOK_CONFIG.buildUrl(WEBHOOK_CONFIG.ENDPOINTS.WHATSAPP.GET_LOGIN_QR), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ session_name: sName }),
      });
      
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      
      // Check if response is an image
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('image/')) {
        // Response is an image, convert to data URL
        const blob = await response.blob();
        const dataUrl = URL.createObjectURL(blob);
        setQrImageUrl(dataUrl);
        setSessionName(sName);
        setIsFetchingQR(false);
        return { qr: dataUrl, sessionName: sName };
      } else {
        // Try to parse as JSON
        try {
          const json = await response.json();
          const payload = Array.isArray(json) ? json[0] : json;
          
          if (!payload || !payload.data || !payload.mimetype) {
            throw new Error("Invalid QR response shape");
          }
          
          const dataUrl = `data:${payload.mimetype};base64,${payload.data}`;
          setQrImageUrl(dataUrl);
          setSessionName(sName);
          setIsFetchingQR(false);
          return { qr: dataUrl, sessionName: sName };
        } catch (jsonError) {
          // If JSON parsing fails, try to get the response as text and check if it's base64
          const text = await response.text();
          if (text && text.length > 0) {
            // Assume it's a base64 encoded image
            const dataUrl = `data:image/png;base64,${text}`;
            setQrImageUrl(dataUrl);
            setSessionName(sName);
            setIsFetchingQR(false);
            return { qr: dataUrl, sessionName: sName };
          } else {
            throw new Error("Invalid response format");
          }
        }
      }
      
      setIsFetchingQR(false);
      return null;
    } catch (error: any) {
      setQrError(error?.message || "Failed to generate QR");
      setIsFetchingQR(false);
      return null;
    }
  };

  // Check WhatsApp session status via polling
  const checkSessionStatus = async () => {
    try {
      // Determine session name from Supabase channels table or from current state
      const resolveSessionName = async (): Promise<string> => {
        if (sessionName && sessionName.trim().length > 0) return sessionName;
        try {
          const orgId = await getUserOrgId();
          if (!orgId) return 'default';
          const { data: ch } = await supabase
            .from('channels')
            .select('display_name, provider')
            .eq('org_id', orgId)
            .eq('provider', 'whatsapp')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          const name = (ch?.display_name || '').replace(/\s/g, '') || 'default';
          return name;
        } catch {
          return 'default';
        }
      };

      const resolved = await resolveSessionName();
      const url = `${WAHA_BASE}/api/sessions/${encodeURIComponent(resolved)}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Check if session is connected and working
        if (data && data.status === 'WORKING' && data.me && data.me.id) {
          setIsWhatsAppConnected(true);
          setQrImageUrl(null); // Hide QR code when connected
          toast({
            title: "Success",
            description: "WhatsApp connected successfully!",
          });
          return true;
        } else {
          setIsWhatsAppConnected(false);
          return false;
        }
      }
      return false;
    } catch (error) {
      console.error("Error checking session status:", error);
      return false;
    }
  };

  // Poll session status every 5 seconds when QR is shown
  useEffect(() => {
    if (!qrImageUrl || isWhatsAppConnected) return;
    
    const pollInterval = setInterval(async () => {
      const isConnected = await checkSessionStatus();
      if (isConnected) {
        clearInterval(pollInterval);
      }
    }, 5000); // Poll every 5 seconds
    
    return () => clearInterval(pollInterval);
  }, [qrImageUrl, isWhatsAppConnected]);

  const hasRequiredFields = Boolean(formData.platformName && formData.selectedAIAgent && selectedSuperAgentId);

  const handleCancel = async () => {
    try {
      setIsCancelling(true);
    } finally {
      setIsCancelling(false);
      // Reset all local states so popup is clean next open
      setFormData({
        platformName: "",
        description: "",
        profilePhoto: null,
        phoneNumber: "",
        selectedAIAgent: "",
        selectedHumanAgents: []
      });
      setIsWhatsAppConnected(false);
      setIsFetchingQR(false);
      setQrImageUrl(null);
      setQrError(null);
      setSelectedSuperAgentId(null);
      onClose();
    }
  };

  const handleSubmit = async () => {
    try {
      setIsCreating(true);
      if (!selectedSuperAgentId || !formData.selectedAIAgent) {
        toast({ title: 'Missing required fields', description: 'Please select a Super Agent and an AI Agent.', variant: 'destructive' });
        setIsCreating(false);
        return;
      }
      // Get user's organization ID
      const orgId = await getUserOrgId();
      if (!orgId) {
        throw new Error('User not found in any organization');
      }

      // First, CREATE SESSION and fetch QR immediately (no connect button)
      const qrResult = await handleWhatsAppConnection();

      // Then submit to the main form handler
      const submitData = {
        ...formData,
        phoneNumber: undefined,
        platformType: 'whatsapp' as const,
        selectedSuperAgentId
      };

      await onSubmit(submitData);
      
      toast({ title: "Success", description: "Channel successfully created." });
      // Close form popup and show QR dialog in parent with latest QR data
      if (qrResult) {
        try {
          window.dispatchEvent(new CustomEvent('open-wa-qr', { detail: { sessionName: qrResult.sessionName, qr: qrResult.qr } }));
        } catch {}
      }
      try {
        window.dispatchEvent(new CustomEvent('refresh-platforms'));
      } catch {}
      onClose();
      // Reset after submit
      setFormData({
        platformName: "",
        description: "",
        profilePhoto: null,
        phoneNumber: "",
        selectedAIAgent: "",
        selectedHumanAgents: []
      });
      setSelectedSuperAgentId(null);
    } catch (error: any) {
      console.error('Error submitting form:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create WhatsApp platform",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Setup WhatsApp Platform</DialogTitle>
          <DialogDescription>
            Configure your new WhatsApp platform with all the necessary information.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Platform Name */}
          <div className="space-y-2">
            <Label htmlFor="platformName">Platform Name *</Label>
            <Input
              id="platformName"
              placeholder="Enter your platform or brand name"
              value={formData.platformName}
              onChange={(e) => setFormData(prev => ({ ...prev, platformName: e.target.value }))}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe your business and what you offer"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>

          {/* WhatsApp Number removed per requirements */}

          {/* Profile Photo / Logo */}
          <div className="space-y-2">
            <Label htmlFor="profilePhoto">Profile Photo / Logo</Label>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-muted-foreground/25">
                {formData.profilePhoto ? (
                  <img
                    src={URL.createObjectURL(formData.profilePhoto)}
                    alt="Profile"
                    className="h-16 w-16 rounded-full object-cover"
                  />
                ) : (
                  <Upload className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <Input
                  id="profilePhoto"
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button 
                  variant="outline"
                  className="text-blue-600 border-blue-200 hover:bg-blue-50"
                  onClick={() => document.getElementById('profilePhoto')?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Photo
                </Button>
                <p className="text-xs text-muted-foreground mt-1">
                  Recommended: 512x512px, max 2MB
                </p>
              </div>
            </div>
          </div>

          {/* Super Agent (single-select dropdown) placed before AI Agent */}
          <div className="space-y-1">
            <div className="text-xs font-medium text-emerald-700">Super Agent (1 max)</div>
            <Select value={selectedSuperAgentId || ''} onValueChange={(v)=>handleSuperAgentSelect(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a Super Agent" />
              </SelectTrigger>
              <SelectContent>
                {humanAgents.filter(a => a.primaryRole === 'super_agent').map(sa => (
                  <SelectItem key={sa.user_id} value={sa.user_id}>{sa.display_name || sa.email || sa.user_id.slice(0,8)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Select AI Agent (filtered by selected Super Agent) */}
          <div className="space-y-2">
            <Label htmlFor="aiAgent">Select AI Agent *</Label>
            {aiAgentsLoading ? (
              <div className="text-sm text-muted-foreground">Loading AI agents...</div>
            ) : (
              <Select 
                value={formData.selectedAIAgent} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, selectedAIAgent: value }))}
                disabled={!selectedSuperAgentId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedSuperAgentId ? "Choose an AI agent" : "Select a Super Agent first"} />
                </SelectTrigger>
                <SelectContent>
                  {aiAgents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Select Human Agents */}
          <div className="space-y-4">
            <Label>Assign Agents</Label>
            {humanAgentsLoading ? (
              <div className="text-sm text-muted-foreground">Loading human agents...</div>
            ) : (
              <>

                {/* Master Agents (display only for awareness) */}
                {/* <div className="space-y-1">
                  <div className="text-xs font-medium text-blue-700">Master Agents</div>
                  <div className="grid grid-cols-2 gap-2">
                    {humanAgents.filter(a => a.primaryRole === 'master_agent').map(ma => (
                      <div key={ma.user_id} className="text-xs text-muted-foreground">
                        {ma.display_name || ma.email || ma.user_id.slice(0,8)}
                      </div>
                    ))}
                  </div>
                </div> */}

                {/* Regular Agents under selected super agent (MultiSelect + Select All) */}
                <div className="space-y-2">
                  <div className="text-xs font-medium">Agents {selectedSuperAgentId ? '' : '(select a Super Agent first)'}</div>
                  {(() => {
                    const available = humanAgents
                      .filter(a => a.primaryRole === 'agent')
                      .filter(a => !!selectedSuperAgentId && (!a.super_agent_id || a.super_agent_id === selectedSuperAgentId));
                    const options = available.map(a => ({ value: a.user_id, label: a.display_name || a.email || `Agent ${a.user_id.slice(0,8)}` }));
                    return (
                      <div className="flex items-center gap-2">
                        <MultiSelect
                          options={options as any}
                          value={formData.selectedHumanAgents}
                          onValueChange={(vals)=>setFormData(prev=>({ ...prev, selectedHumanAgents: vals }))}
                          disabled={!selectedSuperAgentId}
                          placeholder={selectedSuperAgentId ? 'Select human agents' : 'Select a Super Agent first'}
                        />
                        <Button type="button" variant="outline" disabled={!selectedSuperAgentId || options.length===0} onClick={()=>setFormData(prev=>({ ...prev, selectedHumanAgents: options.map((o:any)=>o.value) }))}>Select All</Button>
                        <Button type="button" variant="ghost" disabled={!selectedSuperAgentId || formData.selectedHumanAgents.length===0} onClick={()=>setFormData(prev=>({ ...prev, selectedHumanAgents: [] }))}>Unselect All</Button>
                      </div>
                    );
                  })()}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handleCancel} disabled={isSubmitting || isCancelling} className="text-blue-700 border-blue-200 hover:bg-blue-50">
            {isCancelling ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cancelling...
              </>
            ) : (
              "Cancel"
            )}
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || isCreating || !hasRequiredFields}
            className="bg-blue-100 hover:bg-blue-200 text-blue-700 transition-all duration-200 hover:shadow-md active:scale-[.98]"
            aria-busy={isSubmitting || isCreating}
          >
            {isSubmitting || isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create WhatsApp Platform"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WhatsAppPlatformForm;
