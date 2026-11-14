'use client';

import { ReactNode, useId, useState } from 'react';

interface ChartDataTableProps {
  columns: string[];
  rows: ReactNode[][];
  footer?: ReactNode[];
  label?: string;
}

/** Accessible "Show data" disclosure for a chart's underlying values. */
export function ChartDataTable({
  columns,
  rows,
  footer,
  label = 'Show data',
}: ChartDataTableProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="mt-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="rounded text-xs font-medium text-primary transition-colors hover:text-primary-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        {open ? 'Hide data' : label}
      </button>

      <div
        id={panelId}
        hidden={!open}
        className="mt-2 max-h-56 overflow-y-auto rounded-control border border-line"
      >
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 bg-surface">
            <tr>
              {columns.map((column, index) => (
                <th
                  key={column}
                  scope="col"
                  className={`border-b border-line px-3 py-2 font-semibold text-ink-3 ${
                    index === 0 ? 'text-left' : 'text-right'
                  }`}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-canvas">
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={`px-3 py-1.5 tabular-nums text-ink-2 ${
                      cellIndex === 0 ? 'text-left' : 'text-right'
                    }`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer && (
            <tfoot>
              <tr className="border-t border-line font-semibold text-ink">
                {footer.map((cell, index) => (
                  <td
                    key={index}
                    className={`px-3 py-2 tabular-nums ${
                      index === 0 ? 'text-left' : 'text-right'
                    }`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
