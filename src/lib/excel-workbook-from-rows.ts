/**
 * Shared Excel workbook builder for browser download and server-side email attachments.
 */

import type { Cell, Workbook } from "exceljs";
import { isLonLatColumnKey, shouldRenderAsText, type ColumnDisplayMeta } from "@/lib/coordinate-format";

export type ExcelExportOptions = {
  sheetName?: string;
  /** Footer row: same shape as DataTable column totals */
  totals?: Record<string, number | null> | null;
  totalLabel?: string;
  columnOrder?: string[];
  columnDisplayMeta?: Partial<Record<string, ColumnDisplayMeta>>;
};

function sanitizeSheetName(name: string): string {
  return name.slice(0, 31).replace(/[[\]*?:/\\]/g, "_");
}

function excelCellValue(
  value: unknown,
  headerName: string,
  columnDisplayMeta?: Partial<Record<string, ColumnDisplayMeta>>,
): string | number {
  if (value === null || value === undefined) return "";
  const meta = columnDisplayMeta?.[headerName];
  if (shouldRenderAsText(headerName, meta)) return String(value);
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? "1" : "0";
  return String(value);
}

/**
 * Add a styled worksheet to an existing workbook (used for multi-sheet exports).
 */
export async function addWorksheetFromRows(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ExcelJSMod: any,
  workbook: Workbook,
  rows: Record<string, unknown>[],
  options?: ExcelExportOptions,
): Promise<void> {
  if (!rows.length) {
    throw new Error("addWorksheetFromRows: rows must not be empty");
  }

  const headers =
    options?.columnOrder && options.columnOrder.length > 0
      ? options.columnOrder
      : Object.keys(rows[0]);

  const sheetName = sanitizeSheetName(options?.sheetName ?? "Data");
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
  headerRow.eachCell((cell: Cell) => {
    cell.font = { bold: true, size: 11, color: { argb: "FF0F172A" } };
    cell.fill = headerFill;
    cell.border = { top: borderThin, left: borderThin, bottom: borderThin, right: borderThin };
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  });

  let rowNum = 2;
  for (const dataRow of rows) {
    const values = headers.map((h) => excelCellValue(dataRow[h], h, options?.columnDisplayMeta));
    const r = sheet.addRow(values);
    const even = rowNum % 2 === 0;
    r.eachCell((cell: Cell, colNumber: number) => {
      const headerName = headers[colNumber - 1] ?? "";
      cell.border = { top: borderThin, left: borderThin, bottom: borderThin, right: borderThin };
      if (even) cell.fill = zebraFill;
      const meta = options?.columnDisplayMeta?.[headerName];
      const textMode = shouldRenderAsText(headerName, meta);
      if (!textMode && typeof cell.value === "number") {
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
    tr.eachCell((cell: Cell, colNumber: number) => {
      const headerName = headers[colNumber - 1] ?? "";
      cell.border = {
        top: { style: "medium", color: { argb: "FF94A3B8" } },
        left: borderThin,
        bottom: borderThin,
        right: borderThin,
      };
      const meta = options?.columnDisplayMeta?.[headerName];
      const textMode = shouldRenderAsText(headerName, meta);
      if (!textMode && typeof cell.value === "number") {
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
}

/**
 * Build a styled worksheet from row objects. Used by client download and server email.
 * @param ExcelJSMod - default export from `import("exceljs")` (has `.Workbook`).
 */
export async function populateWorkbookFromRows(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ExcelJSMod: any,
  rows: Record<string, unknown>[],
  options?: ExcelExportOptions,
) {
  const workbook = new ExcelJSMod.Workbook();
  workbook.creator = "SND Analytics";
  workbook.created = new Date();
  await addWorksheetFromRows(ExcelJSMod, workbook, rows, options);
  return workbook;
}

export async function buildExcelBufferFromRows(
  rows: Record<string, unknown>[],
  options?: ExcelExportOptions,
): Promise<Buffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = await populateWorkbookFromRows(ExcelJS, rows, options);
  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export type ExcelSheetPart = {
  sheetName: string;
  rows: Record<string, unknown>[];
  columnOrder?: string[];
};

/**
 * One workbook with multiple sheets (e.g. chart-view delivery: Flat table + Matrix).
 */
export async function buildExcelBufferMultiSheet(parts: ExcelSheetPart[]): Promise<Buffer> {
  const nonEmpty = parts.filter((p) => p.rows.length > 0);
  if (!nonEmpty.length) {
    throw new Error("buildExcelBufferMultiSheet: no non-empty sheets");
  }
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SND Analytics";
  workbook.created = new Date();
  for (const p of nonEmpty) {
    await addWorksheetFromRows(ExcelJS, workbook, p.rows, {
      sheetName: p.sheetName,
      columnOrder: p.columnOrder,
    });
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
