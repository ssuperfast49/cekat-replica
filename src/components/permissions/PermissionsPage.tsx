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
import { supabase } from "@/lib/supabase";
import { useRBAC } from "@/contexts/RBACContext";

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

// Special permissions that don't follow standard CRUD pattern
const SPECIAL_PERMISSIONS = [
  'access_rules.configure',
  'ai_agents.manage',
  'alerts.ack',
  'alerts.configure',
  'alerts.read',
  'alerts.rule_high_usage',
  'analytics.view_containment_rate',
  'analytics.view_handover_rate', 
  'analytics.view_kpi',
  'audit_logs.read',
  'channels.manage',
  'contacts.edit',
  'contacts.export',
  'csat_responses.read',
  'messages.edit',
  'messages.export',
  'messages.send',
  'monitoring.view',
  'n8n_chat_histories.read',
  'permission_catalog.read',
  'promotions.manage',
  'security.manage_2fa',
  'settings.manage',
  'super_agents.create',
  'super_agents.read',
  'super_agents.edit',
  'super_agents.delete',
  'threads.edit',
  'threads.export',
  'token_topups.approve',
  'tokens.topup',
  'tokens.view_all_super_usage',
  'tokens.view_total',
  'users.read_all',
  'users_profile.manage_2fa',
  'v_users.read'
];

const PermissionsPage = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [view, setView] = useState<'roles' | 'configure'>('roles');
  const { toast } = useToast();
  const { refreshRBAC } = useRBAC();
  const [saving, setSaving] = useState<Record<string, boolean>>({});

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

  // Check if role has permission
  const roleHasPermission = (roleId: string, permissionId: string): boolean => {
    return rolePermissions.some(rp => rp.role_id === roleId && rp.permission_id === permissionId);
  };

  // Toggle permission for role via secure RPCs
  const toggleRolePermission = async (roleId: string, permissionId: string) => {
    try {
      const hasPermission = roleHasPermission(roleId, permissionId);
      const key = `${roleId}:${permissionId}`;
      setSaving(prev => ({ ...prev, [key]: true }));

      if (hasPermission) {
        // Revoke via RPC
        const { error } = await supabase.rpc('revoke_role_permission', {
          p_role: roleId,
          p_perm: permissionId,
        });
        if (error) throw error;

        setRolePermissions(prev => prev.filter(rp => !(rp.role_id === roleId && rp.permission_id === permissionId)));
      } else {
        // Grant via RPC
        const { error } = await supabase.rpc('grant_role_permission', {
          p_role: roleId,
          p_perm: permissionId,
        });
        if (error) throw error;

        setRolePermissions(prev => [...prev, { role_id: roleId, permission_id: permissionId }]);
      }

      // Refresh RBAC so nav/guards reflect changes immediately
      await refreshRBAC();

      toast({
        title: "Success",
        description: `Permission ${hasPermission ? 'removed from' : 'added to'} role`,
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

  // Separate CRUD and special permissions
  const crudPermissions = allPermissions.filter(p => 
    CRUD_RESOURCES.includes(p.resource) && CRUD_ACTIONS.includes(normalizeCrudAction(p.action) as any)
  );
  
  const specialPermissions = allPermissions
    .filter(p => !crudPermissions.some(cp => cp.id === p.id))
    .sort((a, b) => {
      const ai = SPECIAL_PERMISSIONS.indexOf(a.name);
      const bi = SPECIAL_PERMISSIONS.indexOf(b.name);
      const aw = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
      const bw = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
      if (aw !== bw) return aw - bw;
      if (a.resource !== b.resource) return a.resource.localeCompare(b.resource);
      return a.action.localeCompare(b.action);
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Role Permissions</h1>
            <p className="text-muted-foreground">Manage role permissions</p>
          </div>
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
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedRole(role);
                          setView('configure');
                        }}
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Configure
                      </Button>
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
                                  disabled={!!saving[`${selectedRole.id}:${permission.id}`]}
                                />
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
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
                          disabled={!!saving[`${selectedRole.id}:${permission.id}`]}
                        />
                        <Label htmlFor={permission.id} className="text-sm font-normal cursor-pointer">
                          <span className="font-mono text-xs">{permission.name}</span>
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