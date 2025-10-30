import { useRBAC } from '@/contexts/RBACContext';
import { NAVIGATION_CONFIG, NAVIGATION_ORDER, NavKey } from '@/config/navigation';

/**
 * Hook for navigation-related permission checks
 * Now uses centralized navigation configuration
 */
export function useNavigation() {
  const { hasAnyPermission, hasAllPermissions, hasAnyRole } = useRBAC();

  /**
   * Check if user can access a navigation item
   */
  const canAccessNavItem = (navKey: NavKey): boolean => {
    const navItem = NAVIGATION_CONFIG[navKey];
    if (!navItem) return false;

    // Strict check: only explicit permissions are considered
    const permsOk = navItem.requireAll
      ? hasAllPermissions(navItem.permissions)
      : hasAnyPermission(navItem.permissions);

    // If requiredRoles specified, also enforce roles (ANY-of)
    const rolesOk = !navItem.requiredRoles || navItem.requiredRoles.length === 0
      ? true
      : hasAnyRole(navItem.requiredRoles);

    return permsOk && rolesOk;
  };

  /**
   * Get all accessible navigation items in display order
   */
  const getAccessibleNavItems = (): NavKey[] => {
    return NAVIGATION_ORDER.filter(navKey => canAccessNavItem(navKey));
  };

  /**
   * Get the default accessible navigation item (first one user can access)
   */
  const getDefaultNavItem = (): NavKey | null => {
    const accessible = getAccessibleNavItems();
    return accessible.length > 0 ? accessible[0] : null;
  };

  /**
   * Get navigation item configuration
   */
  const getNavItem = (navKey: NavKey) => {
    return NAVIGATION_CONFIG[navKey];
  };

  return {
    canAccessNavItem,
    getAccessibleNavItems,
    getDefaultNavItem,
    getNavItem,
    navigationConfig: NAVIGATION_CONFIG,
  };
}
