import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { ProductRow, ReportFilters } from '@/lib/product-health';
import { fetchExport } from '@/lib/product-health/export';
import { fetchReport } from '@/lib/product-health/report';

const initialFilters: ReportFilters = {
  startDate: '2026-01-05',
  endDate: '2026-05-18',
  country: '',
  channel: '',
  brandName: '',
  search: '',
};

export default function Home() {
  const [filters, setFilters] = useState<ReportFilters>(initialFilters);
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const query = useMemo(
    () => new URLSearchParams(cleanFilters(filters)).toString(),
    [filters]
  );

  async function loadReport(nextFilters = filters) {
    setLoading(true);
    setError('');

    try {
      const query = new URLSearchParams(cleanFilters(nextFilters)).toString();
      const response = await fetchReport(query);
      if (!response) {
        setError('Report failed');
        setLoading(false);
        return;
      }
      setRows(response.rows);
      setTotal(response.total);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Report failed');
    } finally {
      setLoading(false);
    }
  }

  async function requestExport() {
    setError('');
    setExporting(true);

    try {
      await fetchExport(query);
      console.log('export is done...')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    loadReport();
  }

  useEffect(() => {
    loadReport(initialFilters);
  }, []);

  return (
    <main className="page">
      <section className="header">
        <div>
          <p className="eyebrow">Digital Shelf</p>
          <h1>Product Health</h1>
        </div>
        <button onClick={requestExport} disabled={exporting}>
          {exporting ? 'Preparing...' : 'Export Selected Filters'}
        </button>
      </section>

      <form className="filters" onSubmit={submit}>
        {/* <label>
          Start
          <input
            type="date"
            value={filters.startDate}
            onChange={(event) =>
              setFilters({ ...filters, startDate: event.target.value })
            }
          />
        </label>
        <label>
          End
          <input
            type="date"
            value={filters.endDate}
            onChange={(event) =>
              setFilters({ ...filters, endDate: event.target.value })
            }
          />
        </label> */}
        <label>
          Country
          <select
            value={filters.country}
            onChange={(event) =>
              setFilters({ ...filters, country: event.target.value })
            }
          >
            <option value="">All</option>
            <option>Indonesia</option>
            <option>Malaysia</option>
            <option>Philippines</option>
            <option>Singapore</option>
            <option>Thailand</option>
            <option>Vietnam</option>
            <option>Taiwan</option>
            <option>China</option>
          </select>
        </label>
        <label>
          Channel
          <select
            value={filters.channel}
            onChange={(event) =>
              setFilters({ ...filters, channel: event.target.value })
            }
          >
            <option value="">All</option>
            <option>Shopee</option>
            <option>Lazada</option>
            <option>TikTok Shop</option>
          </select>
        </label>
        <label>
          Brand
          <select
            value={filters.brandName}
            onChange={(event) =>
              setFilters({ ...filters, brandName: event.target.value })
            }
          >
            <option value="">All</option>
            <option>Acme</option>
            <option>Nova</option>
            <option>Pinnacle</option>
            <option>Everyday Co</option>
          </select>
        </label>
        <label>
          Search
          <input
            value={filters.search}
            onChange={(event) =>
              setFilters({ ...filters, search: event.target.value })
            }
            placeholder="Product name"
          />
        </label>
        <button type="submit">Apply</button>
      </form>

      <section className="status">
        One-click export uses one API request and calculates health scores over
        raw observations. Large filters intentionally stress Node CPU and
        memory.
      </section>

      {error && <section className="error">{error}</section>}

      <section className="summary">
        <span>
          {loading ? 'Loading...' : `${rows.length} shown of ${total} products`}
        </span>
        <a href={`/api/product-health/report?${query}`}>JSON</a>
      </section>

      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Brand</th>
              <th>Channel</th>
              <th>Shop</th>
              <th>In stock</th>
              <th>Price</th>
              <th>Rating</th>
              <th>Content</th>
              <th>Health</th>
              <th>Risk</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.skuId}-${row.channel}`}>
                <td>
                  <strong>{row.productName}</strong>
                  <small>{row.skuId}</small>
                </td>
                <td>{row.brandName}</td>
                <td>{row.channel}</td>
                <td>{row.shopName}</td>
                <td>{row.inStockRate}%</td>
                <td>${row.averagePrice}</td>
                <td>{row.rating}</td>
                <td>{row.contentScore}</td>
                <td>{row.healthScore}</td>
                <td>{row.riskBand}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function cleanFilters(filters: ReportFilters): Record<string, string> {
  return Object.fromEntries(
    Object.entries(filters).filter(
      ([, value]) => typeof value === 'string' && value.length > 0
    )
  ) as Record<string, string>;
}
