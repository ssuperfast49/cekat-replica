import { ReactNode, forwardRef } from 'react';
import { Slot } from '@radix-ui/react-slot';
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
const RoleGate = forwardRef<any, RoleGateProps>(({ 
  role,
  roles = [],
  requireAll = false,
  fallback = null,
  children
}, ref) => {
  const { hasRole, hasAnyRole, loading } = useRBAC();

  if (loading) return null;

  const allRoles = role ? [role, ...roles] : roles;
  const hasAccess = requireAll ? allRoles.every(r => hasRole(r)) : hasAnyRole(allRoles);

  const canUseSlot = !Array.isArray(children) && typeof children !== 'string' && typeof children !== 'number';

  if (!hasAccess) return <>{fallback}</>;

  return canUseSlot ? (
    <Slot ref={ref}>{children}</Slot>
  ) : (
    <>{children}</>
  );
});

export default RoleGate;
