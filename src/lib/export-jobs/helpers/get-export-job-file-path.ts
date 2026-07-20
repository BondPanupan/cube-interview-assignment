import path from "node:path";

export function getExportJobFilePath(jobId: number, EXPORT_DIR: string): string {
  return path.join(EXPORT_DIR, `${jobId}.csv`);
}