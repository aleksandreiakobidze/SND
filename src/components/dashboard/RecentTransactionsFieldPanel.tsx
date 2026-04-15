"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getDefaultMatrixPrefs, type RecentTransactionsLayoutPrefs } from "@/lib/dashboard-layout";
import {
  RECENT_TX_VALUE_META,
  type AggregationType,
  RECENT_TRANSACTIONS_COLUMN_IDS,
  RECENT_TX_COLUMN_LABEL_KEY,
  type RecentTransactionsColumnId,
} from "@/lib/recent-transactions-columns";
import {
  RT_ZONE_COLS,
  RT_ZONE_ROWS,
  RT_ZONE_TABLE,
  RT_ZONE_VALUES,
  removeFieldFromMatrix,
  removeFieldFromTable,
} from "@/lib/recent-transactions-prefs-ops";
import type { TranslationKey } from "@/lib/i18n";
import { GripVertical, X } from "lucide-react";

const RT_PREFIX = {
  field: "rtf:",
  table: "rtt:",
  row: "rtr:",
  col: "rtc:",
  value: "rtv:",
} as const;

type Props = {
  prefs: RecentTransactionsLayoutPrefs;
  onPrefsChange: (next: RecentTransactionsLayoutPrefs) => void;
  onMatrixValueAggregationChange?: (valueId: RecentTransactionsColumnId, aggregation: AggregationType) => void;
  canCustomize: boolean;
  t: (key: TranslationKey) => string;
};

export function RecentTransactionsFieldPanel({
  prefs,
  onPrefsChange,
  onMatrixValueAggregationChange,
  canCustomize,
  t,
}: Props) {
  const view = prefs.viewMode ?? "table";
  const matrix = prefs.matrix ?? getDefaultMatrixPrefs();
  const matrixAssigned = new Set<RecentTransactionsColumnId>([
    ...matrix.rowIds,
    ...matrix.columnIds,
    ...matrix.valueIds,
  ]);

  const paletteTable = prefs.hiddenColumnIds;
  const paletteMatrix = RECENT_TRANSACTIONS_COLUMN_IDS.filter((id) => !matrixAssigned.has(id));

  return (
    <div className="space-y-3 rounded-xl border border-border/80 bg-card/40 p-3 shadow-sm backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-tight">{t("rtFieldsTitle")}</h3>
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant={view === "table" ? "default" : "outline"}
            className="h-8"
            disabled={!canCustomize}
            onClick={() => onPrefsChange({ ...prefs, viewMode: "table", matrix: prefs.matrix ?? getDefaultMatrixPrefs() })}
          >
            {t("rtViewTable")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={view === "matrix" ? "default" : "outline"}
            className="h-8"
            disabled={!canCustomize}
            onClick={() => onPrefsChange({ ...prefs, viewMode: "matrix", matrix: prefs.matrix ?? getDefaultMatrixPrefs() })}
          >
            {t("rtViewMatrix")}
          </Button>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{t("rtFieldsHint")}</p>

      <div>
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t("rtFieldsTitle")}</p>
        <div className="flex min-h-[2.25rem] flex-wrap gap-1.5 rounded-md border border-dashed border-border/90 bg-muted/20 p-2">
          {view === "table"
            ? paletteTable.map((id) => <PaletteChip key={id} id={id} disabled={!canCustomize} t={t} />)
            : paletteMatrix.map((id) => <PaletteChip key={id} id={id} disabled={!canCustomize} t={t} />)}
          {(view === "table" ? paletteTable : paletteMatrix).length === 0 ? (
            <span className="text-xs text-muted-foreground">{t("noData")}</span>
          ) : null}
        </div>
      </div>

      {view === "table" ? (
        <DropZoneTable label={t("rtDropTableColumns")} zoneId={RT_ZONE_TABLE} disabled={!canCustomize}>
          <SortableContext items={prefs.columnOrder.map((id) => `${RT_PREFIX.table}${id}`)} strategy={horizontalListSortingStrategy}>
            <div className="flex min-h-[2.5rem] flex-wrap gap-1.5">
              {prefs.columnOrder.map((id) => (
                <SortableZoneChip
                  key={id}
                  slot={`${RT_PREFIX.table}${id}`}
                  label={t(RECENT_TX_COLUMN_LABEL_KEY[id])}
                  disabled={!canCustomize}
                  removeLabel={t("rtRemoveField")}
                  onRemove={
                    prefs.columnOrder.length > 1
                      ? () => onPrefsChange(removeFieldFromTable(prefs, id))
                      : undefined
                  }
                />
              ))}
            </div>
          </SortableContext>
        </DropZoneTable>
      ) : (
        <div className="space-y-2">
          <DropZoneMatrix label={t("rtDropRows")} zoneId={RT_ZONE_ROWS} disabled={!canCustomize}>
            <SortableContext items={matrix.rowIds.map((id) => `${RT_PREFIX.row}${id}`)} strategy={horizontalListSortingStrategy}>
              <div className="flex min-h-[2.25rem] flex-wrap gap-1.5">
                {matrix.rowIds.map((id) => (
                  <SortableZoneChip
                    key={id}
                    slot={`${RT_PREFIX.row}${id}`}
                    label={t(RECENT_TX_COLUMN_LABEL_KEY[id])}
                    disabled={!canCustomize}
                    removeLabel={t("rtRemoveField")}
                    onRemove={() => onPrefsChange(removeFieldFromMatrix(prefs, id))}
                  />
                ))}
              </div>
            </SortableContext>
          </DropZoneMatrix>
          <DropZoneMatrix label={t("rtDropColumns")} zoneId={RT_ZONE_COLS} disabled={!canCustomize}>
            <SortableContext items={matrix.columnIds.map((id) => `${RT_PREFIX.col}${id}`)} strategy={horizontalListSortingStrategy}>
              <div className="flex min-h-[2.25rem] flex-wrap gap-1.5">
                {matrix.columnIds.map((id) => (
                  <SortableZoneChip
                    key={id}
                    slot={`${RT_PREFIX.col}${id}`}
                    label={t(RECENT_TX_COLUMN_LABEL_KEY[id])}
                    disabled={!canCustomize}
                    removeLabel={t("rtRemoveField")}
                    onRemove={() => onPrefsChange(removeFieldFromMatrix(prefs, id))}
                  />
                ))}
              </div>
            </SortableContext>
          </DropZoneMatrix>
          <DropZoneMatrix label={t("rtDropValues")} zoneId={RT_ZONE_VALUES} disabled={!canCustomize}>
            <SortableContext items={matrix.valueIds.map((id) => `${RT_PREFIX.value}${id}`)} strategy={horizontalListSortingStrategy}>
              <div className="flex min-h-[2.25rem] flex-wrap gap-1.5">
                {matrix.valueIds.map((id) => (
                  <SortableZoneChip
                    key={id}
                    slot={`${RT_PREFIX.value}${id}`}
                    label={t(RECENT_TX_COLUMN_LABEL_KEY[id])}
                    trailingControl={
                      onMatrixValueAggregationChange && RECENT_TX_VALUE_META[id] ? (
                        <select
                          className="h-6 rounded border bg-background px-1 text-[10px]"
                          value={
                            matrix.valueDefs?.find((d) => d.valueId === id)?.aggregation ??
                            RECENT_TX_VALUE_META[id]?.defaultAggregation ??
                            "sum"
                          }
                          onChange={(e) =>
                            onMatrixValueAggregationChange(
                              id,
                              e.target.value as AggregationType,
                            )
                          }
                          onPointerDown={(e) => e.stopPropagation()}
                          disabled={!canCustomize}
                          aria-label={t("rtAggregation")}
                          title={t("rtAggregation")}
                        >
                          {(RECENT_TX_VALUE_META[id]?.allowedAggregations ?? ["sum"]).map((agg) => (
                            <option key={agg} value={agg}>
                              {t(
                                agg === "sum"
                                  ? "rtAggSum"
                                  : agg === "count"
                                    ? "rtAggCount"
                                    : agg === "distinct_count"
                                      ? "rtAggDistinctCount"
                                      : agg === "avg"
                                        ? "rtAggAvg"
                                        : agg === "min"
                                          ? "rtAggMin"
                                          : "rtAggMax",
                              )}
                            </option>
                          ))}
                        </select>
                      ) : null
                    }
                    disabled={!canCustomize}
                    removeLabel={t("rtRemoveField")}
                    onRemove={
                      matrix.valueIds.length > 1
                        ? () => onPrefsChange(removeFieldFromMatrix(prefs, id))
                        : undefined
                    }
                  />
                ))}
              </div>
            </SortableContext>
          </DropZoneMatrix>
        </div>
      )}
    </div>
  );
}

function PaletteChip({
  id,
  disabled,
  t,
}: {
  id: RecentTransactionsColumnId;
  disabled: boolean;
  t: (key: TranslationKey) => string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${RT_PREFIX.field}${id}`,
    disabled,
  });
  const style = { transform: CSS.Translate.toString(transform) };
  return (
    <button
      type="button"
      ref={setNodeRef}
      style={style}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border bg-secondary/60 px-2 py-1 text-xs font-medium shadow-sm",
        "touch-none hover:bg-secondary",
        isDragging && "z-50 opacity-70 ring-2 ring-primary/40",
        disabled && "pointer-events-none opacity-50",
      )}
      {...listeners}
      {...attributes}
    >
      <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
      {t(RECENT_TX_COLUMN_LABEL_KEY[id])}
    </button>
  );
}

function DropZoneTable({
  label,
  zoneId,
  disabled,
  children,
}: {
  label: string;
  zoneId: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: zoneId, disabled });
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div
        ref={setNodeRef}
        className={cn(
          "rounded-md border border-border/90 bg-muted/15 p-2 transition-colors",
          isOver && "border-primary/50 bg-primary/5",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function DropZoneMatrix({
  label,
  zoneId,
  disabled,
  children,
}: {
  label: string;
  zoneId: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: zoneId, disabled });
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div
        ref={setNodeRef}
        className={cn(
          "rounded-md border border-border/90 bg-muted/15 p-2 transition-colors",
          isOver && "border-primary/50 bg-primary/5",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function SortableZoneChip({
  slot,
  label,
  trailingControl,
  disabled,
  onRemove,
  removeLabel,
}: {
  slot: string;
  label: string;
  trailingControl?: React.ReactNode;
  disabled: boolean;
  onRemove?: () => void;
  removeLabel: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slot, disabled });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const showRemove = Boolean(onRemove) && !disabled;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "inline-flex max-w-full items-center gap-0.5 rounded-md border border-input bg-background py-1 pl-1 pr-0.5 text-xs font-medium shadow-sm",
        isDragging && "z-50 opacity-80 ring-2 ring-primary/30",
      )}
    >
      <button type="button" className="cursor-grab touch-none shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground" {...attributes} {...listeners}>
        <GripVertical className="h-3 w-3" aria-hidden />
      </button>
      <span className="min-w-0 flex-1 truncate px-0.5">{label}</span>
      {trailingControl ? <div className="shrink-0 px-0.5">{trailingControl}</div> : null}
      {showRemove ? (
        <button
          type="button"
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
          aria-label={removeLabel}
          title={removeLabel}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
