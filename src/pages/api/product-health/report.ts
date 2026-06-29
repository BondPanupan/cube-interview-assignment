import type { NextApiRequest, NextApiResponse } from 'next';
import { getReport, parseFilters } from '@/lib/product-health';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const filters = parseFilters(req.query as Record<string, unknown>);
    const report = await getReport(filters);
    return res.status(200).json(report);
  } catch (error) {
    return res.status(400).json({
      message: error instanceof Error ? error.message : 'Invalid request',
    });
  }
}
