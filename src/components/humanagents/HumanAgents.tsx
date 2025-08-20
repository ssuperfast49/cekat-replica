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
import { ChevronDown, Edit, Trash2, Plus, Users, UserCheck, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useHumanAgents, AgentWithDetails } from "@/hooks/useHumanAgents";

const HumanAgents = () => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreateTeamDialogOpen, setIsCreateTeamDialogOpen] = useState(false);
  const [newAgent, setNewAgent] = useState<{ name: string; email: string; role: "owner" | "admin" | "agent"; phone?: string }>({ 
    name: "", 
    email: "", 
    role: "agent" 
  });
  const [newTeam, setNewTeam] = useState<{ name: string; description: string }>({ 
    name: "", 
    description: "" 
  });
  const { toast } = useToast();

  const {
    agents,
    teams,
    loading,
    error,
    createAgent,
    updateAgentStatus,
    updateAgentRole,
    deleteAgent,
    createTeam,
    addAgentToTeam,
    removeAgentFromTeam
  } = useHumanAgents();

  const handleCreateAgent = async () => {
    if (!newAgent.name || !newAgent.email) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      await createAgent({
        full_name: newAgent.name,
        email: newAgent.email,
        role: newAgent.role
      });

      setNewAgent({ name: "", email: "", role: "agent" });
      setIsCreateDialogOpen(false);
      
      toast({
        title: "Success",
        description: "Agent created successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create agent",
        variant: "destructive",
      });
    }
  };

  const handleCreateTeam = async () => {
    if (!newTeam.name) {
      toast({
        title: "Error",
        description: "Please enter a team name",
        variant: "destructive",
      });
      return;
    }

    try {
      // Since we don't have teams functionality, just show a message
      toast({
        title: "Info",
        description: "Teams functionality is not available in this version",
      });

      setNewTeam({ name: "", description: "" });
      setIsCreateTeamDialogOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create team",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAgent = async (id: string) => {
    try {
      await deleteAgent(id);
      toast({
        title: "Success",
        description: "Agent deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete agent",
        variant: "destructive",
      });
    }
  };

  const handleStatusChange = async (agentId: string, status: "Online" | "Offline") => {
    // Since we don't have status functionality, just show a message
    toast({
      title: "Info",
      description: `Status functionality is not available in this version`,
    });
  };

  const handleRoleChange = async (agentId: string, role: "owner" | "admin" | "agent") => {
    try {
      await updateAgentRole(agentId, role);
      toast({
        title: "Success",
        description: `Agent role updated to ${role}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update role",
        variant: "destructive",
      });
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getStatusColor = (status: string) => {
    return status === "Online" ? "bg-green-500" : "bg-gray-400";
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Human Agent Settings</h1>
            <p className="text-muted-foreground">Manage your human agents and teams</p>
          </div>
        </div>
        <div className="rounded-lg border bg-red-50 p-6">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
                <Label htmlFor="agent-phone">Phone (Optional)</Label>
                <Input
                  id="agent-phone"
                  type="tel"
                  value={newAgent.phone || ""}
                  onChange={(e) => setNewAgent({ ...newAgent, phone: e.target.value })}
                  placeholder="Enter phone number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent-role">Role</Label>
                <Select value={newAgent.role} onValueChange={(value) => setNewAgent({ ...newAgent, role: value as "owner" | "admin" | "agent" })}>
                  <SelectTrigger className="bg-background border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background border z-50">
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="agent">Agent</SelectItem>
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
            <div className="grid grid-cols-[200px,1fr,120px,120px,100px] gap-4 p-4 border-b bg-muted/50 font-medium text-sm">
              <div>Agent Name</div>
              <div>Email</div>
              <div>Role</div>
              <div>Status</div>
              <div>Action</div>
            </div>
            <div className="divide-y">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Loading agents...</span>
                  </div>
                </div>
              ) : agents.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Agents Yet</h3>
                    <p className="text-muted-foreground mb-4">Create your first agent to get started.</p>
                    <Button onClick={() => setIsCreateDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Agent
                    </Button>
                  </div>
                </div>
              ) : (
                agents.map((agent) => (
                  <div key={agent.user_id} className="grid grid-cols-[200px,1fr,120px,120px,100px] gap-4 p-4 items-center hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                          {getInitials(agent.display_name || 'Unknown')}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-blue-600">{agent.display_name || 'Unknown User'}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">{agent.email || 'No email'}</div>
                    <div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="gap-2 h-8">
                            <Badge variant={agent.role === "admin" ? "default" : "secondary"} className="text-xs">
                              {agent.role}
                            </Badge>
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-background border z-50">
                          <DropdownMenuItem onClick={() => handleRoleChange(agent.user_id, "agent")}>
                            <Badge variant="secondary" className="text-xs">agent</Badge>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleRoleChange(agent.user_id, "admin")}>
                            <Badge variant="default" className="text-xs">admin</Badge>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleRoleChange(agent.user_id, "owner")}>
                            <Badge variant="default" className="text-xs">owner</Badge>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
                          <DropdownMenuItem onClick={() => handleStatusChange(agent.user_id, "Online")}>
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full bg-green-500" />
                              Online
                            </div>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(agent.user_id, "Offline")}>
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
                        onClick={() => handleDeleteAgent(agent.user_id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="teams" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Teams</h3>
            <Dialog open={isCreateTeamDialogOpen} onOpenChange={setIsCreateTeamDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Team
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md bg-background border">
                <DialogHeader>
                  <DialogTitle>Create New Team</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="team-name">Team Name</Label>
                    <Input
                      id="team-name"
                      value={newTeam.name}
                      onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                      placeholder="Enter team name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="team-description">Description (Optional)</Label>
                    <Input
                      id="team-description"
                      value={newTeam.description}
                      onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
                      placeholder="Enter team description"
                    />
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button onClick={handleCreateTeam} className="flex-1">
                      Create Team
                    </Button>
                    <Button variant="outline" onClick={() => setIsCreateTeamDialogOpen(false)} className="flex-1">
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading teams...</span>
              </div>
            </div>
          ) : teams.length === 0 ? (
            <div className="rounded-lg border bg-card p-8 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Teams Yet</h3>
              <p className="text-muted-foreground mb-4">Create teams to organize your agents and improve collaboration.</p>
              <Button onClick={() => setIsCreateTeamDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Team
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {teams.map((team) => (
                <div key={team.id} className="rounded-lg border bg-card p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-lg font-semibold">{team.name}</h4>
                      {team.description && (
                        <p className="text-sm text-muted-foreground">{team.description}</p>
                      )}
                    </div>
                    <Badge variant="secondary">{teams.length} members</Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <h5 className="text-sm font-medium text-muted-foreground">Team Members</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {agents.map(agent => (
                        <div key={agent.user_id} className="flex items-center gap-2 p-2 rounded border">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                              {getInitials(agent.display_name || 'Unknown')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{agent.display_name || 'Unknown User'}</p>
                            <p className="text-xs text-muted-foreground truncate">{agent.email || 'No email'}</p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {agent.role}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default HumanAgents;