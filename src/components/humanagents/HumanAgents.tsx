import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, Edit, Trash2, Plus, Users, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Agent {
  id: string;
  name: string;
  email: string;
  role: "Agent" | "Super Agent";
  status: "Online" | "Offline";
  avatar?: string;
}

const mockAgents: Agent[] = [
  { id: "1", name: "Agent 03", email: "agent03aog@gmail.com", role: "Agent", status: "Offline" },
  { id: "2", name: "Agent 02", email: "agent02aog@gmail.com", role: "Agent", status: "Offline" },
  { id: "3", name: "Agent 01", email: "agent01aog@gmail.com", role: "Agent", status: "Offline" },
  { id: "4", name: "Audit 4", email: "audit4@gmail.com", role: "Super Agent", status: "Online" },
  { id: "5", name: "Julian", email: "fom4dgroup@gmail.com", role: "Super Agent", status: "Online" },
];

const HumanAgents = () => {
  const [agents, setAgents] = useState<Agent[]>(mockAgents);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newAgent, setNewAgent] = useState<{ name: string; email: string; role: "Agent" | "Super Agent" }>({ name: "", email: "", role: "Agent" });
  const { toast } = useToast();

  const handleCreateAgent = () => {
    if (!newAgent.name || !newAgent.email) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const agent: Agent = {
      id: Date.now().toString(),
      name: newAgent.name,
      email: newAgent.email,
      role: newAgent.role,
      status: "Offline",
    };

    setAgents([...agents, agent]);
    setNewAgent({ name: "", email: "", role: "Agent" });
    setIsCreateDialogOpen(false);
    
    toast({
      title: "Success",
      description: "Agent created successfully",
    });
  };

  const handleDeleteAgent = (id: string) => {
    setAgents(agents.filter(agent => agent.id !== id));
    toast({
      title: "Success",
      description: "Agent deleted successfully",
    });
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getStatusColor = (status: string) => {
    return status === "Online" ? "bg-green-500" : "bg-gray-400";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Human Agent Settings</h1>
          <p className="text-muted-foreground">Manage your human agents and teams</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create Agent
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md bg-background border">
            <DialogHeader>
              <DialogTitle>Create New Agent</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="agent-name">Agent Name</Label>
                <Input
                  id="agent-name"
                  value={newAgent.name}
                  onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                  placeholder="Enter agent name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent-email">Email</Label>
                <Input
                  id="agent-email"
                  type="email"
                  value={newAgent.email}
                  onChange={(e) => setNewAgent({ ...newAgent, email: e.target.value })}
                  placeholder="Enter email address"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent-role">Role</Label>
                <Select value={newAgent.role} onValueChange={(value) => setNewAgent({ ...newAgent, role: value as "Agent" | "Super Agent" })}>
                  <SelectTrigger className="bg-background border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background border z-50">
                    <SelectItem value="Agent">Agent</SelectItem>
                    <SelectItem value="Super Agent">Super Agent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={handleCreateAgent} className="flex-1">
                  Create Agent
                </Button>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="agents" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="agents" className="gap-2">
            <UserCheck className="h-4 w-4" />
            Human Agent
          </TabsTrigger>
          <TabsTrigger value="teams" className="gap-2">
            <Users className="h-4 w-4" />
            Teams
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="space-y-4">
          <div className="rounded-lg border bg-card">
            <div className="grid grid-cols-[auto,1fr,120px,100px,100px] gap-4 p-4 border-b bg-muted/50 font-medium text-sm">
              <div>Agent Name</div>
              <div>Email</div>
              <div>Role</div>
              <div>Status</div>
              <div>Action</div>
            </div>
            <div className="divide-y">
              {agents.map((agent) => (
                <div key={agent.id} className="grid grid-cols-[auto,1fr,120px,100px,100px] gap-4 p-4 items-center hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                        {getInitials(agent.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-blue-600">{agent.name}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">{agent.email}</div>
                  <div>
                    <Badge variant={agent.role === "Super Agent" ? "default" : "secondary"} className="text-xs">
                      {agent.role}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-2 h-8">
                          <div className={`h-2 w-2 rounded-full ${getStatusColor(agent.status)}`} />
                          <span className="text-xs">{agent.status}</span>
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="bg-background border z-50">
                        <DropdownMenuItem onClick={() => {
                          setAgents(agents.map(a => a.id === agent.id ? { ...a, status: "Online" as const } : a));
                        }}>
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-green-500" />
                            Online
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          setAgents(agents.map(a => a.id === agent.id ? { ...a, status: "Offline" as const } : a));
                        }}>
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-gray-400" />
                            Offline
                          </div>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDeleteAgent(agent.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="teams" className="space-y-4">
          <div className="rounded-lg border bg-card p-8 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Teams Yet</h3>
            <p className="text-muted-foreground mb-4">Create teams to organize your agents and improve collaboration.</p>
            <Button variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Create Team
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default HumanAgents;