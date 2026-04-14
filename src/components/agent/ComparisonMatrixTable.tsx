"use client";

import { useMemo, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ReportPaginationBar } from "@/components/report/ReportPaginationBar";
import { formatCurrencyCompact } from "@/lib/chart-number-format";
import type { AgentMatrixModel } from "@/lib/agent-matrix";
import type { TranslationKey } from "@/lib/i18n";
import { coercePageSize } from "@/lib/report-pagination-presets";
import { cn } from "@/lib/utils";

type Props = {
  model: AgentMatrixModel;
  /** First column header (e.g. Brand). */
  rowDimLabel: string;
  measureLabel: string;
  t: (k: TranslationKey) => string;
  formatCell?: (n: number) => string;
  className?: string;
  /** Row-dimension pagination (Brand rows), same presets as flat table. */
  pageSize: number;
  pageIndex: number;
  onPageSizeChange: (size: number) => void;
  onPageIndexChange: (index: number) => void;
};

export function ComparisonMatrixTable({
  model,
  rowDimLabel,
  measureLabel,
  t,
  formatCell = formatCurrencyCompact,
  className,
  pageSize: pageSizeProp,
  pageIndex,
  onPageSizeChange,
  onPageIndexChange,
}: Props) {
  const { rowLabels, colLabels, cells, rowTotals, colTotals, grandTotal } = model;

  const pageSize = coercePageSize(pageSizeProp);

  const { totalDataRows, pageCount, safePageIndex, visibleRows } = useMemo(() => {
    const totalDataRows = rowLabels.length;
    const pageCount = Math.max(1, Math.ceil(totalDataRows / pageSize));
    const safePageIndex = Math.min(Math.max(0, pageIndex), pageCount - 1);
    const sliceStart = safePageIndex * pageSize;
    const visibleRows = rowLabels.slice(sliceStart, sliceStart + pageSize).map((rowName, i) => {
      const ri = sliceStart + i;
      return { rowName, ri };
    });
    return { totalDataRows, pageCount, safePageIndex, visibleRows };
  }, [rowLabels, pageSize, pageIndex]);

  useEffect(() => {
    if (safePageIndex !== pageIndex) {
      onPageIndexChange(safePageIndex);
    }
  }, [safePageIndex, pageIndex, onPageIndexChange]);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="w-full overflow-x-auto rounded-xl border border-border/60">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="sticky left-0 z-10 min-w-[120px] bg-muted/90 font-semibold backdrop-blur">
                {rowDimLabel}
              </TableHead>
              {colLabels.map((c) => (
                <TableHead key={c} className="text-right font-semibold whitespace-nowrap">
                  {c}
                </TableHead>
              ))}
              <TableHead className="text-right font-semibold whitespace-nowrap">{t("matrixTotal")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.map(({ rowName, ri }) => (
              <TableRow key={rowName}>
                <TableCell className="sticky left-0 z-10 bg-background/95 font-medium backdrop-blur">
                  {rowName}
                </TableCell>
                {colLabels.map((_, ci) => (
                  <TableCell key={`${rowName}-${ci}`} className="text-right tabular-nums">
                    {formatCell(cells[ri][ci] ?? 0)}
                  </TableCell>
                ))}
                <TableCell className="text-right font-medium tabular-nums">{formatCell(rowTotals[ri] ?? 0)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/30 font-medium">
              <TableCell className="sticky left-0 z-10 bg-muted/80">{t("matrixColumnTotals")}</TableCell>
              {colLabels.map((_, ci) => (
                <TableCell key={`tot-${ci}`} className="text-right tabular-nums">
                  {formatCell(colTotals[ci] ?? 0)}
                </TableCell>
              ))}
              <TableCell className="text-right tabular-nums">{formatCell(grandTotal)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <p className="border-t border-border/60 px-3 py-2 text-xs text-muted-foreground">{measureLabel}</p>
      </div>

      <ReportPaginationBar
        totalRowCount={totalDataRows}
        pageSize={pageSize}
        pageIndex={safePageIndex}
        pageCount={pageCount}
        onPageSizeChange={(size) => {
          const next = coercePageSize(size);
          onPageSizeChange(next);
          onPageIndexChange(0);
        }}
        onPreviousPage={() => onPageIndexChange(safePageIndex - 1)}
        onNextPage={() => onPageIndexChange(safePageIndex + 1)}
        canPreviousPage={safePageIndex > 0}
        canNextPage={safePageIndex < pageCount - 1}
        t={t}
      />
    </div>
  );
}
