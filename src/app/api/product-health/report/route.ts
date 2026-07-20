import { NextRequest, NextResponse } from 'next/server';
import { getReport, parseFilters } from '@/lib/product-health';

export async function GET(req: NextRequest) {
  try {
    const filters = parseFilters(
      Object.fromEntries(req.nextUrl.searchParams)
    );
    const report = await getReport(filters);
    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Invalid request' },
      { status: 400 }
    );
  }
}
