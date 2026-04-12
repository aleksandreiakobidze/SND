function csvEscapeCell(val: unknown): string {
  const str = val === null || val === undefined ? "" : String(val);
  return str.includes(",") || str.includes('"') || str.includes("\n")
    ? `"${str.replace(/"/g, '""')}"`
    : str;
}

export function downloadCsvFromRows(
  rows: Record<string, unknown>[],
  filenameBase: string,
  options?: {
    totals?: Record<string, number | null> | null;
    totalLabel?: string;
  },
): void {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const dataLines = rows.map((row) => headers.map((h) => csvEscapeCell(row[h])).join(","));
  const lines = [headers.join(","), ...dataLines];
  const totals = options?.totals;
  const totalLabel = options?.totalLabel ?? "Total";
  if (totals && Object.values(totals).some((v) => v !== null)) {
    const totalLine = headers
      .map((h, i) => {
        const tv = totals[h];
        if (tv !== null && tv !== undefined) return csvEscapeCell(tv);
        if (i === 0) return csvEscapeCell(totalLabel);
        return "";
      })
      .join(",");
    lines.push(totalLine);
  }
  const csvContent = lines.join("\n");
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safe = filenameBase.replace(/[/\\?%*:|"<>]/g, "-").slice(0, 80);
  a.download = `${safe || "export"}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
