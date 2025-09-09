import { ReactNode } from 'react';
import { useRBAC } from '@/contexts/RBACContext';
import type { PermissionName } from '@/types/rbac';

interface PermissionGateProps {
  permission: PermissionName | string;
  permissions?: (PermissionName | string)[];
  requireAll?: boolean; // If true, requires ALL permissions; if false, requires ANY permission
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * PermissionGate - Conditionally renders children based on user permissions
 * 
 * @param permission - Single permission to check
 * @param permissions - Multiple permissions to check
 * @param requireAll - If true, user must have ALL permissions; if false, user needs ANY permission
 * @param fallback - Component to render if permission is denied
 * @param children - Component to render if permission is granted
 */
export default function PermissionGate({
  permission,
  permissions = [],
  requireAll = false,
  fallback = null,
  children
}: PermissionGateProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions, loading } = useRBAC();

  // Show loading state while RBAC data is being fetched
  if (loading) {
    return null; // or a loading spinner
  }

  // Combine single permission with permissions array
  const allPermissions = permission ? [permission, ...permissions] : permissions;

  // Check permissions based on requireAll flag
  const hasAccess = requireAll 
    ? hasAllPermissions(allPermissions)
    : hasAnyPermission(allPermissions);

  return hasAccess ? <>{children}</> : <>{fallback}</>;
}
