import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pool } from './db';
import { streamCalculatedCsvToFile, type ReportFilters } from './product-health';
import { ExportJobStatus } from './export-job-status';

export { ExportJobStatus };

export type ExportJob = {
  id: number;
  status: ExportJobStatus;
  filters: ReportFilters;
  fileName: string | null;
  rowCount: number | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

const EXPORT_DIR =
  process.env.EXPORT_DIR ?? path.join(os.tmpdir(), 'product-health-exports');

const JOB_COLUMNS = `
  id,
  status,
  filters,
  file_name AS "fileName",
  row_count AS "rowCount",
  error_message AS "errorMessage",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  completed_at AS "completedAt"
`;

export async function createExportJob(filters: ReportFilters): Promise<ExportJob> {
  const result = await pool.query<ExportJob>(
    `INSERT INTO export_jobs (status, filters) VALUES ($1, $2) RETURNING ${JOB_COLUMNS}`,
    [ExportJobStatus.Pending, JSON.stringify(filters)]
  );
  return result.rows[0];
}

export async function listExportJobs(limit = 20): Promise<ExportJob[]> {
  const result = await pool.query<ExportJob>(
    `SELECT ${JOB_COLUMNS} FROM export_jobs ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return result.rows;
}

export async function getExportJob(id: number): Promise<ExportJob | null> {
  const result = await pool.query<ExportJob>(
    `SELECT ${JOB_COLUMNS} FROM export_jobs WHERE id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
}

export function getExportJobFilePath(jobId: number): string {
  return path.join(EXPORT_DIR, `${jobId}.csv`);
}

/**
 * Runs a job to completion in the background. Not awaited by the route
 * handler that kicks it off -- this process stays alive after the HTTP
 * response is sent (this is a long-running `next start` server, not a
 * serverless function), so the export keeps progressing off the request
 * path while streaming batches to disk with bounded memory.
 */
export async function runExportJob(job: ExportJob): Promise<void> {
  await fs.promises.mkdir(EXPORT_DIR, { recursive: true });
  const filePath = getExportJobFilePath(job.id);
  const fileName = `product-health-calculated-${job.filters.startDate}-to-${job.filters.endDate}.csv`;

  await pool.query(
    `UPDATE export_jobs SET status = $2, updated_at = now() WHERE id = $1`,
    [job.id, ExportJobStatus.Processing]
  );

  try {
    const rowCount = await streamCalculatedCsvToFile(job.filters, filePath);
    await pool.query(
      `UPDATE export_jobs
       SET status = $2, file_name = $3, row_count = $4, updated_at = now(), completed_at = now()
       WHERE id = $1`,
      [job.id, ExportJobStatus.Completed, fileName, rowCount]
    );
  } catch (error) {
    await fs.promises.rm(filePath, { force: true });
    await pool.query(
      `UPDATE export_jobs
       SET status = $2, error_message = $3, updated_at = now(), completed_at = now()
       WHERE id = $1`,
      [job.id, ExportJobStatus.Failed, error instanceof Error ? error.message : 'Export failed']
    );
  }
}
