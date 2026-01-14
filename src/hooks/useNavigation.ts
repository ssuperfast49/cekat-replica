import { useRBAC } from '@/contexts/RBACContext';
import { NAVIGATION_CONFIG, NAVIGATION_ORDER, NavKey } from '@/config/navigation';

/**
 * Hook for navigation-related permission checks
 * Now uses centralized navigation configuration
 */
export function useNavigation() {
  const { 
    hasAnyPermission, 
    hasAllPermissions, 
    hasAnyRole, 
    userRoles, 
    userPermissions,
  } = useRBAC();

  /**
   * Check if user can access a navigation item
   */
  const canAccessNavItem = (navKey: NavKey): boolean => {
    const navItem = NAVIGATION_CONFIG[navKey];
    if (!navItem) return false;

    const roleBlocked = Array.isArray(navItem.forbiddenRoles) && navItem.forbiddenRoles.length > 0
      ? hasAnyRole(navItem.forbiddenRoles)
      : false;

    if (roleBlocked) return false;

    const roleBypassGranted = Array.isArray(navItem.roleBypass) && navItem.roleBypass.length > 0
      ? hasAnyRole(navItem.roleBypass)
      : false;

    if (roleBypassGranted) return true;

    const permsOk = navItem.permissions.length === 0
      ? true
      : navItem.requireAll
        ? hasAllPermissions(navItem.permissions)
        : hasAnyPermission(navItem.permissions);

    if (!permsOk) return false;

    const rolesOk = !navItem.requiredRoles || navItem.requiredRoles.length === 0
      ? true
      : hasAnyRole(navItem.requiredRoles);

    return rolesOk;
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
