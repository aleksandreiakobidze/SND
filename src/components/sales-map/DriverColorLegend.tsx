"use client";

import { useLocale } from "@/lib/locale-context";
import { driverColor } from "./DistributionPanel";
import type { DriverLoadStats } from "@/lib/distribution/distribution-types";

interface Props {
  driverStats: DriverLoadStats[];
}

export function DriverColorLegend({ driverStats }: Props) {
  const { t } = useLocale();

  if (driverStats.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-foreground"
      role="list"
      aria-label={t("distDriverLegend")}
    >
      <span className="font-medium text-muted-foreground">{t("distDriverLegend")}:</span>
      {driverStats.map((stat, idx) => (
        <span key={stat.driverId} className="inline-flex items-center gap-1.5" role="listitem">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/10"
            style={{ backgroundColor: driverColor(idx) }}
          />
          <span>{stat.driverName} ({stat.orderCount})</span>
        </span>
      ))}
    </div>
  );
}
