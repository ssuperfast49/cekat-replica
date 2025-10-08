import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Shield, Settings, Edit, Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase, logAction } from "@/lib/supabase";
import { useRBAC } from "@/contexts/RBACContext";
import PermissionGate from "@/components/rbac/PermissionGate";
import AsyncPermissionGate from "@/components/rbac/AsyncPermissionGate";

interface Role {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  created_at: string;
}

interface RolePermission {
  role_id: string;
  permission_id: string;
}

// Common CRUD actions - these are standard across most resources
const CRUD_ACTIONS = ['create', 'read', 'update', 'delete'];

// Normalize action names (e.g., treat "edit" as "update")
const normalizeCrudAction = (action: string): 'create' | 'read' | 'update' | 'delete' | string => {
  const a = (action || '').toLowerCase();
  if (a === 'edit') return 'update';
  if (a === 'remove') return 'delete';
  return a;
};

// Resources that follow standard CRUD pattern
const CRUD_RESOURCES = [
  'ai_profiles',
  'ai_sessions', 
  'channel_agents',
  'channels',
  'contact_identities',
  'contact_labels',
  'contacts',
  'labels',
  'messages',
  'org_members',
  'org_settings',
  'orgs',
  'permissions',
  'role_permissions', 
  'roles',
  'super_agents',
  'thread_collaborators',
  'threads',
  'token_balances',
  'token_topups',
  'token_usage_logs',
  'user_roles',
  'users_profile'
];

// No static SPECIAL_PERMISSIONS list; ordering for specials is alphabetical by resource/action.

const PermissionsPage = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [view, setView] = useState<'roles' | 'configure'>('roles');
  const { toast } = useToast();
  const { refreshRBAC, hasPermission } = useRBAC();
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  // Role master editing state
  const [editOpen, setEditOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const RESOURCES = ['conversations','users','channels','analytics','topup','config'];
  const ACTIONS = ['view','create','update','delete','export'];
  const [policy, setPolicy] = useState<Record<string, Set<string>>>({});
  const [policyLoading, setPolicyLoading] = useState(false);
  const [policySaving, setPolicySaving] = useState(false);

  // Capability flags (frontend gating)
  const canCreateRole = hasPermission('roles.create');
  const canUpdateRole = hasPermission('roles.update');
  const canDeleteRole = hasPermission('roles.delete');
  const canGrantRolePerm = hasPermission('role_permissions.create');
  const canRevokeRolePerm = hasPermission('role_permissions.delete');
  const canConfigurePolicy = hasPermission('access_rules.configure');

  // Fetch roles and permissions data
  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .select('*')
        .order('name');
      
      if (rolesError) throw rolesError;
      setRoles(rolesData || []);

      // Fetch ALL permissions (including special cases)
      const { data: permissionsData, error: permissionsError } = await supabase
        .from('permissions')
        .select('*')
        .order('resource', { ascending: true });
      
      if (permissionsError) throw permissionsError;
      setAllPermissions(permissionsData || []);

      // Fetch role permissions
      const { data: rolePermissionsData, error: rolePermissionsError } = await supabase
        .from('role_permissions')
        .select('*');
      
      if (rolePermissionsError) throw rolePermissionsError;
      setRolePermissions(rolePermissionsData || []);

    } catch (error) {
      console.error('Error fetching RBAC data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch permissions data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateRole = () => {
    setEditingRole(null);
    setEditName("");
    setEditDesc("");
    setEditOpen(true);
  };

  const openEditRole = (role: Role) => {
    setEditingRole(role);
    setEditName(role.name);
    setEditDesc(role.description);
    setEditOpen(true);
  };

  const saveRole = async () => {
    try {
      setEditSaving(true);
      if (editingRole) {
        if (!canUpdateRole) {
          toast({ title: 'Forbidden', description: 'You do not have permission to update roles', variant: 'destructive' });
          return;
        }
        const { error } = await supabase.from('roles').update({ name: editName, description: editDesc }).eq('id', editingRole.id);
        if (error) throw error;
        try { await logAction({ action: 'roles.update', resource: 'roles', resourceId: editingRole.id, context: { name: editName } }); } catch {}
        toast({ title: 'Saved', description: 'Role updated' });
      } else {
        if (!canCreateRole) {
          toast({ title: 'Forbidden', description: 'You do not have permission to create roles', variant: 'destructive' });
          return;
        }
        const { data, error } = await supabase.from('roles').insert([{ name: editName, description: editDesc }]).select('id').single();
        if (error) throw error;
        try { await logAction({ action: 'roles.create', resource: 'roles', resourceId: (data as any)?.id ?? null, context: { name: editName } }); } catch {}
        toast({ title: 'Created', description: 'Role created' });
      }
      setEditOpen(false);
      await fetchData();
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to save role', variant: 'destructive' });
    } finally {
      setEditSaving(false);
    }
  };

  const deleteRole = async (role: Role) => {
    try {
      if (!canDeleteRole) {
        toast({ title: 'Forbidden', description: 'You do not have permission to delete roles', variant: 'destructive' });
        return;
      }
      setSaving(prev => ({ ...prev, [role.id]: true }));
      setDeleteSaving(true);
      // Remove dependent records first to satisfy FK constraints
      await supabase.from('role_permissions').delete().eq('role_id', role.id);
      await supabase.from('user_roles').delete().eq('role_id', role.id);
      const { error } = await supabase.from('roles').delete().eq('id', role.id);
      if (error) throw error;
      try { await logAction({ action: 'roles.delete', resource: 'roles', resourceId: role.id }); } catch {}
      toast({ title: 'Deleted', description: 'Role deleted' });
      setDeleteOpen(false);
      setDeletingRole(null);
      await fetchData();
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to delete role', variant: 'destructive' });
    } finally {
      setSaving(prev => ({ ...prev, [role.id]: false }));
      setDeleteSaving(false);
    }
  };

  // Load RBAC policy for selected role
  useEffect(() => {
    const loadPolicy = async () => {
      if (!selectedRole) return;
      try {
        setPolicyLoading(true);
        const { data, error } = await supabase.rpc('get_role_policy', { p_role: selectedRole.id });
        if (error) throw error;
        const json = (data as any) || {};
        const res = json.resources || {};
        const next: Record<string, Set<string>> = {};
        for (const r of RESOURCES) {
          next[r] = new Set<string>(Array.isArray(res[r]) ? res[r] : []);
        }
        setPolicy(next);
      } catch (e) {
        console.warn('Failed to load policy', e);
        setPolicy({});
      } finally {
        setPolicyLoading(false);
      }
    };
    loadPolicy();
  }, [selectedRole?.id]);

  const togglePolicy = (resource: string, action: string) => {
    setPolicy(prev => {
      const cur = new Set(prev[resource] || []);
      if (cur.has(action)) cur.delete(action); else cur.add(action);
      return { ...prev, [resource]: cur };
    });
  };

  const savePolicy = async () => {
    if (!selectedRole) return;
    try {
      setPolicySaving(true);
      const payload: any = { resources: {} as Record<string, string[]> };
      for (const r of RESOURCES) payload.resources[r] = Array.from(policy[r] || []);
      const { error } = await supabase.rpc('put_role_policy', { p_role: selectedRole.id, p_policy: payload });
      if (error) throw error;
      await logAction({ action: 'rbac.policy_update', resource: 'rbac', context: { role_id: selectedRole.id, policy: payload } });
      toast({ title: 'Saved', description: 'Policy updated' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to save policy', variant: 'destructive' });
    } finally {
      setPolicySaving(false);
    }
  };

  // Check if role has permission
  const roleHasPermission = (roleId: string, permissionId: string): boolean => {
    return rolePermissions.some(rp => rp.role_id === roleId && rp.permission_id === permissionId);
  };

  // Toggle permission for role via secure RPCs
  const toggleRolePermission = async (roleId: string, permissionId: string) => {
    try {
      const isAssigned = roleHasPermission(roleId, permissionId);
      const key = `${roleId}:${permissionId}`;
      setSaving(prev => ({ ...prev, [key]: true }));
      if (isAssigned) {
        if (!canRevokeRolePerm) {
          toast({ title: 'Forbidden', description: 'You do not have permission to revoke role permissions', variant: 'destructive' });
          return;
        }
        // Revoke via RPC
        const { error } = await supabase.rpc('revoke_role_permission', {
          p_role: roleId,
          p_perm: permissionId,
        });
        if (error) throw error;
        setRolePermissions(prev => prev.filter(rp => !(rp.role_id === roleId && rp.permission_id === permissionId)));
        try { await logAction({ action: 'rbac.revoke', resource: 'rbac', context: { role_id: roleId, permission_id: permissionId } }); } catch {}
      } else {
        if (!canGrantRolePerm) {
          toast({ title: 'Forbidden', description: 'You do not have permission to grant role permissions', variant: 'destructive' });
          return;
        }
        // Grant via RPC
        const { error } = await supabase.rpc('grant_role_permission', {
          p_role: roleId,
          p_perm: permissionId,
        });
        if (error) throw error;
        setRolePermissions(prev => [...prev, { role_id: roleId, permission_id: permissionId }]);
        try { await logAction({ action: 'rbac.grant', resource: 'rbac', context: { role_id: roleId, permission_id: permissionId } }); } catch {}
      }

      // Refresh RBAC so nav/guards reflect changes immediately
      await refreshRBAC();

      toast({
        title: "Success",
        description: `Permission ${isAssigned ? 'removed from' : 'added to'} role`,
      });
    } catch (error) {
      console.error('Error updating role permission:', error);
      toast({
        title: "Error",
        description: "Failed to update permission",
        variant: "destructive",
      });
    } finally {
      const key = `${roleId}:${permissionId}`;
      setSaving(prev => ({ ...prev, [key]: false }));
    }
  };

  // Separate CRUD and special permissions directly from DB actions
  const crudPermissions = allPermissions.filter(p => 
    CRUD_ACTIONS.includes(normalizeCrudAction(p.action) as any)
  );
  
  const specialPermissions = allPermissions
    .filter(p => !CRUD_ACTIONS.includes(normalizeCrudAction(p.action) as any))
    .sort((a, b) => {
      if (a.resource !== b.resource) return a.resource.localeCompare(b.resource);
      const aa = normalizeCrudAction(a.action);
      const bb = normalizeCrudAction(b.action);
      return aa.localeCompare(bb);
    });

  // Group CRUD permissions by resource for the grid
  const groupedCrudPermissions = crudPermissions.reduce((acc, permission) => {
    if (!acc[permission.resource]) {
      acc[permission.resource] = {};
    }
    const actionKey = normalizeCrudAction(permission.action);
    acc[permission.resource][actionKey] = permission;
    return acc;
  }, {} as Record<string, Record<string, Permission>>);

  // Group special permissions by resource for clearer sub-sections
  const groupedSpecialPermissions = specialPermissions.reduce((acc, permission) => {
    if (!acc[permission.resource]) {
      acc[permission.resource] = [];
    }
    acc[permission.resource].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);

  // Get role stats
  const getRoleStats = (roleId: string) => {
    const permissionCount = rolePermissions.filter(rp => rp.role_id === roleId).length;
    return permissionCount;
  };

  const formatRoleName = (roleName: string) => {
    return roleName.replace('_', ' ').toUpperCase();
  };

  const formatResourceName = (resourceName: string) => {
    return resourceName
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  const getSpecialPermissionLabel = (permission: Permission) => {
    const name = permission.name || '';
    const idx = name.indexOf(': ');
    if (idx !== -1) {
      return name.slice(idx + 2);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Role Permissions</h1>
            <p className="text-muted-foreground">Manage role permissions</p>
          </div>
          <Button onClick={openCreateRole} disabled={!canCreateRole} title={!canCreateRole ? 'No permission: roles.create' : undefined}>
            <Plus className="h-4 w-4 mr-2" /> New Role
          </Button>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4 animate-pulse" />
            <p className="text-muted-foreground">Loading roles...</p>
          </div>
        </div>
      </div>
    );
  }

  // Roles list view
  if (view === 'roles') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Role Permissions</h1>
            <p className="text-muted-foreground">Manage role permissions</p>
          </div>
          <Button onClick={openCreateRole} disabled={!canCreateRole} title={!canCreateRole ? 'No permission: roles.create' : undefined}>
            <Plus className="h-4 w-4 mr-2" /> New Role
          </Button>
        </div>

        {/* Roles Table */}
        <Card>
          <CardHeader>
            <CardTitle>Roles</CardTitle>
            <CardDescription>
              Click on a role to manage its permissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">
                      <Badge variant="outline">
                        {formatRoleName(role.name)}
                      </Badge>
                    </TableCell>
                    <TableCell>{role.description}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {getRoleStats(role.id)} permissions
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => { setSelectedRole(role); setView('configure'); }}
                          disabled={!canConfigurePolicy}
                          title={!canConfigurePolicy ? 'No permission: access_rules.configure' : undefined}
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          Configure
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openEditRole(role)} disabled={!canUpdateRole} title={!canUpdateRole ? 'No permission: roles.update' : undefined}>
                          <Edit className="h-4 w-4"/>
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          onClick={() => { setDeletingRole(role); setDeleteOpen(true); }} 
                          disabled={!!saving[role.id] || !canDeleteRole}
                          title={!canDeleteRole ? 'No permission: roles.delete' : undefined}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Roles</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{roles.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Permissions</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{allPermissions.length}</div>
              <p className="text-xs text-muted-foreground">
                {crudPermissions.length} CRUD + {specialPermissions.length} special
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Resources</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Object.keys(groupedCrudPermissions).length}</div>
              <p className="text-xs text-muted-foreground">
                CRUD resources
              </p>
            </CardContent>
          </Card>
        </div>
      {/* Edit/Create Role Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRole ? 'Edit Role' : 'Create Role'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="rname">Name</Label>
              <Input id="rname" value={editName} onChange={(e)=>setEditName(e.target.value)} placeholder="e.g. Super Agent" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rdesc">Description</Label>
              <Input id="rdesc" value={editDesc} onChange={(e)=>setEditDesc(e.target.value)} placeholder="Optional" />
            </div>
            <div className="pt-2 flex justify-end gap-2">
              <Button variant="outline" onClick={()=>setEditOpen(false)}>Cancel</Button>
              <Button 
                onClick={saveRole} 
                disabled={
                  editSaving || !editName.trim() || (editingRole ? !canUpdateRole : !canCreateRole)
                }
                title={
                  editingRole
                    ? (!canUpdateRole ? 'No permission: roles.update' : undefined)
                    : (!canCreateRole ? 'No permission: roles.create' : undefined)
                }
              >
                {editSaving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Role Confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Role</DialogTitle>
            <DialogDescription>
              This will permanently delete the role{deletingRole ? ` "${formatRoleName(deletingRole.name)}"` : ''} and all its permissions.
            </DialogDescription>
          </DialogHeader>
          <div className="pt-2 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleteSaving}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={() => deletingRole && deleteRole(deletingRole)}
              disabled={deleteSaving || !canDeleteRole}
              title={!canDeleteRole ? 'No permission: roles.delete' : undefined}
            >
              {deleteSaving ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    );
  }

  // Role configuration view
  if (view === 'configure' && selectedRole) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Button 
              variant="ghost" 
              onClick={() => setView('roles')}
              className="mb-2"
            >
              ← Back to Roles
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">
              Configure {formatRoleName(selectedRole.name)}
            </h1>
            <p className="text-muted-foreground">{selectedRole.description}</p>
          </div>
        </div>

        {/* CRUD Permissions Table */}
        <Card>
          <CardHeader>
            <CardTitle>CRUD Permissions</CardTitle>
            <CardDescription>
              Standard Create, Read, Update, and Delete permissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="w-full overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/3">Resource</TableHead>
                    {CRUD_ACTIONS.map(action => (
                      <TableHead key={action} className="capitalize text-center">{action}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(groupedCrudPermissions).map(([resource, actions]) => (
                    <TableRow key={resource}>
                      <TableCell className="font-medium">{formatResourceName(resource)}</TableCell>
                      {CRUD_ACTIONS.map(action => {
                        const permission = actions[action];
                        return (
                          <TableCell key={action} className="text-center">
                            {permission ? (
                              <div className="inline-flex items-center gap-2">
                                <Checkbox
                                  id={`${resource}-${action}`}
                                  checked={roleHasPermission(selectedRole.id, permission.id)}
                                  onCheckedChange={() => toggleRolePermission(selectedRole.id, permission.id)}
                                  disabled={
                                    !!saving[`${selectedRole.id}:${permission.id}`] ||
                                    (
                                      roleHasPermission(selectedRole.id, permission.id) ? !canRevokeRolePerm : !canGrantRolePerm
                                    )
                                  }
                                  title={
                                    roleHasPermission(selectedRole.id, permission.id)
                                      ? (!canRevokeRolePerm ? 'No permission: role_permissions.delete' : undefined)
                                      : (!canGrantRolePerm ? 'No permission: role_permissions.create' : undefined)
                                  }
                                  className="border-blue-300 focus-visible:ring-blue-400 data-[state=checked]:bg-blue-100 data-[state=checked]:border-blue-400 data-[state=checked]:text-blue-600"
                                />
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-2">
                                <Checkbox
                                  disabled={true}
                                  checked={false}
                                  className="border-blue-300 data-[state=checked]:bg-blue-100 data-[state=checked]:border-blue-400 data-[state=checked]:text-blue-600"
                                />
                              </div>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Policy Rules (Matrix) */}
        <Card>
          <CardHeader>
            <CardTitle>Policy Rules (Matrix)</CardTitle>
            <CardDescription>Fine-grained allow-list per resource and action</CardDescription>
          </CardHeader>
          <CardContent>
            {policyLoading ? (
              <div className="text-sm text-muted-foreground">Loading policy…</div>
            ) : (
              <div className="w-full overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-1/3">Resource</TableHead>
                      {ACTIONS.map(a => (
                        <TableHead key={a} className="capitalize text-center">{a}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {RESOURCES.map(resource => (
                      <TableRow key={resource}>
                        <TableCell className="font-medium">{formatResourceName(resource)}</TableCell>
                        {ACTIONS.map(action => (
                          <TableCell key={action} className="text-center">
                            <Checkbox
                              checked={!!policy[resource]?.has(action)}
                              onCheckedChange={() => togglePolicy(resource, action)}
                              disabled={!canConfigurePolicy}
                              title={!canConfigurePolicy ? 'No permission: access_rules.configure' : undefined}
                              className="border-blue-300 focus-visible:ring-blue-400 data-[state=checked]:bg-blue-100 data-[state=checked]:border-blue-400 data-[state=checked]:text-blue-600"
                            />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="mt-3">
              <Button onClick={savePolicy} disabled={policySaving}>
                {policySaving ? 'Saving…' : 'Save Policy'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Special Permissions (grouped by resource) */}
        <Card>
          <CardHeader>
            <CardTitle>Special Permissions</CardTitle>
            <CardDescription>
              Advanced permissions that don't follow the standard CRUD pattern
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(groupedSpecialPermissions).map(([resource, permissions]) => (
                <div key={resource} className="space-y-3">
                  <h3 className="font-medium text-sm uppercase tracking-wide text-muted-foreground border-b pb-2">
                    {formatResourceName(resource)}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {permissions.map(permission => (
                      <div key={permission.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={permission.id}
                          checked={roleHasPermission(selectedRole.id, permission.id)}
                          onCheckedChange={() => toggleRolePermission(selectedRole.id, permission.id)}
                          disabled={
                            !!saving[`${selectedRole.id}:${permission.id}`] ||
                            (
                              roleHasPermission(selectedRole.id, permission.id) ? !canRevokeRolePerm : !canGrantRolePerm
                            )
                          }
                          title={
                            roleHasPermission(selectedRole.id, permission.id)
                              ? (!canRevokeRolePerm ? 'No permission: role_permissions.delete' : undefined)
                              : (!canGrantRolePerm ? 'No permission: role_permissions.create' : undefined)
                          }
                          className="border-blue-300 focus-visible:ring-blue-400 data-[state=checked]:bg-blue-100 data-[state=checked]:border-blue-400 data-[state=checked]:text-blue-600"
                        />
                        <Label htmlFor={permission.id} className="text-sm font-normal cursor-pointer">
                          {getSpecialPermissionLabel(permission)}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Summary for this role */}
        <Card>
          <CardHeader>
            <CardTitle>Permission Summary</CardTitle>
            <CardDescription>
              Current permissions assigned to {formatRoleName(selectedRole.name)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">CRUD Permissions</h4>
                <Badge variant="secondary">
                  {rolePermissions.filter(rp => 
                    rp.role_id === selectedRole.id && 
                    crudPermissions.some(cp => cp.id === rp.permission_id)
                  ).length} assigned
                </Badge>
              </div>
              <div>
                <h4 className="font-medium mb-2">Special Permissions</h4>
                <Badge variant="secondary">
                  {rolePermissions.filter(rp => 
                    rp.role_id === selectedRole.id && 
                    specialPermissions.some(sp => sp.id === rp.permission_id)
                  ).length} assigned
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
};

export default PermissionsPage;