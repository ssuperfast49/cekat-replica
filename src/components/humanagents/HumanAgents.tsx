import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { ChevronDown, Edit, Trash2, Plus, Users, UserCheck, Loader2, BarChart3, UserPlus, RotateCcw } from "lucide-react";
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
  const [usageRange, setUsageRange] = useState<"7d" | "30d" | "this_month" | "all">("7d");
  const [dialogRange, setDialogRange] = useState<"7d" | "30d" | "this_month">("7d");
  const [usageTotal, setUsageTotal] = useState<number | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [agentStats, setAgentStats] = useState<{ assignedTo: number; assignedBy: number; resolvedBy: number; handoverFromAI: number } | null>(null);
  const [usageBySuper, setUsageBySuper] = useState<Record<string, number>>({});
  const [loadingSuperUsage, setLoadingSuperUsage] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
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
  // Pagination and Pending tab state backed by v_human_agents
  const [activeRows, setActiveRows] = useState<any[]>([]);
  const [pendingRows, setPendingRows] = useState<any[]>([]);
  const [activeTotal, setActiveTotal] = useState(0);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [activePage, setActivePage] = useState(1);
  const [pendingPage, setPendingPage] = useState(1);
  const [activePageSize, setActivePageSize] = useState(10);
  const [pendingPageSize, setPendingPageSize] = useState(10);
  const [loadingActiveTable, setLoadingActiveTable] = useState(false);
  const [loadingPendingTable, setLoadingPendingTable] = useState(false);
  const [tabValue, setTabValue] = useState<'active' | 'pending'>('active');
  const [activeAgentToSuperMap, setActiveAgentToSuperMap] = useState<Record<string, string>>({});
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);

  // Form validation
  const isFormValid = newAgent.name.trim() && 
    newAgent.email.trim() && 
    (newAgent.role !== 'agent' || selectedSuperForNewAgent);
  // Clustering section removed

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

  // Normalize role names coming from the DB view
  const normalizeRoleName = (name: string | null | undefined): "master_agent" | "super_agent" | "agent" | null => {
    if (!name) return null;
    const n = String(name).toLowerCase();
    if (n.includes('master')) return 'master_agent';
    if (n.includes('super')) return 'super_agent';
    if (n.includes('agent')) return 'agent';
    return null;
  };

  // Server-side pagination against v_human_agents
  const fetchHumanAgentsPage = async ({ invited, page, pageSize }: { invited: boolean; page: number; pageSize: number }) => {
    try {
      invited ? setLoadingPendingTable(true) : setLoadingActiveTable(true);
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      let query = supabase
        .from('v_human_agents')
        .select('*', { count: 'exact' });
      if (currentOrgId) {
        query = query.eq('org_id', currentOrgId);
      }
      if (invited) {
        // Pending = anything not accepted (including null/expired/pending)
        query = query.or('confirmation_status.is.null,confirmation_status.neq.accepted');
      } else {
        // Active = accepted
        query = query.eq('confirmation_status', 'accepted');
      }
      const { data, count, error: qErr } = await query
        .order('agent_name', { ascending: true })
        .range(from, to);
      if (qErr) throw qErr;
      if (invited) {
        setPendingRows(data || []);
        setPendingTotal(count || 0);
      } else {
        const rows = data || [];
        setActiveRows(rows);
        setActiveTotal(count || 0);
        // Load super-agent membership mapping for agents on this page
        try {
          const agentIds = rows.filter((r: any) => String((r?.role_name || '')).toLowerCase() === 'agent').map((r: any) => r.user_id);
          if (agentIds.length > 0) {
            let mapsQuery = supabase
              .from('super_agent_members')
              .select('agent_user_id, super_agent_id')
              .in('agent_user_id', agentIds);
            if (currentOrgId) mapsQuery = mapsQuery.eq('org_id', currentOrgId);
            const { data: maps } = await mapsQuery;
            const byId: Record<string, string> = {};
            (maps || []).forEach((m: any) => { if (m?.agent_user_id) byId[String(m.agent_user_id)] = String(m.super_agent_id || ''); });
            setActiveAgentToSuperMap(byId);
          } else {
            setActiveAgentToSuperMap({});
          }
        } catch {
          setActiveAgentToSuperMap({});
        }
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to fetch agents', variant: 'destructive' });
      if (invited) { setPendingRows([]); setPendingTotal(0); }
      else { setActiveRows([]); setActiveTotal(0); }
    } finally {
      invited ? setLoadingPendingTable(false) : setLoadingActiveTable(false);
    }
  };

  // Load Active on mount and when paging changes
  useEffect(() => {
    fetchHumanAgentsPage({ invited: false, page: activePage, pageSize: activePageSize });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePage, activePageSize]);

  // Load Pending when selected or paging changes
  useEffect(() => {
    if (tabValue !== 'pending') return;
    fetchHumanAgentsPage({ invited: true, page: pendingPage, pageSize: pendingPageSize });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabValue, pendingPage, pendingPageSize]);

  // Reusable renderer for a paginated table view
  const renderPagedTable = (
    rows: any[],
    loadingRows: boolean,
    total: number,
    page: number,
    pageSize: number,
    setPage: (n: number) => void,
    setPageSize: (n: number) => void,
    isPending: boolean,
    activeMap?: Record<string, string>
  ) => {
    const pageCount = Math.max(1, Math.ceil((total || 0) / Math.max(1, pageSize)));
    const canPrev = page > 1;
    const canNext = page < pageCount;
    return (
      <div className="space-y-4">
        <div className="rounded-lg border bg-card">
          <div className={`grid gap-4 p-4 border-b bg-muted/50 font-medium text-sm ${isPending ? 'grid-cols-[240px,1fr,220px,120px,160px]' : 'grid-cols-[240px,1fr,220px,160px,120px,120px]'}`}>
            <div>Agent Name</div>
            <div>Email</div>
            <div>Role</div>
            {!isPending && <div>Token Usage</div>}
            <div>Status</div>
            <div>Action</div>
          </div>
          <div className="divide-y">
            {loadingRows ? (
              <div className="flex items-center justify-center py-8">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading agents...</span>
                </div>
              </div>
            ) : rows.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No {isPending ? 'Pending' : 'Active'} Agents</h3>
                  <p className="text-muted-foreground">{isPending ? 'Invited users will appear here until they sign in.' : 'Create your first agent to get started.'}</p>
                </div>
              </div>
            ) : (
              (!isPending && activeMap
                ? (() => {
                    // Group for Active tab
                    const toLower = (v: any) => String(v || '').toLowerCase();
                    const isMaster = (r: any) => toLower(r.role_name).includes('master');
                    const isSuper = (r: any) => toLower(r.role_name).includes('super');
                    const isAgentOnly = (r: any) => toLower(r.role_name) === 'agent' || (toLower(r.role_name).includes('agent') && !toLower(r.role_name).includes('super'));

                    const masters = rows.filter(isMaster);
                    const supers = rows.filter(isSuper);
                    const agentsOnly = rows.filter(isAgentOnly);
                    const superById: Record<string, any> = Object.fromEntries(supers.map((s: any) => [String(s.user_id), s]));
                    const assigned: Record<string, any[]> = {};
                    const unassigned: any[] = [];
                    for (const a of agentsOnly) {
                      const sid = activeMap[String(a.user_id)];
                      if (sid && superById[sid]) {
                        (assigned[sid] = assigned[sid] || []).push(a);
                      } else {
                        unassigned.push(a);
                      }
                    }

                    return (
                      <>
                        {masters.map((row: any) => {
                          const primaryRole = 'master_agent' as const;
                          const stub: AgentWithDetails = {
                            user_id: String(row.user_id),
                            email: row.email || '',
                            display_name: row.agent_name || row.email || 'Unknown',
                            avatar_url: row.avatar_url || null,
                            timezone: null as any,
                            created_at: '',
                            roles: [primaryRole],
                            primaryRole: primaryRole,
                            status: row.is_active ? 'Active' : 'Inactive',
                            super_agent_id: null
                          };
                          return (
                            <div key={`master-${row.user_id}`} className="grid grid-cols-[240px,1fr,220px,160px,120px,120px] gap-4 p-4 items-center hover:bg-muted/30 transition-colors bg-blue-50/30">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="text-xs bg-blue-100 text-blue-700">{getInitials(stub.display_name || 'U')}</AvatarFallback>
                                </Avatar>
                                <span className="font-medium text-blue-600">{stub.display_name}</span>
                              </div>
                              <div className="text-sm text-muted-foreground">{stub.email || '—'}</div>
                              <div className="flex items-center h-8">
                                <Badge className={`text-xs ${roleBadgeClass(stub.primaryRole)} leading-none h-6 px-2 inline-flex items-center`}>Master Agent</Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">—</div>
                              <div className="flex items-center gap-2">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="gap-2 h-8">
                                      <div className={`h-2 w-2 rounded-full ${getStatusColor(stub.status)}`} />
                                      <span className="text-xs">{stub.status}</span>
                                      <ChevronDown className="h-3 w-3" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent className="bg-background border z-50">
                                    <DropdownMenuItem onClick={() => handleStatusChange(stub.user_id, "Active")}><div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-green-500" />Active</div></DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleStatusChange(stub.user_id, "Inactive")}><div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-gray-400" />Inactive</div></DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                              <div className="flex items-center gap-1">
                                <PermissionGate permission={'users_profile.update_token_limit'}>
                                  <Button size="sm" className="h-8 w-8 p-0 bg-yellow-500 hover:bg-yellow-600 text-white" onClick={() => openEditLimits(stub)} title="Edit limits"><Edit className="h-4 w-4" /></Button>
                                </PermissionGate>
                                {hasRole(ROLES.MASTER_AGENT) && (
                                  <Button size="sm" className="h-8 w-8 p-0 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => openUsageDetails(stub)} title="View token usage"><BarChart3 className="h-4 w-4" /></Button>
                                )}
                                <PermissionGate permission={'super_agents.delete'}>
                                  <Button size="sm" className="h-8 w-8 p-0 bg-red-600 hover:bg-red-700 text-white" onClick={() => { setAgentPendingDelete(stub); setConfirmDeleteOpen(true); }}><Trash2 className="h-4 w-4" /></Button>
                                </PermissionGate>
                              </div>
                            </div>
                          );
                        })}

                        {supers.map((row: any) => {
                          const primaryRole = 'super_agent' as const;
                          const stub: AgentWithDetails = {
                            user_id: String(row.user_id),
                            email: row.email || '',
                            display_name: row.agent_name || row.email || 'Unknown',
                            avatar_url: row.avatar_url || null,
                            timezone: null as any,
                            created_at: '',
                            roles: [primaryRole],
                            primaryRole: primaryRole,
                            status: row.is_active ? 'Active' : 'Inactive',
                            super_agent_id: null
                          };
                          const children = assigned[String(row.user_id)] || [];
                          return (
                            <div key={`super-${row.user_id}`} className="">
                              <div className="grid grid-cols-[240px,1fr,220px,160px,120px,120px] gap-4 p-4 items-center hover:bg-muted/30 transition-colors bg-green-50/30">
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-8 w-8"><AvatarFallback className="text-xs bg-green-100 text-green-700">{getInitials(stub.display_name || 'U')}</AvatarFallback></Avatar>
                                  <span className="font-medium text-green-600">{stub.display_name}</span>
                                </div>
                                <div className="text-sm text-muted-foreground">{stub.email || '—'}</div>
                                <div className="flex items-center h-8">
                                  <Badge className={`text-xs ${roleBadgeClass(stub.primaryRole)} leading-none h-6 px-2 inline-flex items-center`}>Super Agent</Badge>
                                </div>
                                <div className="text-sm font-medium">{loadingSuperUsage ? '…' : ((usageBySuper[stub.user_id] ?? 0).toLocaleString())}</div>
                                <div className="flex items-center gap-2">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="sm" className="gap-2 h-8">
                                        <div className={`h-2 w-2 rounded-full ${getStatusColor(stub.status)}`} />
                                        <span className="text-xs">{stub.status}</span>
                                        <ChevronDown className="h-3 w-3" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="bg-background border z-50">
                                      <DropdownMenuItem onClick={() => handleStatusChange(stub.user_id, "Active")}><div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-green-500" />Active</div></DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleStatusChange(stub.user_id, "Inactive")}><div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-gray-400" />Inactive</div></DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                                <div className="flex items-center gap-1">
                                  <PermissionGate permission={'users_profile.update_token_limit'}>
                                    <Button size="sm" className="h-8 w-8 p-0 bg-yellow-500 hover:bg-yellow-600 text-white" onClick={() => openEditLimits(stub)} title="Edit limits"><Edit className="h-4 w-4" /></Button>
                                  </PermissionGate>
                                  {hasRole(ROLES.MASTER_AGENT) && (
                                    <Button size="sm" className="h-8 w-8 p-0 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => openUsageDetails(stub)} title="View token usage"><BarChart3 className="h-4 w-4" /></Button>
                                  )}
                                  <PermissionGate permission={'super_agents.delete'}>
                                    <Button size="sm" className="h-8 w-8 p-0 bg-red-600 hover:bg-red-700 text-white" onClick={() => { setAgentPendingDelete(stub); setConfirmDeleteOpen(true); }}><Trash2 className="h-4 w-4" /></Button>
                                  </PermissionGate>
                                </div>
                              </div>

                              {children.map((row: any) => {
                                const primaryRole = 'agent' as const;
                                const child: AgentWithDetails = {
                                  user_id: String(row.user_id),
                                  email: row.email || '',
                                  display_name: row.agent_name || row.email || 'Unknown',
                                  avatar_url: row.avatar_url || null,
                                  timezone: null as any,
                                  created_at: '',
                                  roles: [primaryRole],
                                  primaryRole: primaryRole,
                                  status: row.is_active ? 'Active' : 'Inactive',
                                  super_agent_id: stub.user_id
                                };
                                return (
                                  <div key={`agent-${row.user_id}`} className="grid grid-cols-[240px,1fr,220px,160px,120px,120px] gap-4 p-4 items-center hover:bg-muted/30 transition-colors bg-gray-50/30 pl-12">
                                    <div className="flex items-center gap-3">
                                      <div className="w-6 h-6 flex items-center justify-center"><div className="w-4 h-4 border-l-2 border-b-2 border-gray-300 rounded-bl"></div></div>
                                      <Avatar className="h-8 w-8"><AvatarFallback className="text-xs bg-gray-100 text-gray-700">{getInitials(child.display_name || 'U')}</AvatarFallback></Avatar>
                                      <span className="font-medium text-gray-600">{child.display_name}</span>
                                    </div>
                                    <div className="text-sm text-muted-foreground">{child.email || '—'}</div>
                                    <div className="flex items-center h-8">
                                      <Badge className={`text-xs ${roleBadgeClass(child.primaryRole)} leading-none h-6 px-2 inline-flex items-center`}>Agent</Badge>
                                    </div>
                                    <div className="text-sm text-muted-foreground">—</div>
                                    <div className="flex items-center gap-2">
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="sm" className="gap-2 h-8">
                                            <div className={`h-2 w-2 rounded-full ${getStatusColor(child.status)}`} />
                                            <span className="text-xs">{child.status}</span>
                                            <ChevronDown className="h-3 w-3" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent className="bg-background border z-50">
                                          <DropdownMenuItem onClick={() => handleStatusChange(child.user_id, "Active")}><div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-green-500" />Active</div></DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => handleStatusChange(child.user_id, "Inactive")}><div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-gray-400" />Inactive</div></DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <PermissionGate permission={'users_profile.update_token_limit'}>
                                        <Button size="sm" className="h-8 w-8 p-0 bg-yellow-500 hover:bg-yellow-600 text-white" onClick={() => openEditLimits(child)} title="Edit limits"><Edit className="h-4 w-4" /></Button>
                                      </PermissionGate>
                                      {hasRole(ROLES.MASTER_AGENT) && (
                                        <Button size="sm" className="h-8 w-8 p-0 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => openUsageDetails(child)} title="View token usage"><BarChart3 className="h-4 w-4" /></Button>
                                      )}
                                      <PermissionGate permission={'super_agents.delete'}>
                                        <Button size="sm" className="h-8 w-8 p-0 bg-red-600 hover:bg-red-700 text-white" onClick={() => { setAgentPendingDelete(child); setConfirmDeleteOpen(true); }}><Trash2 className="h-4 w-4" /></Button>
                                      </PermissionGate>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}

                        {unassigned.map((row: any) => {
                          const primaryRole = 'agent' as const;
                          const stub: AgentWithDetails = {
                            user_id: String(row.user_id),
                            email: row.email || '',
                            display_name: row.agent_name || row.email || 'Unknown',
                            avatar_url: row.avatar_url || null,
                            timezone: null as any,
                            created_at: '',
                            roles: [primaryRole],
                            primaryRole: primaryRole,
                            status: row.is_active ? 'Active' : 'Inactive',
                            super_agent_id: null
                          };
                          return (
                            <div key={`unassigned-${row.user_id}`} className="grid grid-cols-[240px,1fr,220px,160px,120px,120px] gap-4 p-4 items-center hover:bg-muted/30 transition-colors bg-orange-50/30">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8"><AvatarFallback className="text-xs bg-orange-100 text-orange-700">{getInitials(stub.display_name || 'U')}</AvatarFallback></Avatar>
                                <span className="font-medium text-orange-600">{stub.display_name}</span>
                              </div>
                              <div className="text-sm text-muted-foreground">{stub.email || '—'}</div>
                              <div className="flex items-center h-8">
                                <Badge className={`text-xs ${roleBadgeClass(stub.primaryRole)} leading-none h-6 px-2 inline-flex items-center`}>Agent (Unassigned)</Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">—</div>
                              <div className="flex items-center gap-2">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="gap-2 h-8">
                                      <div className={`h-2 w-2 rounded-full ${getStatusColor(stub.status)}`} />
                                      <span className="text-xs">{stub.status}</span>
                                      <ChevronDown className="h-3 w-3" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent className="bg-background border z-50">
                                    <DropdownMenuItem onClick={() => handleStatusChange(stub.user_id, "Active")}><div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-green-500" />Active</div></DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleStatusChange(stub.user_id, "Inactive")}><div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-gray-400" />Inactive</div></DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                              <div className="flex items-center gap-1">
                                <PermissionGate permission={'users_profile.update_token_limit'}>
                                  <Button size="sm" className="h-8 w-8 p-0 bg-yellow-500 hover:bg-yellow-600 text-white" onClick={() => openEditLimits(stub)} title="Edit limits"><Edit className="h-4 w-4" /></Button>
                                </PermissionGate>
                                {hasRole(ROLES.MASTER_AGENT) && (
                                  <Button size="sm" className="h-8 w-8 p-0 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => openUsageDetails(stub)} title="View token usage"><BarChart3 className="h-4 w-4" /></Button>
                                )}
                                <PermissionGate permission={'super_agents.delete'}>
                                  <Button size="sm" className="h-8 w-8 p-0 bg-red-600 hover:bg-red-700 text-white" onClick={() => { setAgentPendingDelete(stub); setConfirmDeleteOpen(true); }}><Trash2 className="h-4 w-4" /></Button>
                                </PermissionGate>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    );
                  })()
                : rows.map((row: any) => {
                const primaryRole = normalizeRoleName(row.role_name);
                const stub: AgentWithDetails = {
                  user_id: String(row.user_id),
                  email: row.email || '',
                  display_name: row.agent_name || row.email || 'Unknown',
                  avatar_url: row.avatar_url || null,
                  timezone: null as any,
                  created_at: '',
                  roles: primaryRole ? [primaryRole] : [],
                  primaryRole: primaryRole,
                  status: row.is_active ? 'Active' : 'Inactive',
                  super_agent_id: null
                };
                const isExpired = String(row.confirmation_status || '').toLowerCase() === 'expired';
                return (
                  <div key={row.user_id} className={`grid gap-4 p-4 items-center hover:bg-muted/30 transition-colors ${isPending ? 'grid-cols-[240px,1fr,220px,120px,160px]' : 'grid-cols-[240px,1fr,220px,160px,120px,120px]'}`}>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {getInitials(stub.display_name || 'U')}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{stub.display_name}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">{stub.email || '—'}</div>
                    <div className="flex items-center h-8">
                      <Badge className={`text-xs ${roleBadgeClass(stub.primaryRole)} leading-none h-6 px-2 inline-flex items-center`}>
                        {stub.primaryRole === 'master_agent' ? 'Master Agent' : stub.primaryRole === 'super_agent' ? 'Super Agent' : 'Agent'}
                      </Badge>
                    </div>
                    {!isPending && (
                      <div className="text-sm text-muted-foreground">—</div>
                    )}
                    <div className="flex items-center gap-2">
                      {isPending ? (
                        <Badge className={`text-xs leading-none h-6 px-2 inline-flex items-center ${isExpired ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{isExpired ? 'Expired' : 'Invited'}</Badge>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="gap-2 h-8">
                              <div className={`h-2 w-2 rounded-full ${getStatusColor(stub.status)}`} />
                              <span className="text-xs">{stub.status}</span>
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="bg-background border z-50">
                            <DropdownMenuItem onClick={() => handleStatusChange(stub.user_id, "Active")}>
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-green-500" />
                                Active
                              </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(stub.user_id, "Inactive")}>
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-gray-400" />
                                Inactive
                              </div>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {!isPending && (
                        <PermissionGate permission={'users_profile.update_token_limit'}>
                          <Button
                            size="sm"
                            className="h-8 w-8 p-0 bg-yellow-500 hover:bg-yellow-600 text-white"
                            onClick={() => openEditLimits(stub)}
                            title="Edit limits"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </PermissionGate>
                      )}
                      {hasRole(ROLES.MASTER_AGENT) && !isPending && (
                        <Button
                          size="sm"
                          className="h-8 w-8 p-0 bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => openUsageDetails(stub)}
                          title="View token usage"
                        >
                          <BarChart3 className="h-4 w-4" />
                        </Button>
                      )}
                      {isPending ? (
                        <>
                          {isExpired && (
                            <PermissionGate permission={'super_agents.create'}>
                              <Button
                                size="sm"
                                className="h-8 w-8 p-0 bg-blue-600 hover:bg-blue-700 text-white"
                                onClick={async () => {
                                  try {
                                    await supabase.functions.invoke('admin-create-user', {
                                      body: { email: stub.email, full_name: stub.display_name, role: stub.primaryRole || 'agent', reinvite: true },
                                    });
                                    toast({ title: 'Reinvite sent', description: `${stub.email}` });
                                    fetchHumanAgentsPage({ invited: true, page, pageSize });
                                  } catch (e: any) {
                                    toast({ title: 'Error', description: e?.message || 'Failed to reinvite', variant: 'destructive' });
                                  }
                                }}
                                title="Reinvite user"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            </PermissionGate>
                          )}
                          <PermissionGate permission={'super_agents.delete'}>
                            <Button 
                              size="sm" 
                              className="h-8 w-8 p-0 bg-red-600 hover:bg-red-700 text-white"
                              onClick={() => { setAgentPendingDelete(stub); setConfirmDeleteOpen(true); }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </PermissionGate>
                        </>
                      ) : (
                        <PermissionGate permission={'super_agents.delete'}>
                          <Button 
                            size="sm" 
                            className="h-8 w-8 p-0 bg-red-600 hover:bg-red-700 text-white"
                            onClick={() => { setAgentPendingDelete(stub); setConfirmDeleteOpen(true); }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </PermissionGate>
                      )}
                    </div>
                  </div>
                );
              }))
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="text-sm text-muted-foreground">
            {total > 0 ? (
              <span>
                Showing {Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} of {total}
              </span>
            ) : (
              <span>0 results</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2">
              <Label className="text-sm text-muted-foreground">Rows</Label>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger className="h-8 w-[100px] bg-background border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border z-50">
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious className={page <= 1 ? 'pointer-events-none opacity-50' : ''} onClick={() => page > 1 && setPage(page - 1)} href="#" />
                </PaginationItem>
                <PaginationItem>
                  <span className="text-sm text-muted-foreground px-2">Page {page} of {Math.max(1, Math.ceil((total || 0) / Math.max(1, pageSize)))}</span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext className={page >= Math.max(1, Math.ceil((total || 0) / Math.max(1, pageSize))) ? 'pointer-events-none opacity-50' : ''} onClick={() => page < Math.max(1, Math.ceil((total || 0) / Math.max(1, pageSize))) && setPage(page + 1)} href="#" />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>
      </div>
    );
  };

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
      // Resolve org once for downstream attach
      let orgIdForCreate = currentOrgId || null;
      if (!orgIdForCreate) {
        try {
          const { data: me } = await supabase.auth.getUser();
          const { data: mem } = await supabase
            .from('org_members')
            .select('org_id')
            .eq('user_id', me?.user?.id || '')
            .limit(1);
          orgIdForCreate = (mem as any[])?.[0]?.org_id || null;
        } catch {}
      }

      const res = await createAgent({
        full_name: newAgent.name,
        email: newAgent.email,
        role: newAgent.role,
        super_agent_id: newAgent.role === 'agent' ? (selectedSuperForNewAgent || null) : null,
        org_id: orgIdForCreate,
      });

      // Auto-assign super_agent membership when role is agent and a super is chosen
      // Edge function will handle membership; no client upsert here

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
      // Refresh current tab data so UI reflects deletion
      if (tabValue === 'pending') {
        if (pendingRows.length <= 1 && pendingPage > 1) {
          setPendingPage((p) => Math.max(1, p - 1));
        } else {
          await fetchHumanAgentsPage({ invited: true, page: pendingPage, pageSize: pendingPageSize });
        }
      } else {
        if (activeRows.length <= 1 && activePage > 1) {
          setActivePage((p) => Math.max(1, p - 1));
        } else {
          await fetchHumanAgentsPage({ invited: false, page: activePage, pageSize: activePageSize });
        }
      }
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

  const fetchSuperUsage = async (range: "7d" | "30d" | "this_month" | "all") => {
    try {
      setLoadingSuperUsage(true);
      const superIds = visibleAgents.filter(a => a.primaryRole === 'super_agent').map(a => a.user_id);
      if (superIds.length === 0) {
        setUsageBySuper({});
        return;
      }

      let usageMap: Record<string, number> = {};
      if (range === 'all') {
        try {
          const { data: vr } = await supabase
            .from('v_super_agent_token_usage')
            .select('super_agent_id,total_tokens');
          for (const row of (vr as any[]) || []) {
            const sid = String((row as any).super_agent_id || '');
            if (!sid) continue;
            usageMap[sid] = Number((row as any).total_tokens || 0);
          }
        } catch {}
      } else {
        const { start, end } = computeRange(range);
        // Fallback: aggregate by channel.super_agent_id within range
        const { data: logs } = await supabase
          .from('token_usage_logs')
          .select('id,channel_id,total_tokens,made_at')
          .gte('made_at', start)
          .lt('made_at', end);
        const channelIds = Array.from(new Set(((logs as any[]) || []).map(r => (r as any).channel_id).filter(Boolean)));
        let channelToSuper: Record<string, string> = {};
        if (channelIds.length > 0) {
          const { data: ch } = await supabase
            .from('channels')
            .select('id,super_agent_id')
            .in('id', channelIds as any);
          channelToSuper = Object.fromEntries(((ch as any[]) || []).map(c => [String((c as any).id), String((c as any).super_agent_id || '')]));
        }
        const seen = new Set<string>();
        for (const row of (logs as any[]) || []) {
          const id = String((row as any).id);
          if (seen.has(id)) continue;
          seen.add(id);
          const channelId = String((row as any).channel_id || '');
          const sid = channelId ? (channelToSuper[channelId] || '') : '';
          if (sid) usageMap[sid] = (usageMap[sid] || 0) + Number((row as any).total_tokens || 0);
        }
      }

      const finalMap: Record<string, number> = {};
      for (const sid of superIds) finalMap[sid] = usageMap[sid] || 0;
      setUsageBySuper(finalMap);
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to load usage', variant: 'destructive' });
    } finally {
      setLoadingSuperUsage(false);
    }
  };

  useEffect(() => {
    if (agents.length > 0) {
      // best-effort refresh; ignore errors
      fetchSuperUsage(usageRange);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents, usageRange]);

  // Resolve current user id once
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        setCurrentUserId(data?.user?.id || null);
        try {
          const { data: mem } = await supabase
            .from('org_members')
            .select('org_id')
            .eq('user_id', data?.user?.id || '')
            .limit(1)
            .maybeSingle();
          setCurrentOrgId(mem?.org_id || null);
        } catch {}
      } catch {}
    })();
  }, []);

  // Compute which agents are visible to the current viewer
  const getVisibleAgents = () => {
    if (hasRole(ROLES.MASTER_AGENT)) return agents;
    if (hasRole(ROLES.SUPER_AGENT)) {
      if (!currentUserId) return [];
      return agents.filter(a =>
        (a.primaryRole === 'super_agent' && a.user_id === currentUserId) ||
        (a.primaryRole === 'agent' && a.super_agent_id === currentUserId)
      );
    }
    // Default: no visibility (could be extended for regular agents if needed)
    return [];
  };

  const visibleAgents = useMemo(() => getVisibleAgents(), [agents, hasRole, currentUserId]);

  const openUsageDetails = async (agent: AgentWithDetails) => {
    setSelectedAgent(agent);
    setIsUsageOpen(true);
    await fetchUsage(agent.user_id, dialogRange);
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
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Usage</Label>
            <Select value={usageRange} onValueChange={async (v)=>{ const r = v as any; setUsageRange(r); try { await fetchSuperUsage(r); } catch {} }}>
              <SelectTrigger className="h-8 w-[160px] bg-background border">
                <SelectValue placeholder="Range" />
              </SelectTrigger>
              <SelectContent className="bg-background border z-50">
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="this_month">This month</SelectItem>
              </SelectContent>
            </Select>
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
      </div>

      <Tabs value={tabValue} onValueChange={(v)=>setTabValue(v as any)} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="active" className="gap-2">
            <UserCheck className="h-4 w-4" />
            Active
          </TabsTrigger>
          <TabsTrigger value="pending" className="gap-2">
            <UserPlus className="h-4 w-4" />
            Pending
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {renderPagedTable(activeRows, loadingActiveTable || loading, activeTotal, activePage, activePageSize, setActivePage, setActivePageSize, false, activeAgentToSuperMap)}
        </TabsContent>
        <TabsContent value="pending" className="space-y-4">
          {renderPagedTable(pendingRows, loadingPendingTable, pendingTotal, pendingPage, pendingPageSize, setPendingPage, setPendingPageSize, true)}
        </TabsContent>
      </Tabs>

      {/* Clustering UI removed per design simplification; nested table above is sufficient */}

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
                <Input id="limit-day" type="number" min={0} placeholder="0" value={tokenLimitForm.perDay === 0 ? "" : tokenLimitForm.perDay} onChange={(e) => setTokenLimitForm({ ...tokenLimitForm, perDay: Number(e.target.value || "0") })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="limit-month">Max Tokens / Month</Label>
                <Input id="limit-month" type="number" min={0} placeholder="0" value={tokenLimitForm.perMonth === 0 ? "" : tokenLimitForm.perMonth} onChange={(e) => setTokenLimitForm({ ...tokenLimitForm, perMonth: Number(e.target.value || "0") })} />
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
              <Select value={dialogRange} onValueChange={async (v) => { const r = v as any as ("7d"|"30d"|"this_month"); setDialogRange(r); if (selectedAgent) await fetchUsage(selectedAgent.user_id, r); }}>
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