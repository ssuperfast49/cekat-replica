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

// Permission constants based on your database
export const PERMISSIONS = {
  // Core Chat Operations
  MESSAGES_SEND: 'messages.send',
  MESSAGES_READ: 'messages.read',
  THREADS_READ: 'threads.read',
  
  // Contact Management
  CONTACTS_READ: 'contacts.read',
  CONTACT_IDENTITIES_READ: 'contact_identities.read',
  LABELS_READ: 'labels.read',
  
  // Analytics
  ANALYTICS_VIEW_KPI: 'analytics.view_kpi',
  ANALYTICS_VIEW_CONTAINMENT_RATE: 'analytics.view_containment_rate',
  ANALYTICS_VIEW_HANDOVER_RATE: 'analytics.view_handover_rate',
  
  // Alerts
  ALERTS_ACK: 'alerts.ack',
  ALERTS_CONFIGURE: 'alerts.configure',
  ALERTS_RULE_HIGH_USAGE: 'alerts.rule_high_usage',
  ALERTS_READ: 'alerts.read',
  
  // Security & Access
  ACCESS_RULES_CONFIGURE: 'access_rules.configure',
  SECURITY_MANAGE_2FA: 'security.manage_2fa',
  AUDIT_LOGS_READ: 'audit_logs.read',
  
  // Platform & System Management
  CHANNELS_MANAGE: 'channels.manage',
  AI_AGENTS_MANAGE: 'ai_agents.manage',
  SETTINGS_MANAGE: 'settings.manage',
  
  // Monitoring
  MONITORING_VIEW: 'monitoring.view',
  
  // Tokens
  TOKENS_VIEW_TOTAL: 'tokens.view_total',
  TOKENS_TOPUP: 'tokens.topup',
  TOKENS_VIEW_ALL_SUPER_USAGE: 'tokens.view_all_super_usage',
  
  // Users & Agents
  USERS_READ_ALL: 'users.read_all',
  SUPER_AGENTS_READ: 'super_agents.read',
  SUPER_AGENTS_CREATE: 'super_agents.create',
  SUPER_AGENTS_EDIT: 'super_agents.edit',
  SUPER_AGENTS_DELETE: 'super_agents.delete',
  
  // Other
  PROMOTIONS_MANAGE: 'promotions.manage',
} as const;

// Role constants
export const ROLES = {
  MASTER_AGENT: 'master_agent',
  SUPER_AGENT: 'super_agent',
  AGENT: 'agent',
} as const;

// Navigation permission mapping
export const NAVIGATION_PERMISSIONS = {
  chat: [PERMISSIONS.MESSAGES_READ, PERMISSIONS.THREADS_READ],
  analytics: [PERMISSIONS.ANALYTICS_VIEW_KPI, PERMISSIONS.ANALYTICS_VIEW_CONTAINMENT_RATE],
  contacts: [PERMISSIONS.CONTACTS_READ, PERMISSIONS.CONTACT_IDENTITIES_READ],
  platforms: ['channels.manage'], // Using channels instead of platforms
  aiagents: ['ai_agents.manage'], // Will need to create this permission
  humanagents: [PERMISSIONS.SUPER_AGENTS_READ],
  settings: ['settings.manage'], // Will need to create this permission
} as const;

// Feature permission mapping
export const FEATURE_PERMISSIONS = {
  // Chat features
  sendMessage: PERMISSIONS.MESSAGES_SEND,
  readMessages: PERMISSIONS.MESSAGES_READ,
  viewThreads: PERMISSIONS.THREADS_READ,
  
  // Contact features
  readContacts: PERMISSIONS.CONTACTS_READ,
  readContactIdentities: PERMISSIONS.CONTACT_IDENTITIES_READ,
  readLabels: PERMISSIONS.LABELS_READ,
  
  // Analytics features
  viewKPIs: PERMISSIONS.ANALYTICS_VIEW_KPI,
  viewContainmentRate: PERMISSIONS.ANALYTICS_VIEW_CONTAINMENT_RATE,
  viewHandoverRate: PERMISSIONS.ANALYTICS_VIEW_HANDOVER_RATE,
  
  // Agent features
  readSuperAgents: PERMISSIONS.SUPER_AGENTS_READ,
  createSuperAgents: PERMISSIONS.SUPER_AGENTS_CREATE,
  editSuperAgents: PERMISSIONS.SUPER_AGENTS_EDIT,
  deleteSuperAgents: PERMISSIONS.SUPER_AGENTS_DELETE,
  
  // Admin features
  manageUsers: PERMISSIONS.USERS_READ_ALL,
  manageSecurity: PERMISSIONS.SECURITY_MANAGE_2FA,
  viewAuditLogs: PERMISSIONS.AUDIT_LOGS_READ,
  managePromotions: PERMISSIONS.PROMOTIONS_MANAGE,
} as const;

// Type helpers
export type PermissionName = typeof PERMISSIONS[keyof typeof PERMISSIONS];
export type RoleName = typeof ROLES[keyof typeof ROLES];
export type NavigationKey = keyof typeof NAVIGATION_PERMISSIONS;
export type FeatureKey = keyof typeof FEATURE_PERMISSIONS;
