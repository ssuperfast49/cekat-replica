import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Simple CSV export helper
export function exportToCsv(filename: string, rows: any[]) {
  if (!rows || rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => {
      const cell = row[h];
      const val = cell == null ? '' : String(cell);
      const escaped = '"' + val.replace(/"/g, '""') + '"';
      return /[",\n]/.test(val) ? escaped : val;
    }).join(','))
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// PII sanitization used for CSV export of logs
export function sanitizeForExport(value: any): any {
  if (typeof value === 'string') {
    let s = value.replace(/([A-Z0-9._%+-]+)@([A-Z0-9.-]+)\.[A-Z]{2,}/gi, '***@***');
    s = s.replace(/\b\+?\d[\d\s-]{6,}\b/g, m => m.slice(0, Math.max(0, m.length-4)).replace(/\d/g,'*') + m.slice(-4));
    s = s.replace(/(\d+\.\d+\.\d+)\.\d+/g, '$1.*');
    return s;
  }
  if (value && typeof value === 'object') {
    const out: any = Array.isArray(value) ? [] : {};
    for (const k of Object.keys(value)) out[k] = sanitizeForExport(value[k]);
    return out;
  }
  return value;
}

// Format date labels with Asia/Jakarta timezone
export function formatDateJakarta(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { timeZone: 'Asia/Jakarta' });
}

export function computePercent(numerator: number, denominator: number): number {
  if (!denominator || denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

export function isValidHandoverReason(reason: string | null | undefined): boolean {
  if (!reason) return false;
  const r = String(reason);
  return r === 'ambiguous' || r === 'payment' || r === 'policy' || /^other:.+$/i.test(r);
}