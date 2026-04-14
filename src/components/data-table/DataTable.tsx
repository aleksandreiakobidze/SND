"use client";

import { useState, useMemo, useEffect } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  SortingState,
  ColumnDef,
  ColumnFiltersState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowUpDown, Download, FileSpreadsheet } from "lucide-react";
import { ReportPaginationBar } from "@/components/report/ReportPaginationBar";
import { coercePageSize } from "@/lib/report-pagination-presets";
import { useLocale } from "@/lib/locale-context";
import { computeColumnTotals } from "@/lib/table-totals";
import { orderKeysItemCodeBeforeItemName } from "@/lib/table-column-order";
import { isTechnicalIdColumnKey } from "@/lib/technical-columns";
import { downloadCsvFromRows } from "@/lib/export-csv";
import { downloadExcelFromRows } from "@/lib/export-excel";
import { cn } from "@/lib/utils";
import { formatTableCellDisplay, isLonLatColumnKey } from "@/lib/coordinate-format";

interface DataTableProps {
  data: Record<string, unknown>[];
  title?: string;
  searchable?: boolean;
  exportable?: boolean;
  pageSize?: number;
  /** Footer row with sums for numeric measure columns (uses filtered rows, not only current page). Default true. */
  showTotals?: boolean;
  /**
   * When false (default), omits internal IDs (IdReal1, IdOnlineReal1, OrderID, …) from columns and exports
   * unless the caller sets this to true (e.g. user explicitly asked for IDs in the result).
   */
  showTechnicalIdColumns?: boolean;
  /** Extra classes on the outer wrapper */
  className?: string;
  /** Classes for the bordered table frame (default: border rounded-lg overflow-hidden) */
  tableFrameClassName?: string;
  /** Search input placeholder */
  searchPlaceholder?: string;
  /** Notified when the user changes rows-per-page (for sharing page size across report views). */
  onPageSizeChange?: (size: number) => void;
  /** Optional tooltip on the Excel button (e.g. full-dataset export hint). */
  exportExcelTooltip?: string;
  /** When true, Excel button label uses `exportFullReport` instead of `exportExcel`. */
  exportLabelFullReport?: boolean;
}

export function DataTable({
  data,
  title,
  searchable = true,
  exportable = true,
  pageSize = 15,
  showTotals = true,
  showTechnicalIdColumns = false,
  className,
  tableFrameClassName,
  searchPlaceholder,
  onPageSizeChange: onPageSizeChangeProp,
  exportExcelTooltip,
  exportLabelFullReport = false,
}: DataTableProps) {
  const { t } = useLocale();
  const [exportingExcel, setExportingExcel] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const visibleKeys = useMemo(() => {
    if (!data.length) return [] as string[];
    const keys = Object.keys(data[0]);
    const filtered = showTechnicalIdColumns
      ? keys
      : keys.filter((k) => !isTechnicalIdColumnKey(k));
    return orderKeysItemCodeBeforeItemName(filtered);
  }, [data, showTechnicalIdColumns]);

  const tableData = useMemo(() => {
    if (!data.length || visibleKeys.length === 0) return [] as Record<string, unknown>[];
    return data.map((row) => {
      const out: Record<string, unknown> = {};
      for (const k of visibleKeys) out[k] = row[k];
      return out;
    });
  }, [data, visibleKeys]);

  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    if (!tableData.length) return [];
    return Object.keys(tableData[0]).map((key) => ({
      accessorKey: key,
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 -ml-2 font-semibold"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          {key}
          <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      cell: ({ getValue, column }) => (
        <span
          className={cn(
            "text-sm",
            isLonLatColumnKey(column.id) && "font-mono tabular-nums",
          )}
        >
          {formatTableCellDisplay(getValue(), column.id)}
        </span>
      ),
    }));
  }, [tableData]);

  const initialPageSize = coercePageSize(pageSize);

  const table = useReactTable({
    data: tableData,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: { pagination: { pageSize: initialPageSize } },
  });

  useEffect(() => {
    const next = coercePageSize(pageSize);
    if (table.getState().pagination.pageSize !== next) {
      table.setPageSize(next);
      table.setPageIndex(0);
    }
  }, [pageSize, table]);

  /** Full filtered dataset for export — not paginated, not viewport-limited. */
  const allFilteredRowsForExport = table.getFilteredRowModel().rows.map((r) => r.original);
  const columnKeys = tableData.length ? Object.keys(tableData[0]) : [];
  const columnTotals = showTotals
    ? computeColumnTotals(columnKeys, allFilteredRowsForExport)
    : null;
  const hasAnyTotal =
    columnTotals && Object.values(columnTotals).some((v) => v !== null);

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        {t("noData")}
      </div>
    );
  }

  if (!visibleKeys.length) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        {t("noData")}
      </div>
    );
  }

  const searchPh = searchPlaceholder ?? "Search...";

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {searchable && (
          <Input
            placeholder={searchPh}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="max-w-xs h-9"
          />
        )}
        <div className="flex flex-wrap items-center gap-2 ml-auto">
          {exportable && (
            <>
              <Button
                variant="default"
                size="sm"
                disabled={exportingExcel}
                title={exportExcelTooltip}
                onClick={() => {
                  void (async () => {
                    setExportingExcel(true);
                    try {
                      await downloadExcelFromRows(allFilteredRowsForExport, title || "export", {
                        sheetName: (title || "data").replace(/[/\\?%*:[\]]/g, "-").slice(0, 31),
                        totals: showTotals ? columnTotals : null,
                        totalLabel: t("tableTotal"),
                      });
                    } catch (e) {
                      console.error(e);
                    } finally {
                      setExportingExcel(false);
                    }
                  })();
                }}
                className="h-9 shadow-sm"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
                {exportingExcel
                  ? t("loading")
                  : exportLabelFullReport
                    ? t("exportFullReport")
                    : t("exportExcel")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadCsvFromRows(allFilteredRowsForExport, title || "export", {
                    totals: showTotals ? columnTotals : null,
                    totalLabel: t("tableTotal"),
                  })
                }
                className="h-9"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                {t("exportCsv")}
              </Button>
            </>
          )}
        </div>
      </div>

      <div
        className={cn(
          "overflow-hidden rounded-lg border",
          tableFrameClassName,
        )}
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="whitespace-nowrap bg-muted/50">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/30">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="whitespace-nowrap">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
            {hasAnyTotal && columnTotals && (
              <TableFooter>
                <TableRow className="hover:bg-muted/50">
                  {table.getHeaderGroups()[0]?.headers.map((header, colIndex) => {
                    const key = header.column.id;
                    const total = columnTotals[key];
                    return (
                      <TableCell key={header.id} className="whitespace-nowrap py-2">
                        {total !== null && total !== undefined ? (
                          <span className="text-sm font-semibold tabular-nums">
                            {formatTableCellDisplay(total, key)}
                          </span>
                        ) : colIndex === 0 ? (
                          <span className="text-sm font-semibold">{t("tableTotal")}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      </div>

      <ReportPaginationBar
        totalRowCount={table.getFilteredRowModel().rows.length}
        pageSize={table.getState().pagination.pageSize}
        pageIndex={table.getState().pagination.pageIndex}
        pageCount={table.getPageCount()}
        onPageSizeChange={(size) => {
          table.setPageSize(size);
          table.setPageIndex(0);
          onPageSizeChangeProp?.(size);
        }}
        onPreviousPage={() => table.previousPage()}
        onNextPage={() => table.nextPage()}
        canPreviousPage={table.getCanPreviousPage()}
        canNextPage={table.getCanNextPage()}
        t={t}
      />
    </div>
  );
}
