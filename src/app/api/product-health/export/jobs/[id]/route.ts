import { NextResponse } from 'next/server';
import { getExportJob } from '@/lib/export-jobs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const jobId = Number(id);

  if (!Number.isInteger(jobId)) {
    return NextResponse.json({ message: 'Invalid job id' }, { status: 400 });
  }

  const job = await getExportJob(jobId);
  if (!job) {
    return NextResponse.json({ message: 'Job not found' }, { status: 404 });
  }

  return NextResponse.json({ job });
}
