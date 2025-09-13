// RBAC Types based on your Supabase schema

export interface Role {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  created_at: string;
}

export interface RolePermission {
  role_id: string;
  permission_id: string;
  created_at: string;
}

export interface UserRole {
  user_id: string;
  role_id: string;
  created_at: string;
}

// Extended types with relationships
export interface RoleWithPermissions extends Role {
  permissions: Permission[];
}

export interface UserWithRoles {
  user_id: string;
  roles: RoleWithPermissions[];
  permissions: Permission[];
}

// Intentionally no permission constants.
// Best practice: reference permissions as exact 'resource.action' strings directly from the DB.

// Role constants
export const ROLES = {
  MASTER_AGENT: 'master_agent',
  SUPER_AGENT: 'super_agent',
  AGENT: 'agent',
} as const;

// Intentionally no navigation permission mapping; use config/navigation.ts.

// Intentionally no feature permission mapping; use string literals close to usage.

// Type helpers
export type PermissionName = string; // use 'resource.action' literals aligned with DB
export type RoleName = typeof ROLES[keyof typeof ROLES];
