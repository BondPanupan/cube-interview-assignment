import { NextRequest, NextResponse } from 'next/server';
import { parseFilters } from '@/lib/product-health';
import { createExportJob, runExportJob } from '@/lib/export-jobs';

export async function POST(req: NextRequest) {
  try {
    const filters = parseFilters(
      Object.fromEntries(req.nextUrl.searchParams)
    );
    const job = await createExportJob(filters);

    // Fire and forget: the export streams to disk in batches off the
    // request path so this response returns immediately regardless of
    // dataset size.
    void runExportJob(job);

    return NextResponse.json({ job }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Export failed' },
      { status: 400 }
    );
  }
}
