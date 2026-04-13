"use client";

import { useCallback, useMemo, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { SortableContext, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type SortingState,
  type ColumnDef,
  type ColumnFiltersState,
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowUpDown, Columns3, Download, ChevronLeft, ChevronRight, FileSpreadsheet, GripVertical } from "lucide-react";
import type { RecentTransactionsLayoutPrefs } from "@/lib/dashboard-layout";
import { getDefaultMatrixPrefs } from "@/lib/dashboard-layout";
import {
  RECENT_TRANSACTIONS_COLUMN_IDS,
  RECENT_TX_COLUMN_LABEL_KEY,
  RECENT_TX_ID_TO_ROW_KEY,
  type RecentTransactionsColumnId,
} from "@/lib/recent-transactions-columns";
import {
  aggregateRecentTransactionsRows,
  filterRecentTransactionsSearch,
} from "@/lib/recent-transactions-aggregate";
import {
  accToValues,
  buildPivotModel,
  sumAccColForPrefix,
  sumAccForFirstDimPrefix,
  type PivotModel,
} from "@/lib/recent-transactions-pivot";
import { computeColumnTotals } from "@/lib/table-totals";
import { downloadCsvFromRows } from "@/lib/export-csv";
import { downloadExcelFromRows } from "@/lib/export-excel";
import { cn } from "@/lib/utils";
import { formatTableCellDisplay, isLonLatColumnKey } from "@/lib/coordinate-format";
import type { TranslationKey } from "@/lib/i18n";
import { RecentTransactionsFieldPanel } from "@/components/dashboard/RecentTransactionsFieldPanel";
import { RecentTransactionsMatrixView } from "@/components/dashboard/RecentTransactionsMatrixView";
import {
  RT_ZONE_COLS,
  RT_ZONE_ROWS,
  RT_ZONE_TABLE,
  RT_ZONE_VALUES,
  addFieldToMatrixZone,
  addFieldToTableColumns,
  moveMatrixFieldBetweenZones,
  parseRtDndField,
  parseRtSlot,
  removeFieldFromMatrix,
  removeFieldFromTable,
  reorderMatrixZone,
  reorderTableColumns,
} from "@/lib/recent-transactions-prefs-ops";

const RT_TABLE_SLOT = "rtt:";

function rtTableSlotId(id: RecentTransactionsColumnId): string {
  return `${RT_TABLE_SLOT}${id}`;
}

function SortableTableHead({
  colId,
  canDrag,
  children,
}: {
  colId: RecentTransactionsColumnId;
  canDrag: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: rtTableSlotId(colId),
    disabled: !canDrag,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <TableHead
      ref={setNodeRef}
      style={style}
      className={cn("whitespace-nowrap bg-muted/50", isDragging && "z-50 opacity-80")}
    >
      <div className="flex items-center gap-1">
        {canDrag ? (
          <button
            type="button"
            className="cursor-grab touch-none shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
            {...attributes}
            {...listeners}
            aria-label="Reorder column"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </TableHead>
  );
}

type Props = {
  data: Record<string, unknown>[] | null;
  loading: boolean;
  prefs: RecentTransactionsLayoutPrefs;
  onPrefsChange: (next: RecentTransactionsLayoutPrefs) => void;
  canCustomize: boolean;
  t: (key: TranslationKey) => string;
};

export function RecentTransactionsTable({
  data,
  loading,
  prefs,
  onPrefsChange,
  canCustomize,
  t,
}: Props) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [columnMenuError, setColumnMenuError] = useState<string | null>(null);
  const pageSize = 10;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const { locale: appLocale } = useLocale();
  const pivotLocale = appLocale === "ka" ? "ka-GE" : "en-US";

  const viewMode = prefs.viewMode ?? "table";
  const matrix = prefs.matrix ?? getDefaultMatrixPrefs();
  const visibleIds = prefs.columnOrder;
  const hiddenSet = useMemo(() => new Set(prefs.hiddenColumnIds), [prefs.hiddenColumnIds]);
  const shouldGroup = viewMode === "table" && prefs.hiddenColumnIds.length > 0;

  const rowKeysInOrder = useMemo(
    () => visibleIds.map((id) => RECENT_TX_ID_TO_ROW_KEY[id]),
    [visibleIds],
  );

  const searchFilteredRows = useMemo(
    () => filterRecentTransactionsSearch(data ?? [], searchQuery),
    [data, searchQuery],
  );

  const pivotModel = useMemo(() => {
    if (viewMode !== "matrix") return null;
    const v = matrix.valueIds?.length ? matrix.valueIds : (["liter"] as RecentTransactionsColumnId[]);
    return buildPivotModel(searchFilteredRows, matrix.rowIds, matrix.columnIds, v, { locale: pivotLocale });
  }, [viewMode, searchFilteredRows, matrix.rowIds, matrix.columnIds, matrix.valueIds, pivotLocale]);

  const tableData = useMemo(() => {
    if (viewMode === "matrix") return [] as Record<string, unknown>[];
    if (!searchFilteredRows.length) return [] as Record<string, unknown>[];
    if (shouldGroup) {
      return aggregateRecentTransactionsRows(searchFilteredRows, visibleIds);
    }
    return searchFilteredRows.map((row) => {
      const out: Record<string, unknown> = {};
      for (const id of visibleIds) {
        const rk = RECENT_TX_ID_TO_ROW_KEY[id];
        out[rk] = row[rk];
      }
      return out;
    });
  }, [viewMode, searchFilteredRows, shouldGroup, visibleIds]);

  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    if (!visibleIds.length || viewMode === "matrix") return [];
    return visibleIds.map((colId) => {
      const key = RECENT_TX_ID_TO_ROW_KEY[colId];
      const labelKey = RECENT_TX_COLUMN_LABEL_KEY[colId];
      return {
        id: colId,
        accessorKey: key,
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-1 -ml-1 font-semibold"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            {t(labelKey)}
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
      };
    });
  }, [visibleIds, t, viewMode]);

  const table = useReactTable({
    data: tableData,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  const filteredOriginals = table.getPrePaginationRowModel().rows.map((r) => r.original);
  const columnTotals = useMemo(
    () => computeColumnTotals(rowKeysInOrder, filteredOriginals),
    [rowKeysInOrder, filteredOriginals],
  );
  const hasAnyTotal = columnTotals && Object.values(columnTotals).some((v) => v !== null);

  const exportRows = useMemo(() => {
    if (viewMode === "matrix" && pivotModel) {
      return pivotExportRows(pivotModel, t);
    }
    return filteredOriginals.map((row) => {
      const out: Record<string, unknown> = {};
      for (const id of visibleIds) {
        const rk = RECENT_TX_ID_TO_ROW_KEY[id];
        out[rk] = row[rk];
      }
      return out;
    });
  }, [filteredOriginals, visibleIds, viewMode, pivotModel, t]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!canCustomize) return;
      const { active, over } = event;
      if (!over) return;
      const aid = String(active.id);
      const oid = String(over.id);

      const paletteField = parseRtDndField(aid);
      if (paletteField) {
        if (oid === RT_ZONE_TABLE) {
          onPrefsChange(addFieldToTableColumns(prefs, paletteField));
          return;
        }
        if (oid === RT_ZONE_ROWS) {
          onPrefsChange(addFieldToMatrixZone(prefs, paletteField, "rows"));
          return;
        }
        if (oid === RT_ZONE_COLS) {
          onPrefsChange(addFieldToMatrixZone(prefs, paletteField, "columns"));
          return;
        }
        if (oid === RT_ZONE_VALUES) {
          onPrefsChange(addFieldToMatrixZone(prefs, paletteField, "values"));
          return;
        }
        return;
      }

      const aSlot = parseRtSlot(aid);
      const oSlot = parseRtSlot(oid);
      if (aSlot && oSlot && aSlot.zone === oSlot.zone) {
        if (aSlot.zone === "table") {
          onPrefsChange(reorderTableColumns(prefs, aSlot.id, oSlot.id));
          return;
        }
        if (aSlot.zone === "rows") {
          onPrefsChange(reorderMatrixZone(prefs, "rows", aSlot.id, oSlot.id));
          return;
        }
        if (aSlot.zone === "cols") {
          onPrefsChange(reorderMatrixZone(prefs, "columns", aSlot.id, oSlot.id));
          return;
        }
        if (aSlot.zone === "values") {
          onPrefsChange(reorderMatrixZone(prefs, "values", aSlot.id, oSlot.id));
          return;
        }
      }

      if (aSlot && !oSlot) {
        if (oid === RT_ZONE_ROWS) {
          onPrefsChange(moveMatrixFieldBetweenZones(prefs, aSlot.id, "rows"));
          return;
        }
        if (oid === RT_ZONE_COLS) {
          onPrefsChange(moveMatrixFieldBetweenZones(prefs, aSlot.id, "columns"));
          return;
        }
        if (oid === RT_ZONE_VALUES) {
          onPrefsChange(moveMatrixFieldBetweenZones(prefs, aSlot.id, "values"));
          return;
        }
        if (oid === RT_ZONE_TABLE && aSlot.zone !== "table") {
          onPrefsChange(addFieldToTableColumns(removeFieldFromMatrix(prefs, aSlot.id), aSlot.id));
          return;
        }
      }
    },
    [canCustomize, onPrefsChange, prefs],
  );

  function toggleColumnVisibility(id: RecentTransactionsColumnId) {
    setColumnMenuError(null);
    const { columnOrder, hiddenColumnIds } = prefs;
    const hidden = new Set(hiddenColumnIds);
    if (hidden.has(id)) {
      hidden.delete(id);
      onPrefsChange({
        ...prefs,
        columnOrder: [...columnOrder, id],
        hiddenColumnIds: [...hidden],
      });
    } else {
      if (columnOrder.length <= 1) {
        setColumnMenuError(t("rtColumnMustKeepOne"));
        return;
      }
      onPrefsChange({
        ...prefs,
        columnOrder: columnOrder.filter((c) => c !== id),
        hiddenColumnIds: [...hiddenColumnIds, id],
      });
    }
  }

  const sortableHeaderIds = visibleIds.map(rtTableSlotId);

  if (loading) {
    return <div className="h-64 animate-pulse rounded-lg bg-muted/30" />;
  }

  if (!data?.length) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">{t("noData")}</div>
    );
  }

  if (viewMode === "table" && !visibleIds.length) {
    return <p className="text-sm text-muted-foreground">{t("rtColumnMustKeepOne")}</p>;
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
          {canCustomize ? (
          <div className="relative z-10 w-full shrink-0 xl:sticky xl:top-4 xl:max-w-sm xl:self-start">
            <RecentTransactionsFieldPanel prefs={prefs} onPrefsChange={onPrefsChange} canCustomize={canCustomize} t={t} />
          </div>
        ) : null}

        <div className="relative isolate z-0 min-w-0 flex-1 space-y-3">
          {columnMenuError ? <p className="text-xs text-destructive">{columnMenuError}</p> : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Input
              placeholder={t("rtSearchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 max-w-xs"
            />
            <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
              {canCustomize && viewMode === "table" ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className={cn(
                      "inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm",
                      "hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    )}
                  >
                    <Columns3 className="h-3.5 w-3.5" />
                    {t("rtColumnsMenu")}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 max-h-72 overflow-y-auto">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="text-xs">{t("rtColumnsMenu")}</DropdownMenuLabel>
                      {RECENT_TRANSACTIONS_COLUMN_IDS.map((id) => {
                        const visible = !hiddenSet.has(id);
                        return (
                          <DropdownMenuCheckboxItem
                            key={id}
                            checked={visible}
                            onCheckedChange={() => toggleColumnVisibility(id)}
                          >
                            {t(RECENT_TX_COLUMN_LABEL_KEY[id])}
                          </DropdownMenuCheckboxItem>
                        );
                      })}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
              <Button
                variant="default"
                size="sm"
                className="h-9 shadow-sm"
                onClick={() => {
                  void downloadExcelFromRows(exportRows, "sales_report", {
                    sheetName: "sales_report".slice(0, 31),
                    totals: viewMode === "table" && hasAnyTotal ? columnTotals : null,
                    totalLabel: t("tableTotal"),
                  });
                }}
              >
                <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
                {t("exportExcel")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() =>
                  downloadCsvFromRows(exportRows, "sales_report", {
                    totals: viewMode === "table" && hasAnyTotal ? columnTotals : null,
                    totalLabel: t("tableTotal"),
                  })
                }
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                {t("exportCsv")}
              </Button>
            </div>
          </div>

          {viewMode === "matrix" && pivotModel ? (
            <RecentTransactionsMatrixView model={pivotModel} t={t} />
          ) : viewMode === "matrix" ? (
            <p className="text-sm text-muted-foreground">{t("noData")}</p>
          ) : (
            <>
              <div className="max-h-[min(72vh,920px)] overflow-auto rounded-lg border">
                  <Table>
                      <TableHeader>
                        <TableRow>
                          <SortableContext items={sortableHeaderIds} strategy={horizontalListSortingStrategy}>
                            {table.getHeaderGroups().map((headerGroup) =>
                              headerGroup.headers.map((header) => {
                                const colId = header.column.id as RecentTransactionsColumnId;
                                const canDragCol = canCustomize && visibleIds.length > 1;
                                return (
                                  <SortableTableHead key={header.id} colId={colId} canDrag={canDragCol}>
                                    {header.isPlaceholder
                                      ? null
                                      : flexRender(header.column.columnDef.header, header.getContext())}
                                  </SortableTableHead>
                                );
                              }),
                            )}
                          </SortableContext>
                        </TableRow>
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
                              const colId = header.column.id as RecentTransactionsColumnId;
                              const rk = RECENT_TX_ID_TO_ROW_KEY[colId];
                              const total = columnTotals[rk];
                              return (
                                <TableCell key={header.id} className="whitespace-nowrap py-2">
                                  {total !== null && total !== undefined ? (
                                    <span className="text-sm font-semibold tabular-nums">
                                      {formatTableCellDisplay(total, rk)}
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

              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {table.getPrePaginationRowModel().rows.length} {t("rows")}
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => table.previousPage()}
                      disabled={!table.getCanPreviousPage()}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="px-2 text-xs text-muted-foreground">
                      {table.getState().pagination.pageIndex + 1} / {Math.max(1, table.getPageCount())}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => table.nextPage()}
                      disabled={!table.getCanNextPage()}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </DndContext>
  );
}

function pivotExportRows(model: PivotModel, t: (key: TranslationKey) => string): Record<string, unknown>[] {
  const { rowIds, colKeys, valueIds, displayRows, cells } = model;
  const cks = colKeys.length ? colKeys : ["\u0000"];
  const rows: Record<string, unknown>[] = [];
  for (const dr of displayRows) {
    if (dr.kind === "subtotal") {
      const o: Record<string, unknown> = { Row: `${t("rtSubtotal")} (${dr.label})` };
      for (const ck of cks) {
        const acc = colKeys.length ? sumAccColForPrefix(model, dr.label, ck) : sumAccForFirstDimPrefix(model, dr.label);
        const vals = accToValues(acc, valueIds);
        for (const vid of valueIds) {
          o[`${ck}-${RECENT_TX_ID_TO_ROW_KEY[vid]}`] = vals[vid];
        }
      }
      rows.push(o);
      continue;
    }
    const rk = dr.rowKey;
    const o: Record<string, unknown> = {};
    rowIds.forEach((id, i) => {
      o[t(RECENT_TX_COLUMN_LABEL_KEY[id])] = dr.dimValues[i];
    });
    for (const ck of cks) {
      const rowMap = cells.get(rk);
      const a = rowMap?.get(ck) ?? null;
      const vals = a ? accToValues(a, valueIds) : null;
      for (const vid of valueIds) {
        o[`${ck}-${RECENT_TX_ID_TO_ROW_KEY[vid]}`] = vals?.[vid];
      }
    }
    rows.push(o);
  }
  return rows;
}
