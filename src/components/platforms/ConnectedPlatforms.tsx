import { useState } from "react";
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

const ConnectedPlatforms = () => {
  const [selectedInbox, setSelectedInbox] = useState("gultik");
  const [selectedAgent, setSelectedAgent] = useState("gultik-ai");
  const [selectedHumanAgent, setSelectedHumanAgent] = useState("agent-01");

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
        </div>
      </div>
    </div>
  );
};

export default ConnectedPlatforms;