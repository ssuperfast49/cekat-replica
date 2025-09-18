import { describe, it, expect } from 'vitest';
import { isActionAllowedByPolicy } from '@/lib/rbac';

describe('RBAC policy evaluation', () => {
  it('allows when action present in resource list', () => {
    const policy = { resources: { analytics: ['view_kpi'] } } as any;
    expect(isActionAllowedByPolicy(policy, 'analytics', 'view_kpi')).toBe(true);
  });

  it('denies when action not in list', () => {
    const policy = { resources: { analytics: ['view_kpi'] } } as any;
    expect(isActionAllowedByPolicy(policy, 'analytics', 'export')).toBe(false);
  });
});


