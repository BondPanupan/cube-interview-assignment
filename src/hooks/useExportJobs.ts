import { useCallback, useEffect, useState } from 'react';
import type { ExportJob } from '@/lib/export-jobs/export-jobs';
import { fetchExportJobs } from '@/lib/product-health/export';

const POLL_INTERVAL_MS = 3000;

export function useExportJobs() {
  const [jobs, setJobs] = useState<ExportJob[]>([]);

  const refresh = useCallback(async () => {
    try {
      const nextJobs = await fetchExportJobs();
      setJobs(nextJobs);
    } catch {
      // Ignore transient polling errors; next tick will retry.
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  return { jobs, refresh };
}
