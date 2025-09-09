import { ReactNode } from 'react';
import { useRBAC } from '@/contexts/RBACContext';
import type { RoleName } from '@/types/rbac';

interface RoleGateProps {
  role: RoleName | string;
  roles?: (RoleName | string)[];
  requireAll?: boolean; // If true, requires ALL roles; if false, requires ANY role
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * RoleGate - Conditionally renders children based on user roles
 * 
 * @param role - Single role to check
 * @param roles - Multiple roles to check
 * @param requireAll - If true, user must have ALL roles; if false, user needs ANY role
 * @param fallback - Component to render if role is denied
 * @param children - Component to render if role is granted
 */
export default function RoleGate({
  role,
  roles = [],
  requireAll = false,
  fallback = null,
  children
}: RoleGateProps) {
  const { hasRole, hasAnyRole, loading } = useRBAC();

  // Show loading state while RBAC data is being fetched
  if (loading) {
    return null; // or a loading spinner
  }

  // Combine single role with roles array
  const allRoles = role ? [role, ...roles] : roles;

  // Check roles based on requireAll flag
  const hasAccess = requireAll 
    ? allRoles.every(r => hasRole(r))
    : hasAnyRole(allRoles);

  return hasAccess ? <>{children}</> : <>{fallback}</>;
}
