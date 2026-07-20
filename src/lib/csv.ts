export type CsvRow = Record<string, string | number | boolean | null>;

function escapeCsv(value: string | number | boolean | null): string {
  if (value === null) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(rows: CsvRow[], options?: { header?: boolean }): string {
  if (rows.length === 0) return '';

  const headers = Object.keys(rows[0]);
  const body = rows.map((row) =>
    headers.map((header) => escapeCsv(row[header])).join(',')
  );

  if (options?.header === false) return body.join('\n');

  return [headers.join(','), ...body].join('\n');
}
