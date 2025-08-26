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
import { Plus, Settings, Camera, HelpCircle, ExternalLink, Code, X, Upload, Trash2, MessageCircle, Globe, Send } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePlatforms, CreatePlatformData } from "@/hooks/usePlatforms";
import { useAIAgents } from "@/hooks/useAIAgents";
import { useHumanAgents } from "@/hooks/useHumanAgents";
import { useToast } from "@/hooks/use-toast";

const ConnectedPlatforms = () => {
  const { toast } = useToast();
  const { platforms, loading: platformsLoading, error: platformsError, createPlatform, deletePlatform, uploadProfilePhoto } = usePlatforms();
  const { aiAgents, loading: aiAgentsLoading } = useAIAgents();
  const { agents: humanAgents, loading: humanAgentsLoading } = useHumanAgents();
  
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [selectedHumanAgent, setSelectedHumanAgent] = useState<string>("");

  // Platform selection and setup state
  const [isPlatformSelectionOpen, setIsPlatformSelectionOpen] = useState(false);
  const [isPlatformSetupOpen, setIsPlatformSetupOpen] = useState(false);
  const [selectedPlatformType, setSelectedPlatformType] = useState<'whatsapp' | 'web' | 'telegram' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWhatsAppConnected, setIsWhatsAppConnected] = useState(false);
  const [newPlatform, setNewPlatform] = useState({
    brandName: "",
    websiteUrl: "",
    businessCategory: "",
    description: "",
    displayName: "",
    profilePhoto: null as File | null,
    phoneNumber: "",
    telegramBotToken: "",
    telegramBotUsername: "",
    selectedAIAgent: "",
    selectedHumanAgents: [] as string[]
  });

  // WhatsApp QR dialog state
  const [isWhatsAppDialogOpen, setIsWhatsAppDialogOpen] = useState(false);
  const [isFetchingQR, setIsFetchingQR] = useState(false);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const isFetchingRef = useRef(false);
  const [qrCountdown, setQrCountdown] = useState<number>(30);

  // Tabs state
  const [activeTab, setActiveTab] = useState("live-chat");

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

  const n8nBaseUrl = (import.meta as any).env?.VITE_N8N_BASE_URL || "https://primary-production-376c.up.railway.app/webhook";

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
    // If platform has whatsapp_number, it's a WhatsApp platform
    // If platform has telegram_bot_token, it's a Telegram platform
    // If platform has website_url but no whatsapp_number or telegram_bot_token, it's a web platform
    if (platform.whatsapp_number) {
      return 'whatsapp';
    }
    if (platform.telegram_bot_token) {
      return 'telegram';
    }
    return 'web';
  };

  // Get the selected platform data
  const selectedPlatformData = platforms.find(platform => platform.id === selectedPlatform);
  const currentPlatformType = selectedPlatformData ? getPlatformType(selectedPlatformData) : null;

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
    setIsWhatsAppConnected(false); // Reset connection status
    setIsPlatformSelectionOpen(false);
    setIsPlatformSetupOpen(true);
  };

  const handleWhatsAppConnection = async () => {
    try {
      setIsFetchingQR(true);
      setQrError(null);
      setQrImageUrl(null);
      
      const response = await fetch(`${n8nBaseUrl}/get_login_qr`, {
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

  const handlePlatformSetup = async (formData: any) => {
    try {
      setIsSubmitting(true);
      
      let profilePhotoUrl = "";
      if (newPlatform.profilePhoto) {
        profilePhotoUrl = await uploadProfilePhoto(newPlatform.profilePhoto);
      }

      // Format phone number to required format: 6287776858347@c.us
      let formattedPhoneNumber = formData.phoneNumber;
      if (selectedPlatformType === 'whatsapp' && formData.phoneNumber) {
        // Remove any non-digit characters
        const cleanNumber = formData.phoneNumber.replace(/\D/g, '');
        // Add 62 prefix and @c.us suffix
        formattedPhoneNumber = `62${cleanNumber}@c.us`;
      }

      const platformData: CreatePlatformData = {
        brand_name: formData.brandName,
        website_url: formData.websiteUrl || undefined,
        business_category: formData.businessCategory || undefined,
        description: formData.description || undefined,
        whatsapp_display_name: formData.displayName,
        profile_photo_url: profilePhotoUrl || undefined,
        whatsapp_number: selectedPlatformType === 'whatsapp' ? formattedPhoneNumber : undefined,
        telegram_bot_token: selectedPlatformType === 'telegram' ? formData.telegramBotToken : undefined,
        telegram_bot_username: selectedPlatformType === 'telegram' ? formData.telegramBotUsername : undefined,
        ai_profile_id: formData.selectedAIAgent || undefined,
        human_agent_ids: formData.selectedHumanAgents
      };

      await createPlatform(platformData);
      
      toast({
        title: "Success",
        description: "Platform created successfully!",
      });
      
      setIsPlatformSetupOpen(false);
      // Reset form
      setNewPlatform({
        brandName: "",
        websiteUrl: "",
        businessCategory: "",
        description: "",
        displayName: "",
        profilePhoto: null,
        phoneNumber: "",
        telegramBotToken: "",
        telegramBotUsername: "",
        selectedAIAgent: "",
        selectedHumanAgents: []
      });
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

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setNewPlatform(prev => ({ ...prev, profilePhoto: file }));
    }
  };

  const handleHumanAgentToggle = (agentId: string) => {
    setNewPlatform(prev => ({
      ...prev,
      selectedHumanAgents: prev.selectedHumanAgents.includes(agentId)
        ? prev.selectedHumanAgents.filter(id => id !== agentId)
        : [...prev.selectedHumanAgents, agentId]
    }));
  };

  const fetchWhatsAppQr = async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsFetchingQR(true);
    setQrError(null);
    setQrImageUrl(null);
    try {
      const response = await fetch(`${n8nBaseUrl}/get_login_qr`, {
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
    } catch (error: any) {
      setQrError(error?.message || "Failed to generate QR");
    } finally {
      isFetchingRef.current = false;
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

  // Auto-refresh QR every 30 seconds with a visible countdown while dialog is open
  useEffect(() => {
    if (!isWhatsAppDialogOpen) return;
    setQrCountdown(30);
    const intervalId: ReturnType<typeof setInterval> = setInterval(() => {
      setQrCountdown((prev) => {
        if (prev <= 1) {
          if (!isFetchingRef.current) {
            fetchWhatsAppQr();
            return 30;
          }
          return 1;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalId);
  }, [isWhatsAppDialogOpen]);

  // Fetch existing WhatsApp sessions
  const fetchWhatsAppSessions = async () => {
    setIsSessionsLoading(true);
    setSessionsError(null);
    try {
      let response = await fetch(`${n8nBaseUrl}/get_sessions`, { method: "POST" });
      if (!response.ok) {
        // Fallback to POST if GET is not supported
        response = await fetch(`${n8nBaseUrl}/get_sessions`, {
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
    } catch (error: any) {
      setSessionsError(error?.message || "Failed to load sessions");
    } finally {
      setIsSessionsLoading(false);
    }
  };

  // Load sessions when switching to WhatsApp tab
  useEffect(() => {
    if (activeTab === "whatsapp") {
      fetchWhatsAppSessions();
    }
  }, [activeTab]);

  const logoutEndpoint = "https://primary-production-376c.up.railway.app/webhook/logout_session";
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

  return (
    <div className="flex h-[calc(100vh-120px)]">
      {/* Left Sidebar - Inboxes List */}
      <div className="w-80 border-r border-border bg-card">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Inboxes</h2>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            This is where you can connect all your platforms
          </p>
          
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
              {platforms.length === 0 ? (
                <div className="text-sm text-muted-foreground p-4 text-center">
                  No platforms found. Create your first platform to get started.
                </div>
              ) : (
                platforms.map((platform) => (
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
                              alt={platform.brand_name}
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-xs font-medium text-blue-600">
                              {platform.brand_name.charAt(0)}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm truncate">{platform.brand_name}</h3>
                          <p className="text-xs text-muted-foreground">{platform.whatsapp_display_name}</p>
                        </div>
                        <Badge 
                          variant={platform.status === 'active' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {platform.status === 'active' ? '●' : '○'}
                        </Badge>
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
                Add Platform
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md p-0 overflow-hidden">
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

                     {/* Platform Setup Form Dialog */}
           <Dialog open={isPlatformSetupOpen} onOpenChange={setIsPlatformSetupOpen}>
             <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                               <DialogHeader>
                  <DialogTitle>
                    Setup {selectedPlatformType === 'whatsapp' ? 'WhatsApp' : selectedPlatformType === 'telegram' ? 'Telegram Bot' : 'Web Live Chat'} Platform
                  </DialogTitle>
                  <DialogDescription>
                    Configure your new {selectedPlatformType === 'whatsapp' ? 'WhatsApp' : selectedPlatformType === 'telegram' ? 'Telegram bot' : 'web live chat'} platform with all the necessary information.
                  </DialogDescription>
                </DialogHeader>
               
               <div className="space-y-6">
                 {/* Common Fields for both platforms */}
                 <div className="space-y-2">
                   <Label htmlFor="brandName">Brand / Org Name *</Label>
                   <Input
                     id="brandName"
                     placeholder="Enter your brand or organization name"
                     value={newPlatform.brandName}
                     onChange={(e) => setNewPlatform(prev => ({ ...prev, brandName: e.target.value }))}
                   />
                 </div>

                 <div className="space-y-2">
                   <Label htmlFor="description">Description</Label>
                   <Textarea
                     id="description"
                     placeholder="Describe your business and what you offer"
                     value={newPlatform.description}
                     onChange={(e) => setNewPlatform(prev => ({ ...prev, description: e.target.value }))}
                     rows={3}
                   />
                 </div>

                                   <div className="space-y-2">
                    <Label htmlFor="displayName">
                      {selectedPlatformType === 'whatsapp' ? 'WhatsApp' : selectedPlatformType === 'telegram' ? 'Telegram Bot' : 'Chat'} Display Name *
                    </Label>
                    <Input
                      id="displayName"
                      placeholder={`Name that will appear in ${selectedPlatformType === 'whatsapp' ? 'WhatsApp' : selectedPlatformType === 'telegram' ? 'Telegram' : 'chat'}`}
                      value={newPlatform.displayName}
                      onChange={(e) => setNewPlatform(prev => ({ ...prev, displayName: e.target.value }))}
                    />
                  </div>

                                   {/* Platform-specific fields */}
                  {selectedPlatformType === 'whatsapp' ? (
                    // WhatsApp-specific fields
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="phoneNumber">WhatsApp Number *</Label>
                        <div className="flex">
                          <div className="flex items-center px-3 py-2 bg-muted border border-r-0 rounded-l-md text-sm text-muted-foreground">
                            +62
                          </div>
                          <Input
                            id="phoneNumber"
                            placeholder="87776858347"
                            value={newPlatform.phoneNumber}
                            onChange={(e) => setNewPlatform(prev => ({ ...prev, phoneNumber: e.target.value }))}
                            className="rounded-l-none"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">Enter number without the +62 prefix (e.g., 87776858347). Will be saved as 6287776858347@c.us</p>
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
                    </>
                  ) : selectedPlatformType === 'telegram' ? (
                    // Telegram-specific fields
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="telegramBotToken">Telegram Bot Token *</Label>
                        <Input
                          id="telegramBotToken"
                          type="password"
                          placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                          value={newPlatform.telegramBotToken}
                          onChange={(e) => setNewPlatform(prev => ({ ...prev, telegramBotToken: e.target.value }))}
                        />
                        <p className="text-xs text-muted-foreground">
                          Get this token from @BotFather on Telegram. Format: 1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="telegramBotUsername">Bot Username *</Label>
                        <div className="flex">
                          <div className="flex items-center px-3 py-2 bg-muted border border-r-0 rounded-l-md text-sm text-muted-foreground">
                            @
                          </div>
                          <Input
                            id="telegramBotUsername"
                            placeholder="your_bot_username"
                            value={newPlatform.telegramBotUsername}
                            onChange={(e) => setNewPlatform(prev => ({ ...prev, telegramBotUsername: e.target.value }))}
                            className="rounded-l-none"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Your bot's username without the @ symbol (e.g., my_customer_service_bot)
                        </p>
                      </div>

                      {/* Telegram Connection Section */}
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
                              <li>Choose a name for your bot</li>
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
                    </>
                  ) : (
                    // Web Live Chat specific fields
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="websiteUrl">Website URL *</Label>
                        <Input
                          id="websiteUrl"
                          type="url"
                          placeholder="https://your-website.com"
                          value={newPlatform.websiteUrl}
                          onChange={(e) => setNewPlatform(prev => ({ ...prev, websiteUrl: e.target.value }))}
                        />
                        <p className="text-xs text-muted-foreground">
                          The website where you want to embed the live chat
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="businessCategory">Business Category</Label>
                        <Select 
                          value={newPlatform.businessCategory} 
                          onValueChange={(value) => setNewPlatform(prev => ({ ...prev, businessCategory: value }))}
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
                    </>
                  )}

                 {/* Profile Photo / Logo */}
                 <div className="space-y-2">
                   <Label htmlFor="profilePhoto">Profile Photo / Logo</Label>
                   <div className="flex items-center gap-4">
                     <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-muted-foreground/25">
                       {newPlatform.profilePhoto ? (
                         <img
                           src={URL.createObjectURL(newPlatform.profilePhoto)}
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
                       value={newPlatform.selectedAIAgent} 
                       onValueChange={(value) => setNewPlatform(prev => ({ ...prev, selectedAIAgent: value }))}
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
                             checked={newPlatform.selectedHumanAgents.includes(agent.user_id)}
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
                 <Button variant="outline" onClick={() => setIsPlatformSetupOpen(false)} disabled={isSubmitting}>
                   Cancel
                 </Button>
                                   <Button 
                    onClick={() => handlePlatformSetup(newPlatform)} 
                    disabled={
                      isSubmitting || 
                      !newPlatform.brandName || 
                      !newPlatform.displayName || 
                      !newPlatform.selectedAIAgent ||
                      (selectedPlatformType === 'whatsapp' && (!newPlatform.phoneNumber || !isWhatsAppConnected)) ||
                      (selectedPlatformType === 'telegram' && (!newPlatform.telegramBotToken || !newPlatform.telegramBotUsername)) ||
                      (selectedPlatformType === 'web' && !newPlatform.websiteUrl)
                    }
                  >
                   {isSubmitting ? "Creating..." : "Create Platform"}
                 </Button>
               </div>
             </DialogContent>
           </Dialog>

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
                  {selectedPlatformData ? selectedPlatformData.brand_name.toUpperCase() : 'Select Platform'}
                </h1>
                <p className="text-muted-foreground">
                  {selectedPlatformData ? selectedPlatformData.whatsapp_display_name : 'Choose a platform to manage'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {selectedPlatformData && (
                <>
                  <Button variant="outline" size="sm">
                    Sim
                  </Button>
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      if (selectedPlatformData) {
                        deletePlatform(selectedPlatformData.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="grid gap-6">
            <Tabs defaultValue="live-chat" value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-2">
                <TabsTrigger value="live-chat">Live Chat</TabsTrigger>
                <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
              </TabsList>

              <TabsContent value="live-chat">
                <div className="grid gap-6">
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
                          value={selectedPlatformData?.ai_profile_id || ""} 
                          onValueChange={(value) => {
                            // Here you would typically update the platform's AI agent
                            // For now, we'll just update the local state
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

                  {/* Teams */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Teams</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-3">
                        You don't have any divisions yet. Create it now.
                      </p>
                      <Button variant="outline" className="text-blue-600">
                        <Plus className="h-4 w-4 mr-2" />
                        Create Division
                      </Button>
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
                      ) : humanAgents.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {humanAgents.map((agent) => (
                            <div key={agent.user_id} className="flex items-center gap-2 bg-muted px-3 py-1 rounded-md">
                              <span className="text-sm">👤 {agent.display_name || agent.email || `Agent ${agent.user_id.slice(0, 8)}`}</span>
                              <Button variant="ghost" size="sm" className="h-4 w-4 p-0">
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No human agents available</p>
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
                          Disable (Skip Asking for Name and Phone Number)
                        </Label>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Link LiveChat - Only show for web platforms */}
                  {currentPlatformType === 'web' && (
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
                            value="https://live.cekat.ai/livechat?IP_3Xb83e94"
                            readOnly
                            className="bg-background"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Embed Code - Only show for web platforms */}
                  {currentPlatformType === 'web' && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          Embed Code 
                          <HelpCircle className="h-4 w-4 text-muted-foreground" />
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Textarea
                          value={`<script type="text/javascript">
window.mychat = window.mychat || [];
window.mychat.storage = "https://live.cekat.ai/socket.io";
window.mychat.key = "3Xb83e94";
window.mychat.frameWidth = "768px";
window.mychat.frameHeight = "500px";
window.mychat.accessibility = "GULTIK-3Xb83e94";
window.mychat.position = "bottom-right";
(function() {
  var script = document.createElement('script');
  script.type = 'text/javascript';
  script.async = true;
  script.src = window.mychat.storage;
  var s = document.getElementsByTagName('script')[0];
  s.parentNode.insertBefore(script, s);
})();
</script>`}
                          readOnly
                          className="font-mono text-xs h-48 bg-muted"
                        />
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="whatsapp">
                {currentPlatformType === 'whatsapp' ? (
                  <div className="grid gap-6">
                    {/* Sessions List */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Existing WhatsApp Sessions</CardTitle>
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
                              const isLoggingOut = sessionName ? loggingOutSessions.has(sessionName) : false;
                              const hasNumber = Boolean(phone);
                              const isScanQr = status === "SCAN_QR_CODE";
                              const isLoggedIn = status === "WORKING" && hasNumber;
                              const logoutDisabled = !isLoggedIn || ["STARTING", "STOPPED"].includes(status);
                              return (
                                <div key={idx} className="flex items-center justify-between rounded-md border p-3">
                                  <div>
                                    <div className="text-sm font-medium">{name}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {isScanQr || !hasNumber ? "No WhatsApp number connected" : phone}
                                    </div>
                                    {(isScanQr || !hasNumber) && (
                                      <div className="text-[11px] text-amber-600 mt-1">Awaiting QR scan to connect</div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant={isLoggedIn ? 'default' : 'secondary'} className="text-xs">
                                      {status}
                                    </Badge>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={!sessionName || isLoggingOut || logoutDisabled}
                                      onClick={() => logoutWhatsAppSession(sessionName)}
                                    >
                                      {isLoggingOut ? "Logging out..." : "Logout"}
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* WhatsApp Connection */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          Connect WhatsApp
                          <HelpCircle className="h-4 w-4 text-muted-foreground" />
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-3">
                          Login to your WhatsApp account by scanning a QR code with your phone.
                        </p>
                        <Dialog
                          open={isWhatsAppDialogOpen}
                          onOpenChange={(open) => {
                            setIsWhatsAppDialogOpen(open);
                            if (open) {
                              // First check if already connected
                              checkSessionStatus().then((isConnected) => {
                                if (!isConnected) {
                                  fetchWhatsAppQr();
                                }
                              });
                            } else {
                              setQrImageUrl(null);
                              setQrError(null);
                            }
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button className="bg-green-600 hover:bg-green-700 text-white">Login with WhatsApp</Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>WhatsApp Login</DialogTitle>
                              <DialogDescription>
                                Scan this QR in WhatsApp: Menu → Linked devices → Link a device.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="flex flex-col items-center justify-center gap-4">
                              {isFetchingQR && (
                                <div className="text-sm text-muted-foreground">Generating QR...</div>
                              )}
                              {qrError && (
                                <div className="w-full">
                                  <div className="text-sm text-red-600 mb-2">{qrError}</div>
                                  <Button variant="outline" onClick={fetchWhatsAppQr}>Retry</Button>
                                </div>
                              )}
                              {qrImageUrl && (
                                <>
                                  <img
                                    src={qrImageUrl}
                                    alt="WhatsApp QR"
                                    className="w-64 h-64 rounded-md border"
                                  />
                                  <div className="flex items-center gap-3">
                                    <Button 
                                      variant="outline" 
                                      onClick={checkSessionStatus}
                                      disabled={isFetchingQR}
                                    >
                                      Check Connection
                                    </Button>
                                    <span className="text-xs text-muted-foreground">Auto check every 5s</span>
                                  </div>
                                </>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      This platform is not configured for WhatsApp. Only WhatsApp platforms can access this tab.
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectedPlatforms;