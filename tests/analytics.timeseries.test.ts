import { describe, it, expect } from 'vitest';
import { transformTimeSeries } from '@/lib/analytics';

describe('transformTimeSeries', () => {
  it('groups by bucket and provider into chart rows', () => {
    const points = [
      { bucket: '2025-09-10T00:00:00.000Z', provider: 'whatsapp', count: 3 },
      { bucket: '2025-09-10T00:00:00.000Z', provider: 'web', count: 2 },
      { bucket: '2025-09-11T00:00:00.000Z', provider: 'whatsapp', count: 1 },
    ];
    const rows = transformTimeSeries(points as any);
    expect(rows.length).toBe(2);
    expect(Object.keys(rows[0])).toContain('whatsapp');
    expect(Object.keys(rows[0])).toContain('web');
  });
});


