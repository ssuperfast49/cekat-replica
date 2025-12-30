import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import { isDocumentHidden, onDocumentVisible } from '@/lib/utils';
import { PERMISSIONS_SCHEMA } from '@/config/permissions';
import { clearAuthzSensitiveCaches, emitAuthzChanged } from '@/lib/authz';
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
  // Helpers for concise UI checks
  can: (resource: string, ...actions: string[]) => boolean;
  canRead: (resource: string) => boolean;
  canCreate: (resource: string) => boolean;
  canUpdate: (resource: string) => boolean;
  canDelete: (resource: string) => boolean;
  loading: boolean;
  error: string | null;
  refreshRBAC: () => Promise<void>;
}

const RBACContext = createContext<RBACContextType | undefined>(undefined);

interface RBACProviderProps {
  children: ReactNode;
}

export function RBACProvider({ children }: RBACProviderProps) {
  const { user, accountDeactivated } = useAuth();
  const [userRoles, setUserRoles] = useState<Role[]>([]);
  const [userPermissions, setUserPermissions] = useState<Permission[]>([]);
  const [userWithRoles, setUserWithRoles] = useState<UserWithRoles | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const computeAuthzFingerprint = (roles: Role[], permissions: Permission[]) => {
    const rolePart = roles
      .map(r => String(r?.name ?? '').trim().toLowerCase())
      .filter(Boolean)
      .sort()
      .join(',');
    const permPart = permissions
      .map(p => `${String((p as any)?.resource ?? '').trim().toLowerCase()}.${String((p as any)?.action ?? '').trim().toLowerCase()}`)
      .filter(s => s !== '.')
      .sort()
      .join(',');
    return `roles:${rolePart}|perms:${permPart}`;
  };

  const persistFingerprintAndMaybeInvalidate = (userId: string, fingerprint: string) => {
    try {
      const key = `app.authzFingerprint:${userId}`;
      const prev = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
      if (prev && prev !== fingerprint) {
        // Role/permission change detected → clear any cached UI/data and force refetch.
        clearAuthzSensitiveCaches();
        emitAuthzChanged('rbac-fingerprint-changed');
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, fingerprint);
      }
    } catch {}
  };

  const fetchUserRBAC = async (userId: string, opts?: { background?: boolean }) => {
    try {
      // During background refreshes, avoid flipping the global loading flag
      if (!opts?.background) {
        setLoading(true);
      }
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
        persistFingerprintAndMaybeInvalidate(userId, computeAuthzFingerprint([], permissions));
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
      persistFingerprintAndMaybeInvalidate(userId, computeAuthzFingerprint(roles, permissions));
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
      if (!opts?.background) {
        setLoading(false);
      }
    }
  };

  const refreshRBAC = async () => {
    if (user?.id) {
      // Refresh in the background so UI (e.g., PermissionGate) doesn't unmount
      await fetchUserRBAC(user.id, { background: true });
    }
  };

  // Fetch RBAC data when user changes (gate network on visibility)
  useEffect(() => {
    if (user?.id && !accountDeactivated) {
      const run = () => fetchUserRBAC(user.id);
      run();
    } else {
      setUserRoles([]);
      setUserPermissions([]);
      setUserWithRoles(null);
      setLoading(false);
    }
  }, [user?.id, accountDeactivated]);

  // Realtime: if your roles are edited directly in the DB, invalidate cached UI/data and refresh RBAC.
  useEffect(() => {
    if (!user?.id || accountDeactivated) return;
    const uid = user.id;

    const channel = supabase
      .channel(`rbac-user-roles:${uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_roles', filter: `user_id=eq.${uid}` },
        async () => {
          // Clear any cached "master agent" UI/data immediately, then refresh RBAC in background.
          clearAuthzSensitiveCaches();
          emitAuthzChanged('user_roles-realtime-change');
          try {
            await fetchUserRBAC(uid, { background: true });
          } catch {}
        }
      )
      .subscribe();

    return () => {
      try { supabase.removeChannel(channel); } catch {}
    };
  }, [user?.id, accountDeactivated]);

  // Permission checking functions
  const hasPermission = (permission: PermissionName | string): boolean => {
    if (!permission) return false;

    // Master Agent Bypass: Always allow master_agent
    if (userRoles.some(r => r.name === 'master_agent')) return true;

    const normalizedInput = String(permission).trim().toLowerCase();

    // 1) Direct match against human-readable name (e.g., "Messages: Read")
    const matchedByName = userPermissions.some(p => (p.name || '').trim().toLowerCase() === normalizedInput);
    if (matchedByName) return true;

    // 2) Match against machine key resource.action (e.g., "messages.read")
    const matchedByKey = userPermissions.some(p => `${p.resource}.${p.action}`.toLowerCase() === normalizedInput);
    if (matchedByKey) return true;

    // 3) Common action synonyms support (edit/update, remove/delete, send/create)
    const dotIndex = normalizedInput.indexOf('.');
    if (dotIndex > 0) {
      const resource = normalizedInput.slice(0, dotIndex);
      const action = normalizedInput.slice(dotIndex + 1);
      const synonymMap: Record<string, string[]> = {
        edit: ['update'],
        update: ['edit'],
        remove: ['delete'],
        delete: ['remove'],
        send: ['create'],
        // Read synonyms: treat any read_* as satisfying generic read and vice versa
        read: ['read_all', 'read_own', 'read_channel_owned', 'read_collaborator'],
        read_all: ['read'],
      };
      const alts = synonymMap[action] || [];
      if (alts.length > 0) {
        const matchedByAlt = userPermissions.some(p => alts.some(a => `${p.resource}.${p.action}`.toLowerCase() === `${resource}.${a}`));
        if (matchedByAlt) return true;
      }
    }

    return false;
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

  // Concise helpers for common checks
  const can = (resource: string, ...actions: string[]) => {
    if (!resource || actions.length === 0) return false;
    return actions.every(a => hasPermission(`${resource}.${a}`));
  };
  // canRead checks if user has ANY read capability for the resource based on the schema
  const canRead = (resource: string) => {
    const actions = (PERMISSIONS_SCHEMA as any)[resource] as string[] | undefined;
    if (!Array.isArray(actions)) return false;
    const readActions = actions.filter(a => a === 'read' || a.startsWith('read_'));
    if (readActions.length === 0) return false;
    return readActions.some(a => hasPermission(`${resource}.${a}`));
  };
  const canCreate = (resource: string) => hasPermission(`${resource}.create`);
  const canUpdate = (resource: string) => hasPermission(`${resource}.update`);
  const canDelete = (resource: string) => hasPermission(`${resource}.delete`);

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
    can,
    canRead,
    canCreate,
    canUpdate,
    canDelete,
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
