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
import { Plus, Settings, Camera, HelpCircle, ExternalLink, Code, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ConnectedPlatforms = () => {
  const [selectedInbox, setSelectedInbox] = useState("gultik");
  const [selectedAgent, setSelectedAgent] = useState("gultik-ai");
  const [selectedHumanAgent, setSelectedHumanAgent] = useState("agent-01");

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
      const json = await response.json();
      const payload = Array.isArray(json) ? json[0] : json;
      if (!payload || !payload.data || !payload.mimetype) {
        throw new Error("Invalid QR response shape");
      }
      const dataUrl = `data:${payload.mimetype};base64,${payload.data}`;
      setQrImageUrl(dataUrl);
    } catch (error: any) {
      setQrError(error?.message || "Failed to generate QR");
    } finally {
      isFetchingRef.current = false;
      setIsFetchingQR(false);
    }
  };

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

  const inboxes = [
    { id: "gultik", name: "GULTIK TOP UP", platform: "GULTIK.AI", status: "active" },
    { id: "orang", name: "ORANG TOP U...", platform: "ORANG.AI", status: "inactive" },
    { id: "antatoto", name: "ANTATOTO TOP...", platform: "ANTATOTO.AI", status: "inactive" }
  ];

  const selectedInboxData = inboxes.find(inbox => inbox.id === selectedInbox);

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
          
          <div className="space-y-2">
            {inboxes.map((inbox) => (
              <Card 
                key={inbox.id}
                className={`cursor-pointer transition-colors hover:bg-accent ${
                  selectedInbox === inbox.id ? 'bg-accent border-primary' : ''
                }`}
                onClick={() => setSelectedInbox(inbox.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-xs font-medium text-blue-600">
                        {inbox.name.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm truncate">{inbox.name}</h3>
                      <p className="text-xs text-muted-foreground">{inbox.platform}</p>
                    </div>
                    <Badge 
                      variant={inbox.status === 'active' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {inbox.status === 'active' ? '●' : '○'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Button variant="outline" className="w-full mt-4 text-blue-600 border-blue-200 hover:bg-blue-50">
            <Plus className="h-4 w-4 mr-2" />
            Click to Connect A Platform
          </Button>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Add a new Whatsapp Inbox
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
                <h1 className="text-2xl font-bold">{selectedInboxData?.name.toUpperCase()}</h1>
                <p className="text-muted-foreground">{selectedInboxData?.platform}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                Sim
              </Button>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
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
                      <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gultik-ai">🤖 GULTIK AI</SelectItem>
                        </SelectContent>
                      </Select>
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
                      <div className="flex gap-2">
                        <div className="flex items-center gap-2 bg-muted px-3 py-1 rounded-md">
                          <span className="text-sm">👤 Agent 01</span>
                          <Button variant="ghost" size="sm" className="h-4 w-4 p-0">
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
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

                  {/* Link LiveChat */}
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
                </div>
              </TabsContent>

              <TabsContent value="whatsapp">
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
                            fetchWhatsAppQr();
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
                                  <Button variant="outline" onClick={fetchWhatsAppQr} disabled={isFetchingQR}>Refresh now</Button>
                                  <span className="text-xs text-muted-foreground">Auto refresh in {qrCountdown}s</span>
                                </div>
                              </>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectedPlatforms;