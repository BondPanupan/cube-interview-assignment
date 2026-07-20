import type { ExportJob } from '@/lib/export-jobs';

export async function createExportJob(queryParams: string): Promise<ExportJob> {
  const res = await fetch(`/api/product-health/export?${queryParams}`, {
    method: 'POST',
  });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(body.message ?? 'Export failed');
  }

  return body.job as ExportJob;
}

export async function fetchExportJobs(): Promise<ExportJob[]> {
  const res = await fetch('/api/product-health/export/jobs');
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(body.message ?? 'Failed to load export notifications');
  }

  return body.jobs as ExportJob[];
}

export function downloadExportJob(job: ExportJob): void {
  const url = `/api/product-health/export/jobs/${job.id}/download`;
  const link = document.createElement('a');
  link.href = url;
  if (job.fileName) link.download = job.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
