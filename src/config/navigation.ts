import { LucideIcon, MessageSquare, BarChart2, Users, PlugZap, Bot, ShieldCheck, Settings as SettingsIcon } from 'lucide-react';
import { PERMISSIONS, PermissionName } from '@/types/rbac';

export type NavKey = 
  | "chat"
  | "analytics"
  | "contacts"
  | "platforms"
  | "aiagents"
  | "humanagents"
  | "settings";

export interface NavigationItem {
  key: NavKey;
  label: string;
  icon: LucideIcon;
  permissions: PermissionName[];
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
    permissions: [PERMISSIONS.MESSAGES_READ, PERMISSIONS.THREADS_READ],
    requireAll: false, // User needs ANY of these permissions
    description: "View and manage conversations"
  },
  
  analytics: {
    key: "analytics",
    label: "Analytics",
    icon: BarChart2,
    permissions: [
      PERMISSIONS.ANALYTICS_VIEW_KPI, 
      PERMISSIONS.ANALYTICS_VIEW_CONTAINMENT_RATE, 
      PERMISSIONS.ANALYTICS_VIEW_HANDOVER_RATE
    ],
    requireAll: false, // User needs ANY analytics permission
    description: "View performance metrics and insights"
  },
  
  contacts: {
    key: "contacts",
    label: "Contacts",
    icon: Users,
    permissions: [PERMISSIONS.CONTACTS_READ, PERMISSIONS.CONTACT_IDENTITIES_READ],
    requireAll: false, // User needs ANY contact permission
    description: "Manage customer contacts and identities"
  },
  
  platforms: {
    key: "platforms",
    label: "Connected Platforms",
    icon: PlugZap,
    permissions: [PERMISSIONS.CHANNELS_MANAGE],
    requireAll: true, // User needs ALL (just one in this case)
    description: "Manage connected channels and integrations"
  },
  
  aiagents: {
    key: "aiagents",
    label: "AI Agents",
    icon: Bot,
    permissions: [PERMISSIONS.AI_AGENTS_MANAGE],
    requireAll: true,
    description: "Configure and manage AI agents"
  },
  
  humanagents: {
    key: "humanagents",
    label: "Human Agents",
    icon: ShieldCheck,
    permissions: [PERMISSIONS.SUPER_AGENTS_READ],
    requireAll: true,
    description: "Manage human agent assignments and roles"
  },
  
  settings: {
    key: "settings",
    label: "Settings",
    icon: SettingsIcon,
    permissions: [
      PERMISSIONS.ACCESS_RULES_CONFIGURE, 
      PERMISSIONS.USERS_READ_ALL, 
      PERMISSIONS.SECURITY_MANAGE_2FA
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
  "settings"
];

/**
 * Get all valid navigation keys
 */
export const VALID_NAV_KEYS = Object.keys(NAVIGATION_CONFIG) as NavKey[];
