/**
 * Matrix (pivot) helpers for agent comparison views — wide chart rows → row=series, col=time.
 */

function cellToNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export type AgentMatrixModel = {
  rowLabels: string[];
  colLabels: string[];
  /** cells[rowIdx][colIdx] */
  cells: number[][];
  rowTotals: number[];
  colTotals: number[];
  grandTotal: number;
};

/**
 * Wide agent rows: one row per time bucket (xKey), numeric columns yKeys = series.
 * Matrix: rows = series (brands), columns = time buckets.
 */
export function buildMatrixFromWide(
  wide: Record<string, unknown>[],
  xKey: string,
  yKeys: string[],
): AgentMatrixModel {
  const seen = new Set<string>();
  const cols: string[] = [];
  for (const r of wide) {
    const c = String(r[xKey] ?? "");
    if (!seen.has(c)) {
      seen.add(c);
      cols.push(c);
    }
  }

  const rowLabels = [...yKeys];
  const cells: number[][] = rowLabels.map(() => cols.map(() => 0));

  for (const r of wide) {
    const colVal = String(r[xKey] ?? "");
    const ci = cols.indexOf(colVal);
    if (ci < 0) continue;
    for (let ri = 0; ri < rowLabels.length; ri++) {
      cells[ri][ci] = cellToNumber(r[rowLabels[ri]]);
    }
  }

  const rowTotals = cells.map((row) => row.reduce((a, b) => a + b, 0));
  const colTotals = cols.map((_, ci) => cells.reduce((s, row) => s + row[ci], 0));
  const grandTotal = rowTotals.reduce((a, b) => a + b, 0);

  return {
    rowLabels,
    colLabels: cols,
    cells,
    rowTotals,
    colTotals,
    grandTotal,
  };
}

/** Flat rows for Excel export (one row per matrix row + total row). */
export function matrixToFlatExportRows(
  model: AgentMatrixModel,
  rowHeader: string,
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (let ri = 0; ri < model.rowLabels.length; ri++) {
    const o: Record<string, unknown> = { [rowHeader]: model.rowLabels[ri] };
    for (let ci = 0; ci < model.colLabels.length; ci++) {
      o[model.colLabels[ci]] = model.cells[ri][ci];
    }
    o.Total = model.rowTotals[ri];
    out.push(o);
  }
  const totalRow: Record<string, unknown> = { [rowHeader]: "Total" };
  for (let ci = 0; ci < model.colLabels.length; ci++) {
    totalRow[model.colLabels[ci]] = model.colTotals[ci];
  }
  totalRow.Total = model.grandTotal;
  out.push(totalRow);
  return out;
}
