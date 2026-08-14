import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type Column<T> = {
  key: string;
  header: string;
  align?: 'left' | 'right';
  cell: (row: T) => ReactNode;
  /** shown as the label in the mobile list presentation */
  mobileLabel?: string;
  hideOnMobileList?: boolean;
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  selectedKey,
  onRowClick,
  emptyMessage = 'No rows to display.',
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  caption: string;
  selectedKey?: string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="cl-panel px-6 py-12 text-center text-[0.9375rem] text-body">
        {emptyMessage}
      </div>
    );
  }

  return (
    <>
      {/* Desktop / tablet table */}
      <div className="cl-panel hidden overflow-x-auto md:block">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="bg-surface">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(
                    'border-b border-line px-4 py-3 text-[0.8125rem] font-semibold whitespace-nowrap text-ink',
                    c.align === 'right' && 'text-right'
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const key = rowKey(row);
              const selected = selectedKey === key;
              return (
                <tr
                  key={key}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'border-b border-line/70 transition-colors duration-150 last:border-b-0',
                    'hover:bg-[rgba(15,110,255,0.04)]',
                    onRowClick && 'cursor-pointer',
                    selected && 'bg-[rgba(15,110,255,0.06)]'
                  )}
                >
                  {columns.map((c, i) => (
                    <td
                      key={c.key}
                      className={cn(
                        'h-14 px-4 py-3 align-middle text-[0.875rem] text-body',
                        c.align === 'right' && 'text-right',
                        selected && i === 0 && 'border-l-2 border-l-cluster-bright'
                      )}
                    >
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile list presentation */}
      <ResponsiveDataList
        columns={columns}
        rows={rows}
        rowKey={rowKey}
        {...(onRowClick ? { onRowClick } : {})}
      />
    </>
  );
}

export function ResponsiveDataList<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: ((row: T) => void) | undefined;
}) {
  return (
    <ul className="space-y-3 md:hidden">
      {rows.map((row) => (
        <li
          key={rowKey(row)}
          className={cn('cl-panel p-4', onRowClick && 'cursor-pointer')}
          onClick={onRowClick ? () => onRowClick(row) : undefined}
        >
          <div className="mb-3 text-[0.9375rem] font-semibold text-ink">
            {columns[0]?.cell(row)}
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
            {columns.slice(1).map((c) =>
              c.hideOnMobileList ? null : (
                <div key={c.key} className="min-w-0">
                  <dt className="cl-meta">{c.mobileLabel ?? c.header}</dt>
                  <dd className="text-[0.875rem] text-ink">{c.cell(row)}</dd>
                </div>
              )
            )}
          </dl>
        </li>
      ))}
    </ul>
  );
}

export function FilterBar({
  options,
  value,
  onChange,
  label,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex flex-wrap gap-2 overflow-x-auto pb-1"
    >
      {options.map((o) => {
        const active = o === value;
        return (
          <button
            key={o}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o)}
            className={cn(
              'min-h-9 rounded-full border px-3.5 py-1.5 text-[0.8125rem] font-semibold whitespace-nowrap transition-colors duration-200 cursor-pointer',
              active
                ? 'border-cluster-bright bg-[rgba(15,110,255,0.08)] text-cluster-bright'
                : 'border-line bg-white text-body hover:border-cluster-bright hover:text-cluster-bright'
            )}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}
