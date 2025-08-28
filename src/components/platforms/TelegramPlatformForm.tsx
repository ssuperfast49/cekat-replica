import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAIAgents } from "@/hooks/useAIAgents";
import { useHumanAgents } from "@/hooks/useHumanAgents";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import WEBHOOK_CONFIG from "@/config/webhook";

interface TelegramPlatformFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: any) => Promise<void>;
  isSubmitting?: boolean;
}

const TelegramPlatformForm = ({ isOpen, onClose, onSubmit, isSubmitting = false }: TelegramPlatformFormProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { aiAgents, loading: aiAgentsLoading } = useAIAgents();
  const { agents: humanAgents, loading: humanAgentsLoading } = useHumanAgents();

  const [formData, setFormData] = useState({
    displayName: "",
    description: "",
    profilePhoto: null as File | null,
    telegramBotToken: "",
    selectedAIAgent: "",
    selectedHumanAgents: [] as string[]
  });

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

  const isFormValid = formData.displayName && 
    formData.selectedAIAgent &&
    formData.telegramBotToken;

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
      // Get user's organization ID
      const orgId = await getUserOrgId();
      if (!orgId) {
        throw new Error('User not found in any organization');
      }

      // First, send to Telegram webhook
      const telegramWebhookData = {
        brand_name: formData.displayName,
        display_name: formData.displayName,
        description: formData.description,
        telegram_bot_token: formData.telegramBotToken,
        ai_profile_id: formData.selectedAIAgent,
        human_agent_ids: formData.selectedHumanAgents,
        org_id: orgId,
        platform_type: 'telegram'
      };

      const webhookUrl = WEBHOOK_CONFIG.buildUrl(WEBHOOK_CONFIG.ENDPOINTS.TELEGRAM.CREATE_PLATFORM);
      
      const webhookResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(telegramWebhookData),
      });

      if (!webhookResponse.ok) {
        throw new Error(`Telegram webhook failed with status ${webhookResponse.status}`);
      }

      const webhookResult = await webhookResponse.json();
      console.log('Telegram webhook response:', webhookResult);

      // Then submit to the main form handler
      const submitData = {
        ...formData,
        platformType: 'telegram' as const
      };

      await onSubmit(submitData);
      
      toast({
        title: "Success",
        description: "Telegram platform created and webhook sent successfully!",
      });
    } catch (error: any) {
      console.error('Error submitting form:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create Telegram platform",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Setup Telegram Bot Platform</DialogTitle>
          <DialogDescription>
            Configure your new Telegram bot platform with all the necessary information.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name *</Label>
            <Input
              id="displayName"
              placeholder="Enter the display name"
              value={formData.displayName}
              onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
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



          {/* Telegram Bot Token */}
          <div className="space-y-2">
            <Label htmlFor="telegramBotToken">Telegram Bot Token *</Label>
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

          {/* Select Human Agents */}
          <div className="space-y-2">
            <Label>Select Human Agents (optional)</Label>
            {humanAgentsLoading ? (
              <div className="text-sm text-muted-foreground">Loading human agents...</div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {humanAgents.map((agent) => (
                  <div key={agent.user_id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={agent.user_id}
                      checked={formData.selectedHumanAgents.includes(agent.user_id)}
                      onChange={() => handleHumanAgentToggle(agent.user_id)}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor={agent.user_id} className="text-sm cursor-pointer">
                      {agent.display_name || agent.email || `Agent ${agent.user_id.slice(0, 8)}`}
                    </Label>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !isFormValid}
          >
            {isSubmitting ? "Creating..." : "Create Telegram Bot Platform"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TelegramPlatformForm;
