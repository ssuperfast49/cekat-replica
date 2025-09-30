import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAIAgents } from "@/hooks/useAIAgents";
import { useHumanAgents } from "@/hooks/useHumanAgents";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
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
  const { aiAgents, loading: aiAgentsLoading } = useAIAgents();
  const { agents: humanAgents, loading: humanAgentsLoading } = useHumanAgents();

  const [formData, setFormData] = useState({
    description: "",
    displayName: "",
    profilePhoto: null as File | null,
    websiteUrl: "",
    businessCategory: "",
    selectedAIAgent: "",
    selectedHumanAgents: [] as string[]
  });
  const [submitting, setSubmitting] = useState(false);
  const [selectedSuperAgentId, setSelectedSuperAgentId] = useState<string | null>(null);

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
    setSelectedSuperAgentId(userId);
    setFormData(prev => ({ ...prev, selectedHumanAgents: [] }));
  };

  const isFormValid = formData.displayName && 
    formData.selectedAIAgent &&
    formData.websiteUrl &&
    selectedSuperAgentId;

  const handleSubmit = async () => {
    try {
      if (submitting) return;
      setSubmitting(true);
      const submitData = {
        ...formData,
        platformType: 'web' as const
      };

      await onSubmit(submitData);
      try {
        window.dispatchEvent(new CustomEvent('refresh-platforms'));
      } catch {}
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Setup Web Live Chat Platform</DialogTitle>
          <DialogDescription>
            Configure your new web live chat platform with all the necessary information.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Removed brand/org name in favor of Display Name */}

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

          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name *</Label>
            <Input
              id="displayName"
              placeholder="Name that will appear in the chat widget"
              value={formData.displayName}
              onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
            />
          </div>

          {/* Website URL */}
          <div className="space-y-2">
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
          </div>

          {/* Business Category */}
          <div className="space-y-2">
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
          </div>

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

          {/* Select AI Agent */}
          <div className="space-y-2">
            <Label htmlFor="aiAgent">Select AI Agent *</Label>
            {aiAgentsLoading ? (
              <div className="text-sm text-muted-foreground">Loading AI agents...</div>
            ) : (
              <Select 
                value={formData.selectedAIAgent} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, selectedAIAgent: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose an AI agent" />
                </SelectTrigger>
                <SelectContent>
                  {aiAgents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Assign Agents with role clustering */}
          <div className="space-y-4">
            <Label>Assign Agents</Label>
            {humanAgentsLoading ? (
              <div className="text-sm text-muted-foreground">Loading human agents...</div>
            ) : (
              <>
                <div className="space-y-1">
                  <div className="text-xs font-medium text-emerald-700">Super Agent (1 max)</div>
                  <div className="grid grid-cols-2 gap-2">
                    {humanAgents.filter(a => a.primaryRole === 'super_agent').map(sa => (
                      <label key={sa.user_id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="radio" name="super-agent" checked={selectedSuperAgentId===sa.user_id} onChange={()=>handleSuperAgentSelect(sa.user_id)} className="accent-emerald-600" />
                        <span>{sa.display_name || sa.email || sa.user_id.slice(0,8)}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-medium text-blue-700">Master Agents</div>
                  <div className="grid grid-cols-2 gap-2">
                    {humanAgents.filter(a => a.primaryRole === 'master_agent').map(ma => (
                      <div key={ma.user_id} className="text-xs text-muted-foreground">{ma.display_name || ma.email || ma.user_id.slice(0,8)}</div>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-medium">Agents {selectedSuperAgentId? '' : '(select a Super Agent first)'}</div>
                  <div className="grid grid-cols-2 gap-2">
                    {humanAgents.filter(a => a.primaryRole === 'agent').map(ag => {
                      const blocked = Boolean(ag.super_agent_id && ag.super_agent_id !== selectedSuperAgentId);
                      return (
                        <label key={ag.user_id} className={`flex items-center gap-2 text-sm ${(!selectedSuperAgentId || blocked) ? 'opacity-50' : ''}`} title={blocked ? 'Agent attached to another Super Agent' : ''}>
                          <input type="checkbox" disabled={!selectedSuperAgentId || blocked} checked={formData.selectedHumanAgents.includes(ag.user_id)} onChange={()=>handleHumanAgentToggle(ag.user_id)} className="rounded border-gray-300" />
                          <span>{ag.display_name || ag.email || `Agent ${ag.user_id.slice(0,8)}`}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting || submitting}>
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
      </DialogContent>
    </Dialog>
  );
};

export default WebPlatformForm;
