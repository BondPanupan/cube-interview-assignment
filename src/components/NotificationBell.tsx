import { useMemo, useState } from 'react';
import type { ExportJob } from '@/lib/export-jobs';
import { downloadExportJob } from '@/lib/product-health/export';

type Props = {
  jobs: ExportJob[];
};

export function NotificationBell({ jobs }: Props) {
  const [open, setOpen] = useState(false);
  const [lastSeenAt, setLastSeenAt] = useState('');

  const unreadCount = useMemo(
    () => jobs.filter((job) => job.updatedAt > lastSeenAt).length,
    [jobs, lastSeenAt]
  );

  function toggle() {
    setOpen((current) => {
      const next = !current;
      if (next) setLastSeenAt(new Date().toISOString());
      return next;
    });
  }

  function handleSelect(job: ExportJob) {
    if (job.status !== 'completed') return;
    downloadExportJob(job);
  }

  return (
    <div className="notif">
      <button
        type="button"
        className="notif-bell"
        onClick={toggle}
        aria-label="Export notifications"
      >
        Notifications
        {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
      </button>

      {open && (
        <div className="notif-overlay" onClick={() => setOpen(false)}>
          <div
            className="notif-modal"
            role="dialog"
            aria-label="Export notifications"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="notif-modal-header">
              <h2>Exports</h2>
              <button type="button" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>

            {jobs.length === 0 && (
              <p className="notif-empty">No exports yet.</p>
            )}

            <ul className="notif-list">
              {jobs.map((job) => (
                <li key={job.id} className={`notif-item notif-item-${job.status}`}>
                  <button
                    type="button"
                    className="notif-item-button"
                    onClick={() => handleSelect(job)}
                    disabled={job.status !== 'completed'}
                  >
                    <span className="notif-item-title">
                      {job.fileName ?? `Export #${job.id}`}
                    </span>
                    <span className="notif-item-meta">{describeStatus(job)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function describeStatus(job: ExportJob): string {
  switch (job.status) {
    case 'pending':
      return 'Queued...';
    case 'processing':
      return 'Processing...';
    case 'completed':
      return `Ready • ${job.rowCount ?? 0} rows • click to download`;
    case 'failed':
      return `Failed: ${job.errorMessage ?? 'Unknown error'}`;
    default:
      return '';
  }
}
