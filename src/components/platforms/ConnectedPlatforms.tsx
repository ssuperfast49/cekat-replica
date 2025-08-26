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
import WhatsAppPlatformForm from "./WhatsAppPlatformForm";
import TelegramPlatformForm from "./TelegramPlatformForm";
import WebPlatformForm from "./WebPlatformForm";
import WEBHOOK_CONFIG from "@/config/webhook";

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
  const [selectedPlatformType, setSelectedPlatformType] = useState<'whatsapp' | 'web' | 'telegram' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);



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
        brand_name: formData.brandName,
        website_url: formData.websiteUrl || undefined,
        business_category: formData.businessCategory || undefined,
        description: formData.description || undefined,
        whatsapp_display_name: formData.displayName,
        profile_photo_url: profilePhotoUrl || undefined,
        whatsapp_number: formData.platformType === 'whatsapp' ? formData.phoneNumber : undefined,
        telegram_bot_token: formData.platformType === 'telegram' ? formData.telegramBotToken : undefined,
        telegram_bot_username: formData.platformType === 'telegram' ? formData.telegramBotUsername : undefined,
        ai_profile_id: formData.selectedAIAgent || undefined,
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
                                                 <Button className="bg-green-600 hover:bg-green-700 text-white">
                           WhatsApp connection is handled in the platform setup form
                         </Button>
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