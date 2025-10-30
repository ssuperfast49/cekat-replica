import { ReactNode, forwardRef } from 'react';
import { Slot } from '@radix-ui/react-slot';
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
const PermissionGate = forwardRef<any, PermissionGateProps>(({ 
  permission,
  permissions = [],
  requireAll = false,
  fallback = null,
  children
}, ref) => {
  const { hasAnyPermission, hasAllPermissions, loading } = useRBAC();

  if (loading) return null;

  const allPermissions = permission ? [permission, ...permissions] : permissions;
  const hasAccess = requireAll ? hasAllPermissions(allPermissions) : hasAnyPermission(allPermissions);

  // Only use Slot when there's exactly one valid React element child.
  const canUseSlot = !Array.isArray(children) && typeof children !== 'string' && typeof children !== 'number';

  if (!hasAccess) return <>{fallback}</>;

  return canUseSlot ? (
    <Slot ref={ref}>{children}</Slot>
  ) : (
    <>{children}</>
  );
});

export default PermissionGate;
