/**
 * Mirrors the Postgres `export_job_status` enum (db/migrations/002_export_jobs.sql).
 * Kept in its own module (no `pg`/server imports) so client components can
 * import the enum values without pulling in the Node-only db pool.
 */
export enum ExportJobStatus {
  Pending = 'pending',
  Processing = 'processing',
  Completed = 'completed',
  Failed = 'failed',
}
