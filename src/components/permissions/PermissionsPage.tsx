import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Shield, Settings, Edit, Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase, logAction } from "@/lib/supabase";
import { useRBAC } from "@/contexts/RBACContext";
import PermissionGate from "@/components/rbac/PermissionGate";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import PermissionMatrix from "./PermissionMatrix";

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

const PermissionsPage = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [view, setView] = useState<'roles' | 'configure'>('roles');
  const { toast } = useToast();
  const { refreshRBAC, hasPermission, hasRole } = useRBAC();
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
  const isRootSelected = selectedRole?.name === 'master_agent';

  // Capability flags (frontend gating)
  const canCreateRole = hasPermission('roles.create');
  const canUpdateRole = hasPermission('roles.update');
  const canDeleteRole = hasPermission('roles.delete');
  // Grant/revoke permissions now gated by roles.update
  const canGrantRolePerm = hasPermission('roles.update');
  const canRevokeRolePerm = hasPermission('roles.update');

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

  // Check if role has permission
  const roleHasPermission = (roleId: string, permissionId: string): boolean => {
    return rolePermissions.some(rp => rp.role_id === roleId && rp.permission_id === permissionId);
  };

  // Toggle permission for role via secure RPCs
  const refreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRBACRefresh = () => {
    if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current);
    refreshDebounceRef.current = setTimeout(() => {
      refreshRBAC().catch(() => {});
    }, 250);
  };

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

      // Debounced RBAC refresh to avoid spamming DB during bulk updates
      scheduleRBACRefresh();

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

  // Get role stats
  const getRoleStats = (roleId: string) => {
    const permissionCount = rolePermissions.filter(rp => rp.role_id === roleId).length;
    return permissionCount;
  };

  const formatRoleName = (roleName: string) => {
    return roleName.replace('_', ' ').toUpperCase();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Role Permissions</h1>
            <p className="text-muted-foreground">Manage role permissions</p>
          </div>
          <PermissionGate permission={'roles.create'}>
            <Button onClick={openCreateRole}>
              <Plus className="h-4 w-4 mr-2" /> New Role
            </Button>
          </PermissionGate>
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
        <Card className="pt-2">
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
                        <PermissionGate permission={'roles.read'}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => { setSelectedRole(role); setView('configure'); }}
                              >
                                <Settings className="h-4 w-4 mr-2" />
                                Configure
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Konfigurasi aturan akses untuk peran ini</p>
                            </TooltipContent>
                          </Tooltip>
                        </PermissionGate>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <PermissionGate permission={'roles.update'}>
                              <Button 
                                size="sm" 
                                className="h-8 w-8 p-0 bg-yellow-500 hover:bg-yellow-600 text-white"
                                onClick={() => openEditRole(role)} 
                                aria-label="Edit role"
                              >
                                <Edit className="h-4 w-4"/>
                              </Button>
                            </PermissionGate>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Edit peran ini</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <PermissionGate permission={'roles.delete'}>
                              <Button 
                                size="sm" 
                                onClick={() => { setDeletingRole(role); setDeleteOpen(true); }} 
                                disabled={!!saving[role.id]}
                                className="h-8 w-8 p-0 bg-red-600 hover:bg-red-700 text-white"
                                aria-label="Delete role"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </PermissionGate>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Hapus peran ini</p>
                          </TooltipContent>
                        </Tooltip>
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
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Resources</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{new Set(allPermissions.map(p => p.resource)).size}</div>
              <p className="text-xs text-muted-foreground">
                Unique resources
              </p>
            </CardContent>
          </Card>
        </div>
      {/* Edit/Create Role Dialog */}
      <PermissionGate permission={'roles.update'}>
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
      </PermissionGate>

      {/* Delete Role Confirmation */}
      <PermissionGate permission={'roles.delete'}>
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
      </PermissionGate>
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

        {/* Root role notice */}
        {isRootSelected && (
          <Card>
            <CardHeader>
              <CardTitle>Root Role</CardTitle>
              <CardDescription>
                Master Agent is a root role with full privileges across the system. 
                {/* Master Agent readonly removed as requested */}
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Menu Access removed per request */}

        <div className="py-4">
          <h2 className="text-lg font-semibold mb-4">Full Permission Matrix</h2>
          <PermissionMatrix
            permissions={allPermissions}
            assignedPermissionIds={rolePermissions
              .filter(rp => rp.role_id === selectedRole.id)
              .map(rp => rp.permission_id)
            }
            onToggle={async (permId, targetState) => {
               // Removed isRootSelected check here as well
               const isAssigned = roleHasPermission(selectedRole.id, permId);
               if (isAssigned !== targetState) {
                 await toggleRolePermission(selectedRole.id, permId);
               }
            }}
            // Removed isRootSelected from isReadOnly prop
            isReadOnly={(!canGrantRolePerm && !canRevokeRolePerm)}
          />
        </div>
      </div>
    );
  }

  return null;
};

export default PermissionsPage;
