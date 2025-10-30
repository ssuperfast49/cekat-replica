import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRBAC } from '@/contexts/RBACContext';

interface PermissionNavItemProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick?: () => void;
  collapsed?: boolean;
  permissions: string[];
  requireAll?: boolean;
  resourceAny?: string[];
  requiredRoles?: string[];
}

/**
 * PermissionNavItem - A clean, simplified navigation item with permission checking
 * Only renders if user has the required permissions
 */
export default function PermissionNavItem({
  icon: Icon,
  label,
  active = false,
  onClick,
  collapsed,
  permissions,
  requireAll = false,
  resourceAny = [],
  requiredRoles = [],
}: PermissionNavItemProps) {
  const { hasAnyPermission, hasAllPermissions, hasAnyRole, loading } = useRBAC();

  if (loading) return null;

  // Strict: rely only on explicit permissions (e.g., 'channels.read')
  const allowedPerms = requireAll
    ? hasAllPermissions(permissions)
    : hasAnyPermission(permissions);
  const allowedRoles = requiredRoles.length === 0 || hasAnyRole(requiredRoles);

  if (!allowedPerms || !allowedRoles) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group grid h-10 w-full grid-cols-[1.125rem,1fr] items-center rounded-md px-3 text-left text-sm transition-all duration-200 gap-2",
        active
          ? "bg-blue-100 text-blue-700 border border-blue-200"
          : "text-muted-foreground hover:bg-blue-50 hover:text-blue-600 hover:border hover:border-blue-100",
        collapsed && "grid-cols-[1.125rem,0fr]"
      )}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
    >
      <Icon className={`h-4 w-4 shrink-0 transition-colors ${active ? "text-blue-600" : "group-hover:text-blue-600"}`} />
      <span
        className={cn(
          "overflow-hidden whitespace-nowrap text-ellipsis transition-opacity duration-200",
          collapsed && "opacity-0 pointer-events-none",
        )}
      >
        {label}
      </span>
    </button>
  );
}
