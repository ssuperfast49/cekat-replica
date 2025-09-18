export interface RolePolicy {
  resources?: Record<string, string[]>;
}

export function isActionAllowedByPolicy(policy: RolePolicy | null | undefined, resource: string, action: string): boolean {
  if (!policy || !policy.resources) return false;
  const list = policy.resources[resource];
  if (!Array.isArray(list)) return false;
  return list.includes(action);
}


