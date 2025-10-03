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
import { ChevronDown, Edit, Trash2, Plus, Users, UserCheck, Loader2, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useHumanAgents, AgentWithDetails } from "@/hooks/useHumanAgents";
import { useAIAgents } from "@/hooks/useAIAgents";
import PermissionGate from "@/components/rbac/PermissionGate";
import { useRBAC } from "@/contexts/RBACContext";
import { ROLES } from "@/types/rbac";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/supabase";
import { Checkbox } from "@/components/ui/checkbox";

const HumanAgents = () => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  // Teams UI disabled for now
  // const [isCreateTeamDialogOpen, setIsCreateTeamDialogOpen] = useState(false);
  const [isEditLimitOpen, setIsEditLimitOpen] = useState(false);
  const [isUsageOpen, setIsUsageOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentWithDetails | null>(null);
  const [savingLimits, setSavingLimits] = useState(false);
  const [tokenLimitForm, setTokenLimitForm] = useState<{ enabled: boolean; perDay: number; perMonth: number; twoFA: boolean }>({ enabled: false, perDay: 0, perMonth: 0, twoFA: false });
  const [usageRange, setUsageRange] = useState<"7d" | "30d" | "this_month">("7d");
  const [usageTotal, setUsageTotal] = useState<number | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [agentStats, setAgentStats] = useState<{ assignedTo: number; assignedBy: number; resolvedBy: number; handoverFromAI: number } | null>(null);
  const [newAgent, setNewAgent] = useState<{ name: string; email: string; role: "master_agent" | "super_agent" | "agent"; phone?: string }>({ 
    name: "", 
    email: "", 
    role: "agent" 
  });
  const [enable2FA, setEnable2FA] = useState(false);
  // const [newTeam, setNewTeam] = useState<{ name: string; description: string }>({ 
  //   name: "", 
  //   description: "" 
  // });
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [selectedSuperForNewAgent, setSelectedSuperForNewAgent] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deletingAgent, setDeletingAgent] = useState(false);
  const [agentPendingDelete, setAgentPendingDelete] = useState<AgentWithDetails | null>(null);
  const { toast } = useToast();
  const { hasPermission, hasRole } = useRBAC();

  // Form validation
  const isFormValid = newAgent.name.trim() && 
    newAgent.email.trim() && 
    (newAgent.role !== 'agent' || selectedSuperForNewAgent);
  const [selectedSuperForCluster, setSelectedSuperForCluster] = useState<string | null>(null);
  const { aiAgents, setFilterBySuper, fetchAIAgents } = useAIAgents();

  const {
    agents,
    // teams,
    loading,
    error,
    fetchAgents,
    createAgent,
    updateAgentStatus,
    updateAgentRole,
    deleteAgent,
    // createTeam,
    // addAgentToTeam,
    // removeAgentFromTeam,
    setEnable2FAFlagForCreate
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

    // Validate Super Agent selection for regular agents
    if (newAgent.role === 'agent' && !selectedSuperForNewAgent) {
      toast({
        title: "Error",
        description: "Please select a Super Agent for this agent",
        variant: "destructive",
      });
      return;
    }

    try {
      setCreatingAgent(true);
      setEnable2FAFlagForCreate(enable2FA);
      const res = await createAgent({
        full_name: newAgent.name,
        email: newAgent.email,
        role: newAgent.role
      });

      // Auto-assign super_agent membership when role is agent and a super is chosen
      try {
        if (newAgent.role === 'agent') {
          // If creator is master_agent, they must select a super agent to attach
          const targetSuper = selectedSuperForNewAgent;
          if (!targetSuper) {
            toast({ title: 'Assignment needed', description: 'Select a Super Agent to attach this agent to.', variant: 'destructive' });
          } else if (res?.id) {
            // Resolve org of current user
            const { data: me } = await supabase.auth.getUser();
            const { data: mem } = await supabase.from('org_members').select('org_id').eq('user_id', me?.user?.id || '').limit(1);
            const orgId = mem?.[0]?.org_id || null;
            if (orgId) {
              await supabase.from('super_agent_members').insert({ org_id: orgId, super_agent_id: targetSuper, agent_user_id: res.id });
            }
          }
        }
      } catch {}

      setNewAgent({ name: "", email: "", role: "agent" });
      setSelectedSuperForNewAgent(null);
      setEnable2FA(false);
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
    } finally {
      setCreatingAgent(false);
    }
  };

  // const handleCreateTeam = async () => {
  //   if (!newTeam.name) {
  //     toast({ title: "Error", description: "Please enter a team name", variant: "destructive" });
  //     return;
  //   }
  //   try {
  //     toast({ title: "Info", description: "Teams functionality is not available in this version" });
  //     setNewTeam({ name: "", description: "" });
  //     setIsCreateTeamDialogOpen(false);
  //   } catch (error) {
  //     toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to create team", variant: "destructive" });
  //   }
  // };

  const handleDeleteAgent = async (id: string) => {
    try {
      setDeletingAgent(true);
      await deleteAgent(id);
      toast({ title: "Success", description: "Agent deleted successfully" });
      setConfirmDeleteOpen(false);
      setAgentPendingDelete(null);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete agent",
        variant: "destructive",
      });
    } finally {
      setDeletingAgent(false);
    }
  };

  const openEditLimits = async (agent: AgentWithDetails) => {
    try {
      setSelectedAgent(agent);
      // Load current limits from users_profile
      const { data, error } = await supabase
        .from('users_profile')
        .select('token_limit_enabled, max_tokens_per_day, max_tokens_per_month, is_2fa_email_enabled')
        .eq('user_id', agent.user_id)
        .maybeSingle();
      if (error) throw error;
      setTokenLimitForm({
        enabled: !!data?.token_limit_enabled,
        perDay: Number(data?.max_tokens_per_day ?? 0),
        perMonth: Number(data?.max_tokens_per_month ?? 0),
        twoFA: !!(data as any)?.is_2fa_email_enabled,
      });
      setIsEditLimitOpen(true);
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to load token limits', variant: 'destructive' });
    }
  };

  const saveTokenLimits = async () => {
    if (!selectedAgent) return;
    try {
      setSavingLimits(true);
      const { error } = await supabase
        .from('users_profile')
        .update({
          token_limit_enabled: tokenLimitForm.enabled,
          max_tokens_per_day: Math.max(0, Math.floor(tokenLimitForm.perDay || 0)),
          max_tokens_per_month: Math.max(0, Math.floor(tokenLimitForm.perMonth || 0)),
          is_2fa_email_enabled: tokenLimitForm.twoFA,
        })
        .eq('user_id', selectedAgent.user_id);
      if (error) throw error;
      toast({ title: 'Saved', description: 'Token limits updated.' });
      setIsEditLimitOpen(false);
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to save token limits', variant: 'destructive' });
    } finally {
      setSavingLimits(false);
    }
  };

  const computeRange = (range: "7d" | "30d" | "this_month") => {
    const now = new Date();
    let start: Date;
    if (range === 'this_month') {
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
    } else {
      const days = range === '7d' ? 7 : 30;
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
      start.setUTCDate(start.getUTCDate() - (days - 1));
    }
    const end = now;
    return { start: start.toISOString(), end: end.toISOString() };
  };

  const openUsageDetails = async (agent: AgentWithDetails) => {
    setSelectedAgent(agent);
    setIsUsageOpen(true);
    await fetchUsage(agent.user_id, usageRange);
  };

  const fetchUsage = async (userId: string, range: "7d" | "30d" | "this_month") => {
    try {
      setLoadingUsage(true);
      const { start, end } = computeRange(range);
      // Aggregate per super-agent cluster. If the selected user is attached to a super agent,
      // count tokens for ALL agents in that cluster. Otherwise, count by this user only.
      const superId = agents.find(a => a.user_id === userId)?.super_agent_id || null;
      const clusterIds = superId
        ? agents.filter(a => a.primaryRole === 'agent' && a.super_agent_id === superId).map(a => a.user_id)
        : [userId];

      // Gather threads assigned to any agent in the cluster within timeframe
      const { data: th } = await supabase
        .from('threads')
        .select('id')
        .in('assignee_user_id', clusterIds)
        .gte('created_at', start)
        .lt('created_at', end);
      const threadIds = (th || []).map((t: any) => t.id);

      // Sum token logs by thread match and by explicit user match, dedup by log id
      const [byThread, byUser] = await Promise.all([
        threadIds.length > 0
          ? supabase
              .from('token_usage_logs')
              .select('id,total_tokens')
              .in('thread_id', threadIds)
              .gte('made_at', start)
              .lt('made_at', end)
          : Promise.resolve({ data: [] as any[] } as any),
        supabase
          .from('token_usage_logs')
          .select('id,total_tokens')
          .in('user_id', clusterIds)
          .gte('made_at', start)
          .lt('made_at', end)
      ]);
      const seen = new Set<string>();
      let total = 0;
      for (const row of ([...(byThread.data as any[]) || [], ...(byUser.data as any[]) || []])) {
        const id = String(row.id);
        if (seen.has(id)) continue;
        seen.add(id);
        total += Number(row.total_tokens || 0);
      }
      setUsageTotal(total);

      // Parallel fetch of agent activity stats in the same range
      const [qAssignedTo, qAssignedBy, qResolvedBy, qHandoverFromAI] = await Promise.all([
        supabase.from('threads').select('id', { count: 'exact', head: true }).gte('created_at', start).lt('created_at', end).eq('assignee_user_id', userId),
        supabase.from('threads').select('id', { count: 'exact', head: true }).gte('created_at', start).lt('created_at', end).eq('assigned_by_user_id', userId),
        supabase.from('threads').select('id', { count: 'exact', head: true }).gte('created_at', start).lt('created_at', end).eq('resolved_by_user_id', userId),
        supabase.from('threads').select('id', { count: 'exact', head: true }).gte('created_at', start).lt('created_at', end).eq('assignee_user_id', userId).not('ai_handoff_at', 'is', null),
      ]);
      setAgentStats({
        assignedTo: qAssignedTo.count || 0,
        assignedBy: qAssignedBy.count || 0,
        resolvedBy: qResolvedBy.count || 0,
        handoverFromAI: qHandoverFromAI.count || 0,
      });
    } catch (e: any) {
      setUsageTotal(null);
      setAgentStats(null);
      toast({ title: 'Error', description: e?.message || 'Failed to load usage', variant: 'destructive' });
    } finally {
      setLoadingUsage(false);
    }
  };

  const handleStatusChange = async (agentId: string, status: "Active" | "Inactive") => {
    try {
      const { error } = await supabase
        .from('users_profile')
        .update({ is_active: status === 'Active' })
        .eq('user_id', agentId);
      if (error) throw error;
      toast({ title: 'Success', description: `Status changed to ${status}` });
      await fetchAgents();
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to change status', variant: 'destructive' });
    }
  };

  const handleRoleChange = async (agentId: string, role: "master_agent" | "super_agent" | "agent") => {
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
    return status === "Active" ? "bg-green-500" : "bg-gray-400";
  };

  const roleBadgeClass = (role: "master_agent" | "super_agent" | "agent" | null) => {
    if (role === "master_agent") return "bg-blue-100 text-blue-700";
    if (role === "super_agent") return "bg-emerald-100 text-emerald-700";
    if (role === "agent") return "bg-gray-100 text-gray-700";
    return "bg-gray-100 text-gray-700";
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
          <p className="text-muted-foreground">Manage your human agents</p>
        </div>
        <PermissionGate permission={'super_agents.create'}>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
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
                <Label htmlFor="agent-name">Agent Name <span className="text-red-500">*</span></Label>
                <Input
                  id="agent-name"
                  value={newAgent.name}
                  onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                  placeholder="Enter agent name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent-email">Email <span className="text-red-500">*</span></Label>
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
              <div className="flex items-center gap-2 pt-1">
                <Checkbox id="agent-2fa" checked={enable2FA} onCheckedChange={(v)=>setEnable2FA(!!v)} />
                <Label htmlFor="agent-2fa" className="text-sm">Enable email 2FA for this agent</Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent-role">Role</Label>
                <Select value={newAgent.role} onValueChange={(value) => setNewAgent({ ...newAgent, role: value as "master_agent" | "super_agent" | "agent" })}>
                  <SelectTrigger className="bg-background border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background border z-50">
                    <SelectItem value="agent">Agent</SelectItem>
                    <SelectItem value="super_agent">Super Agent</SelectItem>
                    <PermissionGate permission={'super_agents.create'}>
                      <SelectItem value="master_agent">Master Agent</SelectItem>
                    </PermissionGate>
                  </SelectContent>
                </Select>
              </div>
              {newAgent.role === 'agent' && (
                <div className="space-y-2">
                  <Label>Attach to Super Agent <span className="text-red-500">*</span></Label>
                  <Select value={selectedSuperForNewAgent || ''} onValueChange={(v)=>setSelectedSuperForNewAgent(v)}>
                    <SelectTrigger className="bg-background border">
                      <SelectValue placeholder="Select Super Agent" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border z-50">
                      {agents.filter(a=>a.primaryRole==='super_agent').map(sa=> (
                        <SelectItem key={sa.user_id} value={sa.user_id}>{sa.display_name || sa.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {/* Help text for required fields */}
              <div className="text-sm text-muted-foreground">
                <p>Fields marked with <span className="text-red-500">*</span> are required.</p>
                {newAgent.role === 'agent' && (
                  <p className="mt-1">Agents must be attached to a Super Agent.</p>
                )}
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={handleCreateAgent} 
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" 
                  disabled={creatingAgent || !isFormValid}
                >
                  {creatingAgent ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </span>
                  ) : (
                    "Create Agent"
                  )}
                </Button>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} className="flex-1" disabled={creatingAgent}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
          </Dialog>
        </PermissionGate>
      </div>

      {/* Tabs commented out for now */}
      {/* <Tabs defaultValue="agents" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-1">
          <TabsTrigger value="agents" className="gap-2">
            <UserCheck className="h-4 w-4" />
            Human Agent
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="space-y-4"> */}
        <div className="space-y-4">
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
                    <PermissionGate permission={'super_agents.create'}>
                      <Button onClick={() => setIsCreateDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Agent
                      </Button>
                    </PermissionGate>
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
                      {hasPermission('super_agents.update') && agent.primaryRole !== 'master_agent' ? (
                        // Editable role dropdown for users with edit permission
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="gap-2 h-8">
                            <Badge className={`text-xs ${roleBadgeClass(agent.primaryRole)}`}>
                                {agent.primaryRole === "master_agent" ? "Master Agent" : 
                                 agent.primaryRole === "super_agent" ? "Super Agent" : 
                                 agent.primaryRole === "agent" ? "Agent" : "No Role"}
                              </Badge>
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="bg-background border z-50">
                            {/* Never allow changing a Master Agent's role */}
                            {agent.primaryRole !== 'master_agent' && (
                              <DropdownMenuItem onClick={() => handleRoleChange(agent.user_id, "agent")}>
                              <Badge className={`text-xs ${roleBadgeClass("agent")}`}>Agent</Badge>
                              </DropdownMenuItem>
                            )}
                            {agent.primaryRole !== 'master_agent' && (
                              <DropdownMenuItem onClick={() => handleRoleChange(agent.user_id, "super_agent")}>
                              <Badge className={`text-xs ${roleBadgeClass("super_agent")}`}>Super Agent</Badge>
                              </DropdownMenuItem>
                            )}
                            {/* Creating/promoting to Master Agent disabled in UI */}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        // Read-only role badge for users without edit permission
                        <Badge className={`text-xs ${roleBadgeClass(agent.primaryRole)}`}>
                          {agent.primaryRole === "master_agent" ? "Master Agent" : 
                           agent.primaryRole === "super_agent" ? "Super Agent" : 
                           agent.primaryRole === "agent" ? "Agent" : "No Role"}
                        </Badge>
                      )}
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
                          <DropdownMenuItem onClick={() => handleStatusChange(agent.user_id, "Active")}>
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full bg-green-500" />
                              Active
                            </div>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(agent.user_id, "Inactive")}>
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full bg-gray-400" />
                              Inactive
                            </div>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex items-center gap-1">
                      <PermissionGate permission={'users_profile.update_token_limit'}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          onClick={() => openEditLimits(agent)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </PermissionGate>
                      {hasRole(ROLES.MASTER_AGENT) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          onClick={() => openUsageDetails(agent)}
                          title="View token usage"
                        >
                          <BarChart3 className="h-4 w-4" />
                        </Button>
                      )}
                      <PermissionGate permission={'super_agents.delete'}>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => { setAgentPendingDelete(agent); setConfirmDeleteOpen(true); }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </PermissionGate>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        {/* </TabsContent>

        {/** Teams tab removed temporarily */}
      {/* </Tabs> */}

      {/* Clustering UI: Super Agent → Agents & AI Agents */}
      <div className="rounded-lg border bg-card">
        <div className="p-4 border-b bg-muted/50 font-medium text-sm">Clustering: Super Agents → Agents & AI Agents</div>
        <div className="p-4 space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Select Super Agent</Label>
              <Select value={selectedSuperForCluster || ''} onValueChange={(v)=>{ setSelectedSuperForCluster(v); setFilterBySuper(v); }}>
                <SelectTrigger className="bg-background border">
                  <SelectValue placeholder="Choose a super agent" />
                </SelectTrigger>
                <SelectContent className="bg-background border z-50">
                  {agents.filter(a=>a.primaryRole==='super_agent').map(sa => (
                    <SelectItem key={sa.user_id} value={sa.user_id}>{sa.display_name || sa.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Agents</Label>
              <div className="rounded-md border p-2 max-h-64 overflow-auto">
                {!selectedSuperForCluster ? (
                  <div className="text-sm text-muted-foreground">Select a Super Agent.</div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">Assigned to this Super</div>
                    {(agents.filter(a=>a.primaryRole==='agent' && a.super_agent_id===selectedSuperForCluster)).map(a => (
                      <div key={a.user_id} className="flex items-center justify-between text-sm">
                        <span>{a.display_name || a.email}</span>
                        <Button size="sm" variant="outline" onClick={async()=>{
                          try{
                            const { data: me } = await supabase.auth.getUser();
                            const { data: mem } = await supabase.from('org_members').select('org_id').eq('user_id', me?.user?.id||'').limit(1);
                            const orgId = mem?.[0]?.org_id || null;
                            if (orgId) await supabase.from('super_agent_members').delete().eq('org_id', orgId).eq('agent_user_id', a.user_id);
                            toast({ title: 'Unassigned', description: 'Agent removed from Super Agent' });
                            await fetchAgents({ force: true });
                          }catch(e:any){ toast({ title:'Error', description:e?.message||'Failed', variant:'destructive' }); }
                        }}>Remove</Button>
                      </div>
                    ))}
                    <div className="h-px bg-border my-2"></div>
                    <div className="text-xs text-muted-foreground">Available (Unassigned)</div>
                    {(agents.filter(a=>a.primaryRole==='agent' && !a.super_agent_id)).map(a => (
                      <div key={a.user_id} className="flex items-center justify-between text-sm">
                        <span>{a.display_name || a.email}</span>
                        <Button size="sm" onClick={async()=>{
                          try{
                            const { data: me } = await supabase.auth.getUser();
                            const { data: mem } = await supabase.from('org_members').select('org_id').eq('user_id', me?.user?.id||'').limit(1);
                            const orgId = mem?.[0]?.org_id || null;
                            if (orgId && selectedSuperForCluster) await supabase.from('super_agent_members').insert({ org_id: orgId, super_agent_id: selectedSuperForCluster, agent_user_id: a.user_id });
                            toast({ title: 'Assigned', description: 'Agent assigned to Super Agent' });
                            await fetchAgents({ force: true });
                          }catch(e:any){ toast({ title:'Error', description:e?.message||'Failed', variant:'destructive' }); }
                        }}>Assign</Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>AI Agents</Label>
              <div className="rounded-md border p-2 max-h-64 overflow-auto">
                <div className="text-sm text-muted-foreground">
                  AI Agents are now independent and can be assigned to channels directly in the Platforms section.
                  Super Agents are assigned to channels, not to AI Agents.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirm Delete Dialog */}
      <Dialog open={confirmDeleteOpen} onOpenChange={(v)=>{ if (!deletingAgent) setConfirmDeleteOpen(v); }}>
        <DialogContent className="sm:max-w-md bg-background border">
          <DialogHeader>
            <DialogTitle>Delete Agent</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to permanently delete {agentPendingDelete?.display_name || 'this agent'}?
              This will remove their profile and role assignments. This action cannot be undone.
            </p>
            <div className="rounded-md border p-3 bg-muted/30 text-sm">
              <div><span className="text-muted-foreground">Name:</span> {agentPendingDelete?.display_name || '—'}</div>
              <div><span className="text-muted-foreground">Email:</span> {agentPendingDelete?.email || '—'}</div>
              <div><span className="text-muted-foreground">Role:</span> {agentPendingDelete?.primaryRole || '—'}</div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => agentPendingDelete && handleDeleteAgent(agentPendingDelete.user_id)}
                disabled={deletingAgent}
              >
                {deletingAgent ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting...
                  </span>
                ) : (
                  'Delete'
                )}
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDeleteOpen(false)} disabled={deletingAgent}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Token Limits Dialog */}
      <Dialog open={isEditLimitOpen} onOpenChange={setIsEditLimitOpen}>
        <DialogContent className="sm:max-w-md bg-background border">
          <DialogHeader>
            <DialogTitle>Token Limits{selectedAgent ? ` — ${selectedAgent.display_name || selectedAgent.email}` : ''}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Enable Limits</Label>
                <p className="text-xs text-muted-foreground">Block token-consuming actions when exceeded.</p>
              </div>
              <Switch checked={tokenLimitForm.enabled} onCheckedChange={(v) => setTokenLimitForm({ ...tokenLimitForm, enabled: !!v })} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Require Email 2FA</Label>
                <p className="text-xs text-muted-foreground">User must enter a one-time code at sign-in.</p>
              </div>
              <Switch checked={tokenLimitForm.twoFA} onCheckedChange={(v) => setTokenLimitForm({ ...tokenLimitForm, twoFA: !!v })} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="limit-day">Max Tokens / Day</Label>
                <Input id="limit-day" type="number" min={0} value={tokenLimitForm.perDay} onChange={(e) => setTokenLimitForm({ ...tokenLimitForm, perDay: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="limit-month">Max Tokens / Month</Label>
                <Input id="limit-month" type="number" min={0} value={tokenLimitForm.perMonth} onChange={(e) => setTokenLimitForm({ ...tokenLimitForm, perMonth: Number(e.target.value) })} />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={saveTokenLimits} disabled={savingLimits} className="flex-1 bg-green-600 hover:bg-green-700 text-white">Save</Button>
              <Button variant="outline" onClick={() => setIsEditLimitOpen(false)} className="flex-1">Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Usage Details Dialog */}
      <Dialog open={isUsageOpen} onOpenChange={setIsUsageOpen}>
        <DialogContent className="sm:max-w-md bg-background border">
          <DialogHeader>
            <DialogTitle>Token Usage{selectedAgent ? ` — ${selectedAgent.display_name || selectedAgent.email}` : ''}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Timeframe</Label>
              <Select value={usageRange} onValueChange={async (v) => { const r = v as any; setUsageRange(r); if (selectedAgent) await fetchUsage(selectedAgent.user_id, r); }}>
                <SelectTrigger className="bg-background border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border z-50">
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="this_month">This month</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-md border p-4">
              <div className="text-sm text-muted-foreground">Total Tokens</div>
              <div className="text-2xl font-bold">{loadingUsage ? '…' : (usageTotal?.toLocaleString() ?? 0)}</div>
            </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-md border p-3">
              <div className="text-sm text-muted-foreground">Assigned To Agent</div>
              <div className="text-xl font-semibold">{agentStats?.assignedTo ?? 0}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-sm text-muted-foreground">Takeovers Initiated</div>
              <div className="text-xl font-semibold">{agentStats?.assignedBy ?? 0}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-sm text-muted-foreground">Resolved by Agent</div>
              <div className="text-xl font-semibold">{agentStats?.resolvedBy ?? 0}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-sm text-muted-foreground">AI→Agent Handovers</div>
              <div className="text-xl font-semibold">{agentStats?.handoverFromAI ?? 0}</div>
            </div>
          </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setIsUsageOpen(false)}>Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HumanAgents;