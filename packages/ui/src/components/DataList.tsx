// "The mobile fallback for every dense table" (docs/06-DESIGN-SYSTEM.md).
// A real <table> at md: (760px) and up; stacked cards with the column name
// as a label above each value below that — never horizontal scroll for
// primary content.
export interface DataListColumn<T> {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
}

export interface DataListProps<T> {
  columns: DataListColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
}

export function DataList<T>({ columns, rows, rowKey }: DataListProps<T>) {
  return (
    <>
      <table className="hidden w-full border-collapse text-sm md:table">
        <thead>
          <tr className="border-b border-line text-left text-ink-soft">
            {columns.map((col) => (
              <th key={col.key} className="px-3 py-2 font-medium">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-b border-line last:border-0">
              {columns.map((col) => (
                <td key={col.key} className="px-3 py-2 text-ink">
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => (
          <div key={rowKey(row)} className="rounded-lg border border-line p-3">
            {columns.map((col) => (
              <div key={col.key} className="flex items-baseline justify-between py-1 text-sm">
                <span className="text-ink-soft">{col.label}</span>
                <span className="text-ink">{col.render(row)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
