import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Upload } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAIAgents } from "@/hooks/useAIAgents";
import { useHumanAgents } from "@/hooks/useHumanAgents";
import { useToast } from "@/hooks/use-toast";
import WEBHOOK_CONFIG from "@/config/webhook";

interface WhatsAppPlatformFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: any) => Promise<void>;
  isSubmitting?: boolean;
}

const WhatsAppPlatformForm = ({ isOpen, onClose, onSubmit, isSubmitting = false }: WhatsAppPlatformFormProps) => {
  const { toast } = useToast();
  const { aiAgents, loading: aiAgentsLoading } = useAIAgents();
  const { agents: humanAgents, loading: humanAgentsLoading } = useHumanAgents();

  const [formData, setFormData] = useState({
    brandName: "",
    description: "",
    displayName: "",
    profilePhoto: null as File | null,
    phoneNumber: "",
    selectedAIAgent: "",
    selectedHumanAgents: [] as string[]
  });

  // WhatsApp QR connection state
  const [isWhatsAppConnected, setIsWhatsAppConnected] = useState(false);
  const [isFetchingQR, setIsFetchingQR] = useState(false);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const isFetchingRef = useRef(false);

  const n8nBaseUrl = WEBHOOK_CONFIG.BASE_URL;

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

  const handleWhatsAppConnection = async () => {
    try {
      setIsFetchingQR(true);
      setQrError(null);
      setQrImageUrl(null);
      
      const response = await fetch(WEBHOOK_CONFIG.buildUrl(WEBHOOK_CONFIG.ENDPOINTS.WHATSAPP.GET_LOGIN_QR), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
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
        } catch (jsonError) {
          // If JSON parsing fails, try to get the response as text and check if it's base64
          const text = await response.text();
          if (text && text.length > 0) {
            // Assume it's a base64 encoded image
            const dataUrl = `data:image/png;base64,${text}`;
            setQrImageUrl(dataUrl);
          } else {
            throw new Error("Invalid response format");
          }
        }
      }
      
      setIsFetchingQR(false);
      
    } catch (error: any) {
      setQrError(error?.message || "Failed to generate QR");
      setIsFetchingQR(false);
    }
  };

  // Check WhatsApp session status via polling
  const checkSessionStatus = async () => {
    try {
      const response = await fetch('https://waha-production-c0b8.up.railway.app/api/sessions/default', {
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

  const isFormValid = formData.brandName && 
    formData.displayName && 
    formData.selectedAIAgent &&
    formData.phoneNumber &&
    isWhatsAppConnected;

  const handleSubmit = async () => {
    try {
      // Format phone number - just clean it without adding @c.us suffix
      let formattedPhoneNumber = formData.phoneNumber;
      if (formData.phoneNumber) {
        // Remove any non-digit characters
        const cleanNumber = formData.phoneNumber.replace(/\D/g, '');
        // Just use the clean number without @c.us suffix
        formattedPhoneNumber = cleanNumber;
      }

      const submitData = {
        ...formData,
        phoneNumber: formattedPhoneNumber,
        platformType: 'whatsapp' as const
      };

      await onSubmit(submitData);
    } catch (error) {
      console.error('Error submitting form:', error);
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
          {/* Brand Name */}
          <div className="space-y-2">
            <Label htmlFor="brandName">Brand / Org Name *</Label>
            <Input
              id="brandName"
              placeholder="Enter your brand or organization name"
              value={formData.brandName}
              onChange={(e) => setFormData(prev => ({ ...prev, brandName: e.target.value }))}
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

          {/* WhatsApp Display Name */}
          <div className="space-y-2">
            <Label htmlFor="displayName">WhatsApp Display Name *</Label>
            <Input
              id="displayName"
              placeholder="Name that will appear in WhatsApp"
              value={formData.displayName}
              onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
            />
          </div>

          {/* WhatsApp Number */}
          <div className="space-y-2">
            <Label htmlFor="phoneNumber">WhatsApp Number *</Label>
            <div className="flex">
              <div className="flex items-center px-3 py-2 bg-muted border border-r-0 rounded-l-md text-sm text-muted-foreground">
                +62
              </div>
              <Input
                id="phoneNumber"
                placeholder="87776858347"
                value={formData.phoneNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                className="rounded-l-none"
              />
            </div>
            <p className="text-xs text-muted-foreground">Enter your phone number (e.g., 6287776858347)</p>
          </div>

          {/* WhatsApp Connection Section */}
          <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">WhatsApp Connection</Label>
                <p className="text-xs text-muted-foreground">
                  Connect your WhatsApp account to enable messaging
                </p>
              </div>
              {isWhatsAppConnected && (
                <Badge variant="default" className="text-xs">
                  ✓ Connected
                </Badge>
              )}
            </div>
            
            {!isWhatsAppConnected ? (
              <div className="space-y-3">
                {qrImageUrl ? (
                  <div className="flex flex-col items-center gap-3">
                    <img
                      src={qrImageUrl}
                      alt="WhatsApp QR"
                      className="w-48 h-48 rounded-md border"
                    />
                    <p className="text-xs text-center text-muted-foreground">
                      Scan this QR code with your WhatsApp app
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleWhatsAppConnection}
                      disabled={isFetchingQR}
                    >
                      {isFetchingQR ? "Generating..." : "Refresh QR"}
                    </Button>
                  </div>
                ) : (
                  <Button 
                    onClick={handleWhatsAppConnection}
                    disabled={isFetchingQR}
                    className="w-full"
                  >
                    {isFetchingQR ? "Generating QR..." : "Connect WhatsApp"}
                  </Button>
                )}
                
                {qrError && (
                  <div className="text-sm text-red-600 text-center">{qrError}</div>
                )}
              </div>
            ) : (
              <div className="text-sm text-green-600 text-center">
                ✓ WhatsApp successfully connected
              </div>
            )}
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
            {isSubmitting ? "Creating..." : "Create WhatsApp Platform"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WhatsAppPlatformForm;
