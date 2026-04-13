"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { DollarSign, GripVertical, ShoppingCart, TrendingUp, Users } from "lucide-react";
import { KPICard } from "@/components/dashboard/KPICard";
import { ChartWrapper, type ChartMeasure } from "@/components/charts/ChartWrapper";
import { FlexChart, type ChartVariant } from "@/components/charts/FlexChart";
import { RecentTransactionsTable } from "@/components/dashboard/RecentTransactionsTable";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/locale-context";
import { formatCurrency } from "@/lib/formatCurrency";
import { formatLiters } from "@/lib/formatLiters";
import {
  type DashboardChartWidgetId,
  type DashboardLayout,
  type DashboardWidgetId,
  type RecentTransactionsLayoutPrefs,
  buildDashboardSegments,
  getDefaultDashboardLayout,
  mergeRemoteDashboardLayout,
  getDefaultRecentTransactionsLayoutPrefs,
} from "@/lib/dashboard-layout";
import type { FilterField } from "@/lib/filters";
import type { DashboardData } from "@/types";
import type { TranslationKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const DASH_PREFIX = "dash:";

function dashId(id: DashboardWidgetId): string {
  return `${DASH_PREFIX}${id}`;
}

function stripDashId(s: string): string {
  return s.startsWith(DASH_PREFIX) ? s.slice(DASH_PREFIX.length) : s;
}

function SortableWidgetShell({
  widgetId,
  canDrag,
  children,
}: {
  widgetId: DashboardWidgetId;
  canDrag: boolean;
  children: React.ReactNode;
}) {
  const { t } = useLocale();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: dashId(widgetId),
    disabled: !canDrag,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("min-w-0", isDragging && "z-50 opacity-80")}
    >
      <div className={cn("flex gap-2", canDrag && "items-start")}>
        {canDrag ? (
          <button
            type="button"
            className="mt-1 cursor-grab touch-none shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
            {...attributes}
            {...listeners}
            aria-label={t("dashboardDragHandle")}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

type Props = {
  data: DashboardData | null;
  loading: boolean;
  t: (key: TranslationKey) => string;
  toggleCrossFilter: (field: FilterField, value: string) => void;
  getCrossFilterValue: (field: FilterField) => string | undefined;
};

export function DashboardWidgets({ data, loading, t, toggleCrossFilter, getCrossFilterValue }: Props) {
  const { user } = useAuth();
  const canDrag = Boolean(user);
  const [layout, setLayout] = useState<DashboardLayout>(() => getDefaultDashboardLayout());
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    if (!user) {
      setLayout(getDefaultDashboardLayout());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/dashboard-layout", { credentials: "include" });
        const json = (await res.json()) as { layout?: DashboardLayout | null };
        if (!cancelled && res.ok) {
          setLayout(mergeRemoteDashboardLayout(json.layout ?? null));
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const persistNow = useCallback(
    async (next: DashboardLayout) => {
      if (!user) return;
      setLayoutError(null);
      const res = await fetch("/api/dashboard-layout", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; details?: string };
      if (!res.ok) {
        const msg =
          body.details != null && body.details !== ""
            ? `${body.error ?? t("dashboardLayoutSaveFailed")}: ${body.details}`
            : body.error ?? t("dashboardLayoutSaveFailed");
        setLayoutError(msg);
        try {
          const again = await fetch("/api/dashboard-layout", { credentials: "include" });
          const j = (await again.json()) as { layout?: DashboardLayout | null };
          if (again.ok) setLayout(mergeRemoteDashboardLayout(j.layout ?? null));
        } catch {
          setLayout(getDefaultDashboardLayout());
        }
      }
    },
    [user, t],
  );

  const schedulePersist = useCallback(
    (next: DashboardLayout) => {
      if (!user) return;
      if (persistTimer.current) clearTimeout(persistTimer.current);
      persistTimer.current = setTimeout(() => {
        persistTimer.current = null;
        void persistNow(next);
      }, 300);
    },
    [user, persistNow],
  );

  useEffect(
    () => () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    },
    [],
  );

  const onDragEnd = (event: DragEndEvent) => {
    if (!canDrag) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const a = stripDashId(String(active.id)) as DashboardWidgetId;
    const o = stripDashId(String(over.id)) as DashboardWidgetId;
    const oldIndex = layout.order.indexOf(a);
    const newIndex = layout.order.indexOf(o);
    if (oldIndex === -1 || newIndex === -1) return;
    const order = arrayMove(layout.order, oldIndex, newIndex);
    const next = { ...layout, order };
    setLayout(next);
    if (persistTimer.current) {
      clearTimeout(persistTimer.current);
      persistTimer.current = null;
    }
    void persistNow(next);
  };

  const def = getDefaultDashboardLayout();

  const variantFor = (id: DashboardChartWidgetId): ChartVariant =>
    layout.variants[id] ?? def.variants[id] ?? "bar";

  const measureFor = (id: DashboardChartWidgetId): ChartMeasure => layout.measureByChart[id] ?? "money";

  const setVariant = (id: DashboardChartWidgetId, v: ChartVariant) => {
    setLayout((prev) => {
      const next = { ...prev, variants: { ...prev.variants, [id]: v } };
      schedulePersist(next);
      return next;
    });
  };

  const setMeasure = (id: DashboardChartWidgetId, m: ChartMeasure) => {
    setLayout((prev) => {
      const next = { ...prev, measureByChart: { ...prev.measureByChart, [id]: m } };
      schedulePersist(next);
      return next;
    });
  };

  const sortableIds = layout.order.map(dashId);

  const updateRecentTransactionsPrefs = useCallback(
    (next: RecentTransactionsLayoutPrefs) => {
      setLayout((prev) => {
        const merged: DashboardLayout = { ...prev, recentTransactions: next };
        schedulePersist(merged);
        return merged;
      });
    },
    [schedulePersist],
  );

  const renderKpi = (id: DashboardWidgetId) => {
    if (id === "kpi-total-revenue") {
      return (
        <KPICard
          title={t("totalRevenue")}
          value={data ? formatCurrency(Number(data.kpis.totalRevenue)) : ""}
          icon={DollarSign}
          loading={loading}
        />
      );
    }
    if (id === "kpi-total-orders") {
      return (
        <KPICard
          title={t("totalOrders")}
          value={data ? Number(data.kpis.totalOrders).toLocaleString() : ""}
          icon={ShoppingCart}
          loading={loading}
        />
      );
    }
    if (id === "kpi-avg-order-value") {
      return (
        <KPICard
          title={t("avgOrderValue")}
          value={data ? formatCurrency(Number(data.kpis.avgOrderValue)) : ""}
          icon={TrendingUp}
          loading={loading}
        />
      );
    }
    if (id === "kpi-active-customers") {
      return (
        <KPICard
          title={t("activeCustomers")}
          value={data ? Number(data.kpis.activeCustomers).toLocaleString() : ""}
          icon={Users}
          loading={loading}
        />
      );
    }
    return null;
  };

  const renderChart = (id: DashboardChartWidgetId) => {
    const v = variantFor(id);
    const m = measureFor(id);
    if (id === "chart-revenue-by-region") {
      return (
        <ChartWrapper
          title={t("revenueByRegion")}
          loading={loading}
          chartMeasure={m}
          onChartMeasureChange={(nm) => setMeasure(id, nm)}
          chartMeasureTitle={t("chartMeasureTitle")}
          chartMeasureMoneyLabel={t("chartMeasureMoney")}
          chartMeasureLitersLabel={t("chartMeasureLiters")}
          variants={["bar", "pie", "horizontal-bar"]}
          activeVariant={v}
          onVariantChange={(nv) => setVariant(id, nv)}
        >
          {data && (
            <FlexChart
              data={m === "money" ? data.revenueByRegion : data.litersByRegion}
              variant={v}
              formatter={m === "money" ? formatCurrency : formatLiters}
              tooltipLabel={m === "money" ? t("revenue") : t("liters")}
              onElementClick={(name) => toggleCrossFilter("region", name)}
              highlightValue={getCrossFilterValue("region")}
            />
          )}
        </ChartWrapper>
      );
    }
    if (id === "chart-sales-by-category") {
      return (
        <ChartWrapper
          title={t("salesByCategory")}
          loading={loading}
          chartMeasure={m}
          onChartMeasureChange={(nm) => setMeasure(id, nm)}
          chartMeasureTitle={t("chartMeasureTitle")}
          chartMeasureMoneyLabel={t("chartMeasureMoney")}
          chartMeasureLitersLabel={t("chartMeasureLiters")}
          variants={["pie", "bar", "horizontal-bar"]}
          activeVariant={v}
          onVariantChange={(nv) => setVariant(id, nv)}
        >
          {data && (
            <FlexChart
              data={m === "money" ? data.salesByCategory : data.litersBySalesCategory}
              variant={v}
              formatter={m === "money" ? formatCurrency : formatLiters}
              tooltipLabel={m === "money" ? t("revenue") : t("liters")}
              onElementClick={(name) => toggleCrossFilter("category", name)}
              highlightValue={getCrossFilterValue("category")}
            />
          )}
        </ChartWrapper>
      );
    }
    if (id === "chart-daily-trend") {
      return (
        <ChartWrapper
          title={t("dailyTrend")}
          loading={loading}
          chartMeasure={m}
          onChartMeasureChange={(nm) => setMeasure(id, nm)}
          chartMeasureTitle={t("chartMeasureTitle")}
          chartMeasureMoneyLabel={t("chartMeasureMoney")}
          chartMeasureLitersLabel={t("chartMeasureLiters")}
          variants={["area", "line", "bar"]}
          activeVariant={v}
          onVariantChange={(nv) => setVariant(id, nv)}
        >
          {data && (
            <FlexChart
              data={data.dailyTrend}
              variant={v}
              valueKeys={[
                m === "money"
                  ? { key: "Revenue", label: t("revenue"), color: "hsl(220, 70%, 55%)" }
                  : { key: "Liters", label: t("liters"), color: "hsl(220, 70%, 55%)" },
              ]}
              formatter={m === "money" ? formatCurrency : formatLiters}
              colorful={false}
            />
          )}
        </ChartWrapper>
      );
    }
    return null;
  };

  const renderOne = (id: DashboardWidgetId) => {
    if (id.startsWith("kpi-")) {
      return (
        <SortableWidgetShell key={id} widgetId={id} canDrag={canDrag}>
          {renderKpi(id)}
        </SortableWidgetShell>
      );
    }
    if (
      id === "chart-revenue-by-region" ||
      id === "chart-sales-by-category" ||
      id === "chart-daily-trend"
    ) {
      return (
        <SortableWidgetShell key={id} widgetId={id} canDrag={canDrag}>
          {renderChart(id)}
        </SortableWidgetShell>
      );
    }
    if (id === "recent-transactions") {
      return (
        <SortableWidgetShell key={id} widgetId={id} canDrag={canDrag}>
          <div className="space-y-4">
            <h2 className="text-lg font-semibold tracking-tight">{t("recentTransactions")}</h2>
            <RecentTransactionsTable
              data={data?.recentTransactions ?? null}
              loading={loading}
              prefs={layout.recentTransactions ?? getDefaultRecentTransactionsLayoutPrefs()}
              onPrefsChange={updateRecentTransactionsPrefs}
              canCustomize={canDrag}
              t={t}
            />
          </div>
        </SortableWidgetShell>
      );
    }
    return null;
  };

  const segments = buildDashboardSegments(layout.order);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-8">
          {layoutError ? <p className="text-sm text-destructive">{layoutError}</p> : null}
          {segments.map((seg, idx) => {
            if (seg.type === "kpi-run") {
              return (
                <div
                  key={`kpi-run-${idx}`}
                  className={cn(
                    "grid gap-4",
                    seg.ids.length >= 4
                      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
                      : seg.ids.length === 3
                        ? "grid-cols-1 sm:grid-cols-3"
                        : seg.ids.length === 2
                          ? "grid-cols-1 sm:grid-cols-2"
                          : "grid-cols-1",
                  )}
                >
                  {seg.ids.map((id) => renderOne(id))}
                </div>
              );
            }
            if (seg.type === "chart-pair") {
              return (
                <div
                  key={`chart-pair-${idx}`}
                  className="grid grid-cols-1 gap-4 lg:grid-cols-2"
                >
                  {seg.ids.map((id) => renderOne(id))}
                </div>
              );
            }
            return <div key={seg.id}>{renderOne(seg.id)}</div>;
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}
