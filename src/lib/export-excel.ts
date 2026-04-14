/**
 * Client-side styled .xlsx download (dynamic import of exceljs to keep initial bundle smaller).
 */

import { isLonLatColumnKey } from "@/lib/coordinate-format";

export type ExcelExportOptions = {
  sheetName?: string;
  /** Footer row: same shape as DataTable column totals */
  totals?: Record<string, number | null> | null;
  totalLabel?: string;
  /**
   * Column order for the sheet. Use for matrix exports so row-dimension columns (e.g. Brand)
   * stay first — `Object.keys(row)` sorts numeric-like keys ("1","2") before other names.
   */
  columnOrder?: string[];
};

function excelCellValue(value: unknown): string | number {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? "1" : "0";
  return String(value);
}

export async function downloadExcelFromRows(
  rows: Record<string, unknown>[],
  filenameBase: string,
  options?: ExcelExportOptions,
): Promise<void> {
  if (!rows.length) return;

  const ExcelJS = (await import("exceljs")).default;
  const headers =
    options?.columnOrder && options.columnOrder.length > 0
      ? options.columnOrder
      : Object.keys(rows[0]);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SND Analytics";
  workbook.created = new Date();

  const sheetName = (options?.sheetName ?? "Data").slice(0, 31).replace(/[[\]*?:/\\]/g, "_");
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  const borderThin = { style: "thin" as const, color: { argb: "FFCBD5E1" } };
  const headerFill = {
    type: "pattern" as const,
    pattern: "solid" as const,
    fgColor: { argb: "FFEFF6FF" },
  };
  const zebraFill = {
    type: "pattern" as const,
    pattern: "solid" as const,
    fgColor: { argb: "FFF8FAFC" },
  };

  const headerRow = sheet.addRow(headers);
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 11, color: { argb: "FF0F172A" } };
    cell.fill = headerFill;
    cell.border = { top: borderThin, left: borderThin, bottom: borderThin, right: borderThin };
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  });

  let rowNum = 2;
  for (const dataRow of rows) {
    const values = headers.map((h) => excelCellValue(dataRow[h]));
    const r = sheet.addRow(values);
    const even = rowNum % 2 === 0;
    r.eachCell((cell, colNumber) => {
      const headerName = headers[colNumber - 1] ?? "";
      cell.border = { top: borderThin, left: borderThin, bottom: borderThin, right: borderThin };
      if (even) cell.fill = zebraFill;
      if (typeof cell.value === "number") {
        cell.numFmt = isLonLatColumnKey(headerName)
          ? "General"
          : Number.isInteger(cell.value)
            ? "#,##0"
            : "#,##0.00";
        cell.alignment = { vertical: "middle", horizontal: "right" };
      } else {
        cell.alignment = { vertical: "middle", horizontal: "left", wrapText: false };
      }
    });
    rowNum++;
  }

  const totals = options?.totals;
  if (totals && Object.values(totals).some((v) => v !== null && v !== undefined)) {
    const label = options.totalLabel ?? "Total";
    const tr = sheet.addRow(
      headers.map((h, i) => {
        const v = totals[h];
        if (v !== null && v !== undefined) return v;
        if (i === 0) return label;
        return "";
      }),
    );
    tr.font = { bold: true, size: 11, color: { argb: "FF0F172A" } };
    tr.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF1F5F9" },
    };
    tr.eachCell((cell, colNumber) => {
      const headerName = headers[colNumber - 1] ?? "";
      cell.border = {
        top: { style: "medium", color: { argb: "FF94A3B8" } },
        left: borderThin,
        bottom: borderThin,
        right: borderThin,
      };
      if (typeof cell.value === "number") {
        cell.numFmt = isLonLatColumnKey(headerName)
          ? "General"
          : Number.isInteger(cell.value)
            ? "#,##0"
            : "#,##0.00";
        cell.alignment = { vertical: "middle", horizontal: "right" };
      }
    });
  }

  const lastCol = headers.length;
  const lastRow = sheet.rowCount;
  if (lastCol > 0 && lastRow > 0) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: lastCol },
    };
  }

  headers.forEach((h, i) => {
    const col = sheet.getColumn(i + 1);
    let maxLen = Math.min(h.length, 60);
    const scanEnd = Math.min(lastRow, 50);
    for (let r = 2; r <= scanEnd; r++) {
      const v = sheet.getRow(r).getCell(i + 1).value;
      const s = v === null || v === undefined ? "" : String(v);
      if (s.length > maxLen) maxLen = Math.min(s.length, 60);
    }
    col.width = Math.min(52, Math.max(12, maxLen + 2));
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safe = filenameBase.replace(/[/\\?%*:|"<>]/g, "-").slice(0, 80);
  a.download = `${safe || "export"}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
