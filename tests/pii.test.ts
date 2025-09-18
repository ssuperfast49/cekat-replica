import { describe, it, expect } from 'vitest';
import { sanitizeForExport } from '@/lib/utils';

describe('sanitizeForExport', () => {
  it('redacts emails', () => {
    expect(sanitizeForExport('user@example.com')).toBe('***@***');
  });

  it('masks phone numbers', () => {
    const out = sanitizeForExport('+62 812-3456-7890');
    expect(out.endsWith('7890')).toBe(true);
    expect(/\*/.test(out)).toBe(true);
  });

  it('masks IPv4 last octet', () => {
    expect(sanitizeForExport('192.168.1.42')).toBe('192.168.1.*');
  });

  it('recursively sanitizes objects', () => {
    const out = sanitizeForExport({ email: 'a@b.com', nested: { ip: '10.0.0.7' } });
    expect(out.email).toBe('***@***');
    expect(out.nested.ip).toBe('10.0.0.*');
  });
});


