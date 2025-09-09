import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import type { 
  Role, 
  Permission, 
  RoleWithPermissions, 
  UserWithRoles,
  PermissionName,
  RoleName 
} from '@/types/rbac';

interface RBACContextType {
  userRoles: Role[];
  userPermissions: Permission[];
  userWithRoles: UserWithRoles | null;
  hasPermission: (permission: PermissionName | string) => boolean;
  hasAnyPermission: (permissions: (PermissionName | string)[]) => boolean;
  hasAllPermissions: (permissions: (PermissionName | string)[]) => boolean;
  hasRole: (role: RoleName | string) => boolean;
  hasAnyRole: (roles: (RoleName | string)[]) => boolean;
  hasPermissionDB: (resource: string, action: string) => Promise<boolean>;
  loading: boolean;
  error: string | null;
  refreshRBAC: () => Promise<void>;
}

const RBACContext = createContext<RBACContextType | undefined>(undefined);

interface RBACProviderProps {
  children: ReactNode;
}

export function RBACProvider({ children }: RBACProviderProps) {
  const { user } = useAuth();
  const [userRoles, setUserRoles] = useState<Role[]>([]);
  const [userPermissions, setUserPermissions] = useState<Permission[]>([]);
  const [userWithRoles, setUserWithRoles] = useState<UserWithRoles | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserRBAC = async (userId: string) => {
    try {
      setLoading(true);
      setError(null);

      // Use the v_current_user_permissions view for efficient permission fetching
      const { data: permissionsData, error: permissionsError } = await supabase
        .from('v_current_user_permissions')
        .select('*');

      if (permissionsError) throw permissionsError;

      // Extract permissions
      const permissions: Permission[] = permissionsData || [];
      setUserPermissions(permissions);

      // Fetch user roles - use a simpler approach
      const { data: userRolesData, error: userRolesError } = await supabase
        .from('user_roles')
        .select('role_id')
        .eq('user_id', userId);

      if (userRolesError) throw userRolesError;

      if (!userRolesData || userRolesData.length === 0) {
        setUserRoles([]);
        setUserWithRoles({
          user_id: userId,
          roles: [],
          permissions
        });
        return;
      }

      // Fetch role details
      const roleIds = userRolesData.map(item => item.role_id);
      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .select('*')
        .in('id', roleIds);

      if (rolesError) throw rolesError;

      const roles: Role[] = rolesData || [];
      setUserRoles(roles);

      // Create roles with permissions
      const rolesWithPermissions: RoleWithPermissions[] = roles.map(role => ({
        ...role,
        permissions: permissions // All permissions from the view
      }));

      setUserWithRoles({
        user_id: userId,
        roles: rolesWithPermissions,
        permissions
      });

    } catch (err) {
      console.error('Error fetching user RBAC:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch user permissions');
    } finally {
      setLoading(false);
    }
  };

  const refreshRBAC = async () => {
    if (user?.id) {
      await fetchUserRBAC(user.id);
    }
  };

  // Fetch RBAC data when user changes
  useEffect(() => {
    if (user?.id) {
      fetchUserRBAC(user.id);
    } else {
      setUserRoles([]);
      setUserPermissions([]);
      setUserWithRoles(null);
      setLoading(false);
    }
  }, [user?.id]);

  // Permission checking functions
  const hasPermission = (permission: PermissionName | string): boolean => {
    return userPermissions.some(p => p.name === permission);
  };

  const hasAnyPermission = (permissions: (PermissionName | string)[]): boolean => {
    return permissions.some(permission => hasPermission(permission));
  };

  const hasAllPermissions = (permissions: (PermissionName | string)[]): boolean => {
    return permissions.every(permission => hasPermission(permission));
  };

  const hasRole = (role: RoleName | string): boolean => {
    return userRoles.some(r => r.name === role);
  };

  const hasAnyRole = (roles: (RoleName | string)[]): boolean => {
    return roles.some(role => hasRole(role));
  };

  // Database-level permission check using has_perm() function
  const hasPermissionDB = async (resource: string, action: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('has_perm', {
        p_resource: resource,
        p_action: action
      });
      
      if (error) {
        console.error('Error checking permission:', error);
        return false;
      }
      
      return data === true;
    } catch (err) {
      console.error('Error in hasPermissionDB:', err);
      return false;
    }
  };

  const value: RBACContextType = {
    userRoles,
    userPermissions,
    userWithRoles,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasAnyRole,
    hasPermissionDB,
    loading,
    error,
    refreshRBAC,
  };

  return (
    <RBACContext.Provider value={value}>
      {children}
    </RBACContext.Provider>
  );
}

export function useRBAC() {
  const context = useContext(RBACContext);
  if (context === undefined) {
    throw new Error('useRBAC must be used within an RBACProvider');
  }
  return context;
}
