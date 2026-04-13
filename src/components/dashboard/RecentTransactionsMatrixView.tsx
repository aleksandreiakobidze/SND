"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  RECENT_TX_COLUMN_LABEL_KEY,
  RECENT_TX_ID_TO_ROW_KEY,
  type RecentTransactionsColumnId,
} from "@/lib/recent-transactions-columns";
import {
  accToValues,
  grandTotalAcc,
  sumAccColAllRows,
  sumAccColForPrefix,
  sumAccForFirstDimPrefix,
  sumAccRowAllCols,
  type PivotDisplayRow,
  type PivotModel,
} from "@/lib/recent-transactions-pivot";
import { formatTableCellDisplay } from "@/lib/coordinate-format";
import type { TranslationKey } from "@/lib/i18n";

type Props = {
  model: PivotModel;
  t: (key: TranslationKey) => string;
};

export function RecentTransactionsMatrixView({ model, t }: Props) {
  const { rowIds, colKeys, colLabels, valueIds, displayRows } = model;
  const rowDimCount = rowIds.length;
  /** Second header row lists measure name(s) so a single value (e.g. Liters) is always visible. */
  const showValueHeaderRow = colKeys.length > 0 && valueIds.length >= 1;
  const headerRows = showValueHeaderRow ? 2 : 1;
  const showRowTotals = colKeys.length > 0;

  return (
    <div className="relative isolate z-0 min-w-0 max-h-[min(72vh,920px)] overflow-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            {rowIds.map((id) => (
              <TableHead
                key={id}
                rowSpan={headerRows}
                className="sticky left-0 z-[2] min-w-[6.5rem] border-r bg-muted/95 backdrop-blur-sm"
              >
                {t(RECENT_TX_COLUMN_LABEL_KEY[id])}
              </TableHead>
            ))}
            {colKeys.length === 0 ? (
              <TableHead colSpan={Math.max(1, valueIds.length)} className="text-center text-xs font-semibold">
                {t("rtMatrixGrand")}
              </TableHead>
            ) : (
              colKeys.map((ck) => (
                <TableHead
                  key={ck}
                  colSpan={valueIds.length}
                  className="border-l text-center text-xs font-semibold"
                >
                  {colLabels.get(ck) ?? ck}
                </TableHead>
              ))
            )}
            {showRowTotals ? (
              <TableHead rowSpan={headerRows} className="sticky right-0 z-[2] min-w-[5rem] border-l bg-muted/95 text-center text-xs font-semibold backdrop-blur-sm">
                {t("rtRowTotal")}
              </TableHead>
            ) : null}
          </TableRow>
          {showValueHeaderRow ? (
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              {colKeys.flatMap((ck) =>
                valueIds.map((vid) => (
                  <TableHead key={`${ck}-${vid}`} className="border-l px-1.5 py-1 text-center text-[10px] font-medium text-muted-foreground">
                    {t(RECENT_TX_COLUMN_LABEL_KEY[vid])}
                  </TableHead>
                )),
              )}
            </TableRow>
          ) : null}
        </TableHeader>
        <TableBody>
          {displayRows.map((dr, idx) => (
            <MatrixRow key={`${dr.kind}-${idx}`} dr={dr} model={model} rowDimCount={rowDimCount} colKeys={colKeys} valueIds={valueIds} showRowTotals={showRowTotals} t={t} />
          ))}
        </TableBody>
        <TableFooter>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableCell colSpan={rowDimCount} className="sticky left-0 z-[1] border-r bg-muted/90 font-semibold backdrop-blur-sm">
              {t("tableTotal")}
            </TableCell>
            {colKeys.length === 0
              ? valueIds.map((vid) => <FooterMeasureCell key={vid} model={model} colKey={null} vid={vid} valueIds={valueIds} />)
              : colKeys.flatMap((ck) => valueIds.map((vid) => <FooterMeasureCell key={`${ck}-${vid}`} model={model} colKey={ck} vid={vid} valueIds={valueIds} />))}
            {showRowTotals ? (
              <TableCell className="sticky right-0 z-[1] border-l bg-muted/90 text-right font-semibold backdrop-blur-sm tabular-nums">
                <GrandTotalSingleValue model={model} valueIds={valueIds} />
              </TableCell>
            ) : null}
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}

function FooterMeasureCell({
  model,
  colKey,
  vid,
  valueIds,
}: {
  model: PivotModel;
  colKey: string | null;
  vid: RecentTransactionsColumnId;
  valueIds: RecentTransactionsColumnId[];
}) {
  const a = colKey === null ? grandTotalAcc(model) : sumAccColAllRows(model, colKey);
  const vals = accToValues(a, valueIds);
  const v = vals[vid];
  const rk = RECENT_TX_ID_TO_ROW_KEY[vid];
  return (
    <TableCell className="border-l text-right tabular-nums">
      {v !== null && v !== undefined ? formatTableCellDisplay(v, rk) : "—"}
    </TableCell>
  );
}

function GrandTotalSingleValue({ model, valueIds }: { model: PivotModel; valueIds: RecentTransactionsColumnId[] }) {
  if (valueIds.length !== 1) return "—";
  const g = grandTotalAcc(model);
  const vals = accToValues(g, valueIds);
  const vid = valueIds[0];
  const v = vals[vid];
  const rk = RECENT_TX_ID_TO_ROW_KEY[vid];
  return v !== null && v !== undefined ? formatTableCellDisplay(v, rk) : "—";
}

function MatrixRow({
  dr,
  model,
  rowDimCount,
  colKeys,
  valueIds,
  showRowTotals,
  t,
}: {
  dr: PivotDisplayRow;
  model: PivotModel;
  rowDimCount: number;
  colKeys: string[];
  valueIds: RecentTransactionsColumnId[];
  showRowTotals: boolean;
  t: (key: TranslationKey) => string;
}) {
  if (dr.kind === "subtotal") {
    const accAll = sumAccForFirstDimPrefix(model, dr.label);
    return (
      <TableRow className="bg-muted/15">
        <TableCell colSpan={rowDimCount} className="sticky left-0 z-[1] border-r bg-muted/80 text-xs font-medium backdrop-blur-sm">
          {t("rtSubtotal")} ({dr.label})
        </TableCell>
        {colKeys.length === 0
          ? valueIds.map((vid) => {
              const vals = accToValues(accAll, valueIds);
              const v = vals[vid];
              const rk = RECENT_TX_ID_TO_ROW_KEY[vid];
              return (
                <TableCell key={vid} className="border-l text-right text-sm tabular-nums">
                  {v !== null && v !== undefined ? formatTableCellDisplay(v, rk) : "—"}
                </TableCell>
              );
            })
          : colKeys.flatMap((ck) => {
              const accCol = sumAccColForPrefix(model, dr.label, ck);
              return valueIds.map((vid) => {
                const vals = accToValues(accCol, valueIds);
                const v = vals[vid];
                const rk = RECENT_TX_ID_TO_ROW_KEY[vid];
                return (
                  <TableCell key={`${ck}-${vid}`} className="border-l text-right text-sm tabular-nums">
                    {v !== null && v !== undefined ? formatTableCellDisplay(v, rk) : "—"}
                  </TableCell>
                );
              });
            })}
        {showRowTotals ? (
          <TableCell className="sticky right-0 z-[1] border-l bg-muted/80 text-right text-sm tabular-nums">
            <SubtotalRowTotal model={model} label={dr.label} valueIds={valueIds} />
          </TableCell>
        ) : null}
      </TableRow>
    );
  }

  const rk = dr.rowKey;
  return (
    <TableRow className="hover:bg-muted/20">
      {dr.dimValues.map((v, i) => {
        const colId = model.rowIds[i];
        const rkLabel = colId ? RECENT_TX_ID_TO_ROW_KEY[colId] : "";
        return (
          <TableCell key={i} className="sticky left-0 z-[1] min-w-[6.5rem] border-r bg-background/95 text-sm backdrop-blur-sm">
            {formatTableCellDisplay(v, rkLabel)}
          </TableCell>
        );
      })}
      {colKeys.length === 0
        ? valueIds.map((vid) => {
            const rowMap = model.cells.get(rk);
            const a = rowMap?.get("\u0000") ?? null;
            const vals = a ? accToValues(a, valueIds) : null;
            const v = vals?.[vid];
            const rkKey = RECENT_TX_ID_TO_ROW_KEY[vid];
            return (
              <TableCell key={vid} className="border-l text-right tabular-nums">
                {v !== null && v !== undefined ? formatTableCellDisplay(v, rkKey) : "—"}
              </TableCell>
            );
          })
        : colKeys.flatMap((ck) => {
            const rowMap = model.cells.get(rk);
            const a = rowMap?.get(ck) ?? null;
            const vals = a ? accToValues(a, valueIds) : null;
            return valueIds.map((vid) => {
              const v = vals?.[vid];
              const rkKey = RECENT_TX_ID_TO_ROW_KEY[vid];
              return (
                <TableCell key={`${ck}-${vid}`} className="border-l text-right tabular-nums">
                  {v !== null && v !== undefined ? formatTableCellDisplay(v, rkKey) : "—"}
                </TableCell>
              );
            });
          })}
      {showRowTotals ? (
        <TableCell className="sticky right-0 z-[1] border-l bg-background/95 text-right backdrop-blur-sm tabular-nums">
          <RowTotalSingle model={model} rowKey={rk} valueIds={valueIds} />
        </TableCell>
      ) : null}
    </TableRow>
  );
}

function RowTotalSingle({ model, rowKey, valueIds }: { model: PivotModel; rowKey: string; valueIds: RecentTransactionsColumnId[] }) {
  if (valueIds.length !== 1) return "—";
  const rt = sumAccRowAllCols(model, rowKey);
  const vals = accToValues(rt, valueIds);
  const vid = valueIds[0];
  const v = vals[vid];
  const rk = RECENT_TX_ID_TO_ROW_KEY[vid];
  return v !== null && v !== undefined ? formatTableCellDisplay(v, rk) : "—";
}

function SubtotalRowTotal({
  model,
  label,
  valueIds,
}: {
  model: PivotModel;
  label: string;
  valueIds: RecentTransactionsColumnId[];
}) {
  if (valueIds.length !== 1) return "—";
  const acc = sumAccForFirstDimPrefix(model, label);
  const vals = accToValues(acc, valueIds);
  const vid = valueIds[0];
  const v = vals[vid];
  const rk = RECENT_TX_ID_TO_ROW_KEY[vid];
  return v !== null && v !== undefined ? formatTableCellDisplay(v, rk) : "—";
}
