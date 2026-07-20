import { pool } from "@/lib/db";
import { ExportJob } from "../type/export-job.type";

export async function getExportJob(id: number, JOB_COLUMNS: string): Promise<ExportJob | null> {
  const result = await pool.query<ExportJob>(
    `SELECT ${JOB_COLUMNS} FROM export_jobs WHERE id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
}