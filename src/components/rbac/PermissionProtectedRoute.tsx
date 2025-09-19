import { ReactNode } from 'react';
import { useRBAC } from '@/contexts/RBACContext';
import type { PermissionName } from '@/types/rbac';

interface PermissionProtectedRouteProps {
  permission?: PermissionName | string;
  permissions?: (PermissionName | string)[];
  requireAll?: boolean;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * PermissionProtectedRoute - Protects routes based on user permissions
 * Similar to ProtectedRoute but with permission-based access control
 */
export default function PermissionProtectedRoute({
  permission,
  permissions = [],
  requireAll = false,
  children,
  fallback = <PermissionDenied />
}: PermissionProtectedRouteProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions, loading } = useRBAC();

  // Show loading state while RBAC data is being fetched
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span>Loading permissions...</span>
        </div>
      </div>
    );
  }

  // Combine single permission with permissions array
  const allPermissions = permission ? [permission, ...permissions] : permissions;

  // Check permissions based on requireAll flag
  const hasAccess = requireAll 
    ? hasAllPermissions(allPermissions)
    : hasAnyPermission(allPermissions);

  return hasAccess ? <>{children}</> : <>{fallback}</>;
}

/**
 * PermissionDenied - Default fallback component for denied access
 */
function PermissionDenied() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="text-6xl">🚫</div>
        <h1 className="text-2xl font-semibold text-gray-900">Access Denied</h1>
        <p className="text-gray-600 max-w-md">
          You don't have permission to access this page. Please contact your administrator if you believe this is an error.
        </p>
        <button 
          onClick={() => window.history.back()}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Go Back
        </button>
      </div>
    </div>
  );
}
