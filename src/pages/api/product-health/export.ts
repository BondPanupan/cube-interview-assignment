import type { NextApiRequest, NextApiResponse } from 'next';
import { exportCalculatedCsv, parseFilters } from '@/lib/product-health';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const filters = parseFilters(req.query as Record<string, unknown>);
    const exportFile = await exportCalculatedCsv(filters);

    res.setHeader('content-type', 'text/csv');
    res.setHeader(
      'content-disposition',
      `attachment; filename="${exportFile.fileName}"`
    );
    return res.status(200).send(exportFile.content);
  } catch (error) {
    return res.status(400).json({
      message: error instanceof Error ? error.message : 'Export failed',
    });
  }
}
