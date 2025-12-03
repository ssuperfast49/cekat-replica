export const PERMISSIONS_SCHEMA = {
  "analytics": ["read"],
  "ai_profiles": ["create", "update", "delete", "read_all", "read_own"],
  "ai_sessions": ["create", "update", "delete", "read_all", "read_own"],
  "channels": ["create", "update", "delete", "read_all", "read_own"],
  "contacts": ["create", "update", "delete", "read_all", "read_own"],
  "contact_identities": ["create", "update", "delete", "read_all", "read_own"],
  "threads": ["create", "update", "delete", "read_all", "read_channel_owned", "read_collaborator"],
  "messages": ["create", "update", "delete", "send", "read_all", "read_collaborator"],
  "ai_agent_files": ["create", "read", "delete"],
  "admin_panel": ["read", "update"],
  "roles": ["create", "read", "update", "delete"],
  "audit_logs": ["read"],
  "alerts": ["read", "ack"]
} as const;

export type PermissionResource = keyof typeof PERMISSIONS_SCHEMA;
export type PermissionAction = typeof PERMISSIONS_SCHEMA[PermissionResource][number];

// Helper to categorize actions for UI grouping
export const getActionCategory = (action: string): 'create' | 'update' | 'delete' | 'read' | 'special' => {
  if (action === 'create') return 'create';
  if (action === 'update') return 'update';
  if (action === 'delete') return 'delete';
  if (action.startsWith('read') || action.startsWith('view')) return 'read';
  return 'special';
};

export const isHighRiskAction = (action: string) => {
  const risks = ['delete', 'manage_2fa', 'configure', 'update_token_limit', 'manage'];
  return risks.some(r => action.includes(r));
};
