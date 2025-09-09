import { Badge } from '@/components/ui/badge';
import { useRBAC } from '@/contexts/RBACContext';
import { ROLES } from '@/types/rbac';

interface RoleBadgeProps {
  className?: string;
  showAll?: boolean; // If true, shows all user roles; if false, shows highest role only
}

/**
 * RoleBadge - Displays user's role(s) as badges
 */
export default function RoleBadge({ className, showAll = false }: RoleBadgeProps) {
  const { userRoles, loading } = useRBAC();

  if (loading) {
    return <Badge variant="secondary" className={className}>Loading...</Badge>;
  }

  if (userRoles.length === 0) {
    return <Badge variant="outline" className={className}>No Role</Badge>;
  }

  // Role hierarchy for determining "highest" role
  const roleHierarchy = {
    [ROLES.MASTER_AGENT]: 3,
    [ROLES.SUPER_AGENT]: 2,
    [ROLES.AGENT]: 1,
  };

  const rolesToShow = showAll 
    ? userRoles 
    : [userRoles.reduce((highest, current) => 
        (roleHierarchy[current.name as keyof typeof roleHierarchy] || 0) > 
        (roleHierarchy[highest.name as keyof typeof roleHierarchy] || 0) 
          ? current 
          : highest
      )];

  return (
    <div className="flex gap-1 flex-wrap">
      {rolesToShow.map((role) => (
        <Badge 
          key={role.id}
          variant={getRoleVariant(role.name)}
          className={className}
        >
          {formatRoleName(role.name)}
        </Badge>
      ))}
    </div>
  );
}

/**
 * Get badge variant based on role
 */
function getRoleVariant(roleName: string) {
  switch (roleName) {
    case ROLES.MASTER_AGENT:
      return 'default'; // Primary color
    case ROLES.SUPER_AGENT:
      return 'secondary'; // Secondary color
    case ROLES.AGENT:
      return 'outline'; // Outline style
    default:
      return 'outline';
  }
}

/**
 * Format role name for display
 */
function formatRoleName(roleName: string) {
  switch (roleName) {
    case ROLES.MASTER_AGENT:
      return 'Master Agent';
    case ROLES.SUPER_AGENT:
      return 'Super Agent';
    case ROLES.AGENT:
      return 'Agent';
    default:
      return roleName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
}
