import { LucideIcon, MessageSquare, BarChart2, Users, PlugZap, Bot, ShieldCheck, Settings as SettingsIcon, Shield, ClipboardList } from 'lucide-react';
import { ROLES } from '@/types/rbac';

export type NavKey = 
  | "chat"
  | "analytics"
  | "logs"
  | "contacts"
  | "platforms"
  | "aiagents"
  | "humanagents"
  | "permissions";
  // | "settings"; // Temporarily hidden

export interface NavigationItem {
  key: NavKey;
  label: string;
  icon: LucideIcon;
  permissions: string[];
  requireAll?: boolean;
  description?: string;
  /**
   * Optional: if provided, the nav item will be considered accessible when
   * the user has ANY permission whose resource matches one of these.
   * Example: ['channels', 'channel_agents']
   */
  resourceAny?: string[];
  /**
   * Optional: restrict nav item visibility to specific roles (ANY-of)
   */
  requiredRoles?: string[];
}

/**
 * Centralized navigation configuration
 * Single source of truth for all navigation items and their permissions
 */
export const NAVIGATION_CONFIG: Record<NavKey, NavigationItem> = {
  chat: {
    key: "chat",
    label: "Chat",
    icon: MessageSquare,
    permissions: ['threads.read'],
    requireAll: true,
    description: "View and manage conversations"
  },
  
  analytics: {
    key: "analytics",
    label: "Analytics",
    icon: BarChart2,
    // Use a single canonical permission for menu access
    permissions: ['analytics.view_kpi'],
    requireAll: true,
    description: "View performance metrics and insights"
  },

  logs: {
    key: "logs",
    label: "Logs",
    icon: ClipboardList,
    permissions: ['audit_logs.read'],
    requireAll: true,
    description: "View user action logs"
  },
  
  contacts: {
    key: "contacts",
    label: "Contacts",
    icon: Users,
    permissions: ['contacts.read'],
    requireAll: true,
    description: "Manage customer contacts and identities"
  },
  
  platforms: {
    key: "platforms",
    label: "Connected Platforms",
    icon: PlugZap,
    // Show menu only if user has channels.read
    permissions: ['channels.read'],
    requireAll: true,
    // resourceAny removed to strictly require channels.read
    description: "Manage connected channels and integrations"
  },
  
  aiagents: {
    key: "aiagents",
    label: "AI Agents",
    icon: Bot,
    permissions: ['ai_profiles.read'],
    requireAll: true,
    description: "Configure and manage AI agents"
  },
  
  humanagents: {
    key: "humanagents",
    label: "Human Agents",
    icon: ShieldCheck,
    permissions: ['super_agents.read'],
    requireAll: true,
    description: "Manage human agent assignments and roles"
  },

  permissions: {
    key: "permissions",
    label: "Permissions",
    icon: Shield,
    permissions: ['access_rules.configure'],
    requireAll: true,
    requiredRoles: [ROLES.MASTER_AGENT],
    description: "Manage roles and permissions"
  },
  
  // Settings menu temporarily hidden
  // settings: {
  //   key: "settings",
  //   label: "Settings",
  //   icon: SettingsIcon,
  //   permissions: [
  //     'access_rules.configure',
  //     'users.read_all', 
  //     'security.manage_2fa'
  //   ],
  //   requireAll: false, // User needs ANY admin permission
  //   description: "System configuration and administration"
  // }
};

/**
 * Get navigation items in display order
 */
export const NAVIGATION_ORDER: NavKey[] = [
  "chat",
  "analytics", 
  "logs",
  "contacts",
  "platforms",
  "aiagents",
  "humanagents",
  "permissions",
  // "settings" // Temporarily hidden
];

/**
 * Get all valid navigation keys
 */
export const VALID_NAV_KEYS = Object.keys(NAVIGATION_CONFIG) as NavKey[];
