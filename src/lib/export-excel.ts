/**
 * Client-side styled .xlsx download (dynamic import of exceljs to keep initial bundle smaller).
 */

import { populateWorkbookFromRows, type ExcelExportOptions } from "@/lib/excel-workbook-from-rows";

export type { ExcelExportOptions };

export async function downloadExcelFromRows(
  rows: Record<string, unknown>[],
  filenameBase: string,
  options?: ExcelExportOptions,
): Promise<void> {
  if (!rows.length) return;

  const ExcelJS = (await import("exceljs")).default;
  const workbook = await populateWorkbookFromRows(ExcelJS, rows, options);
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
