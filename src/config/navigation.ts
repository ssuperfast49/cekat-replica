import { LucideIcon, MessageSquare, BarChart2, Users, PlugZap, Bot, ShieldCheck, Settings as SettingsIcon, Shield } from 'lucide-react';

export type NavKey = 
  | "chat"
  | "analytics"
  | "contacts"
  | "platforms"
  | "aiagents"
  | "humanagents"
  | "permissions"
  | "settings";

export interface NavigationItem {
  key: NavKey;
  label: string;
  icon: LucideIcon;
  permissions: string[];
  requireAll?: boolean;
  description?: string;
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
    permissions: ['messages.read', 'threads.read'],
    requireAll: false, // User needs ANY of these permissions
    description: "View and manage conversations"
  },
  
  analytics: {
    key: "analytics",
    label: "Analytics",
    icon: BarChart2,
    permissions: [
      'analytics.view_kpi',
      'analytics.view_containment_rate', 
      'analytics.view_handover_rate'
    ],
    requireAll: false, // User needs ANY analytics permission
    description: "View performance metrics and insights"
  },
  
  contacts: {
    key: "contacts",
    label: "Contacts",
    icon: Users,
    permissions: ['contacts.read', 'contact_identities.read'],
    requireAll: false, // User needs ANY contact permission
    description: "Manage customer contacts and identities"
  },
  
  platforms: {
    key: "platforms",
    label: "Connected Platforms",
    icon: PlugZap,
    permissions: ['channels.manage'],
    requireAll: true, // User needs ALL (just one in this case)
    description: "Manage connected channels and integrations"
  },
  
  aiagents: {
    key: "aiagents",
    label: "AI Agents",
    icon: Bot,
    permissions: ['ai_agents.manage'],
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
    description: "Manage roles and permissions"
  },
  
  settings: {
    key: "settings",
    label: "Settings",
    icon: SettingsIcon,
    permissions: [
      'access_rules.configure',
      'users.read_all', 
      'security.manage_2fa'
    ],
    requireAll: false, // User needs ANY admin permission
    description: "System configuration and administration"
  }
};

/**
 * Get navigation items in display order
 */
export const NAVIGATION_ORDER: NavKey[] = [
  "chat",
  "analytics", 
  "contacts",
  "platforms",
  "aiagents",
  "humanagents",
  "permissions",
  "settings"
];

/**
 * Get all valid navigation keys
 */
export const VALID_NAV_KEYS = Object.keys(NAVIGATION_CONFIG) as NavKey[];
