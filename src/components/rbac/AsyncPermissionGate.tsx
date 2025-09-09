import { ReactNode, useEffect, useState } from 'react';
import { useRBAC } from '@/contexts/RBACContext';

interface AsyncPermissionGateProps {
  resource: string;
  action: string;
  fallback?: ReactNode;
  children: ReactNode;
  loading?: ReactNode;
}

/**
 * AsyncPermissionGate - Uses database-level permission checking with has_perm() function
 * This is more efficient for one-off permission checks
 */
export default function AsyncPermissionGate({
  resource,
  action,
  fallback = null,
  children,
  loading = null
}: AsyncPermissionGateProps) {
  const { hasPermissionDB } = useRBAC();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkPermission = async () => {
      try {
        setIsLoading(true);
        const result = await hasPermissionDB(resource, action);
        setHasAccess(result);
      } catch (error) {
        console.error('Error checking permission:', error);
        setHasAccess(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkPermission();
  }, [resource, action, hasPermissionDB]);

  if (isLoading) {
    return <>{loading}</>;
  }

  return hasAccess ? <>{children}</> : <>{fallback}</>;
}
