import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload, HelpCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { useAIAgents } from "@/hooks/useAIAgents";
import { useHumanAgents } from "@/hooks/useHumanAgents";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useRBAC } from "@/contexts/RBACContext";
import { supabase } from "@/lib/supabase";
import WEBHOOK_CONFIG from "@/config/webhook";
import { callWebhook } from "@/lib/webhookClient";
import { usePlatforms } from "@/hooks/usePlatforms";

interface TelegramPlatformFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: any) => Promise<void>;
  isSubmitting?: boolean;
}

const TelegramPlatformForm = ({ isOpen, onClose, onSubmit, isSubmitting = false }: TelegramPlatformFormProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { hasPermission } = useRBAC();
  const { aiAgents, loading: aiAgentsLoading } = useAIAgents();
  const { agents: humanAgents, loading: humanAgentsLoading } = useHumanAgents();
  const { uploadChannelAvatar } = usePlatforms();

  const [formData, setFormData] = useState({
    displayName: "",
    description: "",
    telegramBotToken: "",
    selectedAIAgent: "",
    selectedHumanAgents: [] as string[],
    profilePhoto: null as File | null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [selectedSuperAgentId, setSelectedSuperAgentId] = useState<string | null>(null);

  // Permission-based gating: user must have channels.create
  const canCreateChannel = hasPermission('channels.create');

  const resolveSuperAgentForAI = (aiProfileId: string): string | null => {
    if (!aiProfileId) return null;
    const agent = aiAgents.find((ai) => ai.id === aiProfileId);
    return agent?.super_agent_id || null;
  };

  const selectedSuperAgent = useMemo(() => {
    if (!selectedSuperAgentId) return null;
    return humanAgents.find((a) => a.primaryRole === 'super_agent' && a.user_id === selectedSuperAgentId) || null;
  }, [selectedSuperAgentId, humanAgents]);


  const handleHumanAgentToggle = (agentId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedHumanAgents: prev.selectedHumanAgents.includes(agentId)
        ? prev.selectedHumanAgents.filter(id => id !== agentId)
        : [...prev.selectedHumanAgents, agentId]
    }));
  };

  const isFormValid = formData.displayName && 
    formData.selectedAIAgent &&
    formData.telegramBotToken &&
    selectedSuperAgentId &&
    canCreateChannel;

  const getUserOrgId = async () => {
    if (!user) return null;
    
    const { data: userOrgMember } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .single();
    
    return userOrgMember?.org_id || null;
  };

  const handleSubmit = async () => {
    try {
      if (submitting) return;
      setSubmitting(true);
      if (!canCreateChannel) {
        toast({ title: 'Permission denied', description: 'You do not have permission to create channels.', variant: 'destructive' });
        setSubmitting(false);
        return;
      }
      if (!selectedSuperAgentId || !formData.selectedAIAgent) {
        toast({ title: 'Missing required fields', description: 'Please select a Super Agent and an AI Agent.', variant: 'destructive' });
        setSubmitting(false);
        return;
      }
      // Get user's organization ID
      const orgId = await getUserOrgId();
      if (!orgId) {
        throw new Error('User not found in any organization');
      }

      // Pre-check: prevent duplicate Telegram bot token across existing channels
      const normalizedToken = (formData.telegramBotToken || '').trim();
      if (!normalizedToken) {
        throw new Error('Telegram bot token is required');
      }
      try {
        const { data: existing } = await supabase
          .from('channels')
          .select('id')
          .eq('provider', 'telegram')
          .eq('external_id', normalizedToken)
          .limit(1);
        if (Array.isArray(existing) && existing.length > 0) {
          toast({
            title: "Duplicate token",
            description: "A Telegram bot with this BotFather token already exists.",
            variant: "destructive",
          });
          setSubmitting(false);
          return;
        }
      } catch (_) {
        // If the check fails due to RLS/permissions, proceed; server/webhook should still validate.
      }

      // First, send to Telegram webhook
      const telegramWebhookData = {
        brand_name: formData.displayName,
        display_name: formData.displayName,
        description: formData.description,
        telegram_bot_token: formData.telegramBotToken,
        ai_profile_id: formData.selectedAIAgent,
        human_agent_ids: formData.selectedHumanAgents,
        super_agent_id: selectedSuperAgentId,
        org_id: orgId,
        platform_type: 'telegram'
      };

      const webhookResponse = await callWebhook(WEBHOOK_CONFIG.ENDPOINTS.TELEGRAM.CREATE_PLATFORM, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(telegramWebhookData),
      });

      if (!webhookResponse.ok) {
        throw new Error(`Telegram webhook failed with status ${webhookResponse.status}`);
      }

      // Safely read response body (webhook may return empty or non-JSON)
      let webhookResult: any = null;
      try {
        const ct = webhookResponse.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          webhookResult = await webhookResponse.json();
        } else {
          const text = await webhookResponse.text();
          try { webhookResult = text ? JSON.parse(text) : null; } catch { webhookResult = { raw: text || null }; }
        }
      } catch {
        // ignore body parsing errors
        webhookResult = null;
      }
      

      // Upload avatar only after webhook success and channel exists
      try {
        if (formData.profilePhoto) {
          // Try to get channel_id from webhook response first
          let channelId: string | null = (webhookResult?.channel_id || webhookResult?.id || webhookResult?.channel?.id || null) as string | null;
          if (!channelId) {
            // Fallback: query by org_id + provider + external_id (bot token)
            const { data: chRow } = await supabase
              .from('channels')
              .select('id')
              .eq('org_id', orgId)
              .eq('provider', 'telegram')
              .eq('external_id', normalizedToken)
              .limit(1)
              .maybeSingle();
            channelId = (chRow as any)?.id || null;
          }
          if (channelId) {
            await uploadChannelAvatar(channelId, formData.profilePhoto, orgId);
          }
        }
      } catch (uploadErr: any) {
        console.warn('Telegram avatar upload failed:', uploadErr);
      }

      toast({ title: "Success", description: "Telegram channel created successfully" });
      try {
        window.dispatchEvent(new CustomEvent('refresh-platforms'));
      } catch {}
      onClose();
      // Reset after submit
      setFormData({
        displayName: "",
        description: "",
        telegramBotToken: "",
        selectedAIAgent: "",
        selectedHumanAgents: [],
        profilePhoto: null,
      });
      setSelectedSuperAgentId(null);
    } catch (error: any) {
      console.error('Error submitting form:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create Telegram platform",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" style={{ overflowX: 'visible', overflowY: 'auto' }}>
        <div>
          <DialogHeader>
            <DialogTitle>Setup Telegram Bot Platform</DialogTitle>
            <DialogDescription>
              Configure your new Telegram bot platform with all the necessary information.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
          {/* Display Name */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="displayName">Display Name *</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent 
                  className="z-[9999] max-w-xs" 
                  side="top" 
                  align="start" 
                  sideOffset={5} 
                  avoidCollisions={true} 
                  collisionPadding={20}
                  sticky="always"
                >
                  <p>Nama yang akan ditampilkan di widget chat Telegram</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              id="displayName"
              placeholder="Enter the display name"
              value={formData.displayName}
              onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="description">Description</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent 
                  className="z-[9999] max-w-xs" 
                  side="top" 
                  align="start" 
                  sideOffset={5} 
                  avoidCollisions={true} 
                  collisionPadding={20}
                  sticky="always"
                >
                  <p>Deskripsi bisnis dan layanan yang akan ditampilkan kepada pelanggan</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Textarea
              id="description"
              placeholder="Describe your business and what you offer"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>

          {/* Profile Photo / Logo */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="profilePhoto">Profile Photo / Logo</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent 
                  className="z-[9999] max-w-xs" 
                  side="top" 
                  align="start" 
                  sideOffset={5} 
                  avoidCollisions={true} 
                  collisionPadding={20}
                  sticky="always"
                >
                  <p>Foto profil atau logo yang akan ditampilkan di bot Telegram</p>
                </TooltipContent>
              </Tooltip>
            </div>
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
                  onChange={(e)=>{ const f = e.target.files?.[0] || null; setFormData(prev=>({ ...prev, profilePhoto: f })); }}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={()=>document.getElementById('profilePhoto')?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" /> Upload Photo
                </Button>
              </div>
            </div>
          </div>

          {/* Telegram Bot Setup Instructions */}
          <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Telegram Bot Setup</Label>
                <p className="text-xs text-muted-foreground">
                  Follow these steps to set up your Telegram bot
                </p>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="text-sm space-y-2">
                <p className="font-medium">Step 1: Create a bot with BotFather</p>
                <ol className="list-decimal list-inside text-xs space-y-1 ml-2">
                  <li>Open Telegram and search for @BotFather</li>
                  <li>Send /newbot command</li>
                  <li>Choose a name for your bot (organization name)</li>
                  <li>Choose a username (must end with 'bot')</li>
                  <li>Copy the bot token provided</li>
                </ol>
              </div>
              
              <div className="text-sm space-y-2">
                <p className="font-medium">Step 2: Configure bot settings</p>
                <ol className="list-decimal list-inside text-xs space-y-1 ml-2">
                  <li>Send /setdescription to set bot description</li>
                  <li>Send /setabouttext to set about text</li>
                  <li>Send /setcommands to set available commands</li>
                </ol>
              </div>
              
              <div className="text-sm space-y-2">
                <p className="font-medium">Step 3: Enable webhook (optional)</p>
                <p className="text-xs text-muted-foreground">
                  Your bot will automatically receive messages once connected to our platform.
                </p>
              </div>
            </div>
          </div>

          {/* Telegram Bot Token */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="telegramBotToken">Telegram Bot Token *</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent 
                  className="z-[9999] max-w-xs" 
                  side="top" 
                  align="start" 
                  sideOffset={5} 
                  avoidCollisions={true} 
                  collisionPadding={20}
                  sticky="always"
                >
                  <p>Token bot Telegram yang diperoleh dari @BotFather untuk mengautentikasi bot</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              id="telegramBotToken"
              type="password"
              placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
              value={formData.telegramBotToken}
              onChange={(e) => setFormData(prev => ({ ...prev, telegramBotToken: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Get this token from @BotFather on Telegram. Format: 1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
            </p>
          </div>

          {/* Super Agent (read-only) above AI Agent */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>Super Agent *</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent 
                  className="z-[9999] max-w-xs" 
                  side="top" 
                  align="start" 
                  sideOffset={5} 
                  avoidCollisions={true} 
                  collisionPadding={20}
                  sticky="always"
                >
                  <p>Super Agent yang akan mengawasi dan mengelola platform Telegram ini</p>
                </TooltipContent>
              </Tooltip>
            </div>
            {humanAgentsLoading ? (
              <div className="rounded-md border bg-muted px-3 py-2 text-sm">Loading super agents...</div>
            ) : (
              <Select
                value={selectedSuperAgentId || ''}
                onValueChange={(value) => {
                  setSelectedSuperAgentId(value);
                  // Reset AI/human agent selections to respect new super agent scope
                  setFormData(prev => ({ ...prev, selectedAIAgent: "", selectedHumanAgents: [] }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a Super Agent" />
                </SelectTrigger>
                <SelectContent className="bg-background border z-50">
                  {humanAgents
                    .filter((a) => a.primaryRole === 'super_agent')
                    .map((sa) => (
                      <SelectItem key={sa.user_id} value={sa.user_id}>
                        {sa.display_name || sa.email || sa.user_id.slice(0, 8)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-muted-foreground">
              {'Default mengikuti super agent pada AI agent terpilih. Anda bisa mengubahnya di sini.'}
            </p>
          </div>

          {/* Select AI Agent (filtered by selected Super Agent) */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="aiAgent">Select AI Agent *</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent 
                  className="z-[9999] max-w-xs" 
                  side="top" 
                  align="start" 
                  sideOffset={5} 
                  avoidCollisions={true} 
                  collisionPadding={20}
                  sticky="always"
                >
                  <p>Agen AI yang akan menangani percakapan otomatis di platform Telegram ini</p>
                </TooltipContent>
              </Tooltip>
            </div>
            {aiAgentsLoading ? (
              <div className="text-sm text-muted-foreground">Loading AI agents...</div>
            ) : (
              <Select 
                value={formData.selectedAIAgent} 
                onValueChange={(value) => {
                  const agent = aiAgents.find(a => a.id === value);
                  if (!selectedSuperAgentId) {
                    toast({ title: "Select a Super Agent first", description: "Pilih super agent terlebih dahulu, lalu pilih AI agent.", variant: "destructive" });
                    return;
                  }
                  if (!agent || agent.super_agent_id !== selectedSuperAgentId) {
                    toast({ title: "AI agent tidak sesuai", description: "AI agent yang dipilih tidak berada di bawah super agent terpilih.", variant: "destructive" });
                    return;
                  }
                  setFormData(prev => ({ ...prev, selectedAIAgent: value, selectedHumanAgents: [] }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedSuperAgentId ? "Choose an AI agent" : "Select a Super Agent first"} />
                </SelectTrigger>
                <SelectContent className="bg-background border z-50">
                  {aiAgents
                    .filter(agent => selectedSuperAgentId ? agent.super_agent_id === selectedSuperAgentId : false)
                    .map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
            {selectedSuperAgentId && (
              <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-muted px-3 py-1 text-xs text-muted-foreground">
                <span>Super Agent:</span>
                <span className="font-medium">
                  {selectedSuperAgent?.display_name || selectedSuperAgent?.email || selectedSuperAgentId.slice(0, 8)}
                </span>
              </div>
            )}
          </div>
          {formData.selectedAIAgent && !selectedSuperAgentId && (
            <p className="text-xs text-amber-600">
              AI agent terpilih belum memiliki super agent. Tetapkan super agent di halaman AI Agents terlebih dahulu.
            </p>
          )}

          {/* Select Human Agents (MultiSelect + Select All) */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>Select Human Agents (optional)</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent 
                  className="z-[9999] max-w-xs" 
                  side="top" 
                  align="start" 
                  sideOffset={5} 
                  avoidCollisions={true} 
                  collisionPadding={20}
                  sticky="always"
                >
                  <p>Agen manusia yang akan menangani percakapan yang memerlukan intervensi manual</p>
                </TooltipContent>
              </Tooltip>
            </div>
            {humanAgentsLoading ? (
              <div className="text-sm text-muted-foreground">Loading human agents...</div>
            ) : (
              (() => {
                    const available = humanAgents
                      .filter(a => a.primaryRole === 'agent')
                      .filter(a => !!selectedSuperAgentId && a.super_agent_id === selectedSuperAgentId);
                const options = available.map(a => ({ value: a.user_id, label: a.display_name || a.email || `Agent ${a.user_id.slice(0,8)}` }));
                return (
                  <div className="flex items-center gap-2">
                    <MultiSelect
                      options={options as any}
                      value={formData.selectedHumanAgents}
                      onValueChange={(vals)=>setFormData(prev=>({ ...prev, selectedHumanAgents: vals }))}
                      disabled={!selectedSuperAgentId}
                      placeholder={selectedSuperAgentId ? 'Select human agents' : 'Select an AI agent first'}
                    />
                    <Button type="button" variant="outline" disabled={!selectedSuperAgentId || options.length===0} onClick={()=>setFormData(prev=>({ ...prev, selectedHumanAgents: options.map((o:any)=>o.value) }))}>Select All</Button>
                    <Button type="button" variant="ghost" disabled={!selectedSuperAgentId || formData.selectedHumanAgents.length===0} onClick={()=>setFormData(prev=>({ ...prev, selectedHumanAgents: [] }))}>Unselect All</Button>
                  </div>
                );
              })()
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={()=>{ if (submitting) return; setFormData({ displayName: "", description: "", telegramBotToken: "", selectedAIAgent: "", selectedHumanAgents: [] as string[], profilePhoto: null }); setSelectedSuperAgentId(null); onClose(); }} disabled={isSubmitting || submitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || submitting || !isFormValid}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isSubmitting || submitting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Creating...
              </span>
            ) : (
              "Create Telegram Bot Platform"
            )}
          </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TelegramPlatformForm;
