import { NextResponse } from 'next/server';
import { listExportJobs } from '@/lib/export-jobs';

export async function GET() {
  const jobs = await listExportJobs();
  return NextResponse.json({ jobs });
}
