import { formatDateJakarta, computePercent } from '@/lib/utils';

export interface TimeSeriesPoint { bucket: string; provider: string; count: number }

// Convert [{bucket,provider,count}] into chart rows [{ bucketLabel, providerA, providerB, ... }]
export function transformTimeSeries(points: TimeSeriesPoint[]) {
  const providers = Array.from(new Set(points.map(p => p.provider)));
  const buckets = Array.from(new Set(points.map(p => p.bucket))).sort();
  return buckets.map(b => {
    const row: Record<string, any> = { bucket: formatDateJakarta(b) };
    for (const p of providers) {
      row[p] = points.find(x => x.bucket === b && x.provider === p)?.count || 0;
    }
    return row;
  });
}

export function containmentPercent(aiResolved: number, total: number) {
  return computePercent(aiResolved, total);
}


