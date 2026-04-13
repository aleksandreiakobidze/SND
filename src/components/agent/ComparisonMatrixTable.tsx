"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrencyCompact } from "@/lib/chart-number-format";
import type { AgentMatrixModel } from "@/lib/agent-matrix";
import type { TranslationKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Props = {
  model: AgentMatrixModel;
  /** First column header (e.g. Brand). */
  rowDimLabel: string;
  measureLabel: string;
  t: (k: TranslationKey) => string;
  formatCell?: (n: number) => string;
  className?: string;
};

export function ComparisonMatrixTable({
  model,
  rowDimLabel,
  measureLabel,
  t,
  formatCell = formatCurrencyCompact,
  className,
}: Props) {
  const { rowLabels, colLabels, cells, rowTotals, colTotals, grandTotal } = model;

  return (
    <div className={cn("w-full overflow-x-auto rounded-xl border border-border/60", className)}>
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
          {rowLabels.map((rowName, ri) => (
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
      <p className="border-t border-border/60 px-3 py-2 text-xs text-muted-foreground">
        {measureLabel}
      </p>
    </div>
  );
}
