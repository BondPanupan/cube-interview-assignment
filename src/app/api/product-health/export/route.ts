import { NextRequest, NextResponse } from 'next/server';
import { exportCalculatedCsv, parseFilters } from '@/lib/product-health';

export async function GET(req: NextRequest) {
  try {
    const filters = parseFilters(
      Object.fromEntries(req.nextUrl.searchParams)
    );
    const exportFile = await exportCalculatedCsv(filters);

    return new NextResponse(exportFile.content, {
      status: 200,
      headers: {
        'content-type': 'text/csv',
        'content-disposition': `attachment; filename="${exportFile.fileName}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Export failed' },
      { status: 400 }
    );
  }
}
