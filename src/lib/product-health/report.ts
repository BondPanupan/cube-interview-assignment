import type { ReportResult } from '@/lib/product-health';

export async function fetchReport(queryParams: string): Promise<ReportResult> {
  const res = await fetch(`/api/product-health/report?${queryParams}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.message ?? 'Report failed');
  }

  return body as ReportResult;
}
