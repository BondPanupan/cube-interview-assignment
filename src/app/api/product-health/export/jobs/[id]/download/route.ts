import fs from 'node:fs';
import { Readable } from 'node:stream';
import { NextResponse } from 'next/server';
import { ExportJobStatus, getExportJob, getExportJobFilePath } from '@/lib/export-jobs/export-jobs';

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

  if (job.status !== ExportJobStatus.Completed || !job.fileName) {
    return NextResponse.json(
      { message: `Export is not ready (status: ${job.status})` },
      { status: 409 }
    );
  }

  const filePath = getExportJobFilePath(job.id);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json(
      { message: 'Export file is no longer available' },
      { status: 410 }
    );
  }

  const nodeStream = fs.createReadStream(filePath);
  const webStream = Readable.toWeb(nodeStream) as ReadableStream;

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      'content-type': 'text/csv',
      'content-disposition': `attachment; filename="${job.fileName}"`,
    },
  });
}
