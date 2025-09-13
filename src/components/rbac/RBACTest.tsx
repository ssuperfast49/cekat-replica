import { useRBAC } from '@/contexts/RBACContext';
import { ROLES } from '@/types/rbac';
import PermissionGate from './PermissionGate';
import AsyncPermissionGate from './AsyncPermissionGate';
import RoleGate from './RoleGate';
import RoleBadge from './RoleBadge';

/**
 * RBACTest - A test component to verify RBAC functionality
 * This can be temporarily added to any page to test the RBAC system
 */
export default function RBACTest() {
  const { 
    userRoles, 
    userPermissions, 
    hasPermission, 
    hasRole, 
    hasPermissionDB,
    loading, 
    error 
  } = useRBAC();

  if (loading) {
    return <div className="p-4 border rounded">Loading RBAC data...</div>;
  }

  if (error) {
    return <div className="p-4 border rounded bg-red-50 text-red-700">Error: {error}</div>;
  }

  return (
    <div className="p-4 border rounded space-y-4">
      <h3 className="text-lg font-semibold">RBAC Test Component</h3>
      
      {/* User Role Badge */}
      <div>
        <h4 className="font-medium">Your Role:</h4>
        <RoleBadge />
      </div>

      {/* User Roles */}
      <div>
        <h4 className="font-medium">User Roles:</h4>
        <ul className="list-disc list-inside">
          {userRoles.map(role => (
            <li key={role.id}>{role.name} - {role.description}</li>
          ))}
        </ul>
      </div>

      {/* User Permissions */}
      <div>
        <h4 className="font-medium">User Permissions:</h4>
        <ul className="list-disc list-inside max-h-32 overflow-y-auto">
          {userPermissions.map(permission => (
            <li key={permission.id}>{permission.name}</li>
          ))}
        </ul>
      </div>

      {/* Permission Tests */}
      <div>
        <h4 className="font-medium">Permission Tests:</h4>
        <div className="space-y-2">
          <div>
            Can send messages: {hasPermission('messages.send') ? '✅' : '❌'}
          </div>
          <div>
            Can read messages: {hasPermission('messages.read') ? '✅' : '❌'}
          </div>
          <div>
            Can view analytics: {hasPermission('analytics.view_kpi') ? '✅' : '❌'}
          </div>
          <div>
            Can manage users: {hasPermission('users.read_all') ? '✅' : '❌'}
          </div>
        </div>
      </div>

      {/* Role Tests */}
      <div>
        <h4 className="font-medium">Role Tests:</h4>
        <div className="space-y-2">
          <div>
            Is Master Agent: {hasRole(ROLES.MASTER_AGENT) ? '✅' : '❌'}
          </div>
          <div>
            Is Super Agent: {hasRole(ROLES.SUPER_AGENT) ? '✅' : '❌'}
          </div>
          <div>
            Is Agent: {hasRole(ROLES.AGENT) ? '✅' : '❌'}
          </div>
        </div>
      </div>

      {/* Permission Gate Tests */}
      <div>
        <h4 className="font-medium">Permission Gate Tests:</h4>
        <div className="space-y-2">
          <PermissionGate permission={'messages.send'}>
            <div className="p-2 bg-green-100 text-green-800 rounded">
              ✅ You can send messages
            </div>
          </PermissionGate>
          
          <PermissionGate permission={'analytics.view_kpi'}>
            <div className="p-2 bg-blue-100 text-blue-800 rounded">
              ✅ You can view analytics
            </div>
          </PermissionGate>
          
          <PermissionGate permission="non.existent.permission">
            <div className="p-2 bg-red-100 text-red-800 rounded">
              ❌ This should not show
            </div>
          </PermissionGate>
        </div>
      </div>

      {/* Role Gate Tests */}
      <div>
        <h4 className="font-medium">Role Gate Tests:</h4>
        <div className="space-y-2">
          <RoleGate role={ROLES.MASTER_AGENT}>
            <div className="p-2 bg-purple-100 text-purple-800 rounded">
              ✅ You are a Master Agent
            </div>
          </RoleGate>
          
          <RoleGate role={ROLES.AGENT}>
            <div className="p-2 bg-gray-100 text-gray-800 rounded">
              ✅ You are an Agent
            </div>
          </RoleGate>
        </div>
      </div>

      {/* Async Permission Gate Tests (Database-level) */}
      <div>
        <h4 className="font-medium">Async Permission Gate Tests (DB-level):</h4>
        <div className="space-y-2">
          <AsyncPermissionGate resource="messages" action="send">
            <div className="p-2 bg-green-100 text-green-800 rounded">
              ✅ You can send messages (DB check)
            </div>
          </AsyncPermissionGate>
          
          <AsyncPermissionGate resource="analytics" action="view_kpi">
            <div className="p-2 bg-blue-100 text-blue-800 rounded">
              ✅ You can view analytics (DB check)
            </div>
          </AsyncPermissionGate>
          
          <AsyncPermissionGate resource="access_rules" action="configure">
            <div className="p-2 bg-purple-100 text-purple-800 rounded">
              ✅ You can configure access rules (DB check)
            </div>
          </AsyncPermissionGate>
        </div>
      </div>
    </div>
  );
}
