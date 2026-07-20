import fs from 'node:fs';
import { once } from 'node:events';
import { pool } from './db';
import { toCsv, type CsvRow } from './csv';

const EXPORT_BATCH_SIZE = 1000;

export type ReportFilters = {
  startDate: string;
  endDate: string;
  country?: string;
  channel?: string;
  brandName?: string;
  search?: string;
};

export type ProductRow = {
  productName: string;
  skuId: string;
  country: string;
  channel: string;
  shopName: string;
  brandName: string;
  categoryL2: string;
  categoryL3: string;
  observations: number;
  inStockRate: number;
  averagePrice: number;
  priceIndex: number;
  rating: number;
  reviewCount: number;
  contentScore: number;
  healthScore: number;
  riskBand: 'High' | 'Medium' | 'Low';
};

export type ReportResult = {
  rows: ProductRow[];
  total: number;
};

type Observation = {
  productName: string;
  skuId: string;
  country: string;
  channel: string;
  shopName: string;
  brandName: string;
  listingUrl: string;
  categoryL2: string;
  categoryL3: string;
  inStock: boolean;
  price: number;
  competitorMedianPrice: number;
  rating: number;
  reviewCount: number;
  contentScore: number;
  rawSnapshot: string;
};

type ProductAccumulator = {
  productName: string;
  skuId: string;
  country: string;
  channel: string;
  shopName: string;
  brandName: string;
  categoryL2: string;
  categoryL3: string;
  observations: number;
  inStockCount: number;
  priceTotal: number;
  competitorPriceTotal: number;
  ratingTotal: number;
  reviewCountMax: number;
  contentScoreTotal: number;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseFilters(input: Record<string, unknown>): ReportFilters {
  const filters = {
    startDate: String(input.startDate ?? ''),
    endDate: String(input.endDate ?? ''),
    country: optionalString(input.country),
    channel: optionalString(input.channel),
    brandName: optionalString(input.brandName),
    search: optionalString(input.search),
  };

  if (!DATE_RE.test(filters.startDate) || !DATE_RE.test(filters.endDate)) {
    throw new Error('startDate and endDate must use YYYY-MM-DD');
  }

  if (filters.startDate > filters.endDate) {
    throw new Error('startDate must be before or equal to endDate');
  }

  return filters;
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function buildWhere(filters: ReportFilters): {
  sql: string;
  values: unknown[];
} {
  const clauses = ['observed_at BETWEEN $1 AND $2'];
  const values: unknown[] = [filters.startDate, filters.endDate];

  for (const [column, value] of [
    ['country', filters.country],
    ['channel', filters.channel],
    ['brand_name', filters.brandName],
  ] as const) {
    if (!value) continue;
    values.push(value);
    clauses.push(`${column} = $${values.length}`);
  }

  if (filters.search) {
    values.push(`%${filters.search}%`);
    clauses.push(`product_name ILIKE $${values.length}`);
  }

  return {
    sql: clauses.join(' AND '),
    values,
  };
}

export async function getReport(filters: ReportFilters): Promise<ReportResult> {
  const where = buildWhere(filters);
  const query = `
    SELECT
      product_name AS "productName",
      sku_id AS "skuId",
      country,
      channel,
      shop_name AS "shopName",
      brand_name AS "brandName",
      category_l2 AS "categoryL2",
      category_l3 AS "categoryL3",
      count(*)::int AS observations,
      round(avg(CASE WHEN in_stock THEN 100 ELSE 0 END), 1)::float AS "inStockRate",
      round(avg(price), 2)::float AS "averagePrice",
      round(avg(price / nullif(competitor_median_price, 0)) * 100, 1)::float AS "priceIndex",
      round(avg(rating), 2)::float AS rating,
      max(review_count)::int AS "reviewCount",
      round(avg(content_score), 0)::int AS "contentScore"
    FROM product_observations
    WHERE ${where.sql}
    GROUP BY product_name, sku_id, country, channel, shop_name, brand_name, category_l2, category_l3
    ORDER BY "inStockRate" ASC, "productName" ASC
    LIMIT 100
  `;

  const countQuery = `
    SELECT count(*)::int AS total
    FROM (
      SELECT sku_id, channel
      FROM product_observations
      WHERE ${where.sql}
      GROUP BY sku_id, channel
    ) grouped
  `;

  const [rows, total] = await Promise.all([
    pool.query<Omit<ProductRow, 'healthScore' | 'riskBand'>>(
      query,
      where.values
    ),
    pool.query<{ total: number }>(countQuery, where.values),
  ]);

  return {
    rows: rows.rows.map(addHealthScore),
    total: total.rows[0]?.total ?? 0,
  };
}

/**
 * Streams raw observations from Postgres in fixed-size batches (keyset
 * pagination on `id`, never OFFSET) and writes CSV rows to disk as each
 * batch arrives. Memory is bounded by one batch (EXPORT_BATCH_SIZE rows)
 * plus a per-product aggregation map, instead of the full result set.
 * Returns the number of raw observation rows written.
 */
export async function streamCalculatedCsvToFile(
  filters: ReportFilters,
  filePath: string
): Promise<number> {
  const where = buildWhere(filters);
  const accumulator = new Map<string, ProductAccumulator>();
  const writeStream = fs.createWriteStream(filePath);

  let cursor = 0;
  let rowCount = 0;
  let headerWritten = false;

  const write = async (chunk: string) => {
    if (!writeStream.write(chunk)) {
      await once(writeStream, 'drain');
    }
  };

  try {
    while (true) {
      const values = [...where.values, cursor, EXPORT_BATCH_SIZE];
      const cursorParam = values.length - 1;
      const limitParam = values.length;
      const query = `
        SELECT
          id,
          product_name AS "productName",
          sku_id AS "skuId",
          country,
          channel,
          shop_name AS "shopName",
          brand_name AS "brandName",
          listing_url AS "listingUrl",
          category_l2 AS "categoryL2",
          category_l3 AS "categoryL3",
          in_stock AS "inStock",
          price::float AS price,
          competitor_median_price::float AS "competitorMedianPrice",
          rating::float AS rating,
          review_count AS "reviewCount",
          content_score AS "contentScore",
          raw_snapshot AS "rawSnapshot"
        FROM product_observations
        WHERE ${where.sql} AND id > $${cursorParam}
        ORDER BY id
        LIMIT $${limitParam}
      `;

      const result = await pool.query<Observation & { id: number }>(
        query,
        values
      );
      if (result.rows.length === 0) break;

      const rawRows = result.rows.map((row) => ({
        productName: row.productName,
        skuId: row.skuId,
        country: row.country,
        channel: row.channel,
        shopName: row.shopName,
        brandName: row.brandName,
        listingUrl: row.listingUrl,
        categoryL2: row.categoryL2,
        categoryL3: row.categoryL3,
        inStock: row.inStock,
        price: row.price,
        competitorMedianPrice: row.competitorMedianPrice,
        rating: row.rating,
        reviewCount: row.reviewCount,
        contentScore: row.contentScore,
        rawSnapshot: row.rawSnapshot,
        diagnosticPayload: `${row.rawSnapshot};calculation_context=${row.skuId}:${row.channel}:${row.price}:${row.rating}`,
      }));

      accumulateProductHealth(accumulator, result.rows);

      await write(toCsv(rawRows as CsvRow[], { header: !headerWritten }) + '\n');
      headerWritten = true;

      rowCount += result.rows.length;
      cursor = result.rows[result.rows.length - 1].id;
    }

    const summaryRows = finalizeProductHealth(accumulator);
    await write('\n# Summary (calculated health scores)\n');
    await write(toCsv(summaryRows as CsvRow[]));

    writeStream.end();
    await once(writeStream, 'finish');
  } catch (error) {
    writeStream.destroy();
    throw error;
  }

  return rowCount;
}

function accumulateProductHealth(
  byProduct: Map<string, ProductAccumulator>,
  rows: Observation[]
): void {
  for (const row of rows) {
    const key = `${row.skuId}:${row.channel}`;
    const current =
      byProduct.get(key) ??
      ({
        productName: row.productName,
        skuId: row.skuId,
        country: row.country,
        channel: row.channel,
        shopName: row.shopName,
        brandName: row.brandName,
        categoryL2: row.categoryL2,
        categoryL3: row.categoryL3,
        observations: 0,
        inStockCount: 0,
        priceTotal: 0,
        competitorPriceTotal: 0,
        ratingTotal: 0,
        reviewCountMax: 0,
        contentScoreTotal: 0,
      } satisfies ProductAccumulator);

    current.observations += 1;
    current.inStockCount += row.inStock ? 1 : 0;
    current.priceTotal += row.price;
    current.competitorPriceTotal += row.competitorMedianPrice;
    current.ratingTotal += row.rating;
    current.reviewCountMax = Math.max(current.reviewCountMax, row.reviewCount);
    current.contentScoreTotal += row.contentScore;
    byProduct.set(key, current);
  }
}

function finalizeProductHealth(
  byProduct: Map<string, ProductAccumulator>
): ProductRow[] {
  return [...byProduct.values()].map((row) => {
    const inStockRate = round((row.inStockCount / row.observations) * 100, 1);
    const averagePrice = round(row.priceTotal / row.observations, 2);
    const priceIndex = round(
      (row.priceTotal / Math.max(row.competitorPriceTotal, 1)) * 100,
      1
    );
    const rating = round(row.ratingTotal / row.observations, 2);
    const contentScore = round(row.contentScoreTotal / row.observations, 0);

    return addHealthScore({
      productName: row.productName,
      skuId: row.skuId,
      country: row.country,
      channel: row.channel,
      shopName: row.shopName,
      brandName: row.brandName,
      categoryL2: row.categoryL2,
      categoryL3: row.categoryL3,
      observations: row.observations,
      inStockRate,
      averagePrice,
      priceIndex,
      rating,
      reviewCount: row.reviewCountMax,
      contentScore,
    });
  });
}

function addHealthScore(
  row: Omit<ProductRow, 'healthScore' | 'riskBand'>
): ProductRow {
  const availabilityScore = row.inStockRate;
  const priceScore = Math.max(0, 100 - Math.abs(row.priceIndex - 100) * 1.5);
  const ratingScore = (row.rating / 5) * 100;
  const reviewScore = Math.min(100, Math.log10(row.reviewCount + 1) * 30);

  // ponytail: intentionally CPU-side calculation for take-home; candidate decides isolation path.
  let stabilityPenalty = 0;
  for (let i = 0; i < 80; i += 1) {
    stabilityPenalty += Math.abs(Math.sin((row.priceIndex + i) / 13)) / 80;
  }

  const healthScore = round(
    availabilityScore * 0.35 +
      priceScore * 0.2 +
      ratingScore * 0.15 +
      reviewScore * 0.1 +
      row.contentScore * 0.2 -
      stabilityPenalty,
    1
  );

  return {
    ...row,
    healthScore,
    riskBand: healthScore < 60 ? 'High' : healthScore < 78 ? 'Medium' : 'Low',
  };
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
