import { useRef, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";

/**
 * Virtualized table body. Renders only the rows currently visible in the
 * scroll viewport — safe for tens of thousands of rows.
 *
 * The header is rendered outside the scroll container so it stays sticky
 * and doesn't reflow as rows recycle. Row heights are estimated; keep
 * `estimateRowHeight` close to reality for smoothest scroll.
 */
export function VirtualTable<T>({
  rows,
  rowKey,
  renderRow,
  header,
  colCount,
  estimateRowHeight = 52,
  maxHeight = 520,
  emptyState,
  className,
}: {
  rows: T[];
  rowKey: (row: T, index: number) => string;
  renderRow: (row: T, index: number) => ReactNode;
  header: ReactNode;
  colCount: number;
  estimateRowHeight?: number;
  maxHeight?: number;
  emptyState?: ReactNode;
  className?: string;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateRowHeight,
    overscan: 8,
  });

  const items = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  return (
    <div className={cn("w-full border border-border/60 rounded-md overflow-hidden", className)}>
      <div className="w-full text-sm">
        <div className="border-b border-border/60 bg-secondary/30">
          <table className="w-full table-fixed">
            <thead>{header}</thead>
          </table>
        </div>
        {rows.length === 0 && emptyState ? (
          <div className="p-6">{emptyState}</div>
        ) : (
          <div
            ref={parentRef}
            className="overflow-auto"
            style={{ maxHeight, height: Math.min(maxHeight, Math.max(estimateRowHeight, totalSize)) }}
          >
            <div style={{ height: totalSize, position: "relative", width: "100%" }}>
              <table className="w-full table-fixed absolute top-0 left-0" style={{ transform: `translateY(${items[0]?.start ?? 0}px)` }}>
                <tbody>
                  {items.map((v) => {
                    const row = rows[v.index];
                    return (
                      <tr
                        key={rowKey(row, v.index)}
                        data-index={v.index}
                        ref={virtualizer.measureElement}
                        className="border-b border-border/40 hover:bg-secondary/40 transition-colors"
                      >
                        {renderRow(row, v.index)}
                      </tr>
                    );
                  })}
                  {items.length === 0 && (
                    <tr><td colSpan={colCount} className="p-4 text-center text-xs text-muted-foreground">Nothing to show</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
