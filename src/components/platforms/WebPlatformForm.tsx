import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload, HelpCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAIAgents } from "@/hooks/useAIAgents";
import { useHumanAgents } from "@/hooks/useHumanAgents";
import { MultiSelect, MultiSelectOption } from "@/components/ui/multi-select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useRBAC } from "@/contexts/RBACContext";
import { supabase } from "@/lib/supabase";
import WEBHOOK_CONFIG from "@/config/webhook";

interface WebPlatformFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: any) => Promise<void>;
  isSubmitting?: boolean;
}

const WebPlatformForm = ({ isOpen, onClose, onSubmit, isSubmitting = false }: WebPlatformFormProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { hasPermission } = useRBAC();
  const { aiAgents, loading: aiAgentsLoading } = useAIAgents();
  const { agents: humanAgents, loading: humanAgentsLoading } = useHumanAgents();

  const [formData, setFormData] = useState({
    description: "",
    displayName: "",
    websiteUrl: "",
    businessCategory: "",
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


  const handleHumanAgentToggle = (agentId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedHumanAgents: prev.selectedHumanAgents.includes(agentId)
        ? prev.selectedHumanAgents.filter(id => id !== agentId)
        : [...prev.selectedHumanAgents, agentId]
    }));
  };

  const isFormValid = Boolean(
    formData.displayName &&
    selectedSuperAgentId &&
    formData.selectedAIAgent &&
    canCreateChannel &&
    // websiteUrl optional for now
    true
  );

  const handleSubmit = async () => {
    try {
      if (submitting) return;
      if (!canCreateChannel) {
        toast({ title: 'Permission denied', description: 'You do not have permission to create channels.', variant: 'destructive' });
        return;
      }
      if (!selectedSuperAgentId || !formData.selectedAIAgent) {
        toast({ title: 'Missing required fields', description: 'Please select a Super Agent and an AI Agent.', variant: 'destructive' });
        return;
      }
      setSubmitting(true);
      const submitData = {
        ...formData,
        platformType: 'web' as const,
        selectedSuperAgentId
      };

      await onSubmit(submitData);
      try {
        window.dispatchEvent(new CustomEvent('refresh-platforms'));
      } catch {}
      // Clear form after successful submit
      setFormData({
        description: "",
        displayName: "",
        websiteUrl: "",
        businessCategory: "",
        selectedAIAgent: "",
        selectedHumanAgents: [],
        profilePhoto: null,
      });
      setSelectedSuperAgentId(null);
      onClose();
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (submitting) return;
    setFormData({
      description: "",
      displayName: "",
      websiteUrl: "",
      businessCategory: "",
      selectedAIAgent: "",
      selectedHumanAgents: [],
      profilePhoto: null,
    });
    setSelectedSuperAgentId(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" style={{ overflowX: 'visible', overflowY: 'auto' }}>
        <div>
          <DialogHeader>
            <DialogTitle>Setup Web Live Chat Platform</DialogTitle>
            <DialogDescription>
              Configure your new web live chat platform with all the necessary information.
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-6 space-y-6">
          {/* Removed brand/org name in favor of Display Name */}

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
                  <p>Foto profil atau logo yang akan ditampilkan di widget live chat</p>
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
                  <p>Nama yang akan ditampilkan di widget live chat</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              id="displayName"
              placeholder="Name that will appear in the chat widget"
              value={formData.displayName}
              onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
            />
          </div>

          {/* Website URL */}
          {/* <div className="space-y-2">
            <Label htmlFor="websiteUrl">Website URL *</Label>
            <Input
              id="websiteUrl"
              type="url"
              placeholder="https://your-website.com"
              value={formData.websiteUrl}
              onChange={(e) => setFormData(prev => ({ ...prev, websiteUrl: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              The website where you want to embed the live chat
            </p>
          </div> */}

          {/* Business Category */}
          {/* <div className="space-y-2">
            <Label htmlFor="businessCategory">Business Category</Label>
            <Select 
              value={formData.businessCategory} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, businessCategory: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select business category" />
              </SelectTrigger>
              <SelectContent>
                {businessCategories.map((category) => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div> */}


          {/* Super Agent derived from selected AI agent */}
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
                  <p>Super Agent yang akan mengawasi dan mengelola platform Live Chat ini</p>
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

          {/* Select AI Agent (filtered by selected super agent) */}
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
                  <p>Agen AI yang akan menangani percakapan otomatis di platform Live Chat ini</p>
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

          {/* Assign Agents with role clustering */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Label>Assign Agents</Label>
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
              <>
                {/* Super Agent moved above AI Agent */}

                {/* <div className="space-y-1">
                  <div className="text-xs font-medium text-blue-700">Master Agents</div>
                  <div className="grid grid-cols-2 gap-2">
                    {humanAgents.filter(a => a.primaryRole === 'master_agent').map(ma => (
                      <div key={ma.user_id} className="text-xs text-muted-foreground">{ma.display_name || ma.email || ma.user_id.slice(0,8)}</div>
                    ))}
                  </div>
                </div> */}

                <div className="space-y-2">
                  <div className="text-xs font-medium">Agents {selectedSuperAgentId ? '' : '(select an AI agent first)'}</div>
                  {(() => {
                    const available = humanAgents
                      .filter(a => a.primaryRole === 'agent')
                      .filter(a => !!selectedSuperAgentId && a.super_agent_id === selectedSuperAgentId);
                    const options: MultiSelectOption[] = available.map(a => ({ value: a.user_id, label: a.display_name || a.email || `Agent ${a.user_id.slice(0,8)}` }));
                    return (
                      <>
                        <div className="flex items-center gap-2">
                          <MultiSelect
                            options={options}
                            value={formData.selectedHumanAgents}
                            onValueChange={(vals)=>setFormData(prev=>({ ...prev, selectedHumanAgents: vals }))}
                            disabled={!selectedSuperAgentId}
                            placeholder={selectedSuperAgentId ? 'Select human agents' : 'Select an AI agent first'}
                          />
                          <Button type="button" variant="outline" disabled={!selectedSuperAgentId || options.length===0} onClick={()=>setFormData(prev=>({ ...prev, selectedHumanAgents: options.map(o=>o.value) }))}>Select All</Button>
                          <Button type="button" variant="ghost" disabled={!selectedSuperAgentId || formData.selectedHumanAgents.length===0} onClick={()=>setFormData(prev=>({ ...prev, selectedHumanAgents: [] }))}>Unselect All</Button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handleCancel} disabled={isSubmitting || submitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || submitting || !isFormValid}
          >
            {isSubmitting || submitting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Creating...
              </span>
            ) : (
              "Create Web Live Chat Platform"
            )}
          </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WebPlatformForm;
