import { useEffect, useMemo, useState } from 'react';
import { useRBAC } from '@/contexts/RBACContext';
import { NAVIGATION_CONFIG, NAVIGATION_ORDER, NavKey } from '@/config/navigation';

/**
 * Hook for navigation-related permission checks
 * Now uses centralized navigation configuration
 */
export function useNavigation() {
  const { hasAnyPermission, hasAllPermissions, hasAnyRole, hasPermissionDB, userRoles, userPermissions } = useRBAC() as any;

  // Cache DB-computed access per nav key to reflect table policies first
  const [dbAccessMap, setDbAccessMap] = useState<Record<NavKey, boolean>>({} as Record<NavKey, boolean>);

  useEffect(() => {
    let cancelled = false;
    const compute = async () => {
      const entries = await Promise.all(
        NAVIGATION_ORDER.map(async (navKey) => {
          const navItem = NAVIGATION_CONFIG[navKey];
          // roles check (client side) first
          const rolesOk = !navItem.requiredRoles || navItem.requiredRoles.length === 0
            ? true
            : hasAnyRole(navItem.requiredRoles);

          // DB permission checks (policies first)
          const checks = await Promise.all(
            navItem.permissions.map(async (perm) => {
              const dot = perm.indexOf('.');
              if (dot < 0) return false;
              const resource = perm.slice(0, dot);
              const action = perm.slice(dot + 1);
              return await hasPermissionDB(resource, action);
            })
          );
          const permsOk = navItem.requireAll ? checks.every(Boolean) : checks.some(Boolean);
          return [navKey, rolesOk && permsOk] as const;
        })
      );
      if (!cancelled) {
        const next: Record<NavKey, boolean> = {} as Record<NavKey, boolean>;
        for (const [k, v] of entries) next[k] = v;
        setDbAccessMap(next);
      }
    };
    compute();
    return () => {
      cancelled = true;
    };
  // Recompute when roles/permissions change; avoid depending on function identity
  }, [hasAnyRole, userRoles, userPermissions]);

  /**
   * Check if user can access a navigation item
   */
  const canAccessNavItem = (navKey: NavKey): boolean => {
    const navItem = NAVIGATION_CONFIG[navKey];
    if (!navItem) return false;

    // Prefer DB-evaluated access (policies first) when it grants access.
    // If DB check denies (false), fall back to client-side evaluation to allow
    // master-agent bypass and non-DB-derived permission logic for navigation visibility.
    if (dbAccessMap[navKey] === true) return true;

    // Fallback to in-memory permissions if DB result not ready
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
